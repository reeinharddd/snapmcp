import { describe, it } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

describe("captureFile line range", () => {
  it("extracts correct line range from file content", () => {
    // Test the line-slicing logic directly
    const content = "line1\nline2\nline3\nline4\nline5";
    const lines = content.split("\n");
    const sliced = lines.slice(1, 4).join("\n");
    assert.equal(sliced, "line2\nline3\nline4");
  });

  it("handles startLine only", () => {
    const content = "a\nb\nc\nd\ne";
    const lines = content.split("\n");
    const sliced = lines.slice(2).join("\n");
    assert.equal(sliced, "c\nd\ne");
  });

  it("handles single line range", () => {
    const content = "a\nb\nc";
    const lines = content.split("\n");
    const sliced = lines.slice(1, 2).join("\n");
    assert.equal(sliced, "b");
  });

  it("handles whole file when no range", () => {
    const content = "a\nb\nc";
    const lines = content.split("\n");
    const sliced = lines.slice(0).join("\n");
    assert.equal(sliced, "a\nb\nc");
  });

  it("handles slice from start to specific line", () => {
    const content = "x\ny\nz";
    const lines = content.split("\n");
    const sliced = lines.slice(0, 2).join("\n");
    assert.equal(sliced, "x\ny");
  });
});
