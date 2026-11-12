/**
 * Tests for the Office document writers.
 *
 * Covers PowerPoint and Word output: valid Office packages, embedded media,
 * editable text, and the embedding limits shared with the other formats.
 */

import { describe, it, afterEach } from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import zlib from "node:zlib"
import { createDocument, DocumentError } from "../src/document.js"
import { loadConfig } from "../src/config.js"
import { TOOL_LIMITS } from "../src/capabilities.js"

// ─── Helpers ───────────────────────────────────────────────────

const tempDirs = new Set<string>()

/** Create a temporary directory for test output. */
function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-office-test-"))
  tempDirs.add(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  tempDirs.clear()
})

/** Create a minimal valid 1×1 PNG for image embedding tests. */
function createTestPng(dir: string, name = "test.png"): string {
  const png = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1×1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 8-bit RGB
    0xDE,
    0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
    0x08, 0xD7, 0x63, 0x60, 0x60, 0x60, 0x00, 0x00,
    0x00, 0x04, 0x00, 0x01, 0x27, 0x34, 0x27,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
    0xAE, 0x42, 0x60, 0x82,
  ])
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, png)
  return filePath
}

/** Read a file as a buffer for content assertions. */
function read(filePath: string): Buffer {
  return fs.readFileSync(filePath)
}

/**
 * Read one entry from a ZIP archive.
 *
 * Office packages are ZIP files, so the document text lives inside a
 * compressed entry. This parses the central directory and inflates the
 * requested entry without adding a dependency.
 */
