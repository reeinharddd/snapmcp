import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  IMAGE_OUTPUT_EXTENSIONS,
  createOutputPath,
  resolveNamedOutput,
  resolveOutputDirectory,
} from "../src/output.js";
import { SecurityError } from "../src/security.js";

describe("output path confinement", () => {
  let root: string;
  let baseDir: string;

  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-output-test-"));
    baseDir = path.join(root, "captures");
    fs.mkdirSync(baseDir);
  });

  after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("creates a requested output directory inside the base directory", () => {
    const outputDir = resolveOutputDirectory(baseDir, "nested/captures");
    assert.equal(outputDir, path.join(baseDir, "nested", "captures"));
    assert.equal(fs.statSync(outputDir).isDirectory(), true);
  });

  it("defaults the output directory to the configured base directory", () => {
    assert.equal(resolveOutputDirectory(baseDir), baseDir);
  });

  it("rejects traversal in an output directory", () => {
    for (const requested of ["../escape", "nested/../../escape", "..%2Fescape"]) {
      assert.throws(
        () => resolveOutputDirectory(baseDir, requested),
        SecurityError,
        `Expected output traversal to be blocked: ${requested}`,
      );
    }
  });

  it("rejects an output directory outside the configured base directory", () => {
    const outside = path.join(root, "outside");
    fs.mkdirSync(outside);
    assert.throws(
      () => resolveOutputDirectory(baseDir, outside),
      SecurityError,
    );
  });

  it("rejects a symlinked output directory that escapes the base directory", (t) => {
    const outside = path.join(root, "symlink-target");
    fs.mkdirSync(outside);
    const link = path.join(baseDir, "linked-output");
    try {
      fs.symlinkSync(
        outside,
        link,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") {
        t.skip(`symlink creation is not permitted on this platform: ${code}`);
        return;
      }
      throw error;
    }

    assert.throws(
      () => resolveOutputDirectory(baseDir, "linked-output"),
      SecurityError,
    );
  });

  it("supports a symlinked output root without allowing nested escapes", (t) => {
    const realRoot = path.join(root, "real-output-root");
    fs.mkdirSync(realRoot);
    const linkedRoot = path.join(root, "linked-output-root");
    try {
      fs.symlinkSync(
        realRoot,
        linkedRoot,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") {
        t.skip(`symlink creation is not permitted on this platform: ${code}`);
        return;
      }
      throw error;
    }

    const output = resolveNamedOutput(linkedRoot, "capture.png", IMAGE_OUTPUT_EXTENSIONS);
    assert.equal(output, path.join(linkedRoot, "capture.png"));
    fs.writeFileSync(output, "png");
    assert.equal(
      fs.realpathSync(output),
      path.join(fs.realpathSync(realRoot), "capture.png"),
    );

    const outside = path.join(root, "nested-escape-target");
    fs.mkdirSync(outside);
    try {
      fs.symlinkSync(
        outside,
        path.join(realRoot, "nested-escape"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") return;
      throw error;
    }

    assert.throws(
      () => resolveNamedOutput(linkedRoot, "nested-escape/capture.png", IMAGE_OUTPUT_EXTENSIONS),
      SecurityError,
    );
  });

  it("supports output roots reached through a symlinked parent", (t) => {
    const realParent = path.join(root, "real-parent");
    const linkedParent = path.join(root, "linked-parent");
    fs.mkdirSync(realParent);
    try {
      fs.symlinkSync(
        realParent,
        linkedParent,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") {
        t.skip(`symlink creation is not permitted on this platform: ${code}`);
        return;
      }
      throw error;
    }

    const outputBase = path.join(linkedParent, "captures");
    fs.mkdirSync(outputBase);
    const output = resolveNamedOutput(outputBase, "capture.png", IMAGE_OUTPUT_EXTENSIONS);
    assert.equal(output, path.join(outputBase, "capture.png"));
    fs.writeFileSync(output, "png");
    assert.equal(
      fs.realpathSync(output),
      path.join(fs.realpathSync(realParent), "captures", "capture.png"),
    );
  });

  it("rejects broken symlinks that would write outside the output root", (t) => {
    const outside = path.join(root, "broken-symlink-target");
    fs.mkdirSync(outside);
    const brokenLink = path.join(baseDir, "broken.png");
    try {
      fs.symlinkSync(path.join(outside, "missing.png"), brokenLink);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") {
        t.skip(`symlink creation is not permitted on this platform: ${code}`);
        return;
      }
      throw error;
    }

    assert.throws(
      () => resolveNamedOutput(baseDir, "broken.png", IMAGE_OUTPUT_EXTENSIONS),
      SecurityError,
    );
  });

  it("enforces the allowed output extensions", () => {
    const png = resolveNamedOutput(baseDir, "capture.png", IMAGE_OUTPUT_EXTENSIONS);
    assert.equal(png, path.join(baseDir, "capture.png"));

    const jpeg = resolveNamedOutput(baseDir, "capture.JPEG", IMAGE_OUTPUT_EXTENSIONS);
    assert.equal(jpeg, path.join(baseDir, "capture.JPEG"));

    for (const filename of ["capture.gif", "capture.svg", "capture", "   "]) {
      assert.throws(
        () => resolveNamedOutput(baseDir, filename, IMAGE_OUTPUT_EXTENSIONS),
        SecurityError,
        `Expected unsupported output name to be rejected: ${filename}`,
      );
    }
  });

  it("rejects traversal in named output files", () => {
    for (const filename of [
      "../escape.png",
      "nested/../../escape.png",
      "..%2Fescape.png",
    ]) {
      assert.throws(
        () => resolveNamedOutput(baseDir, filename, IMAGE_OUTPUT_EXTENSIONS),
        SecurityError,
        `Expected file traversal to be blocked: ${filename}`,
      );
    }
  });

  it("rejects named output files outside the configured base directory", () => {
    const outside = path.join(root, "outside.png");
    assert.throws(
      () => resolveNamedOutput(baseDir, outside, IMAGE_OUTPUT_EXTENSIONS),
      SecurityError,
    );
  });

  it("creates unique output paths with the requested extension", () => {
    const first = createOutputPath(baseDir, baseDir, "terminal capture", ".png");
    const second = createOutputPath(baseDir, baseDir, "terminal capture", ".png");

    assert.notEqual(first, second);
    assert.equal(path.extname(first), ".png");
    assert.equal(path.extname(second), ".png");
    assert.equal(path.dirname(first), baseDir);
    assert.equal(path.dirname(second), baseDir);
    assert.ok(path.basename(first).startsWith("terminal-capture-"));
  });

  it("rejects a generated output directory outside the configured base directory", () => {
    const outside = path.join(root, "outside-generated");
    fs.mkdirSync(outside);
    assert.throws(
      () => createOutputPath(baseDir, outside, "capture", "png"),
      SecurityError,
    );
  });
});
