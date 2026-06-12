/**
 * GIF encoder module for snapmcp.
 *
 * Creates animated GIFs from PNG frame files using gifencoder + pngjs.
 * Supports custom frame delays, looping, configurable quality, and
 * auto-detection of dimensions from the first frame.
 *
 * @module
 */

import GIFEncoder from "gifencoder"
import { PNG } from "pngjs"
import fs from "node:fs"
import path from "node:path"

// ─── Error ────────────────────────────────────────────────────

/**
 * Error thrown by GIF operations.
 */
export class GifError extends Error {
  constructor(message: string) {
    super(`[GIF] ${message}`)
    this.name = "GifError"
  }
}

// ─── Interfaces ───────────────────────────────────────────────

/** A single frame in an animated GIF. */
export interface GifFrame {
  /** Path to a PNG file on disk. */
  filePath: string
  /**
   * Frame delay in centiseconds (1/100 sec).
   * @default 80 (800 ms)
   */
  delay?: number
}

/** Options for GIF creation. */
export interface GifOptions {
  /**
   * Whether the GIF should loop forever.
   * @default true
   */
  loop?: boolean
  /**
   * GIF canvas width.
   * Auto-detected from the first frame when omitted.
   */
  width?: number
  /**
   * GIF canvas height.
   * Auto-detected from the first frame when omitted.
   */
  height?: number
  /**
   * Color quantization quality (sample interval).
   * Lower values produce better colours but are slower to encode.
   * @default 20
   * @range 10–40
   */
  quality?: number
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Create an animated GIF from a list of PNG frames.
 *
 * Each frame is read from disk synchronously during encoding. Frames are
 * piped through the GIF encoder and written to `outputPath` via streams.
 *
 * @param frames     Ordered frame descriptors — each references a PNG on disk
 * @param outputPath Destination path for the generated `.gif` file
 * @param options    Optional encoding parameters
 * @returns The resolved `outputPath` on success
 * @throws {GifError} When frames is empty, a file is missing, a PNG is
 *                    invalid, frame dimensions mismatch, or encoding fails
 */
export async function createGif(
  frames: GifFrame[],
  outputPath: string,
  options?: GifOptions,
): Promise<string> {
  if (frames.length === 0) {
    throw new GifError("At least one frame is required")
  }

  const loop = options?.loop ?? true
  const quality = clamp(options?.quality ?? 20, 10, 40)

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  // Auto-detect dimensions from the first frame
  const first = readPng(frames[0].filePath)
  const width = options?.width ?? first.width
  const height = options?.height ?? first.height

  // Set up encoder
  const encoder = new GIFEncoder(width, height)
  encoder.setQuality(quality)
  encoder.setRepeat(loop ? 0 : -1)

  return new Promise<string>((resolve, reject) => {
    const readStream = encoder.createReadStream()
    const writeStream = fs.createWriteStream(outputPath)

    writeStream.on("finish", () => resolve(outputPath))
    writeStream.on("error", (err) =>
      reject(new GifError(`Write failed: ${err.message}`)),
    )
    readStream.on("error", (err) =>
      reject(new GifError(`Encode stream error: ${err.message}`)),
    )

    readStream.pipe(writeStream)

    try {
      encoder.start()

      for (const frame of frames) {
        const delay = frame.delay ?? 80
        encoder.setDelay(delay * 10) // centiseconds → milliseconds

        const png = readPng(frame.filePath)

        // Fail early when a frame doesn't match the GIF canvas size
        if (png.width !== width || png.height !== height) {
          throw new GifError(
            `Frame dimensions (${png.width}x${png.height}) must match ` +
            `GIF canvas (${width}x${height}): ${frame.filePath}`,
          )
        }

        encoder.addFrame(png.data)
      }

      encoder.finish()
    } catch (err) {
      // Tear down the write stream so the process doesn't hang
      writeStream.destroy()
      // Remove any partial output
      try {
        fs.unlinkSync(outputPath)
      } catch {
        // file may not exist yet — ignore
      }
      reject(
        err instanceof GifError
          ? err
          : new GifError(`Encoding failed: ${(err as Error).message}`),
      )
    }
  })
}

// ─── Internal helpers ─────────────────────────────────────────

/**
 * Read and decode a PNG file from disk.
 *
 * @param filePath Absolute or relative path to a PNG file
 * @returns Decoded PNG metadata and raw RGBA pixel data
 * @throws {GifError} When the file cannot be read or is not a valid PNG
 */
function readPng(filePath: string): {
  width: number
  height: number
  data: Buffer
} {
  let buffer: Buffer
  try {
    buffer = fs.readFileSync(filePath)
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException
    if (nodeErr.code === "ENOENT") {
      throw new GifError(`File not found: ${filePath}`)
    }
    throw new GifError(`Cannot read file: ${filePath} — ${nodeErr.message}`)
  }

  try {
    const png = PNG.sync.read(buffer)
    return { width: png.width, height: png.height, data: png.data }
  } catch (err) {
    throw new GifError(
      `Invalid PNG file: ${filePath} — ${(err as Error).message}`,
    )
  }
}

/**
 * Clamp a number between a minimum and maximum value (inclusive).
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
