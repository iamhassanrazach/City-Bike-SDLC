# --- Stage 1: Build ---
FROM node:20 AS builder
ARG GITHUB_SHA=local-dev
ENV GITHUB_SHA=$GITHUB_SHA
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: Runtime ---
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/server.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 4173
CMD ["node", "server.js"]
