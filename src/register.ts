/**
 * snapmcp MCP auto-registration.
 *
 * Detects MCP clients on the system (OpenCode, Claude Desktop, etc.)
 * and registers snapmcp as an MCP server in their config files.
 * Always creates a .bak backup before modifying any config.
 *
 * @module
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  applyEdits,
  modify,
  parse,
  printParseErrorCode,
  type JSONPath,
  type ParseError,
} from "jsonc-parser";
import { ask, CHECK, WARN, CROSS, STEP, TEAL, BLUE, GRAY } from "./setup-shared.js";

/* ─── Types ───────────────────────────────────────────────── */

/** Describes a detected MCP client config file */
export interface McpClientConfig {
  name: string;
  configPath: string;
  format: "opencode" | "claude-desktop" | "vscode-cline" | "windsurf" | "cursor";
  exists: boolean;
}

/** Result of registering snapmcp in a single client config */
export interface RegistrationResult {
  client: string;
  configPath: string;
  action: "added" | "skipped" | "error";
  error?: string;
}

/* ─── Known client definitions ────────────────────────────── */

/**
 * Return the candidate paths for the user's global OpenCode config.
 * OpenCode supports both JSON and JSONC. XDG_CONFIG_HOME is checked first,
 * followed by the documented ~/.config fallback.
 */
export function openCodeConfigCandidates(): string[] {
  const roots: string[] = [];
  const xdgConfigHome = process.env.XDG_CONFIG_HOME?.trim();
  if (xdgConfigHome) roots.push(path.join(path.resolve(xdgConfigHome), "opencode"));
  roots.push(path.join(os.homedir(), ".config", "opencode"));

  const uniqueRoots = [...new Set(roots.map((root) => path.resolve(root)))];
  return uniqueRoots.flatMap((root) => [
    path.join(root, "opencode.jsonc"),
    path.join(root, "opencode.json"),
  ]);
}

/**
 * Find the global OpenCode config to target.
 *
 * OpenCode merges `opencode.json` and `opencode.jsonc` when both exist, so
 * preferring a file that already registers snapmcp avoids creating a duplicate
 * entry. Otherwise JSONC wins because it preserves comments and formatting.
 */
export function findOpenCodeConfigPath(): string | null {
  const existing = openCodeConfigCandidates().filter((candidate) => fs.existsSync(candidate));
  if (existing.length === 0) return null;

  for (const candidate of existing) {
    try {
      const raw = fs.readFileSync(candidate, "utf-8");
      if (hasSnapmcp(parseClientConfig(raw, candidate), "opencode")) return candidate;
    } catch {
      // Unreadable or malformed configs are reported during registration.
    }
  }

  return existing[0]!;
}

/**
 * Build list of known MCP client config file paths.
 * Each entry is checked for existence at call time.
 */
function knownClients(): McpClientConfig[] {
  const home = os.homedir();
  const clients: McpClientConfig[] = [];

  /* 1. OpenCode */
  const opencodePath = findOpenCodeConfigPath();
  if (opencodePath) {
    clients.push({
      name: "OpenCode",
      configPath: opencodePath,
      format: "opencode",
      exists: true,
    });
  }

  /* 2. Claude Desktop */
  const claudePath = path.join(home, ".config", "Claude", "claude_desktop_config.json");
  clients.push({
    name: "Claude Desktop",
    configPath: claudePath,
    format: "claude-desktop",
    exists: fs.existsSync(claudePath),
  });

  /* 3. Windsurf */
  const windsurfPath = path.join(home, ".config", "windsurf", "settings.json");
  clients.push({
    name: "Windsurf",
    configPath: windsurfPath,
    format: "windsurf",
    exists: fs.existsSync(windsurfPath),
  });

  /* 4. Cursor */
  const cursorPath = path.join(home, ".config", "Cursor", "User", "settings.json");
  clients.push({
    name: "Cursor",
    configPath: cursorPath,
    format: "cursor",
    exists: fs.existsSync(cursorPath),
  });

  /* 5. VS Code Cline / Roo-Cline extensions (globalStorage) */
  const vscodeStorage = path.join(home, ".config", "Code", "User", "globalStorage");
  if (fs.existsSync(vscodeStorage)) {
    try {
      const entries = fs.readdirSync(vscodeStorage);
      for (const entry of entries) {
        if (entry.toLowerCase().includes("cline") || entry.toLowerCase().includes("roo-cline")) {
          const settingsPath = path.join(vscodeStorage, entry, "settings.json");
          if (fs.existsSync(settingsPath)) {
            clients.push({
              name: `VS Code (${entry})`,
              configPath: settingsPath,
              format: "vscode-cline",
              exists: true,
            });
          }
        }
      }
    } catch {
      /* best-effort */
    }
  }

  return clients;
}

