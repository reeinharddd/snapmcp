import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  captureTerminal, captureCode, captureFile,
  captureBrowser, captureMarkdown, captureHtml, captureDiff
} from "../renderer.js";
import { createDocument, type DocumentSection, type DocumentFormat } from "../document.js"
import {
  createOutputPath,
  resolveNamedOutput,
} from "../output.js";
import { runCleanup } from "../renderer.js";
import path from "node:path";
import { TOOL_LIMITS } from "../capabilities.js";
import { artifactResult, documentOutputShape } from "../results.js";
import type { ToolDeps } from "./deps.js";

// Common field for all capture types in document
const CaptureCommon = {
  caption: z.string().max(200).optional().describe("Caption for this capture in the document"),
};

// Discriminated union for capture parameters - include caption in each variant
const TerminalParams = z.object({
  type: z.literal("terminal"),
  title: z.string().max(100).optional().describe("Window title (default: 'step')"),
  lines: z.array(z.string()).min(1).max(TOOL_LIMITS.terminal.maxLines).describe("Lines to render. Prefix with '$ ' for prompts."),
  ...CaptureCommon,
});

const CodeParams = z.object({
  type: z.literal("code"),
  code: z.string().min(1).max(TOOL_LIMITS.code.maxBytes).describe("Source code to render"),
  language: z.string().default("text").describe("Programming language (typescript, python, rust, go, etc.)"),
  title: z.string().max(100).optional().describe("Window title (default: 'step')"),
  startLine: z.number().int().min(1).optional().describe("First line number (1-indexed)"),
  endLine: z.number().int().min(1).optional().describe("Last line number (1-indexed, inclusive)"),
  ...CaptureCommon,
});

const FileParams = z.object({
  type: z.literal("file"),
  filePath: z.string().min(1).describe("Absolute path to file (must be in SNAPMCP_ALLOWED_PATHS)"),
  startLine: z.number().int().min(1).optional().describe("First line number (1-indexed)"),
  endLine: z.number().int().min(1).optional().describe("Last line number (1-indexed, inclusive)"),
  ...CaptureCommon,
});

const BrowserParams = z.object({
  type: z.literal("browser"),
  url: z.string().url().describe("URL to capture (http/https, SSRF protected)"),
  fullPage: z.boolean().default(false).describe("Capture full scrollable page"),
  width: z.number().int().min(TOOL_LIMITS.browser.minWidth).max(TOOL_LIMITS.browser.maxWidth).default(1280).describe("Viewport width (px)"),
  height: z.number().int().min(TOOL_LIMITS.browser.minHeight).max(TOOL_LIMITS.browser.maxHeight).default(800).describe("Viewport height (px)"),
  ...CaptureCommon,
});

const MarkdownParams = z.object({
  type: z.literal("markdown"),
  markdown: z.string().min(1).max(TOOL_LIMITS.markdown.maxBytes).describe("Markdown content (GFM supported)"),
  title: z.string().max(100).optional().describe("Document title (default: 'step')"),
  ...CaptureCommon,
});

const HtmlParams = z.object({
  type: z.literal("html"),
  html: z.string().min(1).max(TOOL_LIMITS.html.maxBytes).describe("HTML content (external resources blocked)"),
  title: z.string().max(100).optional().describe("Description for logging (default: 'step')"),
  ...CaptureCommon,
});

const DiffParams = z.object({
  type: z.literal("diff"),
  diff: z.string().min(1).max(TOOL_LIMITS.diff.maxBytes).describe("Unified diff content (git diff format)"),
  ...CaptureCommon,
});

const CaptureWithCaption = z.discriminatedUnion("type", [
  TerminalParams, CodeParams, FileParams, BrowserParams,
  MarkdownParams, HtmlParams, DiffParams,
]);

/** File extension produced by each document format. */
const DOCUMENT_EXTENSIONS: Record<DocumentFormat, string> = {
  markdown: ".md",
  html: ".html",
  pdf: ".pdf",
  pptx: ".pptx",
  docx: ".docx",
};

export function registerDocumentTool(server: McpServer, { fail, config }: ToolDeps): void {
  server.registerTool(
    "capture_document",
    {
      title: "Capture a visual document",
      description: `Create a document with embedded step-by-step captures. Each capture is rendered as an image and embedded in the document with optional captions. Output formats: markdown (with image references), html (self-contained with base64 images), pdf (print-quality), pptx (editable PowerPoint deck), or docx (editable Word document). Maximum ${TOOL_LIMITS.document.maxCaptures} captures per document; ${TOOL_LIMITS.document.maxEmbeddedImageBytes / 1_000_000} MB per embedded image and ${TOOL_LIMITS.document.maxEmbeddedTotalBytes / 1_000_000} MB total.`,
      inputSchema: {
        title: z.string().min(1).max(200).describe("Document title"),
        captures: z.array(CaptureWithCaption).min(1).max(TOOL_LIMITS.document.maxCaptures).describe("Array of captures to embed. Each specifies capture type, type-specific parameters, and optional caption."),
        format: z.enum(["markdown", "html", "pdf", "pptx", "docx"]).default("markdown").describe("Output document format: markdown (image refs), html (self-contained), pdf (print-quality), pptx (editable PowerPoint), docx (editable Word)"),
        includeTimestamps: z.boolean().default(false).describe("Include capture timestamps in the document"),
        output: z.string().optional().describe("Output filename (default: auto-generated as 'document-<timestamp>.md/.html/.pdf/.pptx/.docx'). Extension should match format."),
      },
      outputSchema: documentOutputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ title, captures, format, includeTimestamps, output }) => {
      try {
        // First capture all steps as images
        const capturedPaths: { imagePath: string; caption?: string }[] = [];

        const imageExtension = config.format === "jpeg" ? "jpg" : "png";
        for (const cap of captures) {
          const prefix = cap.type;
          const p = createOutputPath(config.outputDir, config.outputDir, prefix, imageExtension);

          switch (cap.type) {
            case "terminal": {
              await captureTerminal(cap.title || "step", cap.lines, p, config);
              break;
            }
            case "code": {
              await captureCode(cap.code, cap.language, cap.title || "step", p, config, cap.startLine, cap.endLine);
              break;
            }
            case "file": {
              await captureFile(cap.filePath, p, config, cap.startLine, cap.endLine);
              break;
            }
            case "browser": {
              await captureBrowser(cap.url, p, cap.fullPage, cap.width, cap.height, config);
              break;
            }
            case "markdown": {
              await captureMarkdown(cap.markdown, cap.title || "step", p, config);
              break;
            }
            case "html": {
              await captureHtml(cap.html, cap.title || "step", p, config);
              break;
            }
            case "diff": {
              await captureDiff(cap.diff, p, config);
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

        const docExt = DOCUMENT_EXTENSIONS[format];
        const requestedOutput = output?.trim();
        const outputName = requestedOutput
          ? (path.extname(requestedOutput) ? requestedOutput : `${requestedOutput}${docExt}`)
          : undefined;
        const docOutput = outputName
          ? resolveNamedOutput(config.outputDir, outputName, [docExt])
          : createOutputPath(config.outputDir, config.outputDir, "document", docExt);

        await createDocument(
          { title, sections, format: format as DocumentFormat, includeTimestamps, outputPath: docOutput },
          config,
        );

        runCleanup(config);
        return artifactResult(
          docOutput,
          { captureCount: captures.length },
          `✅ Document saved: ${docOutput} (${captures.length} captures, ${format})`,
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
