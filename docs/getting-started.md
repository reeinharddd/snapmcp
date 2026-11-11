# Getting Started

snapmcp is a local MCP server that creates visual documentation artifacts. It exposes exactly 13 tools. The 12 capture/document tools return saved file paths rather than image bytes; `snapmcp-hint` returns text guidance.

## Requirements

- Node.js 20 or newer. This is the primary runtime.
- Bun 1.2 or newer is optional for local development and tests.
- Playwright Chromium for browser-backed captures. `snapmcp init` installs it explicitly.

npm and npx work without Bun.

## Install

### Global npm install

```bash
npm install -g snapmcp
snapmcp init
```

`snapmcp init` checks the runtime and browser, installs Playwright Chromium when needed, creates the output directory, and can prepare an MCP client configuration.

### npx

```bash
npx -y snapmcp init
npx -y snapmcp
```

The package postinstall step performs lightweight browser detection and prints setup guidance. It does not download Chromium.

## Start the server

```bash
snapmcp
```

The server speaks MCP over stdio. It does not open a network port.

## Register an MCP client

### Claude Code

Add to `~/.claude/claude.json`:

```json
{
  "mcpServers": {
    "snapmcp": {
      "command": "npx",
      "args": ["-y", "snapmcp"],
      "env": {
        "SNAPMCP_DIR": "./captures",
        "SNAPMCP_THEME": "nord"
      }
    }
  }
}
```

### OpenCode

Add to `opencode.json` or `opencode.jsonc` under `mcp.servers`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "snapmcp": {
        "type": "local",
        "command": ["npx", "-y", "snapmcp"],
        "environment": {
          "SNAPMCP_DIR": "./captures",
          "SNAPMCP_FORMAT": "jpeg",
          "SNAPMCP_QUALITY": "95"
        }
      }
    }
  }
}
```

The OpenCode CLI can add the same server: `opencode mcp add snapmcp -- npx -y snapmcp`.

`snapmcp init` writes the current OpenCode V2 shape under `mcp.servers` for JSON and JSONC configuration files. JSONC comments, trailing commas, and unrelated settings are preserved. It recognizes an existing deprecated `mcp.snapmcp` entry and leaves it unchanged to avoid creating a duplicate.

### VS Code, Cline, and Roo-Cline

Use the same stdio server entry in the client's MCP configuration.

## Verify the setup

```bash
snapmcp doctor
snapmcp test
```

`snapmcp doctor` checks Node.js, Chromium, the Chromium sandbox, the output directory, disk space, configuration, and the syntax highlighter. Use `--json` for machine-readable diagnostics.

`snapmcp test` creates `test-terminal.png` and `test-code.png` in `SNAPMCP_DIR`.

## Discover the tools

Agents can discover the 13 tools without loading the full documentation:

```bash
snapmcp capabilities --json
snapmcp search "website screenshot" --json
```

In MCP, the equivalent surfaces are `tools/list`, `snapmcp-hint` with a natural-language `query`, and the `snapmcp://capabilities` resource. The server instructions provide an additional short selection guide.

See the [Agent Guide](agents.md) for code-mode and OpenCode examples.

## Docker (optional)

Docker is an optional packaging surface, not the primary installation path. The image uses Node.js, includes Chromium, selects that system Chromium explicitly, runs as a non-root user, and communicates over stdio.

```bash
docker run -i --rm \
  -e SNAPMCP_DIR=/app/captures \
  -v /path/to/output:/app/captures \
  ghcr.io/reeinharddd/snapmcp
```

The mounted directory must be writable by the container's non-root user.

## Next steps

- [Tool Reference](tools.md): all 13 tools and exact schemas
- [Agent Guide](agents.md): selection, discovery, and token-efficient behavior
- [Configuration](configuration.md): environment variables and browser behavior
- [CLI Reference](cli.md): setup, diagnostics, discovery, and verification
- [Security Policy](../SECURITY.md): enforced controls and known limits
