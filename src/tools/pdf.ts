import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { capturePdf } from "../renderer.js"
import { resolveSafePath } from "../security.js";
import { logger, AuditEventType } from "../logger.js";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

export function registerPdfTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_pdf",
    "Convert a URL to a PDF document using headless Chromium.",
    {
      url: z.string().url().describe("URL to convert to PDF"),
      fullPage: z.boolean().default(true).describe("Include all content"),
      width: z.number().int().min(320).max(3840).default(1280).describe("Viewport width"),
      height: z.number().int().min(240).max(4096).default(800).describe("Viewport height"),
      output: z.string().optional().describe("Output filename (default: auto-generated)"),
    },
    async ({ url, fullPage, width, height, output }) => {
      try {
        const { validateUrl } = await import("../security.js");
        if (config.securityChecks) validateUrl(url, config.ssrfProtection);
        
        const filename = output || `pdf-${Date.now()}.pdf`;
        const hasExt = /\.(pdf)$/i.test(filename);
        const finalName = hasExt ? filename : `${filename}.pdf`;
        const p = resolveSafePath(config.outputDir, finalName);
        
        await capturePdf(url, p, fullPage, width, height, config);
        logger.audit({ event: AuditEventType.CapturePdf, severity: "info", detail: `URL: ${url}`, source: "capture_pdf" });
        return ok(p);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
