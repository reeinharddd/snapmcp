import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureBrowser } from "../renderer.js";
import { validateUrl, SecurityError } from "../security.js";
import { logger, AuditEventType } from "../logger.js";
import { TOOL_LIMITS } from "../capabilities.js";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

export function registerBrowserTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_browser",
    "Take a screenshot of an HTTP(S) URL using headless Chromium. Uses Playwright's bundled Chromium by default; set SNAPMCP_CHROME_EXECUTABLE or the experimental SNAPMCP_CHROME_PROFILE to opt into a system Chrome or persistent profile. Explicit profile mode can send profile cookies and session state to the target site. SSRF protection is enabled by default and blocks private/local targets. Supports full-page or viewport captures.",
    {
      url: z.string().url().describe("URL to capture (http/https). Private and local IPv4/IPv6 targets, localhost variants, and hostnames resolving to private addresses are blocked when SSRF protection is enabled."),
      fullPage: z.boolean().default(false).describe("Capture the full scrollable page (true) or the viewport (false)."),
      width: z.number().int().min(TOOL_LIMITS.browser.minWidth).max(TOOL_LIMITS.browser.maxWidth).default(1280).describe(`Viewport width in pixels (${TOOL_LIMITS.browser.minWidth}-${TOOL_LIMITS.browser.maxWidth}).`),
      height: z.number().int().min(TOOL_LIMITS.browser.minHeight).max(TOOL_LIMITS.browser.maxHeight).default(800).describe(`Viewport height in pixels (${TOOL_LIMITS.browser.minHeight}-${TOOL_LIMITS.browser.maxHeight}).`),
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
