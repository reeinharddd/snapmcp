import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Canonical runtime limits for the public tools. Tool schemas, validators, and
 * discovery metadata should use these values so the advertised contract stays
 * aligned with enforcement.
 */
export const TOOL_LIMITS = {
  terminal: { maxLines: 1_000, maxBytes: 1_000_000 },
  code: { maxBytes: 200_000 },
  file: { maxBytes: 5_000_000 },
  markdown: { maxBytes: 200_000 },
  diff: { maxBytes: 500_000 },
  html: { maxBytes: 200_000 },
  browser: {
    minWidth: 320,
    maxWidth: 3_840,
    minHeight: 240,
    maxHeight: 4_096,
  },
  batch: { maxCaptures: 10 },
  sequence: { maxSteps: 60 },
  gif: {
    minFrames: 2,
    maxFrames: 60,
    minFrameDelayMs: 10,
    maxFrameDelayMs: 5_000,
    maxDimension: 8_192,
    maxPixels: 67_108_864,
  },
  document: {
    maxCaptures: 30,
    maxEmbeddedImageBytes: 25_000_000,
    maxEmbeddedTotalBytes: 75_000_000,
  },
} as const;

/** Canonical security defaults and explicitly documented limitations. */
export const SECURITY_DEFAULTS = {
  securityChecks: true,
  ssrfProtection: true,
  urlProtocols: ["http", "https"],
  fileAccess: "deny-all",
  fileAllowlistEnv: "SNAPMCP_ALLOWED_PATHS",
  outputRootEnv: "SNAPMCP_DIR",
  syntheticJavaScript: "disabled",
  syntheticNetwork: "blocked",
  dnsPinning: true,
  dnsPinningMechanism:
    "URL captures run through a local validating proxy that resolves and pins every target, including each redirect hop; Chromium cannot resolve target hostnames itself",
  chromiumSandbox:
    "configuration checked at startup; custom browser status is not statically verifiable",
  containerRuntime: "non-root",
} as const;

/** A compact, machine-readable description of one MCP tool. */
export interface ToolCapability {
  name: string;
  title: string;
  summary: string;
  useWhen: string;
  keywords: readonly string[];
  outputs: readonly string[];
  limits: string;
}

/** A scored search result. */
export interface CapabilityMatch {
  capability: ToolCapability;
  score: number;
}

/**
 * The public capability catalog. Keep this aligned with the tools registered
 * in src/tools/: tests/tools metadata validation enforce the same names.
 */
