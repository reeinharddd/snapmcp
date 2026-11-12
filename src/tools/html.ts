import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureHtml } from "../renderer.js";
import { TOOL_LIMITS } from "../capabilities.js";
import { imageOutputShape } from "../results.js";
import type { ToolDeps } from "./deps.js";

export function registerHtmlTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.registerTool(
    "capture_html",
    {
      title: "Render HTML",
      description:
        "Render HTML/CSS as a screenshot in an isolated, JavaScript-disabled context. Inline styles and embedded data images are supported; scripts, frames, external stylesheets, and other external resources are removed or blocked. Maximum input 200KB.",
      inputSchema: {
        html: z.string().min(1).max(TOOL_LIMITS.html.maxBytes).describe(`HTML content to render. Active elements, event handlers, external references, and unsafe URL schemes are removed. Inline styles, <style> tags, and embedded data images work. Maximum ${TOOL_LIMITS.html.maxBytes / 1_000}KB.`),
        title: z.string().max(100).default("html").describe("Description for logging and window title (if window chrome enabled)."),
        output: z.string().optional().describe("Output filename (default: auto-generated as 'html-<timestamp>.png' or '.jpeg' based on SNAPMCP_FORMAT). Include extension to override format."),
      },
      outputSchema: imageOutputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
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
