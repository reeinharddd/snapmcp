import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchCapabilities, TOOL_LIMITS } from "../capabilities.js";
import { hintOutputShape, structuredResult } from "../results.js";

const SETUP_HINTS: Record<string, string> = {
  init: "Run `snapmcp init` for interactive setup: detects Chrome, installs Playwright Chromium when needed, configures the output directory, picks a terminal theme, and prepares MCP client configuration.",
  doctor: "Run `snapmcp doctor` to diagnose runtime, Chromium, sandbox, output-directory, disk, configuration, and syntax-highlighter health. Use `--json` for CI or agent workflows.",
  browser: "Prefer bundled Playwright Chromium for reproducible rendering. Set SNAPMCP_CHROME_EXECUTABLE to select a system Chrome/Chromium binary explicitly. Experimental SNAPMCP_CHROME_PROFILE mode runs URL captures in the selected persistent profile, so profile cookies and session state can be sent to the target site. URL captures remain SSRF-protected.",
  themes: "Set SNAPMCP_THEME to one of 27 Shiki themes: dracula, nord, catppuccin-mocha, tokyo-night, one-dark-pro, ayu-dark, ayu-light, vitesse-dark, vitesse-light, min-dark, min-light, poimandres, rose-pine, rose-pine-moon, rose-pine-dawn, slack-dark, slack-ochin, snazzy-light, github-dark-dimmed, github-light, one-light, solarized-light, solarized-dark, material-theme, material-theme-lighter, material-theme-ocean. Terminal themes are auto-detected from Kitty, GNOME, Alacritty, and WezTerm configs.",
  output: "Set SNAPMCP_DIR to choose where captures are saved (default: ./captures). SNAPMCP_FORMAT selects png or jpeg; SNAPMCP_QUALITY controls JPEG quality. Other visual defaults are SNAPMCP_PADDING, SNAPMCP_SHADOW, SNAPMCP_WINDOW_CHROME, SNAPMCP_BORDER_RADIUS, and SNAPMCP_BADGE.",
  security: "Security is deny-by-default: URL tools block private and local networks, redirects are revalidated, HTML external resources are blocked, and capture_file requires SNAPMCP_ALLOWED_PATHS. Chromium sandbox status is checked at startup. Keep SNAPMCP_SECURITY_CHECKS and SNAPMCP_SSRF_PROTECTION enabled outside isolated test environments.",
  sandbox: "snapmcp checks Chromium sandbox availability at startup, uses Chromium's own process isolation, blocks SSRF targets and path traversal, and ships a non-root Docker runtime. For hostile pages, keep sandbox and SSRF protection enabled and do not reuse a personal Chrome profile.",
  gif: `Use capture_gif for ${TOOL_LIMITS.gif.minFrames}-${TOOL_LIMITS.gif.maxFrames} explicit frames and capture_sequence for ordered process steps with an optional GIF. Configure frameDelay (${TOOL_LIMITS.gif.minFrameDelayMs}-${TOOL_LIMITS.gif.maxFrameDelayMs}ms) and loop. Maximum canvas is ${TOOL_LIMITS.gif.maxDimension}x${TOOL_LIMITS.gif.maxDimension}.`,
  document: `Use capture_document for up to ${TOOL_LIMITS.document.maxCaptures} captioned captures embedded in Markdown, self-contained HTML, or print-quality PDF. Use capture_batch when only independent image files are needed.`,
  batch: `Use capture_batch for up to ${TOOL_LIMITS.batch.maxCaptures} independent captures. Each item uses the same typed schema as the underlying terminal, code, file, browser, Markdown, HTML, or diff tool. Prefer one batch over many unrelated tool calls.`,
  tokens: "Keep context small: tools return saved file paths rather than image bytes, inputs are bounded, capture_batch handles independent items in one call, and snapmcp-hint searches capabilities without loading the full reference. Every tool also returns a structured payload with the saved path, format and byte size. Use `snapmcp capabilities --json` for a compact manifest.",
  agents: "Discovery surfaces are tools/list (canonical), snapmcp-hint (natural-language search), snapmcp://capabilities (JSON resource), `snapmcp capabilities --json` (CLI), and llms.txt (static agent-friendly overview). Server instructions guide tool selection across workflows.",
  discovery: "Search by intent with snapmcp-hint, for example `query: \"website screenshot\"` or `query: \"pdf export\"`. Read snapmcp://capabilities for the complete machine-readable catalog.",
  "code-mode": "Run `snapmcp capabilities --json` for a stable manifest, or `snapmcp search \"<intent>\" --json` for ranked matches. The manifest includes tool names, use cases, outputs, limits, security defaults, and token policy.",
};

export function registerHintTool(server: McpServer): void {
  server.registerTool(
    "snapmcp-hint",
    {
      title: "Find the right snapmcp tool",
      description:
        "Find the right snapmcp tool by natural-language intent, or get concise setup, security, sandbox, agent, and token guidance. Use when tool selection is unclear or before loading the full documentation.",
      inputSchema: {
        topic: z
          .string()
          .max(50)
          .optional()
          .describe("Legacy named topic: init, doctor, browser, themes, output, security, sandbox, gif, document, batch, tokens, agents, discovery, or code-mode."),
        query: z
          .string()
          .max(200)
          .optional()
          .describe("Natural-language intent to search, such as 'website screenshot', 'animated before and after', 'pdf export', or 'read a source file'."),
      },
      outputSchema: hintOutputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ topic, query }) => {
      const requested = query?.trim() || (topic && !SETUP_HINTS[topic] ? topic.trim() : undefined);

      if (requested) {
        const matches = searchCapabilities(requested, 5);
        if (matches.length > 0) {
          const lines = [`Best snapmcp matches for "${requested}":`];
          for (const { capability } of matches) {
            lines.push(
              `- ${capability.name}: ${capability.summary} Use when: ${capability.useWhen} Limits: ${capability.limits}`,
            );
          }
          lines.push(
            "Call `snapmcp capabilities --json` only when you need the complete machine-readable catalog.",
          );
          const answer = lines.join("\n");
          return structuredResult(
            {
              kind: "matches",
              query: requested,
              answer,
              matches: matches.map(({ capability }) => ({
                name: capability.name,
                title: capability.title,
                summary: capability.summary,
                useWhen: capability.useWhen,
              })),
            },
            answer,
          );
        }
      }

      if (topic && SETUP_HINTS[topic]) {
        const answer = SETUP_HINTS[topic];
        return structuredResult({ kind: "topic", query: topic, answer, matches: [] }, answer);
      }

      const generic = [
        "Use snapmcp to create visual documentation artifacts.",
        "",
        "Quick selection:",
        "- terminal/CLI output → capture_terminal",
        "- source code or an allowed file → capture_code or capture_file",
        "- website or web app → capture_browser",
        "- Markdown/HTML/diff → capture_markdown, capture_html, or capture_diff",
        "- PDF document → capture_pdf",
        "- several independent images → capture_batch",
        "- ordered steps or animation → capture_sequence or capture_gif",
        "- captioned multi-page deliverable → capture_document",
        "",
        "Search with `query`, or read `snapmcp://capabilities` for the complete catalog. File access is deny-by-default; URL captures are SSRF-protected.",
      ].join("\n");

      return structuredResult(
        { kind: "overview", query: requested ?? topic ?? "", answer: generic, matches: [] },
        generic,
      );
    },
  );
}
