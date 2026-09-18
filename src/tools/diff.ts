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
    "Render a git diff with color-coded additions (green) and deletions (red). Parses unified diff format (output of `git diff`, `diff -u`). Shows file headers, line numbers, and context lines. Ideal for PR reviews, migration guides, and change documentation. Maximum input 500KB.",
    {
      diff: z.string().min(1).max(500_000).describe("Diff content in unified diff format (e.g., output of 'git diff' or 'diff -u'). Must include file headers (---/+++) and hunks (@@ -... +... @@). Maximum 500KB."),
      output: z.string().optional().describe("Output filename (default: auto-generated as 'diff-<timestamp>.png' or '.jpeg' based on SNAPMCP_FORMAT). Include extension to override format."),
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
