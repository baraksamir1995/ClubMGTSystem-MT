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
# To roll back, point this at a :<sha> tag instead of :latest.
#
# Local development still uses `npm run dev`; to build the image the way CI
# does, run: docker build -f Dockerfile.build .
FROM ghcr.io/baraksamir1995/clby-gym-admin:latest
