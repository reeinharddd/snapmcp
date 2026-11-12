import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { capturePdf } from "../renderer.js"
import { createOutputPath, resolveNamedOutput } from "../output.js";
import { logger, AuditEventType } from "../logger.js";
import path from "node:path";
import { TOOL_LIMITS } from "../capabilities.js";
import { pdfOutputShape } from "../results.js";
import type { ToolDeps } from "./deps.js";

export function registerPdfTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.registerTool(
    "capture_pdf",
    {
      title: "Capture a URL as PDF",
      description:
        "Convert a URL to a print-quality PDF using headless Chromium. The complete paginated document is printed. Uses a system Chrome profile only when explicitly configured. SSRF protection is enabled by default (blocks private IPs and localhost).",
      inputSchema: {
        url: z.string().url().describe("URL to convert to PDF (http/https). Must pass SSRF validation: private and local addresses are blocked and requests are revalidated."),
        width: z.number().int().min(TOOL_LIMITS.browser.minWidth).max(TOOL_LIMITS.browser.maxWidth).default(1280).describe(`Viewport width in pixels (${TOOL_LIMITS.browser.minWidth}-${TOOL_LIMITS.browser.maxWidth}) for responsive rendering.`),
        height: z.number().int().min(TOOL_LIMITS.browser.minHeight).max(TOOL_LIMITS.browser.maxHeight).default(800).describe(`Viewport height in pixels (${TOOL_LIMITS.browser.minHeight}-${TOOL_LIMITS.browser.maxHeight}) for responsive rendering.`),
        output: z.string().optional().describe("Output filename (default: auto-generated as 'pdf-<timestamp>.pdf'). Must end in .pdf."),
      },
      outputSchema: pdfOutputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ url, width, height, output }) => {
      try {
        const { validateUrl } = await import("../security.js");
        if (config.securityChecks) validateUrl(url, config.ssrfProtection);

        const requested = output?.trim();
        const extension = requested ? (path.extname(requested).toLowerCase()) : "";
        if (extension && extension !== ".pdf") {
          throw new Error(`Unsupported PDF output extension "${extension}" (expected .pdf)`);
        }
        const filename = requested ? (extension ? requested : `${requested}.pdf`) : undefined;
        const p = filename
          ? resolveNamedOutput(config.outputDir, filename, [".pdf"])
          : createOutputPath(config.outputDir, config.outputDir, "pdf", "pdf");

        await capturePdf(url, p, width, height, config);
        logger.audit({ event: AuditEventType.CapturePdf, severity: "info", detail: `URL: ${url}`, source: "capture_pdf" });
        return ok(p);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
