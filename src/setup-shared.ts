/**
 * snapmcp bootstrap — shared detection, setup, and summary functions.
 *
 * Used by:
 *  - scripts/setup.mjs (standalone interactive bootstrap)
 *  - src/cli.ts       (snapmcp init command)
 *
 * @module
 */

import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import {
  detectMcpClients,
  printDetectedClients,
  type McpClientConfig,
} from "./register.js";
import { detectChrome } from "./browser.js";
import {
  hasPlaywrightChromium,
  installPlaywrightChromium,
} from "./playwright-cli.js";

/* ─── Types ───────────────────────────────────────────────── */

/** Full system state snapshot (read-only detection) */
export interface SystemState {
  runtime: {
    bun: boolean;
    nodeVersion: string;
    platform: string;
  };
  chromium: {
    installed: boolean;
    systemChrome: string | null;
    playwrightBrowsers: boolean;
  };
  outputDir: {
    exists: boolean;
    writable: boolean;
    path: string;
  };
  config: {
    envVars: Record<string, string>;
    configFile: string | null;
  };
  installMode: "global" | "project" | "unknown";
}

/* ─── Color constants ─────────────────────────────────────── */

export const CHECK = "\x1b[32m✓\x1b[0m";
export const WARN  = "\x1b[33m⚠\x1b[0m";
export const CROSS = "\x1b[31m✗\x1b[0m";
export const STEP  = "\x1b[36m→\x1b[0m";
export const TEAL  = (s: string) => `\x1b[38;2;0;212;170m${s}\x1b[0m`;
export const BLUE  = (s: string) => `\x1b[38;2;0;153;255m${s}\x1b[0m`;
export const GRAY  = (s: string) => `\x1b[38;2;107;107;128m${s}\x1b[0m`;

/* ─── Helpers ─────────────────────────────────────────────── */

/**
 * Ask a yes/no question on the terminal.
 * Returns true for yes, false for no.
 * Works in both Node and Bun.
 */
export async function ask(prompt: string, defaultYes: boolean = true): Promise<boolean> {
  // Auto-answer in CI / non-interactive environments
  if (process.env.CI || !process.stdin.isTTY) return defaultYes;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>((resolve) => {
    rl.question(`${prompt} ${defaultYes ? "[Y/n]" : "[y/N]"} `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === "") resolve(defaultYes);
      else resolve(trimmed === "y" || trimmed === "yes");
    });
  });
}

/**
 * Detect install mode based on how the process was invoked.
 */
export function detectInstallMode(): "global" | "project" | "unknown" {
  const exe = process.argv[1] || "";
  // Check for npx-run detection
  if (exe.includes("_npx") || /\bnpx\b/.test(exe)) return "global";

  // Check for bunx
  if (exe.includes("/bunx") || exe.includes("\\bunx")) return "global";

  // Check if cwd is the snapmcp project
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { name?: string };
      if (pkg.name === "snapmcp") return "project";
    }
  } catch {
    /* best-effort */
  }

  // Check if we're inside node_modules
  if (exe.includes("node_modules")) return "global";

  return "unknown";
}

/* ─── Detection ───────────────────────────────────────────── */

/**
 * Read-only system state detection. Never modifies the system.
 */
export function detectSystemState(): SystemState {
  const outDir = process.env.SNAPMCP_DIR || "./captures";
  const resolvedOut = path.resolve(outDir);

  /* Runtime */
  const bun = process.versions?.bun !== undefined;

  /* Chromium: exact executable detection (system browser or Playwright cache) */
  const detectedChrome = detectChrome();
  const playwrightBrowsers = hasPlaywrightChromium();
  const systemChrome = detectedChrome.executablePath ?? null;
  const chromiumInstalled = playwrightBrowsers || detectedChrome.found;

  /* Output directory */
  let outExists = false;
  let outWritable = false;
  try {
    outExists = fs.existsSync(resolvedOut);
    if (outExists) {
      fs.accessSync(resolvedOut, fs.constants.R_OK | fs.constants.W_OK);
      outWritable = true;
    }
  } catch {
    /* directory doesn't exist or permissions issue */
  }

  /* Config: env vars */
  const envVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("SNAPMCP_") && value) {
      envVars[key] = value;
    }
  }

  /* Config: .env file */
  let configFile: string | null = null;
  try {
    const envPath = path.resolve(".env");
    if (fs.existsSync(envPath)) configFile = envPath;
  } catch {
    /* best-effort */
  }

  const installMode = detectInstallMode();

  return {
    runtime: { bun, nodeVersion: process.version, platform: process.platform },
    chromium: { installed: chromiumInstalled, systemChrome, playwrightBrowsers },
    outputDir: { exists: outExists, writable: outWritable, path: resolvedOut },
    config: { envVars, configFile },
    installMode,
  };
}

/* ─── Bootstrap ───────────────────────────────────────────── */

