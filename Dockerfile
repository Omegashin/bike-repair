# The app as it runs in production: Express serves /api and the built React app from one port.
FROM node:24-slim
# Prisma's migration engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --ignore-scripts

COPY . .
RUN cd apps/api && npx prisma generate
RUN npm run build -w apps/web

WORKDIR /app/apps/api
ENV PORT=3000 WEB_DIST_DIR=/app/apps/web/dist
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed && node src/index.ts"]
