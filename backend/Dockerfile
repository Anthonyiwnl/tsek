# syntax=docker/dockerfile:1
# TSEK backend image (#79). Multi-stage: production dependencies are installed
# in their own layer, so code-only changes reuse the cached dependency layer.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY db ./db
COPY scripts ./scripts
COPY src ./src
# Run as the unprivileged user that ships with the Node image.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" > /dev/null || exit 1
CMD ["node", "--import", "./src/environment.js", "src/server.js"]
