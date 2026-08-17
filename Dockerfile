# ─── Build stage ───────────────────────────────────────────
FROM --platform=$BUILDPLATFORM oven/bun:1.3 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
RUN bunx tsc

# ─── Runtime stage ─────────────────────────────────────────
FROM oven/bun:1.3-slim

LABEL org.opencontainers.image.title="snapmcp"
LABEL org.opencontainers.image.description="All-in-one MCP server for visual captures"
LABEL org.opencontainers.image.source="https://github.com/reeinharddd/snapmcp"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Install Chromium + deps (works on both amd64 and arm64)
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Copy built artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json /app/bun.lock ./
# Prune devDependencies for runtime
RUN bun install --frozen-lockfile --production --ignore-scripts

# Run as non-root
RUN groupadd -r snapmcp && useradd -r -g snapmcp -d /app snapmcp
RUN mkdir -p /app/captures && chown -R snapmcp:snapmcp /app

USER snapmcp

ENV SNAPMCP_DIR=/app/captures
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium
ENV NODE_ENV=production

VOLUME /app/captures

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "process.exit(0)"

ENTRYPOINT ["node", "dist/index.js"]
