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

  // Read all frames to auto-detect max canvas dimensions
  const framesData = frames.map(f => ({ frame: f, png: readPng(f.filePath) }));

  let canvasWidth = options?.width ?? Math.max(...framesData.map(f => f.png.width));
  let canvasHeight = options?.height ?? Math.max(...framesData.map(f => f.png.height));

  const gif = new GIFEncoder(canvasWidth, canvasHeight, { loop });

  try {
    for (const { frame, png } of framesData) {
      const delay = (frame.delay ?? 80) * 10; // centiseconds → ms
      let data = png.data;
      let w = png.width;
      let h = png.height;

      // Auto-pad smaller frames to match canvas dimensions
      if (w !== canvasWidth || h !== canvasHeight) {
        const padded = new Uint8Array(canvasWidth * canvasHeight * 4);
        padded.fill(0); // transparent black
        const ox = Math.floor((canvasWidth - w) / 2);
        const oy = Math.floor((canvasHeight - h) / 2);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const si = (y * w + x) * 4;
            const di = ((y + oy) * canvasWidth + (x + ox)) * 4;
            padded[di] = data[si];
            padded[di + 1] = data[si + 1];
            padded[di + 2] = data[si + 2];
            padded[di + 3] = data[si + 3];
          }
        }
        data = padded;
        w = canvasWidth;
        h = canvasHeight;
      }

      const palette = quantize(data, 256);
      const idxData = applyPalette(data, palette);
      const flatPalette = new Uint8Array(palette.length * 3);
      for (let i = 0; i < palette.length; i++) {
        flatPalette[i * 3] = palette[i][0];
        flatPalette[i * 3 + 1] = palette[i][1];
        flatPalette[i * 3 + 2] = palette[i][2];
      }
      gif.writeFrame(idxData, w, h, { delay, palette: flatPalette, transparent: false });
    }

    gif.finish();
    const buffer = gif.bytes();
    fs.writeFileSync(outputPath, buffer);

    return outputPath;
  } catch (err) {
    try { fs.unlinkSync(outputPath) } catch { /* ignore */ }
    throw err instanceof GifError
      ? err
      : new GifError(`Encoding failed: ${(err as Error).message}`);
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
