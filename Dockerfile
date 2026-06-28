# ─── Build stage ───────────────────────────────────────────
FROM oven/bun:1.3 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
RUN bunx tsc

# ─── Runtime stage ─────────────────────────────────────────
FROM oven/bun:1.3-slim

WORKDIR /app

# Install Chromium + deps
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

ENV SNAPMCP_DIR=/app/captures
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium

RUN mkdir -p $SNAPMCP_DIR

VOLUME /app/captures

ENTRYPOINT ["node", "dist/index.js"]
