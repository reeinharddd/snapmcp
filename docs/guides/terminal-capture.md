# Terminal Capture Guide

Use the `capture_terminal` tool to turn command-line output into styled
screenshots. Each line prefixed with `$` becomes a command prompt; everything
else becomes plain output.

## How Terminal Colors Auto-Detect

When `SNAPMCP_THEME` is set to `auto` (the default), snapmcp tries to match
your terminal's look. The detection chain:

1. **`SNAPMCP_THEME` explicit override** -- if you set it to a specific theme,
   that's used directly
2. **Terminal emulator detection** -- snapmcp reads environment variables to
   identify the running terminal and picks a matching theme:

   | Terminal | Detected By | Default Theme |
   |----------|-------------|---------------|
   | Kitty | `KITTY_WINDOW_ID` | `tokyo-night` |
   | Gnome Terminal | `GNOME_TERMINAL_SCREEN` | `catppuccin-mocha` |
   | Alacritty | `ALACRITTY_WINDOW_ID` | `dracula` |
   | WezTerm | `WEZTERM_PANE` | `nord` |
   | Xfce4 Terminal | `TERM` + `COLORTERM` checks | `catppuccin-mocha` |
   | LXTerminal | `LXTERMINAL` env var | `one-dark-pro` |

3. **`COLORFGBG` variable** -- if no terminal is detected, snapmcp reads
   `COLORFGBG` to decide light vs dark. A dark background picks `dracula`; a
   light one picks `github-light`.

4. **OS theme fallback** -- checks the OS-level dark mode preference (macOS
   appearance, GNOME dark preference via gsettings). Dark mode gets `dracula`,
   light gets `github-light`.

5. **Hard fallback** -- `dracula`

## Using the `capture_terminal` Tool

The tool accepts lines of text that look like a terminal session. Lines
starting with `$ ` are rendered as command prompts. Everything else is output.

```json
{
  "name": "capture_terminal",
  "arguments": {
    "title": "git log",
    "lines": [
      "$ git log --oneline -3",
      "a1b2c3d fix: handle null pointer in parser",
      "e4f5g6h feat: add dark mode support",
      "i7j8k9l chore: bump dependencies",
      "$ "
    ]
  }
}
```

Parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | yes | Window title bar text |
| `lines` | string[] | yes | Lines to render: `$ ` prefix = command, no prefix = output |
| `output` | string | no | Custom output filename (saved to `SNAPMCP_DIR`) |

## Screenshot Format Tips

**Keep line length under 80 characters.** Wide lines get clipped by the
viewport. If you're capturing a command with long output, trim it or use
horizontal format.

**Use blank lines for spacing.** An empty string in the `lines` array creates
visual breathing room between sections.

**Match the prompt style.** All commands must start with `$ ` at the beginning
of the line. Trailing spaces before `$` break the detection.

**Combine with code captures.** For showing both terminal interaction and code
results, use `capture_terminal` for the command and `capture_code` for the
code itself. Then combine them in your document.

## Examples

### Single command with output

```json
{
  "title": "npm test",
  "lines": [
    "$ npm test",
    "",
    "> my-project@1.0.0 test",
    "> vitest run",
    "",
    " PASS  tests/example.test.ts",
    "   ✓ should render the component (2ms)",
    "   ✓ should handle user input (1ms)",
    "",
    "Tests: 2 passed, 2 total",
    "$ "
  ]
}
```

### Multi-step workflow

```json
{
  "title": "deploy",
  "lines": [
    "$ npm run build",
    "✓ built in 4.2s",
    "$ docker build -t app .",
    "✓ image created",
    "$ docker push myregistry/app:latest",
    "✓ pushed in 12s",
    "$ "
  ]
}
```

## Related

- [Configuration Reference](../configuration.md) -- theme and font settings
- [CLI Commands](../cli.md) -- `snapmcp test` generates sample terminal
  captures
- [Browser Capture Guide](browser-capture.md) -- capturing web pages instead
  of terminals
- [GIF Animation Guide](gif-animation.md) -- turning terminal sequences into
  animations
