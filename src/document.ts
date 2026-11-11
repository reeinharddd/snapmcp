/**
 * Document generation module for snapmcp.
 *
 * Compiles a sequence of captures (images, code, text) into a formatted
 * document in Markdown, HTML, or PDF format. Images are embedded as base64
 * data URIs so documents are fully self-contained.
 *
 * @module
 */

import fs from "node:fs"
import path from "node:path"
import type { SnapConfig } from "./config.js"
import { logger } from "./logger.js"
import { BRAND } from "./brand.js"
import { captureHtmlToPdf } from "./renderer.js"
import { validateFileRead, LimitError } from "./security.js"
import { TOOL_LIMITS } from "./capabilities.js"

// ─── Types ─────────────────────────────────────────────────────

/** Supported output formats. */
export type DocumentFormat = "markdown" | "html" | "pdf"

/** A single section inside a generated document. */
export interface DocumentSection {
  /** Section heading (optional — omitted when absent). */
  title?: string
  /** Descriptive text rendered as a paragraph. */
  description?: string
  /** Path to an existing PNG capture to embed. */
  imagePath?: string
  /** Visible caption below the image. */
  caption?: string
  /** Optional code block to include (rendered in a fenced block). */
  code?: string
  /** Programming language for syntax highlighting in code blocks. */
  codeLanguage?: string
}

/** Options for building a document. */
export interface DocumentOptions {
  /** Document title (becomes the top-level heading). */
  title: string
  /** Ordered list of sections. */
  sections: DocumentSection[]
  /** Output document format. */
  format: DocumentFormat
  /** Include a timestamp header in the document. */
  includeTimestamps?: boolean
  /** Absolute or relative output path (.md, .html, or .pdf). */
  outputPath: string
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Create a self-contained document with embedded captures.
 *
 * Renders the specified sections (images, code, text) into a single
 * document in the requested format. Images are read from disk and
 * embedded as base64 data URIs, making the output fully portable.
 *
 * @param options Document content and format options
 * @param config  Server configuration (used for PDF only)
 * @returns The resolved output path on success
 */
export async function createDocument(
  options: DocumentOptions,
  config: SnapConfig,
): Promise<string> {
  const { title, sections, format, includeTimestamps, outputPath } = options

  if (sections.length === 0) {
    throw new DocumentError("At least one section is required")
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true })

  switch (format) {
    case "markdown":
      return writeMarkdown(title, sections, includeTimestamps ?? false, outputPath, config)
    case "html":
      return writeHtml(title, sections, includeTimestamps ?? false, outputPath, config)
    case "pdf":
      return writePdf(title, sections, includeTimestamps ?? false, outputPath, config)
    default:
      throw new DocumentError(`Unsupported format: ${format}`)
  }
}

// ─── Error ─────────────────────────────────────────────────────

/**
 * Error thrown by document operations.
 */
export class DocumentError extends Error {
  constructor(message: string) {
    super(`[DOCUMENT] ${message}`)
    this.name = "DocumentError"
  }
}

// ─── Markdown output ───────────────────────────────────────────

function writeMarkdown(
  title: string,
  sections: DocumentSection[],
  includeTimestamps: boolean,
  outputPath: string,
  config: SnapConfig,
): string {
  const lines: string[] = []
  let embeddedBytes = 0

  lines.push(`# ${escapeMd(title)}`)
  lines.push("")

  if (includeTimestamps) {
    lines.push(`_Generated: ${new Date().toISOString()}_`)
    lines.push("")
  }

  for (const section of sections) {
    if (section.title) {
      lines.push(`## ${escapeMd(section.title)}`)
      lines.push("")
    }

    if (section.description) {
      lines.push(section.description)
      lines.push("")
    }

    if (section.imagePath) {
      const remainingBytes = TOOL_LIMITS.document.maxEmbeddedTotalBytes - embeddedBytes
      const image = readImageDataUri(section.imagePath, config, remainingBytes)
      if (image) {
        embeddedBytes += image.byteLength
        const caption = section.caption ? escapeMd(section.caption) : ""
        lines.push(`![${caption}](${image.dataUri})`)
        lines.push("")
        if (section.caption) {
          lines.push(`*${escapeMd(section.caption)}*`)
          lines.push("")
        }
      }
    }

    if (section.code) {
      const lang = section.codeLanguage ?? ""
      lines.push("```" + lang)
      lines.push(section.code)
      lines.push("```")
      lines.push("")
    }
  }

  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8")
  logger.info(`Markdown document saved: ${outputPath}`)
  return outputPath
}

/** Minimal Markdown escaping. */
function escapeMd(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|])/g, "\\$1")
}

// ─── HTML output ───────────────────────────────────────────────

