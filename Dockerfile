FROM node:22-alpine AS base
WORKDIR /app

# ─── Dependencies stage ───────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

# ─── Builder stage ──────────────────────────────────────────────────────────
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages packages
COPY apps apps
RUN pnpm build --filter @juragan/api

# ─── Production image ─────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production

# Install runtime deps
RUN apk add --no-cache dumb-init

# Copy built artifacts
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=builder /app/apps/api/dist /app/apps/api/dist
COPY --from=builder /app/apps/api/package.json /app/apps/api/package.json
COPY --from=builder /app/packages /app/packages

# Copy source for Mastra runtime (it reads source at runtime)
COPY apps/api/src /app/apps/api/src
COPY packages/core/src /app/packages/core/src
COPY packages/shared/src /app/packages/shared/src
COPY packages/plugin-sdk/src /app/packages/plugin-sdk/src
COPY packages/core-tools/src /app/packages/core-tools/src

# Volume mount points
VOLUME ["/app/data"]

EXPOSE 4111

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "-r", "@mastra/node-ser", "dist/index.js"]
