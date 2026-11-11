/**
 * Tests for the document generation module.
 *
 * Covers Markdown and HTML output, section rendering, image embedding,
 * error handling, and edge cases. PDF tests require Playwright and are
 * skipped when Chromium is not available or run conditionally.
 */

import { describe, it, afterEach } from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import {
  createDocument,
  DocumentError,
  type DocumentSection,
  type DocumentFormat,
} from "../src/document.js"
import { loadConfig } from "../src/config.js"
import { TOOL_LIMITS } from "../src/capabilities.js"

// ─── Helpers ───────────────────────────────────────────────────

const tempDirs = new Set<string>()

/** Create a temporary directory for test output. */
function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-doc-test-"))
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
  // Minimal valid PNG (1×1 white pixel, CRC included)
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
  const fp = path.join(dir, name)
  fs.writeFileSync(fp, png)
  return fp
}

/** Write a file with a real image-container signature for MIME detection. */
function createImageWithSignature(
  dir: string,
  name: string,
  signature: Buffer,
): string {
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, Buffer.concat([signature, Buffer.from([0x00, 0x01])]))
  return filePath
}

// ─── Tests ─────────────────────────────────────────────────────

describe("createDocument", () => {
  describe("Markdown output", () => {
    it("generates a valid markdown document with title", async () => {
      const dir = tmpDir()
      const out = path.join(dir, "test.md")
      await createDocument(
        { title: "Test Doc", sections: [{ description: "Hello world" }], format: "markdown", outputPath: out },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("# Test Doc"))
      assert.ok(content.includes("Hello world"))
    })

    it("renders sections with headings", async () => {
      const dir = tmpDir()
      const out = path.join(dir, "sections.md")
      await createDocument(
        {
          title: "Sections",
          sections: [
            { title: "First", description: "Content A" },
            { title: "Second", description: "Content B" },
          ],
          format: "markdown",
          outputPath: out,
        },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("## First"))
      assert.ok(content.includes("## Second"))
      assert.ok(content.includes("Content A"))
      assert.ok(content.includes("Content B"))
    })

    it("embeds images as base64 data URIs", async () => {
      const dir = tmpDir()
      const img = createTestPng(dir)
      const out = path.join(dir, "img.md")
      await createDocument(
        {
          title: "With Image",
          sections: [{ imagePath: img, caption: "Test image" }],
          format: "markdown",
          outputPath: out,
        },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("data:image/png;base64,"))
      assert.ok(content.includes("Test image"))
    })

    it("embeds generated images larger than the default file-read limit", async () => {
      const dir = tmpDir()
      const image = path.join(dir, "large.png")
      fs.writeFileSync(image, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      fs.truncateSync(image, 6_000_000)
      const out = path.join(dir, "large.md")

      await createDocument(
        {
          title: "Large image",
          sections: [{ imagePath: image }],
          format: "markdown",
          outputPath: out,
        },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )

      const content = fs.readFileSync(out, "utf-8")
      assert.match(content, /data:image\/png;base64,/)
    })

    it("fails instead of silently dropping an image over the embedding limit", async () => {
      const dir = tmpDir()
      const image = path.join(dir, "too-large.png")
      fs.writeFileSync(image, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      fs.truncateSync(image, TOOL_LIMITS.document.maxEmbeddedImageBytes + 1)

      await assert.rejects(
        () =>
          createDocument(
            {
              title: "Too large",
              sections: [{ imagePath: image }],
              format: "markdown",
              outputPath: path.join(dir, "too-large.md"),
            },
            { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
          ),
        (error: unknown) => {
          assert.ok(error instanceof DocumentError)
          assert.match(error.message, /embedding limit/)
          return true
        },
      )
    })

    it("embeds PNG, JPEG, GIF, and WebP with their real MIME types", async () => {
      const dir = tmpDir()
      const png = createTestPng(dir, "capture.png")
      const jpeg = createImageWithSignature(
        dir,
        "capture.jpg",
        Buffer.from([0xff, 0xd8, 0xff]),
      )
      const gif = createImageWithSignature(
        dir,
        "capture.gif",
        Buffer.from("GIF89a", "ascii"),
      )
      const webp = createImageWithSignature(
        dir,
        "capture.webp",
        Buffer.concat([
          Buffer.from("RIFF", "ascii"),
          Buffer.from([0x08, 0x00, 0x00, 0x00]),
          Buffer.from("WEBP", "ascii"),
        ]),
      )
      const out = path.join(dir, "mime-types.md")

      await createDocument(
        {
          title: "Image MIME types",
          sections: [
            { imagePath: png },
            { imagePath: jpeg },
            { imagePath: gif },
            { imagePath: webp },
          ],
          format: "markdown",
          outputPath: out,
        },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )

      const content = fs.readFileSync(out, "utf-8")
      assert.match(content, /data:image\/png;base64,/)
      assert.match(content, /data:image\/jpeg;base64,/)
      assert.match(content, /data:image\/gif;base64,/)
      assert.match(content, /data:image\/webp;base64,/)
    })

    it("includes code blocks with language tags", async () => {
      const dir = tmpDir()
      const out = path.join(dir, "code.md")
      await createDocument(
        {
          title: "Code",
          sections: [{ code: "const x = 1;", codeLanguage: "js" }],
          format: "markdown",
          outputPath: out,
        },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("```js"))
      assert.ok(content.includes("const x = 1;"))
    })

    it("includes timestamp when requested", async () => {
      const dir = tmpDir()
      const out = path.join(dir, "ts.md")
      await createDocument(
        { title: "TS", sections: [{ description: "test" }], format: "markdown", includeTimestamps: true, outputPath: out },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("_Generated:"))
    })

    it("skips missing image files gracefully", async () => {
      const dir = tmpDir()
      const out = path.join(dir, "missing.md")
      await createDocument(
        {
          title: "Missing",
          sections: [{ imagePath: "/nonexistent/file.png", caption: "gone" }],
          format: "markdown",
          outputPath: out,
        },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )
      // Should not throw — just skip the missing image
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("# Missing"))
    })

    it("skips files that are not supported image containers", async () => {
      const dir = tmpDir()
      const textFile = path.join(dir, "not-an-image.txt")
      fs.writeFileSync(textFile, "plain text")
      const out = path.join(dir, "unsupported.md")

      await createDocument(
        {
          title: "Unsupported",
          sections: [{ imagePath: textFile }],
          format: "markdown",
          outputPath: out,
        },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )

      const content = fs.readFileSync(out, "utf-8")
      assert.match(content, /# Unsupported/)
      assert.doesNotMatch(content, /data:image\//)
    })

    it("does not embed images outside the file-read allowlist", async () => {
      const imageDir = tmpDir()
      const outputDir = tmpDir()
      const image = createTestPng(imageDir, "outside.png")
      const out = path.join(outputDir, "denied.md")

      await createDocument(
        {
          title: "Denied",
          sections: [{ imagePath: image }],
          format: "markdown",
          outputPath: out,
        },
        { ...loadConfig(), outputDir, allowedPaths: [] },
      )

      const content = fs.readFileSync(out, "utf-8")
      assert.match(content, /# Denied/)
      assert.doesNotMatch(content, /data:image\//)
    })
  })

  describe("HTML output", () => {
    it("generates a valid HTML document", async () => {
      const dir = tmpDir()
      const out = path.join(dir, "test.html")
      await createDocument(
        { title: "HTML Doc", sections: [{ description: "Hello" }], format: "html", outputPath: out },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("<!DOCTYPE html>"))
      assert.ok(content.includes("<h1>HTML Doc</h1>"))
      assert.ok(content.includes("<p>Hello</p>"))
    })

    it("renders images in figure elements", async () => {
      const dir = tmpDir()
      const img = createTestPng(dir)
      const out = path.join(dir, "fig.html")
      await createDocument(
        {
          title: "Figure",
          sections: [{ imagePath: img, caption: "My caption" }],
          format: "html",
          outputPath: out,
        },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("<figure>"))
      assert.ok(content.includes("<figcaption>My caption</figcaption>"))
      assert.ok(content.includes("<img"))
      assert.match(content, /src="data:image\/png;base64,/)
    })

    it("preserves a non-PNG image MIME type in HTML", async () => {
      const dir = tmpDir()
      const jpeg = createImageWithSignature(
        dir,
        "capture.jpg",
        Buffer.from([0xff, 0xd8, 0xff]),
      )
      const out = path.join(dir, "jpeg.html")

      await createDocument(
        {
          title: "JPEG",
          sections: [{ imagePath: jpeg }],
          format: "html",
          outputPath: out,
        },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )

      const content = fs.readFileSync(out, "utf-8")
      assert.match(content, /src="data:image\/jpeg;base64,/)
      assert.doesNotMatch(content, /data:image\/png;base64,/)
    })

    it("renders code blocks in pre/code tags", async () => {
      const dir = tmpDir()
      const out = path.join(dir, "code.html")
      await createDocument(
        {
          title: "Code",
          sections: [{ code: "console.log('hi')", codeLanguage: "js" }],
          format: "html",
          outputPath: out,
        },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("<pre><code"))
      assert.ok(content.includes("console.log('hi')"))
    })

    it("includes timestamp when requested", async () => {
      const dir = tmpDir()
      const out = path.join(dir, "ts.html")
      await createDocument(
        { title: "TS", sections: [{ description: "test" }], format: "html", includeTimestamps: true, outputPath: out },
        { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
      )
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("Generated:"))
    })
  })

  describe("Error handling", () => {
    it("throws DocumentError for empty sections", async () => {
      const dir = tmpDir()
      await assert.rejects(
        () =>
          createDocument(
            { title: "Empty", sections: [], format: "markdown", outputPath: path.join(dir, "empty.md") },
            { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
          ),
        (err: unknown) => {
          assert.ok(err instanceof DocumentError)
          assert.ok((err as DocumentError).message.includes("At least one section"))
          return true
        },
      )
    })

    it("throws DocumentError for unsupported format", async () => {
      const dir = tmpDir()
      await assert.rejects(
        () =>
          createDocument(
            { title: "Bad", sections: [{ description: "x" }], format: "docx" as DocumentFormat, outputPath: path.join(dir, "bad.md") },
            { ...loadConfig(), outputDir: dir, allowedPaths: [dir] },
          ),
        (err: unknown) => {
          assert.ok(err instanceof DocumentError)
          assert.ok((err as DocumentError).message.includes("Unsupported format"))
          return true
        },
      )
    })
  })

  describe("TypeScript types", () => {
    it("DocumentSection accepts all fields", () => {
      const section: DocumentSection = {
        title: "Intro",
        description: "Desc",
        imagePath: "/img.png",
        caption: "Cap",
        code: "code",
        codeLanguage: "ts",
      }
      assert.equal(section.title, "Intro")
      assert.equal(section.codeLanguage, "ts")
    })

    it("DocumentSection works with minimal fields", () => {
      const section: DocumentSection = { description: "Just text" }
      assert.equal(section.description, "Just text")
      assert.equal(section.title, undefined)
    })
  })
})
