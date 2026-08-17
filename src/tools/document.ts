import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  captureTerminal, captureCode, captureFile, 
  captureBrowser, captureMarkdown, captureHtml, captureDiff 
} from "../renderer.js";
import { createDocument, type DocumentSection, type DocumentFormat } from "../document.js"
import { resolveSafePath } from "../security.js";
import { runCleanup } from "../renderer.js";
import path from "path";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

export function registerDocumentTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_to_document",
    "Create a document (Markdown/HTML/PDF) with embedded step-by-step captures.",
    {
      title: z.string().min(1).describe("Document title"),
      captures: z.array(z.object({
        type: z.enum(["terminal", "code", "file", "browser", "markdown", "html", "diff"]),
        params: z.record(z.string(), z.any()).describe("Parameters for the capture type"),
        caption: z.string().optional().describe("Caption for this capture"),
      })).min(1).max(30),
      format: z.enum(["markdown", "html", "pdf"]).default("markdown").describe("Output document format"),
      includeTimestamps: z.boolean().default(false).describe("Include timestamps in document"),
      output: z.string().optional().describe("Output filename (default: auto-generated)"),
    },
    async ({ title, captures, format, includeTimestamps, output }) => {
      try {
        // First capture all steps as images
        const capturedPaths: { imagePath: string; caption?: string }[] = [];
        
        for (const cap of captures) {
          const prefix = cap.type;
          const p = path.join(config.outputDir, `${prefix}-${Date.now()}.${config.format === "jpeg" ? "jpg" : "png"}`);
          
          switch (cap.type) {
            case "terminal": {
              const { title, lines } = cap.params as { title?: string; lines?: string[] };
              await captureTerminal(title || "step", lines || [], p, config);
              break;
            }
            case "code": {
              const { code, language, title } = cap.params as { code?: string; language?: string; title?: string };
              await captureCode(code || "", language || "text", title || "step", p, config);
              break;
            }
            case "file": {
              const { filePath } = cap.params as { filePath?: string };
              await captureFile(filePath || "", p, config);
              break;
            }
            case "browser": {
              const { url, fullPage, width, height } = cap.params as { url?: string; fullPage?: boolean; width?: number; height?: number };
              await captureBrowser(url || "about:blank", p, fullPage || false, width || 1280, height || 800, config);
              break;
            }
            case "markdown": {
              const { markdown, title } = cap.params as { markdown?: string; title?: string };
              await captureMarkdown(markdown || "", title || "step", p, config);
              break;
            }
            case "html": {
              const { html, title } = cap.params as { html?: string; title?: string };
              await captureHtml(html || "", title || "step", p, config);
              break;
            }
            case "diff": {
              const { diff } = cap.params as { diff?: string };
              await captureDiff(diff || "", p, config);
              break;
            }
          }
          capturedPaths.push({ imagePath: p, caption: cap.caption });
        }
        
        // Build document sections from captured images
        const sections: DocumentSection[] = capturedPaths.map(cp => ({
          imagePath: cp.imagePath,
          caption: cp.caption,
        }));
        
        const docExt = format === "markdown" ? "md" : format === "html" ? "html" : "pdf";
        const docOutput = output
          ? resolveSafePath(config.outputDir, output)
          : path.join(config.outputDir, `document-${Date.now()}.${docExt}`);
        
        await createDocument(
          { title, sections, format: format as DocumentFormat, includeTimestamps, outputPath: docOutput },
          config,
        );
        
        runCleanup(config);
        return ok(`✅ Document saved: ${docOutput} (${captures.length} captures, ${format})`);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
