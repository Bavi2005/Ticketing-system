FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

RUN npm ci --prefix backend && npm ci --prefix frontend && npm ci

COPY . .

RUN cd backend && npx prisma generate

RUN npm run build --prefix frontend


# -------------------------
# Runtime
# -------------------------

FROM node:20-alpine

RUN apk add --no-cache openssl

ENV NODE_ENV=production

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/proxy.js ./proxy.js
COPY --from=builder /app/start.js ./start.js
COPY --from=builder /app/package.json ./package.json

RUN cd backend && npm ci --omit=dev

RUN cd backend && npx prisma generate

RUN mkdir -p /app/backend/uploads && chown -R app:app /app

USER app

EXPOSE 8080

CMD ["sh", "-c", "cd backend && npx prisma db push && node seed.js && cd .. && node start.js"]
