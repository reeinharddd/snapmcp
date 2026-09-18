import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureTerminal } from "../renderer.js";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

export function registerTerminalTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_terminal",
    "Generate a styled terminal screenshot from text lines with real terminal theme colors. Automatically detects your terminal theme (Kitty, GNOME, Alacritty, WezTerm, etc.) for authentic prompt colors. Use for CLI tutorials, command output documentation, and terminal-based guides.",
    {
      title: z.string().min(1).max(100).describe("Window title shown in the terminal title bar (e.g., 'bash', 'zsh', 'git log')"),
      lines: z.array(z.string()).min(1).max(1000).describe("Lines to render. Prefix command prompts with '$ ' (or '# ' for root) for syntax-colored prompts. Other lines are rendered as output. Maximum 1000 lines."),
      output: z.string().optional().describe("Output filename (default: auto-generated as 'terminal-<timestamp>.png' or '.jpeg' based on SNAPMCP_FORMAT). Include extension to override format."),
    },
    async ({ title, lines, output }) => {
      try {
        const p = outPath("terminal", output);
        await captureTerminal(title, lines, p, config);
        return ok(p);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
