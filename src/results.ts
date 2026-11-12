/**
 * Structured tool results for snapmcp.
 *
 * Every snapmcp tool advertises an output schema, so the MCP SDK requires a
 * matching `structuredContent` payload on success. This module owns the shared
 * output schemas, the file metadata helpers, and the result builders used by
 * all tools so the contract stays identical everywhere.
 *
 * @module
 */

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * Text plus optional structured payload returned by every snapmcp tool.
 *
 * Declared as a type alias so it stays assignable to the MCP `CallToolResult`
 * shape, which carries an open index signature.
 */
export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** Artifact formats snapmcp can produce. */
export const ARTIFACT_FORMATS = [
  "png",
  "jpeg",
  "gif",
  "pdf",
  "markdown",
  "html",
  "pptx",
  "docx",
] as const;

/** Format of a saved artifact. */
export type ArtifactFormat = (typeof ARTIFACT_FORMATS)[number];

/** Formats that carry pixel dimensions. */
type RasterFormat = "png" | "jpeg" | "gif";

// ─── Output schemas ───────────────────────────────────────────

/** Shape returned by tools that save a single raster image. */
export const imageOutputShape = {
  path: z.string().describe("Absolute path of the saved image file"),
  format: z.enum(["png", "jpeg"]).describe("Format of the saved image file"),
  bytes: z.number().int().nonnegative().describe("Size of the saved file in bytes"),
  width: z.number().int().positive().optional().describe("Image width in pixels"),
  height: z.number().int().positive().optional().describe("Image height in pixels"),
};

/** Shape returned by tools that save a single PDF. */
export const pdfOutputShape = {
  path: z.string().describe("Absolute path of the saved PDF"),
  format: z.literal("pdf").describe("Format of the saved file"),
  bytes: z.number().int().nonnegative().describe("Size of the saved file in bytes"),
};

/** Shape returned by tools that save a single document artifact. */
export const documentOutputShape = {
  path: z.string().describe("Absolute path of the saved document"),
  format: z
    .enum(["markdown", "html", "pdf", "pptx", "docx"])
    .describe("Format of the saved document"),
  bytes: z.number().int().nonnegative().describe("Size of the saved file in bytes"),
  captureCount: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Number of captures embedded in the document"),
};

/** Shape of a single saved capture inside a batch or sequence result. */
export const captureEntryShape = {
  type: z.string().describe("Capture type that produced the file"),
  path: z.string().describe("Absolute path of the saved file"),
  format: z.string().describe("Format of the saved file"),
  bytes: z.number().int().nonnegative().describe("Size of the saved file in bytes"),
  width: z.number().int().positive().optional().describe("Image width in pixels"),
  height: z.number().int().positive().optional().describe("Image height in pixels"),
  stepNumber: z.number().int().positive().optional().describe("Step number in the sequence"),
  label: z.string().optional().describe("Caller-provided label for the capture"),
};

/** Shape returned by capture_batch. */
export const batchOutputShape = {
  count: z.number().int().nonnegative().describe("Number of captures produced"),
  captures: z
    .array(z.object(captureEntryShape))
    .describe("One entry per saved capture, in capture order"),
};

/** Shape returned by capture_sequence. */
export const sequenceOutputShape = {
  stepCount: z.number().int().nonnegative().describe("Number of steps captured"),
  steps: z
    .array(z.object(captureEntryShape))
    .describe("One entry per captured step, in step order"),
  gifPath: z.string().optional().describe("Absolute path of the compiled GIF, when requested"),
  gifBytes: z.number().int().nonnegative().optional().describe("Size of the compiled GIF in bytes"),
};

/** Shape returned by capture_gif. */
export const gifOutputShape = {
  path: z.string().describe("Absolute path of the saved GIF"),
  format: z.literal("gif").describe("Format of the saved file"),
  bytes: z.number().int().nonnegative().describe("Size of the saved file in bytes"),
  width: z.number().int().positive().optional().describe("Animation width in pixels"),
  height: z.number().int().positive().optional().describe("Animation height in pixels"),
  frames: z.number().int().nonnegative().describe("Number of frames in the animation"),
};

/** Shape returned by snapmcp-hint. */
export const hintOutputShape = {
  kind: z
    .enum(["matches", "topic", "overview"])
    .describe("Kind of guidance returned: ranked matches, a setup topic, or the overview"),
  query: z.string().describe("Query or topic the guidance answers"),
  answer: z.string().describe("Human-readable guidance text"),
  matches: z
    .array(
      z.object({
        name: z.string().describe("Tool name"),
        title: z.string().describe("Human-readable tool title"),
        summary: z.string().describe("One-line tool summary"),
        useWhen: z.string().describe("When to prefer the tool"),
      }),
    )
    .describe("Ranked tool matches; empty when the answer is not a search"),
};

// ─── File metadata ────────────────────────────────────────────

