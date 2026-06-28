import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { encode } from "fast-png"
import { createGif, GifError, type GifFrame } from "../src/gif.js"

let tmpDir: string

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-gif-test-"))
})

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function createPng(
  name: string,
  w: number,
  h: number,
  r = 0,
  g = 0,
  b = 0,
): string {
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = 255
    }
  }
  const pngBuffer = encode({ width: w, height: h, data })
  const filePath = path.join(tmpDir, name)
  fs.writeFileSync(filePath, pngBuffer)
  return filePath
}

function isGif(filePath: string): boolean {
  let fd: number | undefined
  try {
    fd = fs.openSync(filePath, "r")
    const buf = Buffer.alloc(3)
    fs.readSync(fd, buf, 0, 3, 0)
    return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

describe("createGif", () => {
  it("creates a valid GIF from a single frame", async () => {
    const frame = createPng("single.png", 10, 10, 255, 0, 0)
    const out = path.join(tmpDir, "single.gif")

    const result = await createGif([{ filePath: frame, delay: 100 }], out)

    assert.equal(result, out)
    assert.ok(fs.existsSync(out), "output file should exist")
    assert.ok(isGif(out), "output should have GIF magic header")
    assert.ok(fs.statSync(out).size > 20, "GIF should have reasonable size")
  })

  it("creates a GIF from multiple frames", async () => {
    const red   = createPng("multi-red.png", 5, 5, 255, 0, 0)
    const green = createPng("multi-green.png", 5, 5, 0, 255, 0)
    const blue  = createPng("multi-blue.png", 5, 5, 0, 0, 255)
    const out   = path.join(tmpDir, "multi.gif")

    const result = await createGif(
      [
        { filePath: red, delay: 50 },
        { filePath: green, delay: 100 },
        { filePath: blue },
      ],
      out,
    )

    assert.equal(result, out)
    assert.ok(fs.existsSync(out))
    assert.ok(isGif(out))
    assert.ok(fs.statSync(out).size > 100)
  })

  it("respects loop: false (play once)", async () => {
    const frame = createPng("loop-once.png", 8, 8, 64, 64, 64)
    const out   = path.join(tmpDir, "loop-once.gif")

    await createGif([{ filePath: frame }], out, { loop: false })

    assert.ok(fs.existsSync(out))
    assert.ok(isGif(out))
  })

  it("auto-detects dimensions from the first frame", async () => {
    const frame = createPng("autodetect.png", 32, 16, 0, 255, 0)
    const out   = path.join(tmpDir, "autodetect.gif")

    await createGif([{ filePath: frame }], out)

    const buf = fs.readFileSync(out)
    const gifW = buf[6] + (buf[7] << 8)
    const gifH = buf[8] + (buf[9] << 8)
    assert.equal(gifW, 32)
    assert.equal(gifH, 16)
  })

  it("accepts explicit width / height override", async () => {
    const frame = createPng("explicit-dim.png", 64, 48, 100, 100, 100)
    const out   = path.join(tmpDir, "explicit-dim.gif")

    await createGif([{ filePath: frame }], out, {
      width: 64,
      height: 48,
    })

    const buf = fs.readFileSync(out)
    const gifW = buf[6] + (buf[7] << 8)
    const gifH = buf[8] + (buf[9] << 8)
    assert.equal(gifW, 64)
    assert.equal(gifH, 48)
  })

  it("throws GifError for an empty frames array", async () => {
    await assert.rejects(
      createGif([], path.join(tmpDir, "empty.gif")),
      { name: "GifError", message: /At least one frame is required/ },
    )
  })

  it("throws GifError when a frame file does not exist", async () => {
    await assert.rejects(
      createGif(
        [{ filePath: "/tmp/snapmcp-nonexistent-frame.png" }],
        path.join(tmpDir, "missing.gif"),
      ),
      { name: "GifError", message: /File not found/ },
    )
  })

  it("throws GifError when passed an invalid PNG", async () => {
    const badFile = path.join(tmpDir, "corrupt.png")
    fs.writeFileSync(badFile, "this is not a PNG image")

    await assert.rejects(
      createGif([{ filePath: badFile }], path.join(tmpDir, "bad.gif")),
      { name: "GifError", message: /Invalid PNG/ },
    )
  })

  it("throws GifError when frame dimensions do not match", async () => {
    const small = createPng("dim-small.png", 4, 4, 0, 0, 0)
    const large = createPng("dim-large.png", 8, 8, 255, 255, 255)
    const out   = path.join(tmpDir, "dim-mismatch.gif")

    await assert.rejects(
      createGif([{ filePath: small }, { filePath: large }], out),
      { name: "GifError", message: /must match GIF canvas/ },
    )
  })

  it("cleans up partial output on encoding failure", async () => {
    const badFile = path.join(tmpDir, "partial-fail.png")
    fs.writeFileSync(badFile, "garbage data")

    const out = path.join(tmpDir, "partial.gif")
    await assert.rejects(
      createGif([{ filePath: badFile }], out),
      GifError,
    )
    assert.ok(!fs.existsSync(out), "partial output should be cleaned up")
  })
})

describe("GifError", () => {
  it("has the correct name", () => {
    const err = new GifError("test")
    assert.equal(err.name, "GifError")
  })

  it("formats the message with [GIF] prefix", () => {
    const err = new GifError("something went wrong")
    assert.equal(err.message, "[GIF] something went wrong")
  })

  it("is an instance of Error", () => {
    assert.ok(new GifError("x") instanceof Error)
  })
})
