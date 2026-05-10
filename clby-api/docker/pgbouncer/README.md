# PgBouncer (optional, for prod scale)

PgBouncer sits between PHP-FPM workers and Postgres in **transaction-pool**
mode. Each FPM worker opens one PgBouncer connection (cheap) and PgBouncer
multiplexes them onto a much smaller pool of real Postgres connections.

Right now we don't need it: with 25 FPM workers (`docker/php-fpm/www.conf`)
and 100 Postgres `max_connections`, we're well under the cap. PgBouncer
becomes worth deploying when:

- worker count goes past ~50 (multi-container Coolify deploy), or
- Postgres `max_connections` becomes a real cap (CPU-bound or memory-bound
  Postgres), or
- you want graceful Postgres failover — PgBouncer holds client connections
  open while the DB restarts behind it.

## Wiring it up under Coolify

1. In the Coolify dashboard, add a new resource → **Docker Compose** →
   paste the snippet below.
2. Put it on the same private network as the clby-api container.
3. Update clby-api's environment so `DB_HOST=pgbouncer` and `DB_PORT=6432`.
   Everything else (DB_DATABASE / USERNAME / PASSWORD) stays the same —
   PgBouncer authenticates against `userlist.txt` and proxies through.
4. Bounce clby-api once. Existing PDO persistent connections will reconnect
   through PgBouncer transparently.

```yaml
services:
  pgbouncer:
    image: edoburu/pgbouncer:latest
    restart: unless-stopped
    environment:
      DB_HOST: ${POSTGRES_HOST}     # the actual Postgres container/IP
      DB_PORT: 5432
      DB_USER: ${POSTGRES_USER}
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      DB_NAME: ${POSTGRES_DB}
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 200          # how many FPM workers can connect
      DEFAULT_POOL_SIZE: 20         # real Postgres connections per database
      RESERVE_POOL_SIZE: 5
      RESERVE_POOL_TIMEOUT: 3
      SERVER_RESET_QUERY: DISCARD ALL
      AUTH_TYPE: md5
    ports:
      - "6432:6432"
    healthcheck:
      test: ["CMD", "pg_isready", "-h", "127.0.0.1", "-p", "6432"]
      interval: 10s
      timeout: 3s
      retries: 5
```

## Trade-offs to know

- **Transaction mode is incompatible with `LISTEN/NOTIFY` and prepared
  statements that span transactions.** Laravel's PDO doesn't use either
  by default. If you ever add a notify-based job runner, switch that
  service to a direct DB connection or use `session` pool mode.
- **`SERVER_RESET_QUERY = DISCARD ALL`** is the safe default — it
  resets connection state between transactions. It also drops Postgres
  prepared statements per transaction, which adds ~0.5ms per query that
  uses prepared statements. Acceptable given the connection-reuse win.
- **PgBouncer adds one more hop in the network path.** On the same
  Docker network this is sub-millisecond, but if you ever route through
  a load balancer it can add 5-10ms.
- **PHP `PDO::ATTR_PERSISTENT = true` + PgBouncer is fine** in
  transaction mode because PgBouncer rebinds the underlying Postgres
  connection per transaction; the PHP-side persistent connection stays
  pinned to PgBouncer.
