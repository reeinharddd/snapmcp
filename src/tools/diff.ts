import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureDiff } from "../renderer.js";
import { TOOL_LIMITS } from "../capabilities.js";
import { imageOutputShape } from "../results.js";
import type { ToolDeps } from "./deps.js";

export function registerDiffTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.registerTool(
    "capture_diff",
    {
      title: "Capture a code diff",
      description:
        "Render a unified diff with color-coded additions (green) and deletions (red). Shows file headers, hunk markers, and context lines. Ideal for PR reviews, migration guides, and change documentation. Maximum input 500KB.",
      inputSchema: {
        diff: z.string().min(1).max(TOOL_LIMITS.diff.maxBytes).describe(`Unified diff content (for example, output from 'git diff' or 'diff -u'). File headers (---/+++) and hunk markers (@@ -... +... @@) are rendered when present. Maximum ${TOOL_LIMITS.diff.maxBytes / 1_000}KB.`),
        output: z.string().optional().describe("Output filename (default: auto-generated as 'diff-<timestamp>.png' or '.jpeg' based on SNAPMCP_FORMAT). Include extension to override format."),
      },
      outputSchema: imageOutputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
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
