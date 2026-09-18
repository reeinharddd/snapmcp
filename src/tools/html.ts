import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureHtml } from "../renderer.js";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

export function registerHtmlTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_html",
    "Render arbitrary HTML as a screenshot with full CSS support. Use for custom UI previews, email templates, dashboard widgets, or any HTML/CSS content. Renders in a clean viewport with optional window chrome. Security: input is sanitized, external resources (scripts, iframes, external CSS) are blocked. Maximum input 200KB.",
    {
      html: z.string().min(1).max(200_000).describe("HTML content to render. External scripts, iframes, and external stylesheets are blocked for security. Inline styles and <style> tags work. Maximum 200KB."),
      title: z.string().max(100).default("html").describe("Description for logging and window title (if window chrome enabled)."),
      output: z.string().optional().describe("Output filename (default: auto-generated as 'html-<timestamp>.png' or '.jpeg' based on SNAPMCP_FORMAT). Include extension to override format."),
    },
    async ({ html, title, output }) => {
      try {
        const p = outPath("html", output);
        await captureHtml(html, title, p, config);
        return ok(p);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
