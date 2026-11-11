import { describe, it } from "node:test";
import assert from "node:assert";
import { SYNTHETIC_CSP, markdownToSafeHtml } from "../src/synthetic.js";

describe("synthetic rendering policy", () => {
  it("denies active content and network connections by default", () => {
    assert.match(SYNTHETIC_CSP, /default-src 'none'/);
    assert.match(SYNTHETIC_CSP, /script-src 'none'/);
    assert.match(SYNTHETIC_CSP, /connect-src 'none'/);
    assert.match(SYNTHETIC_CSP, /object-src 'none'/);
    assert.match(SYNTHETIC_CSP, /frame-src 'none'/);
    assert.match(SYNTHETIC_CSP, /base-uri 'none'/);
  });

  it("allows only inline styles and embedded image/font data", () => {
    assert.match(SYNTHETIC_CSP, /style-src 'unsafe-inline'/);
    assert.match(SYNTHETIC_CSP, /img-src data: blob:/);
    assert.match(SYNTHETIC_CSP, /font-src data:/);
  });

  it("escapes raw HTML instead of emitting active markup", async () => {
    const html = await markdownToSafeHtml(
      "# Safe title\n\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>",
      "Fallback title",
      "dark-plus",
    );

    assert.match(html, /<h1>Safe title<\/h1>/);
    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /<img/i);
    assert.match(html, /&#60;script&#62;/);
    assert.match(html, /onerror=alert\(1\)/);
  });

  it("does not add a fallback title when the Markdown already has one", async () => {
    const html = await markdownToSafeHtml(
      "# Existing title\n\nBody",
      "Fallback title",
      "dark-plus",
    );

    assert.match(html, /<h1>Existing title<\/h1>/);
    assert.doesNotMatch(html, /Fallback title/);
  });
});
