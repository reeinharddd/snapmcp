import { describe, it } from "node:test";
import assert from "node:assert";
import { sliceCodeRange } from "../src/renderer.js";

describe("sliceCodeRange", () => {
  const code = "line1\nline2\nline3\nline4\nline5";

  it("returns the complete source when no range is requested", () => {
    assert.deepEqual(sliceCodeRange(code), { code, startLine: 1 });
  });

  it("uses inclusive 1-indexed start and end lines", () => {
    assert.deepEqual(sliceCodeRange(code, 2, 4), {
      code: "line2\nline3\nline4",
      startLine: 2,
    });
  });

  it("includes the requested end line", () => {
    assert.deepEqual(sliceCodeRange(code, 3, 3), {
      code: "line3",
      startLine: 3,
    });
  });

  it("runs from the requested start through the final line", () => {
    assert.deepEqual(sliceCodeRange(code, 3), {
      code: "line3\nline4\nline5",
      startLine: 3,
    });
  });

  it("runs from the first line through the requested end", () => {
    assert.deepEqual(sliceCodeRange(code, undefined, 3), {
      code: "line1\nline2\nline3",
      startLine: 1,
    });
  });

  it("rejects invalid and out-of-bounds ranges", () => {
    for (const range of [
      [0, 2],
      [2, 1],
      [1.5, 2],
      [1, 2.5],
      [1, 6],
    ] as const) {
      assert.throws(
        () => sliceCodeRange(code, range[0], range[1]),
        /Invalid line range/,
      );
    }
  });

  it("preserves an empty source when the only line is selected", () => {
    assert.deepEqual(sliceCodeRange("", 1, 1), {
      code: "",
      startLine: 1,
    });
  });
});
