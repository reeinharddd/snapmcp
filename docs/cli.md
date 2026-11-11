# CLI Reference

The `snapmcp` command starts the MCP server and provides setup, diagnostics, verification, and discovery utilities.

## Server

### `snapmcp`

Starts the MCP server on stdio. The server exposes exactly 13 tools and registers the `snapmcp://capabilities` resource.

```bash
snapmcp
```

Configuration comes from `SNAPMCP_*` environment variables. See [Configuration](configuration.md).

## Setup

### `snapmcp init`

Runs the interactive setup flow. It can:

- inspect the Node.js or Bun runtime;
- install Playwright Chromium when it is missing;
- create the output directory;
- detect supported MCP clients;
- offer to register snapmcp with a detected client.

```bash
snapmcp init
```

Chromium installation is explicit. Package postinstall does not download it.

## Diagnostics

### `snapmcp doctor`

Checks the runtime, Chromium, Chromium sandbox, output directory, disk space, configuration, and syntax highlighter.

```bash
snapmcp doctor
```

### `snapmcp doctor --json`

Writes machine-readable diagnostics to standard output:

```bash
snapmcp doctor --json
```

The JSON contains an overall status and a list of named checks.

## Verification

### `snapmcp test`

Generates a terminal and code capture in `SNAPMCP_DIR`:

- `test-terminal.png`
- `test-code.png`

```bash
snapmcp test
```

Use this after installation to confirm that Chromium and the output directory work.

## Discovery

### `snapmcp capabilities`

Prints the 13-tool capability catalog.

```bash
snapmcp capabilities
```

### `snapmcp capabilities --json`

Prints the machine-readable capability manifest, including tool summaries, outputs, limits, discovery surfaces, security defaults, and token policy.

```bash
snapmcp capabilities --json
```

### `snapmcp search "<intent>" --json`

Searches the catalog by natural-language intent and prints up to five ranked matches.

```bash
snapmcp search "website screenshot" --json
snapmcp search "printable report with captures" --json
```

The MCP equivalents are `tools/list`, `snapmcp-hint` with `query`, and the `snapmcp://capabilities` resource.

## General options

### `snapmcp --help`

Prints usage information.

```bash
snapmcp --help
```

### `snapmcp --version`

Prints the installed version.

```bash
snapmcp --version
```

## Exit behavior

- The MCP server and setup commands normally run until interrupted.
- `snapmcp doctor` exits with code 0 when no check has an error status and a non-zero code when an error is present.
- `snapmcp search` without an intent prints usage information and exits with code 1.

## Related

- [Getting Started](getting-started.md)
- [Agent Guide](agents.md)
- [Tool Reference](tools.md)
- [Configuration](configuration.md)
