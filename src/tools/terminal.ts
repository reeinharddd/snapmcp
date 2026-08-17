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
    "Generate a styled terminal screenshot from text lines. Prefix with '$ ' for command prompts.",
    {
      title: z.string().min(1).describe("Window title shown in the terminal title bar"),
      lines: z.array(z.string()).min(1).describe("Lines to render. '$ ' prefix = command prompt, others = output"),
      output: z.string().optional().describe("Output filename (default: auto-generated)"),
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
