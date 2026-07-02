# snapmcp docs

All-in-one MCP server for visual captures: terminal, code, browser,
markdown, diffs, HTML, PDF, and GIF.

[Getting Started](getting-started.md) . [Tools](tools.md) . [Configuration](configuration.md) . [CLI](cli.md) . [Guides](guides/) . [GitHub](https://github.com/reeinharddd/snapmcp)

---

## Why snapmcp?

One MCP server for every kind of visual capture you might need. No
switching between servers, no learning four different tool
interfaces, no config duplication. Point your MCP client at snapmcp
and you get terminal screenshots, code highlights, browser pages,
markdown renders, diffs, HTML snapshots, PDF exports, and GIF
animations from a single endpoint.

### Feature highlights

**Real terminal colors.** Snapmcp reads your actual terminal config
(Kitty, Gnome Terminal, Alacritty, WezTerm, Xfce4, LXTerminal) and
reproduces your real foreground, background, and accent colors in
every terminal capture.

**Real browser profile.** It finds your system Chrome, Edge, or
Brave installation and uses your real user data directory for
browser captures. Cookies, sessions, and logged-in pages work
without extra setup.

**In-project captures.** Output lands in `./captures` right inside
your current project. No hunting through hidden directories.

**Zero-dependency GIF.** GIF animation is powered by gifenc +
fast-png with zero runtime dependencies. No external imagemagick,
no ffmpeg, no sharp.

---

## Quick install

```bash
npm install -g snapmcp
snapmcp
```

That starts the MCP server on stdio, ready to talk to your client.
See [Getting Started](getting-started.md) for detailed setup,
client configuration, and health checks.

---

## Project docs

- [Architecture](https://github.com/reeinharddd/snapmcp/blob/main/ARCHITECTURE.md) -- module map, data flow, design decisions
- [Security](https://github.com/reeinharddd/snapmcp/blob/main/SECURITY.md) -- SSRF protection, file allowlist, path traversal
- [Contributing](https://github.com/reeinharddd/snapmcp/blob/main/CONTRIBUTING.md) -- development workflow, PR checklist
- [Changelog](https://github.com/reeinharddd/snapmcp/blob/main/CHANGELOG.md) -- release history
- [License](https://github.com/reeinharddd/snapmcp/blob/main/LICENSE) -- MIT
