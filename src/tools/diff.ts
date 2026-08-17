import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureDiff } from "../renderer.js";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

export function registerDiffTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_diff",
    "Render a git diff with color-coded additions and deletions.",
    {
      diff: z.string().min(1).describe("Diff content (git diff / unified diff format)"),
      output: z.string().optional().describe("Output filename (default: auto-generated)"),
    },
    async ({ diff, output }) => {
      try {
        const p = outPath("diff", output);
        await captureDiff(diff, p, config);
        return ok(p);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