/**
 * Interactive setup: ask user for each missing dependency and install/configure.
 * Call after detectSystemState() to show what's missing.
 *
 * @param options.installChrome - Set false to skip Chromium install prompt (default: true)
 * @param options.outputDir     - Custom output dir path (default: SNAPMCP_DIR or ./captures)
 * @param options.createEnv     - Set false to skip .env prompt (default: true)
 */
export async function bootstrapSetup(options?: {
  installChrome?: boolean;
  outputDir?: string;
  createEnv?: boolean;
}): Promise<void> {
  const state = detectSystemState();

  /* ── a. Install Playwright Chromium ── */
  // The bundled browser is the reproducible default even when a system Chrome
  // is present, so `snapmcp init` explicitly ensures that Playwright Chromium
  // is available.
  if (!state.chromium.playwrightBrowsers) {
    if (options?.installChrome !== false) {
      const answer = await ask(
        "  Install Playwright Chromium (the reproducible browser default)?",
        true,
      );
      if (answer) {
        console.log(`  ${STEP} Installing Chromium with the local Playwright CLI...`);
        try {
          installPlaywrightChromium();
          console.log(`  ${CHECK} Chromium installed`);
        } catch {
          console.log(
            `  ${CROSS} Chromium install failed. Manual: npx playwright install chromium`,
          );
        }
      }
    }
  } else {
    console.log(`  ${CHECK} Playwright Chromium already available`);
  }

  /* ── b. Create output directory ── */
  const outDir = options?.outputDir || process.env.SNAPMCP_DIR || "./captures";
  const resolvedOut = path.resolve(outDir);
  if (!state.outputDir.exists) {
    const answer = await ask(
      `  Output directory '${outDir}' not found. Create it?`,
      true,
    );
    if (answer) {
      fs.mkdirSync(resolvedOut, { recursive: true });
      console.log(`  ${CHECK} Created: ${resolvedOut}`);
    }
  } else {
    console.log(`  ${CHECK} Output directory exists: ${resolvedOut}`);
  }

  /* ── c. Notify about system Chrome vs Playwright ── */
  if (state.chromium.systemChrome && !state.chromium.playwrightBrowsers) {
    console.log(
      `  ${STEP} System Chrome found at: ${state.chromium.systemChrome}`,
    );
    console.log(
      `  ${GRAY("     For reproducible rendering, run snapmcp init to install Playwright Chromium")}`,
    );
  }

  /* ── d. Save .env file ── */
  if (options?.createEnv !== false) {
    const existing = state.config.configFile !== null;
    const prompt = existing
      ? "  .env file exists. Overwrite with current SNAPMCP_ settings?"
      : "  Save current SNAPMCP_ configuration to .env file?";
    const answer = await ask(prompt, !existing);
    if (answer) {
      const vars: Record<string, string> = {
        SNAPMCP_DIR: process.env.SNAPMCP_DIR || "./captures",
        SNAPMCP_FORMAT: process.env.SNAPMCP_FORMAT || "png",
        SNAPMCP_THEME: process.env.SNAPMCP_THEME || "dark-plus",
        SNAPMCP_SHADOW: process.env.SNAPMCP_SHADOW || "soft",
        SNAPMCP_WINDOW_CHROME: process.env.SNAPMCP_WINDOW_CHROME || "true",
      };
      // Only include vars that differ from defaults or are explicitly set
      const lines = Object.entries(vars)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`);
      fs.writeFileSync(".env", lines.join("\n") + "\n");
      console.log(`  ${CHECK} .env file written (${lines.length} variables)`);
    }
  }
}

/* ─── Summary ─────────────────────────────────────────────── */

/**
 * Print a formatted system summary table.
 * Uses console.log for output (safe before MCP server starts).
 */
export function printSummary(
  state: SystemState,
  clients: McpClientConfig[] = detectMcpClients(),
): void {
  console.log("");
  console.log(`  ${TEAL("╔═══════════════════════════════════════════╗")}`);
  console.log(`  ${TEAL("║  ⬡ snapmcp — System Summary              ║")}`);
  console.log(`  ${TEAL("╚═══════════════════════════════════════════╝")}`);
  console.log("");

  /* Runtime */
  console.log(`  ${BLUE("Runtime")}`);
  if (state.runtime.bun) {
    console.log(`    ${CHECK} Bun ${process.versions.bun}`);
  } else {
    console.log(`    ${CHECK} Node.js ${state.runtime.nodeVersion}`);
  }
  console.log(`    ${CHECK} Platform: ${state.runtime.platform}`);
  console.log("");

  /* Chromium */
  console.log(`  ${BLUE("Chromium")}`);
  if (state.chromium.playwrightBrowsers) {
    console.log(`    ${CHECK} Playwright Chromium installed`);
  } else {
    console.log(`    ${WARN} Playwright Chromium not installed`);
  }
  if (state.chromium.systemChrome) {
    console.log(
      `    ${CHECK} System Chrome: ${state.chromium.systemChrome}`,
    );
  }
  if (!state.chromium.installed) {
    console.log(`    ${CROSS} No Chromium found — install required`);
  }
  console.log("");

  /* Output directory */
  console.log(`  ${BLUE("Output")}`);
  if (state.outputDir.exists && state.outputDir.writable) {
    console.log(`    ${CHECK} ${state.outputDir.path} (writable)`);
  } else if (state.outputDir.exists) {
    console.log(`    ${WARN} ${state.outputDir.path} (not writable)`);
  } else {
    console.log(`    ${WARN} ${state.outputDir.path} (does not exist)`);
  }
  console.log("");

  /* Config */
  console.log(`  ${BLUE("Config")}`);
  const envKeys = Object.keys(state.config.envVars);
  if (envKeys.length > 0) {
    for (const key of envKeys.slice(0, 8)) {
      console.log(`    ${CHECK} ${key}=${state.config.envVars[key]}`);
    }
    if (envKeys.length > 8) {
      console.log(`    ${GRAY(`  ... and ${envKeys.length - 8} more`)}`);
    }
  } else {
    console.log(`    ${STEP} No SNAPMCP_* env vars set`);
  }
  if (state.config.configFile) {
    console.log(`    ${CHECK} .env: ${state.config.configFile}`);
  }
  console.log("");

  /* Install mode */
  console.log(`  ${BLUE("Install")}`);
  const modeIcon =
    state.installMode === "project"
      ? CHECK
      : state.installMode === "global"
        ? CHECK
        : STEP;
  console.log(`    ${modeIcon} Mode: ${state.installMode}`);
  console.log("");

  /* ─── MCP Client Detection ─── */
  printDetectedClients(clients);

  /* ─── MCP Client Config Snippet ─── */
  printMcpConfigSnippet(state, clients);
}

/** Resolve the local command shown in MCP configuration snippets. */
function resolveMcpCommand(state: SystemState): { command: string; args: string[] } {
  const entrypoint = process.argv[1] ?? "";
  const isNpxInvocation = entrypoint.includes("npx") || entrypoint.includes("_npx");
  const isBunxInvocation = entrypoint.includes("/bunx") || entrypoint.includes("\\bunx");

  if (isNpxInvocation) return { command: "npx", args: ["-y", "snapmcp"] };
  if (isBunxInvocation) return { command: "bunx", args: ["snapmcp"] };
  if (state.installMode === "global") return { command: "snapmcp", args: [] };
  if (state.installMode === "project" && state.runtime.bun) {
    return { command: "bun", args: ["run", "src/index.ts"] };
  }
  if (state.installMode === "project") {
    return { command: "node", args: ["dist/index.js"] };
  }
  return { command: "npx", args: ["-y", "snapmcp"] };
}

/** Collect environment values shown in MCP configuration snippets. */
function resolveMcpEnvironment(state: SystemState): Record<string, string> {
  const environment: Record<string, string> = {
    SNAPMCP_DIR: state.config.envVars.SNAPMCP_DIR || "./captures",
  };
  if (state.config.envVars.SNAPMCP_THEME) {
    environment.SNAPMCP_THEME = state.config.envVars.SNAPMCP_THEME;
  }
  return environment;
}

export interface McpConfigSnippet {
  label: string;
  config: Record<string, unknown>;
}

/** Build client-specific snippets using the configuration shape each client expects. */
export function buildMcpConfigSnippets(
  state: SystemState,
  clients: McpClientConfig[],
): McpConfigSnippet[] {
  const { command, args } = resolveMcpCommand(state);
  const environment = resolveMcpEnvironment(state);
  const snippets: McpConfigSnippet[] = [];

  if (clients.some((client) => client.format === "opencode")) {
    snippets.push({
      label: "MCP Client Config (OpenCode V2)",
      config: {
        mcp: {
          servers: {
            snapmcp: {
              type: "local",
              command: [command, ...args],
              environment,
            },
          },
        },
      },
    });
  }

  if (clients.some((client) => client.format !== "opencode") || clients.length === 0) {
    snippets.push({
      label: "MCP Client Config (Claude Desktop / Cursor / Windsurf / Cline)",
      config: {
        mcpServers: {
          snapmcp: {
            command,
            args,
            env: environment,
          },
        },
      },
    });
  }

  return snippets;
}

/**
 * Print MCP client configuration snippets based on detected install mode.
 */
function printMcpConfigSnippet(
  state: SystemState,
  clients: McpClientConfig[] = detectMcpClients(),
): void {
  for (const snippet of buildMcpConfigSnippets(state, clients)) {
    console.log(`  ${BLUE(snippet.label)}`);
    console.log(`  ${GRAY("Paste into your MCP client settings:")}`);
    console.log("");
    console.log(JSON.stringify(snippet.config, null, 2));
    console.log("");
  }
}
