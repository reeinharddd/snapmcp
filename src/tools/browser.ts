import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureBrowser } from "../renderer.js";
import { validateUrl, SecurityError } from "../security.js";
import { logger, AuditEventType } from "../logger.js";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

export function registerBrowserTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_browser",
    "Take a screenshot of a URL using headless Chromium.",
    {
      url: z.string().url().describe("URL to capture"),
      fullPage: z.boolean().default(false).describe("Capture full scrollable page"),
      width: z.number().int().min(320).max(3840).default(1280).describe("Viewport width (px)"),
      height: z.number().int().min(240).max(4096).default(800).describe("Viewport height (px)"),
      output: z.string().optional().describe("Output filename (default: auto-generated)"),
    },
    async ({ url, fullPage, width, height, output }) => {
      try {
        if (config.securityChecks) validateUrl(url, config.ssrfProtection);
        const p = outPath("browser", output);
        await captureBrowser(url, p, fullPage, width, height, config);
        logger.audit({ event: AuditEventType.CaptureBrowser, severity: "info", detail: `URL: ${url}`, source: "capture_browser" });
        return ok(p);
      } catch (e) {
        if (e instanceof SecurityError) {
          logger.audit({ event: "ssrf_block", severity: "warn", detail: `blocked URL: ${url}`, source: "capture_browser" });
        }
        return fail(e);
      }
    },
  );
}
