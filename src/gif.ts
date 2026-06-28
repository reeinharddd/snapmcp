/**
 * GIF encoder module for snapmcp.
 *
 * Creates animated GIFs from PNG frame files using gifenc + fast-png.
 * Zero heavyweight dependencies.
 *
 * @module
 */

import { GIFEncoder, quantize, applyPalette } from "gifenc/dist/gifenc.esm.js"
import { decode } from "fast-png"
import fs from "node:fs"
import path from "node:path"

// ─── Error ────────────────────────────────────────────────────

export class GifError extends Error {
  constructor(message: string) {
    super(`[GIF] ${message}`)
    this.name = "GifError"
  }
}

// ─── Interfaces ───────────────────────────────────────────────

export interface GifFrame {
  filePath: string
  delay?: number
}

export interface GifOptions {
  loop?: boolean
  width?: number
  height?: number
}

// ─── Public API ───────────────────────────────────────────────

export async function createGif(
  frames: GifFrame[],
  outputPath: string,
  options?: GifOptions,
): Promise<string> {
  if (frames.length === 0) {
    throw new GifError("At least one frame is required")
  }

  const loop = options?.loop ?? true

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  // Read first frame to auto-detect dimensions
  const first = readPng(frames[0].filePath)
  const width = options?.width ?? first.width
  const height = options?.height ?? first.height

  const gif = new GIFEncoder(width, height, { loop })

  try {
    for (const frame of frames) {
      const delay = (frame.delay ?? 80) * 10 // centiseconds → ms
      const png = readPng(frame.filePath)

      if (png.width !== width || png.height !== height) {
        throw new GifError(
          `Frame dimensions (${png.width}x${png.height}) must match ` +
          `GIF canvas (${width}x${height}): ${frame.filePath}`,
        )
      }

      const palette = quantize(png.data, 256)
      const idxData = applyPalette(png.data, palette)
      const flatPalette = new Uint8Array(palette.length * 3)
      for (let i = 0; i < palette.length; i++) {
        flatPalette[i * 3] = palette[i][0]
        flatPalette[i * 3 + 1] = palette[i][1]
        flatPalette[i * 3 + 2] = palette[i][2]
      }
      gif.writeFrame(idxData, width, height, { delay, palette: flatPalette, transparent: false })
    }

    gif.finish()
    const buffer = gif.bytes()
    fs.writeFileSync(outputPath, buffer)

    return outputPath
  } catch (err) {
    try { fs.unlinkSync(outputPath) } catch { /* ignore */ }
    throw err instanceof GifError
      ? err
      : new GifError(`Encoding failed: ${(err as Error).message}`)
  }
}

// ─── Internal helpers ─────────────────────────────────────────

function readPng(filePath: string): { width: number; height: number; data: Uint8Array } {
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
    const image = decode(new Uint8Array(buffer))
    const data = new Uint8Array(image.data) // fast-png returns Uint8ClampedArray
    return { width: image.width, height: image.height, data }
  } catch (err) {
    throw new GifError(
      `Invalid PNG file: ${filePath} — ${(err as Error).message}`,
    )
  }
}