export const TOOL_CAPABILITIES: readonly ToolCapability[] = [
  {
    name: "capture_terminal",
    title: "Capture terminal output",
    summary: "Render terminal text with a detected or configured palette as PNG or JPEG.",
    useWhen: "The user needs a CLI or console screenshot, or command output embedded in documentation.",
    keywords: ["terminal", "shell", "cli", "console", "command output", "prompt", "screenshot"],
    outputs: ["PNG", "JPEG"],
    limits: `${TOOL_LIMITS.terminal.maxLines} lines / ${TOOL_LIMITS.terminal.maxBytes} bytes`,
  },
  {
    name: "capture_code",
    title: "Capture highlighted code",
    summary: "Render source code with Shiki syntax highlighting and optional line ranges.",
    useWhen: "The user needs a polished code image, IDE-like snippet, or language-specific visual.",
    keywords: ["code", "source", "snippet", "syntax highlighting", "shiki", "ide", "developer"],
    outputs: ["PNG", "JPEG"],
    limits: `${TOOL_LIMITS.code.maxBytes / 1_000} KB input; 300+ bundled languages loaded on demand`,
  },
  {
    name: "capture_browser",
    title: "Capture a web page",
    summary: "Take a full-page or viewport screenshot of an HTTP(S) URL.",
    useWhen: "The user needs a visual snapshot of a website, web app, dashboard, or rendered page.",
    keywords: ["browser", "web", "website", "webpage", "url", "page", "screenshot", "chromium"],
    outputs: ["PNG", "JPEG"],
    limits: `HTTP(S) only; width ${TOOL_LIMITS.browser.minWidth}-${TOOL_LIMITS.browser.maxWidth}px, height ${TOOL_LIMITS.browser.minHeight}-${TOOL_LIMITS.browser.maxHeight}px; SSRF-protected`,
  },
  {
    name: "capture_file",
    title: "Capture a source file",
    summary: "Read an allowed file, detect its language, and render it as a highlighted image.",
    useWhen: "The user refers to a file on disk and wants its visual contents rather than raw text.",
    keywords: ["file", "source file", "repository", "code file", "snippet", "read", "highlight"],
    outputs: ["PNG", "JPEG"],
    limits: `${TOOL_LIMITS.file.maxBytes / 1_000_000} MB by default; requires SNAPMCP_ALLOWED_PATHS; optional inclusive line range`,
  },
  {
    name: "capture_markdown",
    title: "Render Markdown",
    summary: "Render GitHub-flavored Markdown as a styled document image.",
    useWhen: "The user wants readable documentation from Markdown, tables, task lists, or code blocks.",
    keywords: ["markdown", "md", "document", "readme", "gfm", "documentation", "table"],
    outputs: ["PNG", "JPEG"],
    limits: `${TOOL_LIMITS.markdown.maxBytes / 1_000} KB input`,
  },
  {
    name: "capture_html",
    title: "Render HTML",
    summary: "Render an HTML/CSS snippet as a polished image.",
    useWhen: "The user provides HTML and wants a visual preview, email mockup, or UI card.",
    keywords: ["html", "css", "email", "ui", "component", "preview", "markup"],
    outputs: ["PNG", "JPEG"],
    limits: `${TOOL_LIMITS.html.maxBytes / 1_000} KB input; external scripts, frames, and stylesheets are blocked`,
  },
  {
    name: "capture_diff",
    title: "Capture a code diff",
    summary: "Render a unified diff with color-coded additions and deletions.",
    useWhen: "The user wants a visual pull-request diff, migration comparison, or changelog image.",
    keywords: ["diff", "patch", "git", "pull request", "pr", "changes", "deletions", "additions"],
    outputs: ["PNG", "JPEG"],
    limits: `${TOOL_LIMITS.diff.maxBytes / 1_000} KB input`,
  },
  {
    name: "capture_pdf",
    title: "Capture a URL as PDF",
    summary: "Convert an HTTP(S) URL to a print-quality PDF document.",
    useWhen: "The user needs a shareable PDF of a web page instead of an image.",
    keywords: ["pdf", "document", "print", "web page", "website", "url", "export"],
    outputs: ["PDF"],
    limits: `HTTP(S) only; width ${TOOL_LIMITS.browser.minWidth}-${TOOL_LIMITS.browser.maxWidth}px, height ${TOOL_LIMITS.browser.minHeight}-${TOOL_LIMITS.browser.maxHeight}px; SSRF-protected`,
  },
  {
    name: "capture_batch",
    title: "Capture multiple artifacts",
    summary: `Render up to ${TOOL_LIMITS.batch.maxCaptures} independent capture items in one call.`,
    useWhen: "Several independent images are needed for the same documentation workflow.",
    keywords: ["batch", "multiple", "many", "bulk", "several", "documentation set"],
    outputs: ["PNG", "JPEG"],
    limits: `${TOOL_LIMITS.batch.maxCaptures} items per call; each item has a typed schema`,
  },
  {
    name: "capture_sequence",
    title: "Capture a process sequence",
    summary: "Capture ordered steps and optionally compile them into an animated GIF.",
    useWhen: "The user needs a tutorial, workflow, deployment, or before/after sequence.",
    keywords: ["sequence", "steps", "workflow", "tutorial", "pipeline", "deployment", "animation"],
    outputs: ["PNG", "JPEG", "GIF"],
    limits: `${TOOL_LIMITS.sequence.maxSteps} steps; GIF requires at least 2 steps`,
  },
  {
    name: "capture_gif",
    title: "Capture an animated GIF",
    summary: `Render ${TOOL_LIMITS.gif.minFrames}-${TOOL_LIMITS.gif.maxFrames} captures and compile them into a looping or one-shot GIF.`,
    useWhen: "The user explicitly wants an animated before/after comparison or walkthrough.",
    keywords: ["gif", "animation", "animated", "frames", "before after", "walkthrough", "loop"],
    outputs: ["GIF"],
    limits: `${TOOL_LIMITS.gif.minFrames}-${TOOL_LIMITS.gif.maxFrames} frames; maximum canvas ${TOOL_LIMITS.gif.maxDimension}x${TOOL_LIMITS.gif.maxDimension}`,
  },
  {
    name: "capture_document",
    title: "Capture a visual document",
    summary: `Embed up to ${TOOL_LIMITS.document.maxCaptures} captioned captures in a Markdown, self-contained HTML, print-quality PDF, PowerPoint, or Word document.`,
    useWhen: "The final deliverable is a guide, report, tutorial, or visual document containing captures.",
    keywords: ["document", "report", "guide", "tutorial", "manual", "embed", "chapters", "pdf", "pptx", "docx", "powerpoint", "word"],
    outputs: ["Markdown", "HTML", "PDF", "PPTX", "DOCX"],
    limits: `${TOOL_LIMITS.document.maxCaptures} captures per document; ${TOOL_LIMITS.document.maxEmbeddedImageBytes / 1_000_000} MB per embedded image; ${TOOL_LIMITS.document.maxEmbeddedTotalBytes / 1_000_000} MB total embedded images`,
  },
  {
    name: "snapmcp-hint",
    title: "Find the right snapmcp tool",
    summary: "Search snapmcp capabilities by natural-language intent and return concise guidance.",
    useWhen: "An agent is unsure which capture tool to use or needs setup, security, or token guidance.",
    keywords: ["discover", "search", "find", "choose", "help", "hint", "capabilities", "agents", "tokens"],
    outputs: ["Text"],
    limits: "Returns the top 5 matching tools",
  },
] as const;

/**
 * Server-wide guidance. Keep the first 512 characters useful because MCP
 * clients may surface only an excerpt to the model.
 */
