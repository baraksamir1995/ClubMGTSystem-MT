# Coolify-facing Dockerfile — deliberately just a pull, not a build.
#
# `next build` peaks around 1.1GB RSS and the prod box (t3.small, 1.9GB with
# the prod containers resident) has roughly 600MB free, so building here
# OOM-killed three deploys in a row on 2026-09-02. The real multi-stage build
# lives in Dockerfile.build and runs on a 16GB GitHub Actions runner, which
# publishes the finished image to GHCR (.github/workflows/build-gym-admin.yml).
#
# Keeping this file as the Coolify build target means the resource stays in
# "Dockerfile" mode — its domain, Traefik labels and env vars are untouched —
# while the deploy itself becomes a registry pull that takes seconds and
# cannot exhaust the box.
#
# PINNED BY SHA, not :latest, and that is load-bearing. Coolify tags its
# images by git SHA and skips the build when neither the SHA nor this
# file changed. With a static `:latest` line the text never changed, so
# Coolify reused a cached local image instead of re-resolving what
# :latest had become — the deploy reported success while serving old
# code (a stale CSP shipped this way on 2026-09-02). Bumping this tag on
# every deploy is what forces the pull.
#
# To deploy: after CI publishes the image, set this to the new commit's
# SHA and push. To roll back: point it at an older :<sha>.
#
# Local development still uses `npm run dev`; to build the image the way CI
# does, run: docker build -f Dockerfile.build .
FROM ghcr.io/baraksamir1995/clby-gym-admin:571ad0965e070b7b4c9f62bcd4048e76fbc68a85
