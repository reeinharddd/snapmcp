/**
 * Chrome/Chromium detection and browser profile management.
 *
 * Detects system-installed Chrome/Chromium, finds user profiles,
 * and manages browser lifecycle for real-profile captures.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { logger } from "./logger.js";

export interface ChromeProfile {
  name: string;
  path: string;
  isDefault: boolean;
}

export interface DetectedChrome {
  found: boolean;
  executablePath?: string;
  channel?: string;
  profiles?: ChromeProfile[];
}

/** @internal Windows Chrome/Chromium/Edge executable paths (resolved at load) */
const CHROME_PATHS_WIN: Array<{ path: string; channel: string }> = (() => {
  const localAppData =
    process.env.LOCALAPPDATA ||
    path.win32.join(process.env.USERPROFILE || "", "AppData", "Local");
  const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";
  return [
    { path: path.win32.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"), channel: "chrome" },
    { path: path.win32.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"), channel: "chrome" },
    { path: path.win32.join(localAppData, "Google", "Chrome Beta", "Application", "chrome.exe"), channel: "chrome" },
    { path: path.win32.join(localAppData, "Chromium", "Application", "chrome.exe"), channel: "chromium" },
    { path: path.win32.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"), channel: "msedge" },
    { path: path.win32.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"), channel: "msedge" },
  ];
})();

/** @internal macOS Chrome/Chromium/Edge executable paths (resolved at load) */
const CHROME_PATHS_MAC: Array<{ path: string; channel: string }> = (() => {
  const home = process.env.HOME || "";
  return [
    { path: path.join("/", "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"), channel: "chrome" },
    { path: path.join(home, "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"), channel: "chrome" },
    { path: path.join("/", "Applications", "Microsoft Edge.app", "Contents", "MacOS", "Microsoft Edge"), channel: "msedge" },
  ];
})();

/**
 * Return platform-appropriate Chrome/Chromium/Edge executable paths.
 * Each entry has the full path and the channel label for profile detection.
 */
function getChromePaths(): Array<{ path: string; channel: string }> {
  if (process.platform === "win32") return CHROME_PATHS_WIN;
  if (process.platform === "darwin") return CHROME_PATHS_MAC;
  return [];
}

/**
 * Return the user-data-directory for a given channel on the current platform.
 */
export function getChromeProfileDir(channel: string): string {
  if (process.platform === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA ||
      path.win32.join(process.env.USERPROFILE || "", "AppData", "Local");
    if (channel === "msedge") return path.win32.join(localAppData, "Microsoft", "Edge", "User Data");
    if (channel === "chromium") return path.win32.join(localAppData, "Chromium", "User Data");
    return path.win32.join(localAppData, "Google", "Chrome", "User Data");
  }
  if (process.platform === "darwin") {
    const home = process.env.HOME || "";
    if (channel === "msedge") return path.join(home, "Library", "Application Support", "Microsoft Edge");
    if (channel === "chromium") return path.join(home, "Library", "Application Support", "Chromium");
    return path.join(home, "Library", "Application Support", "Google", "Chrome");
  }
  // Linux
  if (channel === "msedge" || channel === "chrome") return path.join(os.homedir(), ".config/google-chrome");
  return path.join(os.homedir(), ".config/chromium");
}

export function tryWhich(bin: string): string | null {
  try {
    const out = execSync(`which ${bin} 2>/dev/null`, {
      encoding: "utf8",
      timeout: 5000,
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

export function tryPath(p: string): string | null {
  try {
    if (fs.existsSync(p)) {
      fs.accessSync(p, fs.constants.X_OK);
      return p;
    }
  } catch {
    // not accessible
  }
  return null;
}

export function detectChromeProfiles(baseDir: string): ChromeProfile[] {
  const localStatePath = path.join(baseDir, "Local State");
  try {
    if (!fs.existsSync(localStatePath)) return [];

    const raw = fs.readFileSync(localStatePath, "utf-8");
    const localState = JSON.parse(raw);
    const cache = localState?.profile?.info_cache;
    if (!cache) return [];

    const profiles: ChromeProfile[] = [];
    const profileKeys = Object.keys(cache);

    for (const key of profileKeys) {
      const info = cache[key];
      profiles.push({
        name: info.name ?? key,
        path: path.join(baseDir, key),
        isDefault: key === "Default",
      });
    }

    // Sort by last active time descending, then by name
    profiles.sort((a, b) => {
      const aKey = Object.keys(cache).find((k) => path.basename(a.path) === k);
      const bKey = Object.keys(cache).find((k) => path.basename(b.path) === k);
      const aTime = (aKey && cache[aKey]?.last_active) ?? 0;
      const bTime = (bKey && cache[bKey]?.last_active) ?? 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.name.localeCompare(b.name);
    });

    return profiles;
  } catch {
    return [];
  }
}

/**
 * Detect system-installed Chrome/Chromium/Edge.
 *
 * Cross-platform search order (adapts per process.platform):
 *  1. SNAPMCP_CHROME_EXECUTABLE env var
 *  2. Platform-specific paths (via getChromePaths)
 *  3. which google-chrome-stable, google-chrome, chromium, chromium-browser
 *  4. Not found
 */
export function detectChrome(): DetectedChrome {
  // 1. Check env var
  const envPath = process.env.SNAPMCP_CHROME_EXECUTABLE;
  if (envPath) {
    const resolved = tryPath(envPath);
    if (resolved) {
      return {
        found: true,
        executablePath: resolved,
        channel: "chrome",
        profiles: detectChromeProfiles(getChromeProfileDir("chrome")),
      };
    }
  }

  // 2. Platform-specific paths
  const platformPaths = getChromePaths();
  for (const { path: binPath, channel } of platformPaths) {
    const resolved = tryPath(binPath);
    if (resolved) {
      return {
        found: true,
        executablePath: resolved,
        channel,
        profiles: detectChromeProfiles(getChromeProfileDir(channel)),
      };
    }
  }

  // 3. Try which for standard binary names
  const candidates = [
    { bin: "google-chrome-stable", channel: "chrome" },
    { bin: "google-chrome", channel: "chrome" },
    { bin: "chromium", channel: "chromium" },
    { bin: "chromium-browser", channel: "chromium" },
  ];

  for (const { bin, channel } of candidates) {
    const resolved = tryWhich(bin);
    if (resolved) {
      return {
        found: true,
        executablePath: resolved,
        channel,
        profiles: detectChromeProfiles(getChromeProfileDir(channel)),
      };
    }
  }

  // 4. Not found
  return { found: false };
}

/**
 * Log Chrome detection status to the snapmcp logger.
 */
export function logChromeStatus(detected: DetectedChrome): void {
  if (detected.found) {
    const profileCount = detected.profiles?.length ?? 0;
    logger.info(
      `[INFO] Chrome detected: ${detected.executablePath} (channel: ${detected.channel}, profiles: ${profileCount})`,
    );
  } else {
    logger.info(
      "[INFO] No system Chrome detected — using Playwright bundled Chromium",
    );
  }
}
