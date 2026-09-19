import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerHintTool(server: McpServer): void {
  server.tool(
    "snapmcp-hint",
    "Return a helpful hint about configuring and using snapmcp. Provides contextual guidance for setup, troubleshooting, and feature discovery.",
    {
      topic: z.enum(["init", "doctor", "browser", "themes", "output", "security", "gif", "document", "batch"]).optional().describe("Topic for targeted help: init (interactive setup), doctor (diagnostics), browser (Chrome profile), themes (27 syntax themes), output (capture directory), security (SSRF/path config), gif (animations), document (multi-capture docs), batch (multi-capture calls)"),
    },
    async ({ topic }) => {
      const hints: Record<string, string> = {
        init: "Run `snapmcp init` for interactive setup: detects Chrome, configures output directory, picks terminal theme, and sets up browser profile. Creates a ready-to-use configuration.",
        doctor: "Run `snapmcp doctor` to diagnose your system: checks Node/Bun version, Chromium installation, output directory permissions, environment variables, and security settings. Use `--json` for CI integration.",
        browser: "Set SNAPMCP_CHROME_EXECUTABLE to your Chrome/Chromium binary path (e.g., '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' on macOS) to use your real browser profile with cookies, extensions, and logged-in sessions for authenticated captures.",
        themes: "Set SNAPMCP_THEME to one of 27 Shiki themes: dracula, nord, catppuccin-mocha, catppuccin-latte, tokyo-night, one-dark-pro, ayu-dark, ayu-light, vitesse-dark, vitesse-light, min-dark, min-light, poimandres, rose-pine, rose-pine-moon, rose-pine-dawn, slack-dark, slack-ochin, snazzy-light, github-dark-dimmed, github-light, one-light, solarized-light, solarized-dark, material-theme, material-theme-lighter, material-theme-ocean. Terminal theme auto-detects from Kitty/GNOME/Alacritty/WezTerm configs.",
        output: "Set SNAPMCP_DIR to control where captures are saved (default: ./captures relative to working directory). Supports absolute or relative paths. Also configurable: SNAPMCP_FORMAT (png/jpeg), SNAPMCP_QUALITY (1-100 for JPEG), SNAPMCP_PADDING (px), SNAPMCP_SHADOW (none/soft/medium/strong), SNAPMCP_WINDOW_CHROME (true/false), SNAPMCP_BORDER_RADIUS (0-32).",
        security: "Security is on by default: SSRF protection (SNAPMCP_SSRF_PROTECTION=true) blocks private IPs, localhost, DNS-rebinding. File access requires SNAPMCP_ALLOWED_PATHS (comma/semicolon-separated allowlist, deny-all when unset). Input limits: terminal 1000 lines, code/markdown/html 200KB, diff 500KB, files 5MB, GIF 60 frames, max canvas 8192x8192. Set SNAPMCP_SECURITY_CHECKS=false to disable (not recommended).",
        gif: "Create animated GIFs with `capture_gif` (2-60 frames) or `capture_sequence` (steps + optional GIF). Each frame uses full capture parameters (terminal, code, file, browser, markdown, html, diff). Configure frameDelay (10-5000ms) and loop (true/false). Max canvas 8192x8192.",
        document: "Create multi-capture documents with `capture_document` (up to 30 captures) in markdown, HTML, or PDF format. Each capture gets a caption. HTML output embeds images as base64 for portability. PDF uses print-quality rendering.",
        batch: "Capture multiple items in one call with `capture_batch` (up to 10 captures). Each capture runs sequentially with independent parameters. Saves individual files to output directory. Use for batch documentation workflows.",
      };

      const generic = `Need help with snapmcp? Available topics: init, doctor, browser, themes, output, security, gif, document, batch.
Run \`snapmcp init\` for interactive setup, or \`snapmcp doctor\` to diagnose your system.`;

      const text = topic && hints[topic] ? hints[topic] : generic;
      return { content: [{ type: "text", text }] };
    },
  );
}
