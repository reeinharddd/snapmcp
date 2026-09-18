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
    "Take a screenshot of a URL using headless Chromium. Uses system Chrome profile when available (set SNAPMCP_CHROME_PROFILE) for authenticated sessions, cookies, and extensions. SSRF protection is enabled by default (SNAPMCP_SSRF_PROTECTION=true) - blocks private IPs, localhost, and DNS-rebounding attacks. Supports full-page or viewport captures.",
    {
      url: z.string().url().describe("URL to capture (http/https). Must pass SSRF validation: no private IPs (10/8, 172.16/12, 192.168/16, fc00::/7), no localhost variants, no DNS-rebinding. Redirects are also validated."),
      fullPage: z.boolean().default(false).describe("Capture full scrollable page (true) or just the viewport (false). Full page may take longer and use more memory."),
      width: z.number().int().min(320).max(3840).default(1280).describe("Viewport width in pixels (320-3840). Ignored if fullPage=true."),
      height: z.number().int().min(240).max(4096).default(800).describe("Viewport height in pixels (240-4096). Ignored if fullPage=true."),
      output: z.string().optional().describe("Output filename (default: auto-generated as 'browser-<timestamp>.png' or '.jpeg' based on SNAPMCP_FORMAT). Include extension to override format."),
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
