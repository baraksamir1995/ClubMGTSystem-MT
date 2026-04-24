# Production Infrastructure

How CLBY production is deployed, where things live, and how to operate it.

---

## Architecture overview

```
┌──────────────────────────────────────────────────────────────┐
│ Cloudflare DNS → AWS EC2 (ip-172-31-24-199 / 18.135.67.205) │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ Coolify (Traefik proxy + orchestration)              │  │
│   │                                                      │  │
│   │   api.clbyapp.com    → clby-api (Laravel 11)         │  │
│   │   admin.clbyapp.com  → gym-admin (Next.js)           │  │
│   │   clbyapp.com        → clby-landing (Next.js)        │  │
│   │                                                      │  │
│   │   clby-prod-db (Postgres 17, internal only)          │  │
│   │     ↑ Docker volume on root EBS                      │  │
│   │     ↓ Daily backup @ 3am → Cloudflare R2             │  │
│   └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Servers

| Env | Public IP | Internal | Purpose |
|-----|-----------|----------|---------|
| Staging | `18.168.78.234` | `ip-172-31-25-44` | staging.clbyapp.com, api.staging.clbyapp.com |
| Production | `18.135.67.205` | `ip-172-31-24-199` | clbyapp.com, admin.clbyapp.com, api.clbyapp.com |

Both run Coolify + Docker on Ubuntu EC2 instances. Access via AWS EC2 Instance Connect (no SSH key needed — use AWS Console).

---

## Domains / DNS

All A records point to the production server (`18.135.67.205`):

| Domain | Points to | Purpose |
|--------|-----------|---------|
| `clbyapp.com` | prod | Landing page |
| `admin.clbyapp.com` | prod | Admin dashboard |
| `api.clbyapp.com` | prod | Laravel API |
| `staging.clbyapp.com` | staging (`18.168.78.234`) | Staging admin |
| `api.staging.clbyapp.com` | staging | Staging API |

DNS managed in Cloudflare. Records are **DNS only** (grey cloud), not proxied — Traefik handles TLS.

---

## Repositories & branches

| Repo | Branch | Deploys to |
|------|--------|------------|
| `baraksamir1995/ClubMGTSystem` | `claude/init-gym-repos-iLjqx` | Staging |
| `baraksamir1995/ClubMGTSystem-MT` | `main` | Production |

Coolify is connected via GitHub App named `clby-m-t` (install link in GitHub Settings → Applications).

---

## Deployed apps (production)

### clby-api (Laravel 11 + PHP 8.4)

- **Domain**: https://api.clbyapp.com
- **Coolify resource UUID**: `ikc20amfejsm89nzk0z08jcx`
- **Base directory**: `/clby-api`
- **Dockerfile**: `/clby-api/Dockerfile`
- **Port**: 8080
- **CMD**: runs `migrate --force` then `artisan serve`

Key env vars (configured in Coolify → clby-api → Environment Variables):

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.clbyapp.com
DB_CONNECTION=pgsql
DB_HOST=rb9wrr37v598kb2xfeput2k9     # internal container name
DB_DATABASE=clby_prod
DB_USERNAME=clby
DB_PASSWORD=<from Coolify DB resource>
CORS_ALLOWED_ORIGINS=https://admin.clbyapp.com,https://clbyapp.com
SESSION_DOMAIN=.clbyapp.com
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=strict
FILESYSTEM_DISK=s3   # Cloudflare R2
AWS_BUCKET=clby-files
# …see .env.example for the full list
```

### gym-admin (Next.js 15)

- **Domain**: https://admin.clbyapp.com
- **Base directory**: `/gym-admin`
- **Port**: 3000
- **Auth flow**: Next.js server-side API routes at `/api/auth/*` proxy to Laravel

Env vars:

```env
NEXT_PUBLIC_API_URL=https://api.clbyapp.com
BACKEND_URL=https://api.clbyapp.com   # used by Next.js server routes
NODE_ENV=production
```

**Important**: `NEXT_PUBLIC_*` vars must be set at build time. Coolify → Advanced → **Inject Build Args to Dockerfile** must be ✅.

### clby-landing (Next.js)

- **Domain**: https://clbyapp.com
- **Base directory**: `/clby-landing`

---

## Database (production)

- **Container**: `rb9wrr37v598kb2xfeput2k9`
- **Image**: `postgres:17-alpine`
- **Database**: `clby_prod`
- **User**: `clby`
- **Host** (internal): `rb9wrr37v598kb2xfeput2k9` (Docker DNS)
- **Access**: internal only — not exposed publicly

