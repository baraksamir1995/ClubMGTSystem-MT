# Making the gym-admin GHCR package private

The image `ghcr.io/baraksamir1995/clby-gym-admin` is published by
`.github/workflows/build-gym-admin.yml` and pulled by Coolify on the prod box
(the `gym-admin/Dockerfile` is a one-line `FROM` of it).

While the package is **public**, the pull needs no credentials. To make it
**private**, the prod Docker daemon has to authenticate to GHCR first.

Nothing in the repo changes — this is purely prod-server + GitHub config.

---

## 1. Create a read-only token

GHCR does not accept fine-grained PATs for pulls, so use a **classic** token.

1. GitHub → Settings → Developer settings → Personal access tokens →
   **Tokens (classic)** → *Generate new token (classic)*
2. Note: `clby prod GHCR pull`
3. Expiration: pick a date you will actually renew, or *No expiration* if this
   is a set-and-forget box. **Put a calendar reminder if it expires** — when
   the token dies, every gym-admin deploy starts failing with `denied` and the
   cause is not obvious from the Coolify log.
4. Scope: tick **`read:packages` only**. Nothing else — this token can then
   only pull images, so a leak cannot touch the repo.
5. Generate and copy the `ghp_…` value.

## 2. Log the prod Docker daemon in

Coolify runs deploys as root, so the credential must live in **root's** Docker
config, not `ubuntu`'s.

```bash
ssh -i ~/Desktop/clby-key.pem ubuntu@18.135.67.205

# paste the token when prompted (it is not echoed)
read -rs GHCR_TOKEN
echo "$GHCR_TOKEN" | sudo docker login ghcr.io -u baraksamir1995 --password-stdin
unset GHCR_TOKEN
```

Expect `Login Succeeded`. This writes `/root/.docker/config.json`, which
persists across reboots and Coolify upgrades.

> Using `--password-stdin` with `read -rs` keeps the token out of your shell
> history and out of the process list, which `docker login -p <token>` would
> not.

## 3. Verify the pull works while still public

Before flipping visibility, confirm the credential is actually being used:

```bash
sudo docker pull ghcr.io/baraksamir1995/clby-gym-admin:latest
```

## 4. Flip the package to private

GitHub → your profile → **Packages** → `clby-gym-admin` → *Package settings* →
Change visibility → **Private**.

## 5. Prove it still works

```bash
# force a fresh pull rather than reusing the local copy
sudo docker rmi ghcr.io/baraksamir1995/clby-gym-admin:latest
sudo docker pull ghcr.io/baraksamir1995/clby-gym-admin:latest
```

If that succeeds, redeploy gym-admin in Coolify and it will too.

---

## If a deploy later fails with `denied` / `unauthorized`

In order of likelihood:

1. **The token expired.** Regenerate and repeat step 2.
2. **The credential is on the wrong user.** Coolify deploys as root; check
   `sudo cat /root/.docker/config.json` contains a `ghcr.io` entry.
3. **Token scope.** It needs `read:packages`. A fine-grained PAT will not work
   for GHCR pulls.
4. **Wrong package.** The image name must be all lowercase —
   `baraksamir1995/clby-gym-admin`.

## Alternative: Coolify's own registry credentials

Coolify 4.x can store registry logins in its UI (Keys & Tokens → Docker
Registries) and inject them per-resource. That keeps the secret in Coolify's
database rather than a file on disk, and survives a server rebuild. The
`docker login` route above is simpler and applies to every resource on the
box, which is why it is the default recommendation here — but if you prefer
secrets managed in one place, use the UI instead and skip step 2.
