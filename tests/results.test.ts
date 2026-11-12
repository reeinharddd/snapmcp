import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  artifactResult,
  describeFile,
  failureResult,
  structuredResult,
} from "../src/results.js";

/** Build a minimal but valid PNG file with the given dimensions. */
function writePng(filePath: string, width: number, height: number): void {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(ihdr.length, 0);
  const type = Buffer.from("IHDR", "ascii");
  fs.writeFileSync(filePath, Buffer.concat([signature, length, type, ihdr]));
}

/** Build a minimal but valid GIF file with the given dimensions. */
function writeGif(filePath: string, width: number, height: number): void {
  const header = Buffer.from("GIF89a", "ascii");
  const screen = Buffer.alloc(4);
  screen.writeUInt16LE(width, 0);
  screen.writeUInt16LE(height, 2);
  fs.writeFileSync(filePath, Buffer.concat([header, screen]));
}

describe("file metadata", () => {
  let root: string;

  it("creates a temporary workspace", () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-results-"));
    assert.ok(root);
  });

  it("reads PNG dimensions from the image header", () => {
    const file = path.join(root, "sample.png");
    writePng(file, 320, 240);
    const info = describeFile(file);
    assert.equal(info.format, "png");
    assert.equal(info.width, 320);
    assert.equal(info.height, 240);
    assert.equal(info.bytes, fs.statSync(file).size);
    assert.equal(info.path, file);
  });

  it("reads GIF dimensions from the logical screen descriptor", () => {
    const file = path.join(root, "sample.gif");
    writeGif(file, 64, 48);
    const info = describeFile(file);
    assert.equal(info.format, "gif");
    assert.equal(info.width, 64);
    assert.equal(info.height, 48);
  });

  it("maps document extensions to artifact formats", () => {
    const cases: Array<[string, string]> = [
      ["report.md", "markdown"],
      ["report.html", "html"],
      ["report.pdf", "pdf"],
      ["report.pptx", "pptx"],
      ["report.docx", "docx"],
      ["shot.jpg", "jpeg"],
      ["shot.jpeg", "jpeg"],
      ["shot.png", "png"],
    ];

    for (const [name, expected] of cases) {
      const file = path.join(root, name);
      fs.writeFileSync(file, "x");
      assert.equal(describeFile(file).format, expected, `Unexpected format for ${name}`);
    }
  });

  it("never throws for a missing file", () => {
    const info = describeFile(path.join(root, "missing.png"));
    assert.equal(info.bytes, 0);
    assert.equal(info.width, undefined);
    assert.equal(info.height, undefined);
  });
});

describe("result builders", () => {
  let root: string;

  it("creates a temporary workspace", () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-results-out-"));
    assert.ok(root);
  });

  it("builds an artifact result from a saved file", () => {
    const file = path.join(root, "artifact.png");
    writePng(file, 10, 20);
    const result = artifactResult(file);

    assert.match(result.content[0]?.text ?? "", /Saved:/);
    const structured = result.structuredContent ?? {};
    assert.equal(structured.path, file);
    assert.equal(structured.format, "png");
    assert.equal(structured.width, 10);
    assert.equal(structured.height, 20);
    assert.equal(result.isError, undefined);
  });

  it("merges extra fields into the artifact payload", () => {
    const file = path.join(root, "artifact-extra.pdf");
    fs.writeFileSync(file, "pdf");
    const result = artifactResult(file, { captureCount: 3 });
    assert.equal(result.structuredContent?.captureCount, 3);
  });

  it("builds a custom structured result", () => {
    const result = structuredResult({ count: 2 }, "done");
    assert.equal(result.content[0]?.text, "done");
    assert.equal(result.structuredContent?.count, 2);
  });

  it("builds a failure result without structured content", () => {
    const result = failureResult(new Error("boom"));
    assert.equal(result.isError, true);
    assert.match(result.content[0]?.text ?? "", /boom/);
    assert.equal(result.structuredContent, undefined);
  });
});
