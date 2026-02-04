# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine

WORKDIR /app

RUN addgroup -S mcp && adduser -S mcp -G mcp

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER mcp

ENV TRANSPORT=http
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["node", "dist/index.js"]
CMD ["--transport", "http"]
