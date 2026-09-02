# ───── Stage 1: deps ─────
FROM node:20-alpine AS deps
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# ───── Stage 2: build ─────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# This image is built on GitHub Actions (see .github/workflows/
# build-gym-admin.yml), not on the prod box — `next build` peaks around
# 1.1GB RSS and the t3.small had ~600MB free, which OOM-killed three
# deploys in a row on 2026-09-02. The runner has 16GB, so the heap no
# longer needs the 1024MB cap that was there to appease the small box.
ENV NODE_OPTIONS="--max-old-space-size=4096"
# CI=1 also flips next.config.mjs to ignoreBuildErrors and disables the
# webpack cache, so keep it set — but the parallelism clamp it used to
# trigger (cpus:1, workerThreads:false) is no longer wanted on a runner.
# next.config.mjs now keys that clamp off COOLIFY_FQDN alone.
ENV CI=1
RUN npm run build

# ───── Stage 3: runtime ─────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
