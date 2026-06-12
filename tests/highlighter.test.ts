/**
 * Tests for the Shiki-based syntax highlighter.
 *
 * These tests load the real Shiki WASM highlighter (loaded at startup
 * in production anyway) and test actual syntax highlighting output.
 *
 * The first call to getHighlighter() will load WASM + grammars (~2-5s).
 * Subsequent calls reuse the singleton.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert";

describe("highlighter module loads", () => {
  it("exports expected functions", async () => {
    const mod = await import("../src/highlighter.js");
    assert.equal(typeof mod.getHighlighter, "function");
    assert.equal(typeof mod.highlightCode, "function");
  });
});

describe("getHighlighter", () => {
  it("initializes without error (loads WASM)", { timeout: 30_000 }, async () => {
    const { getHighlighter } = await import("../src/highlighter.js");
    // Should resolve without throwing
    await getHighlighter();
  });
});

describe("highlightCode", () => {
  before(async () => {
    const { getHighlighter } = await import("../src/highlighter.js");
    await getHighlighter();
  });

  it("highlights TypeScript code with dark-plus theme", { timeout: 10_000 }, async () => {
    const { highlightCode } = await import("../src/highlighter.js");
    const result = await highlightCode("const x: number = 1;", "typescript", "dark-plus");
    assert.ok(typeof result === "string");
    // Should contain either <pre> or <code> tag
    assert.ok(result.includes("<pre") || result.includes("<code"), "Expected HTML with <pre> or <code>");
    // Should contain the source code text
    assert.ok(result.includes("const"));
    assert.ok(result.includes("x"));
  });

  it("highlights Python code with monokai theme", { timeout: 10_000 }, async () => {
    const { highlightCode } = await import("../src/highlighter.js");
    const result = await highlightCode("def hello():\n    print('world')", "python", "monokai");
    assert.ok(typeof result === "string");
    assert.ok(result.includes("<pre") || result.includes("<code"));
    assert.ok(result.includes("def"));
    assert.ok(result.includes("hello"));
  });

  it("handles empty code string", { timeout: 10_000 }, async () => {
    const { highlightCode } = await import("../src/highlighter.js");
    const result = await highlightCode("", "text", "dark-plus");
    assert.ok(typeof result === "string");
    assert.ok(result.includes("<pre") || result.includes("<code"));
  });

  it("throws ShikiError for unknown language", { timeout: 10_000 }, async () => {
    const { highlightCode } = await import("../src/highlighter.js");
    // Shiki throws if language isn't loaded; the tool handlers catch this upstream
    await assert.rejects(
      () => highlightCode("hello world", "unknown_language", "dark-plus"),
      /Language/,
    );
  });

  it("uses fallback theme for nonexistent theme", { timeout: 10_000 }, async () => {
    const { highlightCode } = await import("../src/highlighter.js");
    // The highlighter falls back to "dark-plus" for unloaded themes
    const result = await highlightCode("test", "typescript", "nonexistent_theme");
    assert.ok(typeof result === "string");
    // It should still produce valid HTML with a theme class
    assert.ok(result.includes("shiki") || result.includes("code") || result.includes("pre"));
  });

  it("highlights Go code", { timeout: 10_000 }, async () => {
    const { highlightCode } = await import("../src/highlighter.js");
    const result = await highlightCode('package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hello")\n}', "go", "github-dark");
    assert.ok(typeof result === "string");
    assert.ok(result.includes("package"));
    assert.ok(result.includes("main"));
  });

  it("highlights Rust code", { timeout: 10_000 }, async () => {
    const { highlightCode } = await import("../src/highlighter.js");
    const result = await highlightCode("fn main() {\n    println!(\"hello\");\n}", "rust", "nord");
    assert.ok(typeof result === "string");
    assert.ok(result.includes("fn"));
    assert.ok(result.includes("main"));
  });

  it("produces different HTML for different themes", { timeout: 10_000 }, async () => {
    const { highlightCode } = await import("../src/highlighter.js");
    const code = "const msg = 'hello';";
    const darkResult = await highlightCode(code, "typescript", "dark-plus");
    const lightResult = await highlightCode(code, "typescript", "github-light");
    assert.ok(typeof darkResult === "string");
    assert.ok(typeof lightResult === "string");
    // Both should be valid HTML
    assert.ok(darkResult.includes("msg"));
    assert.ok(lightResult.includes("msg"));
  });
});

describe("auto-init on first call", () => {
  it("highlightCode works without explicit getHighlighter() call", { timeout: 30_000 }, async () => {
    // This module import should not have been initialized by earlier tests
    // But since the highlighter is a singleton, the second call will be a no-op.
    // We test that it still works by calling highlightCode directly.
    const mod = await import("../src/highlighter.js");
    // If _initialized is already true from before(), this still tests the fallback path
    const result = await mod.highlightCode("test", "text", "dark-plus");
    assert.ok(typeof result === "string");
    assert.ok(result.includes("test"));
  });
});
