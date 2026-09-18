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
    "Render Markdown as a styled document screenshot using GitHub-flavored Markdown. Supports tables, task lists, code blocks with syntax highlighting, mermaid diagrams (as text), and HTML. Renders with the configured Shiki theme and document styling. Maximum input 200KB.",
    {
      markdown: z.string().min(1).max(200_000).describe("Markdown content to render. Supports GFM: tables, task lists, fenced code blocks, strikethrough, autolinks. Maximum 200KB."),
      title: z.string().max(100).default("document").describe("Document title shown in the window title bar and as H1 if not present in markdown."),
      output: z.string().optional().describe("Output filename (default: auto-generated as 'markdown-<timestamp>.png' or '.jpeg' based on SNAPMCP_FORMAT). Include extension to override format."),
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
