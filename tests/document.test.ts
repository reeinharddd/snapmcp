/**
 * Tests for the document generation module.
 *
 * Covers Markdown and HTML output, section rendering, image embedding,
 * error handling, and edge cases. PDF tests require Playwright and are
 * skipped when Chromium is not available or run conditionally.
 */

import { describe, it } from "node:test"
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

// ─── Helpers ───────────────────────────────────────────────────

/** Create a temporary directory for test output. */
function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-doc-test-"))
}

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

// ─── Tests ─────────────────────────────────────────────────────

describe("createDocument", () => {
  describe("Markdown output", () => {
    it("generates a valid markdown document with title", async () => {
      const dir = tmpDir()
      const out = path.join(dir, "test.md")
      await createDocument(
        { title: "Test Doc", sections: [{ description: "Hello world" }], format: "markdown", outputPath: out },
        loadConfig(),
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
        loadConfig(),
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
        loadConfig(),
      )
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("data:image/png;base64,"))
      assert.ok(content.includes("Test image"))
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
        loadConfig(),
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
        loadConfig(),
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
        loadConfig(),
      )
      // Should not throw — just skip the missing image
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("# Missing"))
    })
  })

  describe("HTML output", () => {
    it("generates a valid HTML document", async () => {
      const dir = tmpDir()
      const out = path.join(dir, "test.html")
      await createDocument(
        { title: "HTML Doc", sections: [{ description: "Hello" }], format: "html", outputPath: out },
        loadConfig(),
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
        loadConfig(),
      )
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("<figure>"))
      assert.ok(content.includes("<figcaption>My caption</figcaption>"))
      assert.ok(content.includes("<img"))
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
        loadConfig(),
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
        loadConfig(),
      )
      const content = fs.readFileSync(out, "utf-8")
      assert.ok(content.includes("Generated:"))
    })
  })

  describe("Error handling", () => {
    it("throws DocumentError for empty sections", async () => {
      await assert.rejects(
        () =>
          createDocument(
            { title: "Empty", sections: [], format: "markdown", outputPath: "/tmp/empty.md" },
            loadConfig(),
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
            loadConfig(),
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
