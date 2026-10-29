# Production Multi-Stage Dockerfile for KitchenOS Standalone Node.js Server
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Step 1: Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml prisma ./
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

# Step 2: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npx prisma generate
RUN pnpm build

# Step 3: Production Runner (Runs persistent Node.js server 24/7)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets and standalone server output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]

