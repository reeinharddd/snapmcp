import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureTerminal } from "../renderer.js";
import { TOOL_LIMITS } from "../capabilities.js";
import { imageOutputShape } from "../results.js";
import type { ToolDeps } from "./deps.js";

export function registerTerminalTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.registerTool(
    "capture_terminal",
    {
      title: "Capture terminal output",
      description:
        "Generate a styled terminal screenshot from text lines. Uses a detected terminal palette when available (Kitty, GNOME, Alacritty, WezTerm, and others) and otherwise falls back to the configured theme. Use for CLI tutorials, command output documentation, and terminal-based guides.",
      inputSchema: {
        title: z.string().min(1).max(100).describe("Window title shown in the terminal title bar (e.g., 'bash', 'zsh', 'git log')"),
        lines: z.array(z.string()).min(1).max(TOOL_LIMITS.terminal.maxLines).describe(`Lines to render. Prefix command prompts with '$ ' (or '# ' for root) for syntax-colored prompts. Other lines are rendered as output. Maximum ${TOOL_LIMITS.terminal.maxLines} lines.`),
        output: z.string().optional().describe("Output filename (default: auto-generated as 'terminal-<timestamp>.png' or '.jpeg' based on SNAPMCP_FORMAT). Include extension to override format."),
      },
      outputSchema: imageOutputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
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