function readZipEntry(filePath: string, entryName: string): Buffer | null {
  const data = read(filePath)

  let eocd = -1
  for (let i = data.length - 22; i >= 0; i--) {
    if (data.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd === -1) throw new Error("Not a ZIP archive")

  const entryCount = data.readUInt16LE(eocd + 10)
  let offset = data.readUInt32LE(eocd + 16)

  for (let index = 0; index < entryCount; index++) {
    if (data.readUInt32LE(offset) !== 0x02014b50) break
    const method = data.readUInt16LE(offset + 10)
    const compressedSize = data.readUInt32LE(offset + 20)
    const nameLength = data.readUInt16LE(offset + 28)
    const extraLength = data.readUInt16LE(offset + 30)
    const commentLength = data.readUInt16LE(offset + 32)
    const localOffset = data.readUInt32LE(offset + 42)
    const name = data.subarray(offset + 46, offset + 46 + nameLength).toString("utf8")

    if (name === entryName) {
      const localNameLength = data.readUInt16LE(localOffset + 26)
      const localExtraLength = data.readUInt16LE(localOffset + 28)
      const start = localOffset + 30 + localNameLength + localExtraLength
      const payload = data.subarray(start, start + compressedSize)
      return method === 0 ? payload : zlib.inflateRawSync(payload)
    }

    offset += 46 + nameLength + extraLength + commentLength
  }

  return null
}

// ─── Tests ─────────────────────────────────────────────────────

describe("Office document output", () => {
  it("writes a valid PowerPoint package", async () => {
    const dir = tmpDir()
    const output = path.join(dir, "deck.pptx")
    const config = { ...loadConfig(), outputDir: dir, allowedPaths: [dir] }

    await createDocument(
      {
        title: "Deck title",
        sections: [{ title: "Section title", description: "Section body" }],
        format: "pptx",
        outputPath: output,
      },
      config,
    )

    const data = read(output)
    assert.ok(data.length > 0, "Expected a non-empty file")
    assert.equal(data.subarray(0, 2).toString("ascii"), "PK", "Expected a ZIP container")
    assert.ok(data.includes(Buffer.from("[Content_Types].xml")))
    assert.ok(data.includes(Buffer.from("ppt/presentation.xml")))
    assert.ok(data.includes(Buffer.from("ppt/slides/slide1.xml")))
    assert.ok(data.includes(Buffer.from("ppt/slides/slide2.xml")), "Expected one slide per section")
  })

  it("embeds captures in the PowerPoint package", async () => {
    const dir = tmpDir()
    const image = createTestPng(dir)
    const output = path.join(dir, "deck.pptx")
    const config = { ...loadConfig(), outputDir: dir, allowedPaths: [dir] }

    await createDocument(
      {
        title: "Deck title",
        sections: [{ title: "With image", imagePath: image, caption: "A caption" }],
        format: "pptx",
        outputPath: output,
      },
      config,
    )

    const data = read(output)
    assert.ok(data.includes(Buffer.from("ppt/media/")), "Expected embedded media")
    assert.ok(data.includes(Buffer.from("ppt/media/image")), "Expected an embedded image file")
  })

  it("writes a valid Word package", async () => {
    const dir = tmpDir()
    const output = path.join(dir, "report.docx")
    const config = { ...loadConfig(), outputDir: dir, allowedPaths: [dir] }

    await createDocument(
      {
        title: "Document title",
        sections: [{ title: "Section title", description: "Section body" }],
        format: "docx",
        outputPath: output,
      },
      config,
    )

    const data = read(output)
    assert.ok(data.length > 0, "Expected a non-empty file")
    assert.equal(data.subarray(0, 2).toString("ascii"), "PK", "Expected a ZIP container")
    assert.ok(data.includes(Buffer.from("[Content_Types].xml")))
    assert.ok(data.includes(Buffer.from("word/document.xml")))
  })

  it("keeps the title and section text editable in the Word document", async () => {
    const dir = tmpDir()
    const output = path.join(dir, "report.docx")
    const config = { ...loadConfig(), outputDir: dir, allowedPaths: [dir] }

    await createDocument(
      {
        title: "Document title",
        sections: [{ title: "Section title", description: "Section body" }],
        format: "docx",
        outputPath: output,
      },
      config,
    )

    const document = readZipEntry(output, "word/document.xml")
    assert.ok(document, "Expected word/document.xml inside the package")
    const xml = document?.toString("utf8") ?? ""
    assert.match(xml, /Document title/)
    assert.match(xml, /Section title/)
    assert.match(xml, /Section body/)
  })

  it("embeds captures in the Word package", async () => {
    const dir = tmpDir()
    const image = createTestPng(dir)
    const output = path.join(dir, "report.docx")
    const config = { ...loadConfig(), outputDir: dir, allowedPaths: [dir] }

    await createDocument(
      {
        title: "Document title",
        sections: [{ title: "With image", imagePath: image, caption: "A caption" }],
        format: "docx",
        outputPath: output,
      },
      config,
    )

    const data = read(output)
    assert.ok(data.includes(Buffer.from("word/media/")), "Expected embedded media")
  })

  it("skips a missing capture instead of failing the document", async () => {
    const dir = tmpDir()
    const output = path.join(dir, "deck.pptx")
    const config = { ...loadConfig(), outputDir: dir, allowedPaths: [dir] }

    await createDocument(
      {
        title: "Deck title",
        sections: [{ title: "Missing", imagePath: path.join(dir, "nope.png") }],
        format: "pptx",
        outputPath: output,
      },
      config,
    )

    const data = read(output)
    assert.equal(data.subarray(0, 2).toString("ascii"), "PK")
    assert.ok(
      !data.includes(Buffer.from("ppt/media/image")),
      "Expected no embedded image file",
    )
  })

  it("fails instead of silently dropping a capture over the embedding limit", async () => {
    const dir = tmpDir()
    const image = createTestPng(dir)
    const output = path.join(dir, "deck.pptx")
    const config = { ...loadConfig(), outputDir: dir, allowedPaths: [dir] }

    // Grow the file beyond the per-image embedding limit.
    const oversized = path.join(dir, "big.png")
    fs.writeFileSync(oversized, Buffer.alloc(TOOL_LIMITS.document.maxEmbeddedImageBytes + 1))

    await assert.rejects(
      () =>
        createDocument(
          {
            title: "Deck title",
            sections: [{ title: "Too big", imagePath: oversized }],
            format: "pptx",
            outputPath: output,
          },
          config,
        ),
      (error: unknown) => error instanceof DocumentError,
    )
    assert.ok(fs.existsSync(image))
  })

  it("rejects an unknown document format", async () => {
    const dir = tmpDir()
    const output = path.join(dir, "deck.pptx")
    const config = { ...loadConfig(), outputDir: dir, allowedPaths: [dir] }

    await assert.rejects(
      () =>
        createDocument(
          {
            title: "Deck title",
            sections: [{ description: "body" }],
            format: "xlsx" as "markdown",
            outputPath: output,
          },
          config,
        ),
      (error: unknown) => error instanceof DocumentError,
    )
  })
})
