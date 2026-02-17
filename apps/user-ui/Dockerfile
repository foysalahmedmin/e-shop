# ---- Dependencies Stage ----
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.10.2 --activate

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy user-ui package.json
COPY apps/user-ui/package.json ./apps/user-ui/

# Copy shared packages
COPY packages ./packages

# Install dependencies
RUN pnpm install --filter user-ui... --frozen-lockfile

# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.10.2 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/user-ui/node_modules ./apps/user-ui/node_modules
COPY --from=deps /app/packages ./packages

# Copy only essential workspace configuration files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY nx.json ./
COPY tsconfig.base.json ./

# Copy Prisma schema for client generation
COPY prisma ./prisma

# Copy user-ui source code
COPY apps/user-ui ./apps/user-ui

# Build environment variables
ENV NODE_ENV=production
ENV NX_DAEMON=false
ENV NX_SKIP_NX_CACHE=true
ENV NEXT_TELEMETRY_DISABLED=1

# ADD NEXT.JS ENVIRONMENT VARIABLES (BEFORE BUILD)
ENV NEXT_PUBLIC_SERVER_URI=https://shondhane.com
ENV NEXT_PUBLIC_CHATTING_WEBSOCKET_URI=wss://shondhane.com/ws-chatting
ENV NEXT_PUBLIC_SELLER_SERVER_URI=https://sellers.shondhane.com
ENV NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_51Ox7STKfWK4AoG4YmNVlSSToDlYzvr8TGe2d36vzYt5iYQ4JViRC976MOF9A2uXU2wzJt4T2IN5NXscnmpGlXlAz00whmGYvmP

# Generate Prisma client before building
RUN npx prisma generate

# Use Next.js build directly instead of Nx
WORKDIR /app/apps/user-ui
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy the standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/user-ui/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/user-ui/.next/static ./apps/user-ui/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/user-ui/public ./apps/user-ui/public

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/user-ui/server.js"]