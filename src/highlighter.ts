/**
 * Singleton Shiki highlighter for snapmcp.
 *
 * Common grammars are preloaded for fast startup. Any other bundled Shiki
 * language is loaded on demand and reused by the singleton instance.
 */

import { getSingletonHighlighter } from "shiki";

/** Frequently used languages preloaded during server startup. */
const PRELOADED_LANGUAGES = [
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

/** All supported themes (pre-loaded so theme switching is instant). */
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

type SharedHighlighter = Awaited<ReturnType<typeof getSingletonHighlighter>>;

let _highlighterPromise: Promise<SharedHighlighter> | null = null;

async function getSharedHighlighter(): Promise<SharedHighlighter> {
  if (!_highlighterPromise) {
    _highlighterPromise = getSingletonHighlighter({
      themes: THEMES,
      langs: PRELOADED_LANGUAGES,
    }).catch((error) => {
      _highlighterPromise = null;
      throw error;
    });
  }
  return _highlighterPromise;
}

/**
 * Lazily initialize the shared highlighter instance.
 * The highlighter is created once and reused for all captures.
 */
export async function getHighlighter(): Promise<void> {
  await getSharedHighlighter();
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
  const highlighter = await getSharedHighlighter();
  const requestedLanguage = (lang || "text").toLowerCase();

  if (
    requestedLanguage !== "text" &&
    !highlighter.getLoadedLanguages().includes(requestedLanguage)
  ) {
    await highlighter.loadLanguage(
      requestedLanguage as Parameters<typeof highlighter.loadLanguage>[0],
    );
  }

  const loaded = highlighter.getLoadedThemes();
  const safeTheme = loaded.includes(theme) ? theme : "dark-plus";

  return highlighter.codeToHtml(code, {
    lang: requestedLanguage,
    theme: safeTheme,
  });
}
