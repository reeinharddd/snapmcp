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
    "Render arbitrary HTML as a screenshot.",
    {
      html: z.string().min(1).describe("HTML content to render"),
      title: z.string().default("html").describe("Description (for logging)"),
      output: z.string().optional().describe("Output filename (default: auto-generated)"),
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
