# Render Web Service (NestJS API) - Dockerfile
# See: https://render.com/docs/docker

FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json ./
RUN npm install --omit=dev

# Build application
FROM base AS builder
COPY package.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# Production image
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# Render sets PORT; app listens on process.env.PORT and 0.0.0.0
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]