export const SERVER_INSTRUCTIONS =
  "Use snapmcp to turn content into visual documentation artifacts (PNG/JPEG, PDF, GIF, Markdown/HTML/PPTX/DOCX). Select one focused tool per artifact; use capture_batch only for independent captures. Every tool returns a structured payload with the saved path, format and size. Use snapmcp-hint with a natural-language query or read snapmcp://capabilities when the correct tool is unclear. URL captures are SSRF-protected; file reads require an explicit allowlist.";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "by",
  "capture",
  "for",
  "from",
  "how",
  "i",
  "in",
  "make",
  "need",
  "of",
  "should",
  "snapmcp",
  "the",
  "to",
  "use",
  "want",
  "what",
  "with",
]);

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.+#-]+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Rank tools by natural-language intent. The ranking is deterministic and
 * intentionally local so discovery does not require embeddings or a network.
 */
export function searchCapabilities(query: string, limit = 5): CapabilityMatch[] {
  const normalizedQuery = normalize(query);
  const tokens = tokenize(query);
  if (!normalizedQuery || tokens.length === 0) {
    return TOOL_CAPABILITIES.slice(0, limit).map((capability) => ({ capability, score: 1 }));
  }

  const matches: CapabilityMatch[] = [];

  for (const capability of TOOL_CAPABILITIES) {
    const normalizedName = normalize(capability.name);
    const shortName = normalizedName.replace(/^capture[ _-]/, "");
    const searchable = normalize(
      [capability.name, capability.title, capability.summary, capability.useWhen, ...capability.keywords].join(" "),
    );
    const keywordSet = capability.keywords.map(normalize);
    let score = 0;

    if (normalizedQuery === normalizedName) score += 100;
    if (normalizedQuery === shortName) score += 80;
    if (normalizedName.includes(normalizedQuery)) score += 35;
    if (shortName.includes(normalizedQuery)) score += 25;

    for (const token of tokens) {
      if (normalizedName.includes(token)) score += 12;
      if (keywordSet.some((keyword) => keyword === token)) score += 18;
      else if (keywordSet.some((keyword) => keyword.includes(token))) score += 10;
      if (searchable.includes(token)) score += 3;
    }

    if (score > 0) {
      matches.push({ capability, score });
    }
  }

  return matches
    .sort((a, b) => b.score - a.score || a.capability.name.localeCompare(b.capability.name))
    .slice(0, Math.max(1, limit));
}

/** Stable JSON manifest used by the CLI, MCP resource, and code-mode clients. */
export function createCapabilityManifest(version: string) {
  return {
    schemaVersion: "1.0",
    name: "snapmcp",
    mcpName: "io.github.reeinharddd/snapmcp",
    version,
    purpose: "Visual documentation artifacts for AI agents and developers.",
    transport: "stdio",
    runtime: {
      node: ">=20",
      bun: "optional",
    },
    toolCount: TOOL_CAPABILITIES.length,
    capabilities: TOOL_CAPABILITIES,
    discovery: {
      canonical: "MCP tools/list",
      searchTool: "snapmcp-hint",
      resource: "snapmcp://capabilities",
      cli: "snapmcp capabilities --json",
      llms: "https://github.com/reeinharddd/snapmcp/blob/main/llms.txt",
    },
    security: {
      ssrfProtection: "default-on",
      urlProtocols: SECURITY_DEFAULTS.urlProtocols,
      fileAccess: "deny-all until SNAPMCP_ALLOWED_PATHS is configured",
      outputConfinement: "SNAPMCP_DIR",
      htmlExternalResources: "blocked",
      syntheticJavaScript: "disabled",
      dnsPinning: SECURITY_DEFAULTS.dnsPinning,
      dnsPinningMechanism: SECURITY_DEFAULTS.dnsPinningMechanism,
      profileMode:
        "experimental and explicit; URL captures share the selected persistent profile storage",
      chromiumSandbox: SECURITY_DEFAULTS.chromiumSandbox,
      containerRuntime: "non-root",
    },
    tokenPolicy: {
      resultMode: "saved file paths in a structured payload",
      boundedInputs: true,
      batchLimit: TOOL_LIMITS.batch.maxCaptures,
      discoveryHint: "Use snapmcp-hint or snapmcp://capabilities before loading full docs.",
    },
    resultContract: {
      structuredContent: true,
      outputSchemas:
        "Every tool advertises a JSON Schema output schema in tools/list and returns a matching structuredContent payload",
      successFields: "path, format and bytes; raster artifacts also report width and height",
      errorMode:
        "Failures return isError=true with a text message; output-schema validation is skipped for error results",
    },
  } as const;
}

/** Register a machine-readable capability manifest as an MCP resource. */
export function registerCapabilityResource(server: McpServer, version: string): void {
  server.registerResource(
    "snapmcp-capabilities",
    "snapmcp://capabilities",
    {
      title: "SnapMCP capability manifest",
      description:
        "Compact, machine-readable catalog of snapmcp tools, limits, discovery surfaces, security defaults, and token policy.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(createCapabilityManifest(version), null, 2),
        },
      ],
    }),
  );
}
