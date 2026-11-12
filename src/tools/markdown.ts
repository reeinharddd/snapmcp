import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureMarkdown } from "../renderer.js";
import { TOOL_LIMITS } from "../capabilities.js";
import { imageOutputShape } from "../results.js";
import type { ToolDeps } from "./deps.js";

export function registerMarkdownTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.registerTool(
    "capture_markdown",
    {
      title: "Render Markdown",
      description:
        "Render GitHub-flavored Markdown as a styled document screenshot. Supports tables, task lists, and fenced code blocks with syntax highlighting. Raw HTML is escaped, JavaScript is disabled, and external resources are blocked. Maximum input 200KB.",
      inputSchema: {
        markdown: z.string().min(1).max(TOOL_LIMITS.markdown.maxBytes).describe(`Markdown content to render. Supports GFM tables, task lists, fenced code blocks, strikethrough, and autolinks. Raw HTML is escaped. Maximum ${TOOL_LIMITS.markdown.maxBytes / 1_000}KB.`),
        title: z.string().max(100).default("document").describe("Document title shown in the window title bar and as H1 if not present in markdown."),
        output: z.string().optional().describe("Output filename (default: auto-generated as 'markdown-<timestamp>.png' or '.jpeg' based on SNAPMCP_FORMAT). Include extension to override format."),
      },
      outputSchema: imageOutputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
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
