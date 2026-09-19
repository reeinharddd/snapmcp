/**
 * Singleton Shiki highlighter for snapmcp.
 *
 * Uses Shiki v4's getSingletonHighlighter to reuse a single highlighter
 * instance across all code-to-HTML conversions, avoiding repeated
 * WASM/grammar loading on every capture_code / capture_file call.
 */

import { getSingletonHighlighter } from "shiki";

/** Languages used across all code capture tools */
const LANGUAGES = [
  "python",
  "javascript",
  "typescript",
  "tsx",
  "jsx",
  "sql",
  "json",
  "yaml",
  "markdown",
  "html",
  "css",
  "bash",
  "go",
  "rust",
  "cpp",
  "c",
  "csharp",
  "java",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "toml",
  "xml",
  "diff",
  "dockerfile",
  "terraform",
];

/** All supported themes (pre-loaded so theme switching is instant) */
const THEMES = [
  "dark-plus",
  "dracula",
  "github-dark",
  "github-dark-dimmed",
  "github-light",
  "monokai",
  "nord",
  "one-dark-pro",
  "one-light",
  "poimandres",
  "solarized-dark",
  "solarized-light",
  "vitesse-dark",
  "vitesse-light",
  "min-dark",
  "min-light",
  "tokyo-night",
  "ayu-dark",
  "ayu-light",
  "catppuccin-mocha",
  "catppuccin-latte",
  "rose-pine",
  "rose-pine-dawn",
  "rose-pine-moon",
  "slack-dark",
  "slack-ochin",
  "snazzy-light",
];

let _highlighterPromise: Promise<void> | null = null;

/**
 * Lazily initialize and return the shared highlighter instance.
 * The highlighter is created once and reused for all captures.
 */
export async function getHighlighter(): Promise<void> {
  if (_highlighterPromise) return _highlighterPromise;

  _highlighterPromise = (async () => {
    await getSingletonHighlighter({
      themes: THEMES,
      langs: LANGUAGES,
    });
  })();

  return _highlighterPromise;
}

/**
 * Highlight code using the shared highlighter.
 * Initializes the highlighter on first call if needed.
 */
export async function highlightCode(
  code: string,
  lang: string,
  theme: string,
): Promise<string> {
  await getHighlighter();

  const highlighter = await getSingletonHighlighter({
    themes: THEMES,
    langs: LANGUAGES,
  });

  // Fallback: if the requested theme isn't loaded, use dark-plus
  const loaded = highlighter.getLoadedThemes();
  const safeTheme = loaded.includes(theme) ? theme : "dark-plus";

  return highlighter.codeToHtml(code, { lang: lang || "text", theme: safeTheme });
}
