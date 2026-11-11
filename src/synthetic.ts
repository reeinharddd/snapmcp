import { Marked } from "marked";
import type { Page } from "playwright";
import { highlightCode } from "./highlighter.js";

/**
 * Restrictive policy for synthetic HTML/Markdown. The page also runs with
 * JavaScript disabled and all network requests are blocked by the renderer.
 */
export const SYNTHETIC_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "script-src 'none'",
  "connect-src 'none'",
  "form-action 'none'",
  "media-src 'none'",
  "img-src data: blob:",
  "font-src data:",
  "style-src 'unsafe-inline'",
].join("; ");

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&#38;")
    .replace(/</g, "&#60;")
    .replace(/>/g, "&#62;")
    .replace(/"/g, "&#34;")
    .replace(/'/g, "'");
}

/**
 * Convert Markdown to safe HTML. Raw HTML is escaped, fenced code blocks are
 * highlighted on demand, and the supplied title is added when the document
 * does not already contain a level-one heading.
 */
export async function markdownToSafeHtml(
  markdown: string,
  title: string,
  theme: string,
): Promise<string> {
  const codeBlocks: Array<{ text: string; lang: string }> = [];
  const parser = new Marked({ gfm: true, async: false });

  parser.use({
    renderer: {
      code({ text, lang }) {
        const index = codeBlocks.length;
        codeBlocks.push({ text, lang: (lang ?? "text").split(/\s+/)[0] || "text" });
        return `<div data-snapmcp-code="${index}"></div>`;
      },
      html({ text }) {
        return escapeHtml(text);
      },
    },
  });

  const tokens = parser.lexer(markdown);
  const hasLevelOneHeading = tokens.some(
    (token) => token.type === "heading" && token.depth === 1,
  );
  let html = parser.parse(markdown) as string;

  for (let index = 0; index < codeBlocks.length; index++) {
    const block = codeBlocks[index]!;
    const placeholder = `<div data-snapmcp-code="${index}"></div>`;
    let highlighted: string;
    try {
      highlighted = await highlightCode(block.text, block.lang, theme);
    } catch {
      highlighted = `<pre><code>${escapeHtml(block.text)}</code></pre>`;
    }
    html = html.replace(placeholder, () => highlighted);
  }

  if (!hasLevelOneHeading && title.trim()) {
    html = `<h1>${escapeHtml(title.trim())}</h1>\n${html}`;
  }

  return html;
}

/**
 * Insert untrusted synthetic content into a JavaScript-disabled page.
 *
 * The browser's DOM parser is used as a second sanitization layer. Active
 * elements, event handlers, external resource references, unsafe URL schemes,
 * and external CSS imports are removed before the content reaches the live
 * document. This is defense in depth, not a general-purpose HTML sanitizer.
 */
export async function installSyntheticContent(page: Page, html: string): Promise<void> {
  await page.evaluate(
    ({ source, policy }) => {
      const blockedElements = new Set([
        "applet",
        "base",
        "embed",
        "frame",
        "frameset",
        "iframe",
        "link",
        "meta",
        "object",
        "script",
        "template",
      ]);

      const sanitizeCss = (css: string): string =>
        css
          .replace(/@import\b[^;{}]*(?:;|$)/gi, "")
          .replace(/expression\s*\([^)]*\)/gi, "")
          .replace(/behavior\s*:[^;}]*/gi, "")
          .replace(/-moz-binding\s*:[^;}]*/gi, "")
          .replace(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (match, _quote, rawUrl: string) => {
            const value = rawUrl.trim();
            return value.toLowerCase().startsWith("data:") ? match : "none";
          });

      const isSafeHref = (value: string): boolean => {
        const normalized = value.trim().toLowerCase();
        return (
          normalized.startsWith("#") ||
          normalized.startsWith("http://") ||
          normalized.startsWith("https://") ||
          normalized.startsWith("mailto:")
        );
      };

      const isSafeImageSource = (value: string): boolean =>
        /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(value.trim());

      const parsed = new DOMParser().parseFromString(source, "text/html");
      const elements = Array.from(parsed.querySelectorAll("*"));

      for (const element of elements) {
        const tag = element.tagName.toLowerCase();
        if (blockedElements.has(tag)) {
          element.remove();
          continue;
        }

        for (const attribute of Array.from(element.attributes)) {
          const name = attribute.name.toLowerCase();
          const value = attribute.value;

          if (name.startsWith("on") || name === "srcdoc") {
            element.removeAttribute(attribute.name);
            continue;
          }

          if (name === "style") {
            element.setAttribute("style", sanitizeCss(value));
            continue;
          }

          if (name === "href" && tag === "a") {
            if (!isSafeHref(value)) element.removeAttribute(attribute.name);
            continue;
          }

          if (name === "src" && (tag === "img" || tag === "source")) {
            if (!isSafeImageSource(value)) element.removeAttribute(attribute.name);
            continue;
          }

          if (name === "src") {
            element.removeAttribute(attribute.name);
            continue;
          }

          if (
            name === "srcset" ||
            name === "poster" ||
            name === "background" ||
            name === "action" ||
            name === "formaction" ||
            name === "ping" ||
            name === "xlink:href" ||
            (name === "href" && tag !== "a")
          ) {
            element.removeAttribute(attribute.name);
          }
        }
      }

      const css = Array.from(parsed.querySelectorAll("style"))
        .map((element) => sanitizeCss(element.textContent ?? ""))
        .filter(Boolean)
        .join("\n");
      parsed.querySelectorAll("style").forEach((element) => element.remove());

      document.head.replaceChildren();
      const policyElement = document.createElement("meta");
      policyElement.httpEquiv = "Content-Security-Policy";
      policyElement.content = policy;
      document.head.appendChild(policyElement);

      if (css) {
        const styleElement = document.createElement("style");
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
      }

      const template = document.createElement("template");
      template.innerHTML = parsed.body.innerHTML;
      document.body.replaceChildren(template.content);
    },
    { source: html, policy: SYNTHETIC_CSP },
  );
}
