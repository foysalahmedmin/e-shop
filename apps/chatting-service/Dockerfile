# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY apps/chatting-service/package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Copy workspace packages
COPY packages/error-handler ./packages/error-handler
COPY packages/libs/prisma ./packages/libs/prisma
COPY packages/libs/redis ./packages/libs/redis
COPY packages/utils/kafka ./packages/utils/kafka

COPY prisma ./prisma

RUN corepack enable && corepack prepare pnpm@8.10.2 --activate
RUN pnpm install --prod


RUN npx prisma generate

COPY apps/chatting-service/dist ./dist

# ---- Production Stage ----
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create nodejs user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages

USER nodejs

EXPOSE 6006

ENV DOCKER_ENV=true
ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]