import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  captureTerminal, captureCode, captureFile, 
  captureBrowser, captureMarkdown, captureHtml, captureDiff 
} from "../renderer.js";
import { runCleanup } from "../renderer.js";
import path from "path";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

export function registerBatchTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_batch",
    "Capture multiple items in a single call. Each capture is processed sequentially.",
    {
      captures: z.array(z.object({
        type: z.enum(["terminal", "code", "file", "browser", "markdown", "html", "diff"]),
        params: z.record(z.string(), z.any()).describe("Parameters for the capture type"),
        caption: z.string().optional().describe("Optional caption/label for the capture"),
      })).min(1).max(10),
      output: z.string().optional().describe("Output directory (default: SNAPMCP_DIR)"),
    },
    async ({ captures, output }) => {
      try {
        const OUTPUT_DIR = config.outputDir;
        const results: { type: string; path: string; caption?: string }[] = [];
        
        for (const cap of captures) {
          const prefix = cap.type;
          const p = path.join(OUTPUT_DIR, `${prefix}-${Date.now()}.${config.format === "jpeg" ? "jpg" : "png"}`);
          
          switch (cap.type) {
            case "terminal": {
              const { title, lines } = cap.params as { title?: string; lines?: string[] };
              await captureTerminal(title || "terminal", lines || [], p, config);
              break;
            }
            case "code": {
              const { code, language, title } = cap.params as { code?: string; language?: string; title?: string };
              await captureCode(code || "", language || "text", title || "code", p, config);
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
              await captureMarkdown(markdown || "", title || "document", p, config);
              break;
            }
            case "html": {
              const { html, title } = cap.params as { html?: string; title?: string };
              await captureHtml(html || "", title || "html", p, config);
              break;
            }
            case "diff": {
              const { diff } = cap.params as { diff?: string };
              await captureDiff(diff || "", p, config);
              break;
            }
          }
          
          results.push({ type: cap.type, path: p, caption: cap.caption });
        }
        
        runCleanup(config);
        
        const summary = results.map(r =>
          `  ${r.caption ? `[${r.caption}] ` : ""}${r.type}: ${r.path}`
        ).join("\n");
        
        return ok(`✅ Batch complete (${results.length} captures):\n${summary}`);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
