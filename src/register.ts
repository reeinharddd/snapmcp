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
 * Build list of known MCP client config file paths.
 * Each entry is checked for existence at call time.
 */
function knownClients(): McpClientConfig[] {
  const home = os.homedir();
  const clients: McpClientConfig[] = [];

  /* 1. OpenCode */
  const opencodePath = path.join(home, ".config", "opencode", "opencode.json");
  clients.push({
    name: "OpenCode",
    configPath: opencodePath,
    format: "opencode",
    exists: fs.existsSync(opencodePath),
  });

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

/**
 * Detect top-level section keys that hold MCP server definitions,
 * depending on the client format.
 */
function mcpSectionKey(format: McpClientConfig["format"]): string {
  switch (format) {
    case "opencode":   return "mcp";
    case "claude-desktop":
    case "windsurf":
    case "cursor":     return "mcpServers";
    case "vscode-cline": return "cline.mcpServers";
  }
}

/**
 * Check if snapmcp already exists in the config JSON.
 */
export function hasSnapmcp(config: Record<string, unknown>, format: McpClientConfig["format"]): boolean {
  switch (format) {
    case "opencode": {
      const section = (config["mcp"] as Record<string, unknown>) || {};
      return "snapmcp" in section;
    }
    case "claude-desktop":
    case "windsurf":
    case "cursor": {
      const section = (config["mcpServers"] as Record<string, unknown>) || {};
      return "snapmcp" in section;
    }
    case "vscode-cline": {
      const section = (config["cline"] as Record<string, unknown>) || {};
      const servers = (section["mcpServers"] as Record<string, unknown>) || {};
      return "snapmcp" in servers;
    }
  }
}

/**
 * Add snapmcp entry to the config object (mutates in-place).
 */
export function addSnapmcpEntry(config: Record<string, unknown>, format: McpClientConfig["format"]): void {
  const snapmcpEntry = {
    command: SNAPMCP_COMMAND,
    args: SNAPMCP_ARGS,
  };

  switch (format) {
    case "opencode": {
      const section = (config["mcp"] as Record<string, unknown>) || {};
      section["snapmcp"] = {
        enabled: true,
        type: "local",
        command: [SNAPMCP_COMMAND, ...SNAPMCP_ARGS],
      };
      config["mcp"] = section;
      break;
    }
    case "claude-desktop":
    case "windsurf":
    case "cursor": {
      const section = (config["mcpServers"] as Record<string, unknown>) || {};
      section["snapmcp"] = { ...snapmcpEntry };
      config["mcpServers"] = section;
      break;
    }
    case "vscode-cline": {
      const section = (config["cline"] as Record<string, unknown>) || {};
      const servers = (section["mcpServers"] as Record<string, unknown>) || {};
      servers["snapmcp"] = { ...snapmcpEntry };
      section["mcpServers"] = servers;
      config["cline"] = section;
      break;
    }
  }
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
export async function registerSnapmcp(dryRun: boolean = false): Promise<RegistrationResult[]> {
  const clients = detectMcpClients();
  const results: RegistrationResult[] = [];

  for (const client of clients) {
    try {
      const raw = fs.readFileSync(client.configPath, "utf-8");
      const config = JSON.parse(raw) as Record<string, unknown>;

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

      /* Add snapmcp entry */
      addSnapmcpEntry(config, client.format);

      /* Write updated config */
      fs.writeFileSync(client.configPath, JSON.stringify(config, null, 2) + "\n");

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