function buildHtml(
  title: string,
  sections: DocumentSection[],
  includeTimestamps: boolean,
  config: SnapConfig,
): string {
  const parts: string[] = []
  let embeddedBytes = 0

  parts.push("<!DOCTYPE html>")
  parts.push('<html lang="en">')
  parts.push("<head><meta charset=\"utf-8\">")
  parts.push(`<title>${escHtml(title)}</title>`)
  parts.push("<style>")
  const C = BRAND.colors;
  parts.push("*{margin:0;padding:0;box-sizing:border-box}")
  parts.push(`body{background:${C.neutral.black};color:${C.neutral.lighter};font-family:${BRAND.typography.fontStack.ui};font-size:16px;line-height:1.7;padding:40px;max-width:900px;margin:0 auto}`)
  parts.push(`h1{color:${C.brand.secondary};font-size:1.8em;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:.3em;margin-bottom:.8em}`)
  parts.push(`h2{color:${C.brand.secondary};font-size:1.4em;margin:1.2em 0 .5em}`)
  parts.push("p{margin:.8em 0}")
  parts.push("figure{margin:1.2em 0;text-align:center}")
  parts.push(`figure img{max-width:100%;border-radius:6px;box-shadow:${BRAND.shadows.medium}}`)
  parts.push(`figcaption{color:${C.neutral.gray};font-size:.88em;margin-top:6px;font-style:italic}`)
  parts.push(`code{background:${C.neutral.medium};padding:2px 8px;border-radius:4px;font-family:${BRAND.typography.fontStack.mono};font-size:.88em}`)
  parts.push(`pre{margin:.8em 0;padding:14px 18px;background:${C.neutral.dark};border-radius:6px;overflow-x:auto}`)
  parts.push("pre code{background:none;padding:0}")
  parts.push(`.timestamp{color:${C.neutral.gray};font-size:.88em;margin-bottom:1.5em}`)
  parts.push("</style></head><body>")
  parts.push(`<h1>${escHtml(title)}</h1>`)

  if (includeTimestamps) {
    parts.push(`<p class="timestamp">Generated: ${new Date().toISOString()}</p>`)
  }

  for (const section of sections) {
    if (section.title) {
      parts.push(`<h2>${escHtml(section.title)}</h2>`)
    }
    if (section.description) {
      parts.push(`<p>${escHtml(section.description)}</p>`)
    }
    if (section.imagePath) {
      const remainingBytes = TOOL_LIMITS.document.maxEmbeddedTotalBytes - embeddedBytes
      const image = readImageDataUri(section.imagePath, config, remainingBytes)
      if (image) {
        embeddedBytes += image.byteLength
        parts.push("<figure>")
        parts.push(`<img src="${image.dataUri}" alt="${escHtml(section.caption ?? "")}">`)
        if (section.caption) {
          parts.push(`<figcaption>${escHtml(section.caption)}</figcaption>`)
        }
        parts.push("</figure>")
      }
    }
    if (section.code) {
      const lang = section.codeLanguage ?? ""
      parts.push(`<pre><code class="language-${escHtml(lang)}">${escHtml(section.code)}</code></pre>`)
    }
  }

  parts.push("</body></html>")

  return parts.join("\n")
}

function writeHtml(
  title: string,
  sections: DocumentSection[],
  includeTimestamps: boolean,
  outputPath: string,
  config: SnapConfig,
): string {
  const html = buildHtml(title, sections, includeTimestamps, config)
  fs.writeFileSync(outputPath, html, "utf-8")
  logger.info(`HTML document saved: ${outputPath}`)
  return outputPath
}

// ─── PDF output — render HTML through Playwright ───────────────

async function writePdf(
  title: string,
  sections: DocumentSection[],
  includeTimestamps: boolean,
  outputPath: string,
  config: SnapConfig,
): Promise<string> {
  // Build the document in memory. Avoiding a sibling .html temporary prevents
  // the PDF output from being deleted when the output name has no .pdf suffix.
  const html = buildHtml(title, sections, includeTimestamps, config)
  await captureHtmlToPdf(html, outputPath, config)

  logger.info(`PDF document saved: ${outputPath}`)
  return outputPath
}

// ─── Helpers ───────────────────────────────────────────────────

interface EmbeddedImage {
  dataUri: string;
  mimeType: string;
  byteLength: number;
}

/** Detect supported image formats from their file signatures. */
function detectImageMime(data: Buffer): string | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (data.length >= 6 && data.subarray(0, 6).toString("ascii") === "GIF87a") {
    return "image/gif";
  }
  if (data.length >= 6 && data.subarray(0, 6).toString("ascii") === "GIF89a") {
    return "image/gif";
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Read an image file and return a base64 data URI with its real MIME type.
 * Restricted to the output directory and configured allowlist. Missing or
 * unsupported images are skipped, while embedding-limit violations fail
 * loudly so a document can never be reported as complete when it is not.
 */
function readImageDataUri(
  filePath: string,
  config: SnapConfig,
  remainingTotalBytes: number,
): EmbeddedImage | null {
  try {
    if (config.securityChecks) {
      validateFileRead(filePath, {
        maxSize: TOOL_LIMITS.document.maxEmbeddedImageBytes,
        allowedPaths: [config.outputDir, ...config.allowedPaths],
      });
    }
    const resolved = fs.realpathSync(path.resolve(filePath));
    const byteLength = fs.statSync(resolved).size;
    if (byteLength > TOOL_LIMITS.document.maxEmbeddedImageBytes) {
      throw new DocumentError(
        `Image "${filePath}" exceeds the ${TOOL_LIMITS.document.maxEmbeddedImageBytes}-byte embedding limit`,
      );
    }
    if (byteLength > remainingTotalBytes) {
      throw new DocumentError(
        `Embedded images exceed the ${TOOL_LIMITS.document.maxEmbeddedTotalBytes}-byte document limit`,
      );
    }
    const data = fs.readFileSync(resolved);
    const mimeType = detectImageMime(data);
    if (!mimeType) return null;
    return {
      mimeType,
      byteLength,
      dataUri: `data:${mimeType};base64,${data.toString("base64")}`,
    };
  } catch (err) {
    if (err instanceof DocumentError) throw err;
    if (err instanceof LimitError) {
      throw new DocumentError(
        `Image "${filePath}" exceeds the ${TOOL_LIMITS.document.maxEmbeddedImageBytes}-byte embedding limit`,
      );
    }
    logger.warn(`Cannot embed image, skipping: ${filePath} — ${(err as Error).message}`)
    return null
  }
}

/** Simple HTML escaping. */
function escHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
