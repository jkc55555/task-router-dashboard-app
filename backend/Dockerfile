# Backend API for task-router-dashboard-app (Railway/Vercel backend)
FROM node:22-slim AS base
WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies (context = repo root)
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

# Copy prisma schema and generate client
COPY backend/prisma ./prisma/
RUN npx prisma generate

# Copy source and build
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# Production: run migrations then start
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
