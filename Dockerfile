# Root Dockerfile: builds backend when Railway service has no root directory set.
# Build context is repo root; we only use backend/.
FROM node:22-slim
WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy and build backend only (prisma before npm ci so postinstall can run prisma generate)
COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma/
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
