# ─── Build stage ───────────────────────────────────────────
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json ./
RUN npm install --ignore-scripts --no-audit --no-fund

COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY brand/ ./brand/
COPY assets/ ./assets/
RUN npm run build \
    && npm prune --omit=dev --ignore-scripts --no-audit --no-fund

# ─── Runtime stage ─────────────────────────────────────────
FROM node:22-bookworm-slim

LABEL org.opencontainers.image.title="snapmcp"
LABEL org.opencontainers.image.description="Visual documentation MCP server with 13 capture and discovery tools"
LABEL org.opencontainers.image.source="https://github.com/reeinharddd/snapmcp"
LABEL org.opencontainers.image.licenses="MIT"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libatspi2.0-0 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libgbm1 \
        libglib2.0-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libu2f-udev \
        libvulkan1 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxkbcommon0 \
        libxrandr2 \
    && apt-get clean \
    && find /var/lib/apt/lists -mindepth 1 -delete

RUN groupadd --gid 10001 snapmcp \
    && useradd --uid 10001 --gid snapmcp \
        --home-dir /home/snapmcp --create-home \
        --shell /usr/sbin/nologin snapmcp

WORKDIR /app

COPY --chown=snapmcp:snapmcp --from=build /app/package.json ./package.json
COPY --chown=snapmcp:snapmcp --from=build /app/node_modules ./node_modules
COPY --chown=snapmcp:snapmcp --from=build /app/dist ./dist
COPY --chown=snapmcp:snapmcp --from=build /app/scripts ./scripts
COPY --chown=snapmcp:snapmcp --from=build /app/brand ./brand
COPY --chown=snapmcp:snapmcp --from=build /app/assets ./assets

RUN mkdir -p /app/captures \
    && chown -R snapmcp:snapmcp /app

USER snapmcp

ENV HOME=/home/snapmcp
ENV SNAPMCP_DIR=/app/captures
ENV SNAPMCP_CHROME_EXECUTABLE=/usr/bin/chromium
ENV NODE_ENV=production

VOLUME ["/app/captures"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD ["node", "dist/index.js", "--version"]

ENTRYPOINT ["node", "dist/index.js"]