/** Metadata describing a file produced by a tool. */
export interface FileDescriptor {
  /** Absolute path of the saved file. */
  path: string;
  /** Format derived from the file extension. */
  format: ArtifactFormat;
  /** Size of the file in bytes. */
  bytes: number;
  /** Pixel width for raster formats. */
  width?: number;
  /** Pixel height for raster formats. */
  height?: number;
}

/** Map a file extension to the artifact format snapmcp reports. */
function formatFromExtension(filePath: string): ArtifactFormat {
  switch (path.extname(filePath).toLowerCase()) {
    case ".png":
      return "png";
    case ".jpg":
    case ".jpeg":
      return "jpeg";
    case ".gif":
      return "gif";
    case ".pdf":
      return "pdf";
    case ".md":
    case ".markdown":
      return "markdown";
    case ".html":
    case ".htm":
      return "html";
    case ".pptx":
      return "pptx";
    case ".docx":
      return "docx";
    default:
      return "png";
  }
}

/**
 * Describe a file saved by a tool.
 *
 * The size comes from the filesystem and the pixel dimensions are read from
 * the image header, so the reported metadata always matches the bytes on disk.
 *
 * @param filePath Path of the saved file
 * @param format   Optional format override when the extension is not definitive
 */
export function describeFile(filePath: string, format?: ArtifactFormat): FileDescriptor {
  const absolute = path.resolve(filePath);
  const resolvedFormat = format ?? formatFromExtension(absolute);

  let bytes = 0;
  try {
    bytes = fs.statSync(absolute).size;
  } catch {
    bytes = 0;
  }

  const dimensions =
    resolvedFormat === "png" || resolvedFormat === "jpeg" || resolvedFormat === "gif"
      ? readImageSize(absolute, resolvedFormat)
      : {};

  return { path: absolute, format: resolvedFormat, bytes, ...dimensions };
}

/** Read pixel dimensions from a raster image header. */
function readImageSize(
  filePath: string,
  format: RasterFormat,
): { width?: number; height?: number } {
  try {
    if (format === "png") return readPngSize(filePath);
    if (format === "gif") return readGifSize(filePath);
    return readJpegSize(filePath);
  } catch {
    return {};
  }
}

/** Read the IHDR dimensions of a PNG file. */
function readPngSize(filePath: string): { width: number; height: number } {
  const handle = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(24);
    const bytesRead = fs.readSync(handle, header, 0, header.length, 0);
    if (bytesRead < 24) throw new Error("PNG header is truncated");
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  } finally {
    fs.closeSync(handle);
  }
}

/** Read the logical screen dimensions of a GIF file. */
function readGifSize(filePath: string): { width: number; height: number } {
  const handle = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(10);
    const bytesRead = fs.readSync(handle, header, 0, header.length, 0);
    if (bytesRead < 10) throw new Error("GIF header is truncated");
    return { width: header.readUInt16LE(6), height: header.readUInt16LE(8) };
  } finally {
    fs.closeSync(handle);
  }
}

/** Read the frame dimensions of a JPEG file. */
function readJpegSize(filePath: string): { width: number; height: number } {
  const handle = fs.openSync(filePath, "r");
  try {
    const length = Math.min(fs.fstatSync(handle).size, 512 * 1024);
    const buffer = Buffer.alloc(length);
    const bytesRead = fs.readSync(handle, buffer, 0, length, 0);

    let offset = 2;
    while (offset + 9 < bytesRead) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      // Standalone markers carry no payload segment.
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        offset += 2;
        continue;
      }
      const isStartOfFrame =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isStartOfFrame) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
    throw new Error("JPEG frame header was not found");
  } finally {
    fs.closeSync(handle);
  }
}

// ─── Result builders ──────────────────────────────────────────

/**
 * Build a successful result for a saved artifact.
 *
 * @param filePath Path of the saved file
 * @param extra    Additional structured fields merged into the payload
 * @param text     Optional text shown to the caller
 */
export function artifactResult(
  filePath: string,
  extra: Record<string, unknown> = {},
  text?: string,
): ToolResult {
  const descriptor = describeFile(filePath);
  return {
    content: [{ type: "text", text: text ?? `✅ Saved: ${descriptor.path}` }],
    structuredContent: { ...descriptor, ...extra },
  };
}

/**
 * Build a successful result from an explicit structured payload.
 *
 * @param structured Structured payload matching the tool output schema
 * @param text       Text shown to the caller
 */
export function structuredResult(
  structured: Record<string, unknown>,
  text: string,
): ToolResult {
  return {
    content: [{ type: "text", text }],
    structuredContent: structured,
  };
}

/**
 * Build a failed result.
 *
 * The MCP SDK skips output-schema validation for error results, so failures
 * carry the message as text only.
 *
 * @param err Error thrown by the tool
 */
export function failureResult(err: unknown): ToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text", text: `❌ ${message}` }],
    isError: true,
  };
}
