# Getting started

Snapmcp is an MCP server you run alongside your AI coding tool. It
provides 13 tools for visual captures. This guide covers install,
first run, and client setup.

---

## Prerequisites

- **Node.js** >= 20, or **Bun** >= 1.2
- **Playwright Chromium** (auto-installed during `snapmcp init`,
  or install manually with `npx playwright install chromium`)
- **TypeScript** 5.x (for local development)

---

## Installation

### npm global (recommended)

```bash
npm install -g snapmcp
```

This puts the `snapmcp` command on your PATH. Run it from anywhere.

### npx (no install)

```bash
npx -y snapmcp
```

Good for one-off use or CI. Each run fetches the latest version.

### Docker

```bash
docker run -i --rm \
  -e SNAPMCP_DIR=/captures \
  -v /path/to/output:/captures \
  ghcr.io/reeinharddd/snapmcp
```

See the [CLI reference](cli.md) for all Docker options and tags.

---

## Quick start

```bash
snapmcp
```

That's it. The server starts on stdio and waits for MCP messages
from your client. No port, no HTTP, no config file required.

To stop the server, send SIGINT (Ctrl+C).

---

## Health checks

Snapmcp has three CLI commands to verify your setup.

### `snapmcp init` -- interactive wizard

Walks you through:

1. Detecting your system state (Chrome, Playwright, terminal theme,
   output directory)
2. Installing Chromium if missing
3. Choosing capture settings (theme, format, quality)
4. Printing a ready-to-use MCP config snippet for your client

Run it once after install.

### `snapmcp doctor` -- 7 diagnostic checks

| Check | What it tests |
|-------|---------------|
| Runtime | Node >= 20 or Bun >= 1.2 |
| Playwright | Chromium installed via Playwright |
| Output dir | Directory exists and is writable |
| SnapMCP version | Package version |
| Chrome binary | Chrome/Chromium found on system |
| Terminal theme | Terminal config detected (Kitty, Gnome, etc.) |
| Environment | All SNAPMCP_ env vars are valid |

Exits with code 0 if all pass, non-zero otherwise.

### `snapmcp test` -- sample captures

Generates two test files in your output directory:

- `captures/test-terminal.png`
- `captures/test-code.png`

Open them in your file browser. If they look right, everything is
working.

---

## MCP client setup

Snapmcp follows the standard MCP stdio transport. Each client has
its own config file where you register the server.

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

Add to `opencode.json` (project root or global config):

```json
{
  "mcpServers": {
    "snapmcp": {
      "command": "npx",
      "args": ["-y", "snapmcp"],
      "env": {
        "SNAPMCP_DIR": "./captures",
        "SNAPMCP_FORMAT": "jpeg",
        "SNAPMCP_QUALITY": "95"
      }
    }
  }
}
```

Run `snapmcp init --opencode` to auto-register.

### VS Code / Cline / Roo-Cline

Add to VS Code `settings.json` under `cline.mcpServers`:

```json
{
  "cline.mcpServers": {
    "snapmcp": {
      "command": "npx",
      "args": ["-y", "snapmcp"],
      "env": {
        "SNAPMCP_DIR": "./captures",
        "SNAPMCP_FORMAT": "jpeg"
      }
    }
  }
}
```

### Docker (any MCP client)

Use the Docker image instead of direct command execution:

```json
{
  "mcpServers": {
    "snapmcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "SNAPMCP_DIR=/captures",
        "-v", "/path/to/output:/captures",
        "ghcr.io/reeinharddd/snapmcp"
      ]
    }
  }
}
```

---

## Next steps

- Browse the [full tool reference](tools.md) for every capture type
  and their parameters
- See [configuration](configuration.md) for all environment
  variables and theme options
- Read the [CLI reference](cli.md) for init, doctor, test, and
  advanced flags
- Check the [home page](README.md) for an overview of the project