/* ─── Detection ───────────────────────────────────────────── */

/**
 * Scan the system for known MCP client configuration files.
 * Only returns clients whose config files actually exist.
 */
export function detectMcpClients(): McpClientConfig[] {
  return knownClients().filter((c) => c.exists);
}

/* ─── Registration ────────────────────────────────────────── */

/** snapmcp server identity */
const SNAPMCP_COMMAND = "npx";
const SNAPMCP_ARGS = ["-y", "snapmcp"];

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/**
 * Check if snapmcp already exists in the config object.
 */
export function hasSnapmcp(config: Record<string, unknown>, format: McpClientConfig["format"]): boolean {
  switch (format) {
    case "opencode": {
      const mcp = asObject(config["mcp"]);
      const servers = asObject(mcp?.["servers"]);
      // Also recognize the deprecated V1 location so init does not create a
      // duplicate server while an existing configuration is being migrated.
      return (
        (servers !== undefined && Object.hasOwn(servers, "snapmcp")) ||
        (mcp !== undefined && Object.hasOwn(mcp, "snapmcp"))
      );
    }
    case "claude-desktop":
    case "windsurf":
    case "cursor": {
      const section = asObject(config["mcpServers"]);
      return section !== undefined && Object.hasOwn(section, "snapmcp");
    }
    case "vscode-cline": {
      const section = asObject(config["cline"]);
      const servers = asObject(section?.["mcpServers"]);
      return servers !== undefined && Object.hasOwn(servers, "snapmcp");
    }
  }
}

function snapmcpEntry(format: McpClientConfig["format"]): Record<string, unknown> {
  if (format === "opencode") {
    return {
      type: "local",
      command: [SNAPMCP_COMMAND, ...SNAPMCP_ARGS],
    };
  }
  return {
    command: SNAPMCP_COMMAND,
    args: SNAPMCP_ARGS,
  };
}

function snapmcpConfigPath(format: McpClientConfig["format"]): JSONPath {
  switch (format) {
    case "opencode":
      return ["mcp", "servers", "snapmcp"];
    case "claude-desktop":
    case "windsurf":
    case "cursor":
      return ["mcpServers", "snapmcp"];
    case "vscode-cline":
      return ["cline", "mcpServers", "snapmcp"];
  }
}

/**
 * Add snapmcp entry to the config object (mutates in-place).
 */
export function addSnapmcpEntry(config: Record<string, unknown>, format: McpClientConfig["format"]): void {
  const entry = snapmcpEntry(format);

  switch (format) {
    case "opencode": {
      const mcp = asObject(config["mcp"]) ?? {};
      const servers = asObject(mcp["servers"]) ?? {};
      servers["snapmcp"] = entry;
      mcp["servers"] = servers;
      config["mcp"] = mcp;
      break;
    }
    case "claude-desktop":
    case "windsurf":
    case "cursor": {
      const section = asObject(config["mcpServers"]) ?? {};
      section["snapmcp"] = entry;
      config["mcpServers"] = section;
      break;
    }
    case "vscode-cline": {
      const section = asObject(config["cline"]) ?? {};
      const servers = asObject(section["mcpServers"]) ?? {};
      servers["snapmcp"] = entry;
      section["mcpServers"] = servers;
      config["cline"] = section;
      break;
    }
  }
}

/** Parse a JSON/JSONC client config and reject malformed input. */
function parseClientConfig(raw: string, configPath: string): Record<string, unknown> {
  const errors: ParseError[] = [];
  const parsed = parse(raw, errors, {
    allowTrailingComma: true,
    allowEmptyContent: false,
  });
  if (errors.length > 0) {
    const first = errors[0]!;
    throw new Error(
      `Invalid JSON/JSONC in ${configPath} at offset ${first.offset}: ${printParseErrorCode(first.error)}`,
    );
  }
  const config = asObject(parsed);
  if (!config) {
    throw new Error(`MCP client config must contain a JSON object: ${configPath}`);
  }
  return config;
}

