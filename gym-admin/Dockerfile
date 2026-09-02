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
# Cap Node heap to fit within 2GB RAM + 5GB swap on tiny EC2 instances.
# 1536 was too close to the 1.9GB total: with the prod containers also
# resident, the build reached the cap and the kernel OOM-killed it mid
# `next build` (2026-09-02, exit 255 with no error in the log — dockerd
# reported oom_kill on the builder span). 1024 keeps V8 collecting
# instead of climbing into territory the box cannot back.
ENV NODE_OPTIONS="--max-old-space-size=1024"
# CI=1 makes next.config.mjs serialize the build (cpus:1, no worker
# threads) — image builds happen on the prod box, which dies under
# parallel workers. See next.config.mjs.
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
