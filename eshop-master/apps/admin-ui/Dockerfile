# ---- Dependencies Stage ----
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.10.2 --activate

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy admin-ui package.json
COPY apps/admin-ui/package.json ./apps/admin-ui/

# Copy shared packages
COPY packages ./packages

# Install dependencies
RUN pnpm install --filter admin-ui... --frozen-lockfile

# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.10.2 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin-ui/node_modules ./apps/admin-ui/node_modules
COPY --from=deps /app/packages ./packages

# Copy only essential workspace configuration files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY nx.json ./
COPY tsconfig.base.json ./

# Copy Prisma schema for client generation
COPY prisma ./prisma

# Copy admin-ui source code
COPY apps/admin-ui ./apps/admin-ui

# Build environment variables
ENV NODE_ENV=production
ENV NX_DAEMON=false
ENV NX_SKIP_NX_CACHE=true
ENV NEXT_TELEMETRY_DISABLED=1

# ADD NEXT.JS ENVIRONMENT VARIABLES (BEFORE BUILD)
ENV NEXT_PUBLIC_SERVER_URI=https://shondhane.com
ENV NEXT_PUBLIC_SOCKET_URI=wss://shondhane.com/ws-loggers
ENV NEXT_PUBLIC_USER_UI_LINK=https://shondhane.com

# Generate Prisma client before building
RUN npx prisma generate

# Use Next.js build directly instead of Nx
WORKDIR /app/apps/admin-ui
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy the standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-ui/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-ui/.next/static ./apps/admin-ui/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-ui/public ./apps/admin-ui/public

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3002

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/admin-ui/server.js"]