### Schema

Provisioned by dumping staging schema + data once:

```bash
# on staging server
sudo docker exec <staging-db> pg_dump -U postgres -d postgres \
  --clean --if-exists --no-owner --no-privileges > /tmp/dump.sql

# transfer to production, then
sudo docker cp /tmp/staging-dump.sql <prod-db>:/tmp/
sudo docker exec -i <prod-db> psql -U clby -d clby_prod -f /tmp/staging-dump.sql
```

Future schema changes go through Laravel migrations (`database/migrations/`). The Dockerfile runs `php artisan migrate --force` on startup.

### Backups

- **Schedule**: daily at 03:00 UTC
- **Destination**: Cloudflare R2 bucket `clby-files`
- **Path**: `data/coolify/backups/databases/root-team-0/clby-prod-db-rb9wrr37v598kb2xfeput2k9/`
- **Format**: `pg-dump-clby_prod-<timestamp>.dmp` (custom Postgres format)

Configure in Coolify → `clby-prod-db` → **Backups** tab.

---

## Common operations

### SSH to the production server

AWS Console → EC2 → select production instance → **Connect** → **EC2 Instance Connect** tab → Connect.

### View API logs

```bash
sudo docker ps | grep ikc20amfejsm89nzk0z08jcx       # find current container
sudo docker logs <container-name> --tail 50 -f
```

### Run an artisan command

```bash
sudo docker exec -it <clby-api-container> php artisan <command>
```

Example — create a super admin:

```bash
sudo docker exec -it <container> php artisan super-admin:seed \
  --email=foo@example.com --password=... --name="Name"
```

### Reset a user password

```bash
sudo docker exec <container> php artisan tinker --execute="\
  DB::table('profiles')->where('email', 'foo@example.com')\
  ->update(['password' => \Illuminate\Support\Facades\Hash::make('NEW_PASSWORD')]);"
```

### Psql into the database

```bash
sudo docker exec -it rb9wrr37v598kb2xfeput2k9 psql -U clby -d clby_prod
```

### Restore a backup

```bash
# Download the .dmp from R2, then
sudo docker cp backup.dmp <prod-db>:/tmp/
sudo docker exec <prod-db> pg_restore -U clby -d clby_prod --clean --if-exists /tmp/backup.dmp
```

---

## Deployment flow

1. Push to `main` branch of `ClubMGTSystem-MT`
2. Coolify webhook triggers (Auto Deploy is enabled per app)
3. Coolify clones the repo, builds the Docker image, rolling-updates the container
4. For clby-api: migrations run automatically on container start

### Force a rebuild

Coolify often skips rebuild if commit SHA hasn't changed. To force:

1. App → Advanced → check **Disable Build Cache**, save
2. Click **Redeploy**
3. Uncheck **Disable Build Cache** after success

---

## Security notes

- `APP_DEBUG=false` on production — no stack traces exposed
- Security headers set via `SecurityHeaders` middleware (HSTS, CSP, X-Frame-Options, etc.)
- `X-Powered-By` stripped (both in middleware and via `expose_php = Off` in php.ini)
- Rate limiting: 5 req/min on auth routes, 60 req/min API default
- CORS locked to `admin.clbyapp.com` and `clbyapp.com`
- Session cookies: `Secure`, `SameSite=strict`, domain `.clbyapp.com`
- `auth:sanctum` enforces 401 for unauthenticated requests (via custom exception handler)
- `RequireGymId` middleware blocks tenant-scoped routes for users without a `gym_id`

---

## Disaster recovery

### Production server dies

1. Spin up a new EC2 instance, install Coolify
2. Restore Coolify config from its backup (if enabled), or reconfigure manually
3. Deploy apps from `main` branch — code comes back clean
4. Download the latest `.dmp` from R2 and `pg_restore` into the new database
5. Point DNS to the new server IP
6. Validate — hit health check endpoints, test login

### Accidental data loss (dropped table, bad migration)

1. Find the latest good backup in R2
2. Either restore the whole DB (above) or just the affected table:
   ```bash
   pg_restore -U clby -d clby_prod --table=<table_name> backup.dmp
   ```

---

## Contacts / references

- **Coolify staging URL**: http://18.168.78.234:8000
- **Super admin accounts**: `barak@clby.com`, `admin@cluby.com`
- **Backlog**: [BACKLOG.md](./BACKLOG.md)
