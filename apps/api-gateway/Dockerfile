# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY apps/api-gateway/package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY prisma ./prisma

RUN corepack enable && corepack prepare pnpm@8.10.2 --activate
RUN pnpm install --prod


RUN npx prisma generate

COPY apps/api-gateway/dist ./dist

# ---- Production Stage ----
FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

EXPOSE 8080

CMD ["node", "dist/main.js"]