import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureMarkdown } from "../renderer.js";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

export function registerMarkdownTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_markdown",
    "Render Markdown as a styled document screenshot.",
    {
      markdown: z.string().min(1).describe("Markdown content to render"),
      title: z.string().default("document").describe("Document title"),
      output: z.string().optional().describe("Output filename (default: auto-generated)"),
    },
    async ({ markdown, title, output }) => {
      try {
        const p = outPath("markdown", output);
        await captureMarkdown(markdown, title, p, config);
        return ok(p);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
