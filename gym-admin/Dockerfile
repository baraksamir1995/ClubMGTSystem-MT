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
# Cap Node heap to fit within 2GB RAM + 2GB swap on tiny EC2 instances
ENV NODE_OPTIONS="--max-old-space-size=1536"
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