/**
 * Add snapmcp to JSON/JSONC source text while preserving comments, trailing
 * commas, and unrelated settings. The updated source is parsed again before
 * it is returned so a malformed edit can never be written.
 */
export function addSnapmcpEntryToText(
  raw: string,
  format: McpClientConfig["format"],
): string {
  parseClientConfig(raw, "<client-config>");
  const edits = modify(raw, snapmcpConfigPath(format), snapmcpEntry(format), {
    formattingOptions: {
      insertSpaces: true,
      tabSize: 2,
      eol: "\n",
    },
  });
  const updated = applyEdits(raw, edits);
  parseClientConfig(updated, "<updated-client-config>");
  return updated;
}

/**
 * Register snapmcp in all detected MCP client configs.
 *
 * For each config:
 *  1. Confirm with user via ask()
 *  2. Create a .bak backup of the original file
 *  3. Add snapmcp entry if not already present
 *  4. Write updated config back
 *
 * @param dryRun - If true, only show what would be done (no writes, no backup)
 * @returns Array of registration results
 */
export async function registerSnapmcp(
  dryRun: boolean = false,
  clients: McpClientConfig[] = detectMcpClients(),
): Promise<RegistrationResult[]> {
  const results: RegistrationResult[] = [];

  for (const client of clients) {
    try {
      const raw = fs.readFileSync(client.configPath, "utf-8");
      const config = parseClientConfig(raw, client.configPath);

      if (hasSnapmcp(config, client.format)) {
        results.push({
          client: client.name,
          configPath: client.configPath,
          action: "skipped",
        });
        continue;
      }

      /* Ask user for confirmation (skip in dry-run mode) */
      if (!dryRun) {
        const answer = await ask(
          `  Register snapmcp in ${BLUE(client.name)} config?`,
          true,
        );
        if (!answer) {
          results.push({
            client: client.name,
            configPath: client.configPath,
            action: "skipped",
          });
          continue;
        }
      }

      if (dryRun) {
        results.push({
          client: client.name,
          configPath: client.configPath,
          action: "added",
        });
        continue;
      }

      /* Create .bak backup */
      const bakPath = client.configPath + ".bak";
      fs.copyFileSync(client.configPath, bakPath);

      /* Add snapmcp entry while preserving JSONC comments and formatting. */
      const updated = addSnapmcpEntryToText(raw, client.format);

      /* Write updated config */
      fs.writeFileSync(client.configPath, updated);

      results.push({
        client: client.name,
        configPath: client.configPath,
        action: "added",
      });
    } catch (err) {
      results.push({
        client: client.name,
        configPath: client.configPath,
        action: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

/* ─── Display ─────────────────────────────────────────────── */

/**
 * Print a formatted summary of MCP auto-registration results.
 */
export function printRegistrationResults(results: RegistrationResult[]): void {
  if (results.length === 0) {
    console.log(`  ${STEP} No MCP clients detected for auto-registration`);
    return;
  }

  console.log("");
  console.log(`  ${TEAL("╔═══════════════════════════════════════════╗")}`);
  console.log(`  ${TEAL("║  ⬡ snapmcp — MCP Registration            ║")}`);
  console.log(`  ${TEAL("╚═══════════════════════════════════════════╝")}`);
  console.log("");

  for (const r of results) {
    const icon = r.action === "added" ? CHECK : r.action === "skipped" ? STEP : CROSS;
    const label =
      r.action === "added"
        ? "Registered"
        : r.action === "skipped"
          ? r.error
            ? "Error"
            : "Already registered"
          : "Error";
    console.log(`  ${icon} ${BLUE(r.client)}`);
    console.log(`    ${GRAY(r.configPath)}`);
    console.log(`    ${label}${r.error ? `: ${r.error}` : ""}`);
  }
  console.log("");
}

/**
 * Print MCP client detection status.
 */
export function printDetectedClients(clients: McpClientConfig[]): void {
  if (clients.length === 0) {
    console.log(`  ${STEP} No MCP clients detected`);
    return;
  }

  console.log(`  ${BLUE("MCP Clients Detected")}`);
  for (const c of clients) {
    console.log(`    ${CHECK} ${c.name}`);
    console.log(`      ${GRAY(c.configPath)}`);
  }
  console.log("");
}
