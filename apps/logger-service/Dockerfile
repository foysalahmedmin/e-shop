# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY apps/logger-service/package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Copy workspace packages
COPY packages/error-handler ./packages/error-handler
COPY packages/utils/kafka ./packages/utils/kafka

# Copy prisma directory
COPY prisma ./prisma

# Enable pnpm and install dependencies
RUN corepack enable && corepack prepare pnpm@8.10.2 --activate
RUN pnpm install --prod


# Generate Prisma client
RUN npx prisma generate

# Copy built application
COPY apps/logger-service/dist ./dist

# ---- Production Stage ----
FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache openssl dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built artifacts with correct ownership
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages

# Switch to non-root user
USER nodejs

EXPOSE 6008

ENV DOCKER_ENV=true
ENV NODE_ENV=production

# Use dumb-init to handle signals properly
CMD ["dumb-init", "node", "dist/main.js"]