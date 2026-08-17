/**
 * Security utilities for snapmcp.
 *
 * Provides:
 *  - Path traversal prevention (output files stay inside output dir)
 *  - Input size limits (prevent OOM / browser hangs)
 *  - File read validation (protect against arbitrary reads)
 *  - Chromium sandbox detection
 */

import path from "path";
import fs from "fs";
import { URL } from "url";
import dns from "dns";
import { logger } from "./logger.js";

// DNS lookup cache (hostname → IPs) with TTL so the per-request route guard does one lookup per hostname.
const _dnsCache = new Map<string, { ips: string[]; ts: number }>();
const DNS_TTL_MS = 60_000;

async function resolveHostname(hostname: string): Promise<string[]> {
  const now = Date.now();
  const hit = _dnsCache.get(hostname);
  if (hit && now - hit.ts < DNS_TTL_MS) return hit.ips;
  try {
    const result = await dns.promises.lookup(hostname, { all: true });
    const ips = result.map((a) => a.address);
    _dnsCache.set(hostname, { ips, ts: now });
    return ips;
  } catch {
    _dnsCache.set(hostname, { ips: [], ts: now });
    return [];
  }
}

// ─── Size limits ────────────────────────────────────────────
// These prevent resource exhaustion attacks
export const LIMITS = {
  /** Max lines in terminal capture */
  TERMINAL_LINES: 1_000,
  /** Max code string length (bytes) */
  CODE_LENGTH: 200_000,
  /** Max markdown string length */
  MARKDOWN_LENGTH: 200_000,
  /** Max diff string length */
  DIFF_LENGTH: 500_000,
  /** Max HTML string length */
  HTML_LENGTH: 200_000,
  /** Max file size to read (bytes) */
  FILE_READ_SIZE: 5_000_000,
} as const;

// ─── SSRF Protection — URL denylist ────────────────────────
// Blocks requests to private/internal networks to prevent SSRF.
const PRIVATE_CIDR = [
  { start: [10, 0, 0, 0], end: [10, 255, 255, 255] },
  { start: [172, 16, 0, 0], end: [172, 31, 255, 255] },
  { start: [192, 168, 0, 0], end: [192, 168, 255, 255] },
  { start: [127, 0, 0, 0], end: [127, 255, 255, 255] },
  { start: [169, 254, 0, 0], end: [169, 254, 255, 255] },
  { start: [0, 0, 0, 0], end: [0, 255, 255, 255] },
];

function ipToNum(octets: number[]): number {
  return ((octets[0] ?? 0) << 24) | ((octets[1] ?? 0) << 16) | ((octets[2] ?? 0) << 8) | (octets[3] ?? 0);
}

function normalizeHostname(hostname: string): string {
  // WHATWG keeps a single trailing dot (FQDN form). Strip it so "localhost." and
  // "127.0.0.1." match the local-network checks below — DNS still resolves them.
  return hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
}

function ipv4Match(hostname: string): string[] | null {
  return hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
}

function isPrivateIP(hostname: string): boolean {
  // Skip DNS resolution — check if it's already an IP literal
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return isPrivateIPv6(hostname);
  const octets = [ipv4Match[1], ipv4Match[2], ipv4Match[3], ipv4Match[4]].map(Number);
  if (octets.some((o) => o < 0 || o > 255)) return false;
  const ipNum = ipToNum(octets);
  return PRIVATE_CIDR.some((cidr) => ipNum >= ipToNum(cidr.start) && ipNum <= ipToNum(cidr.end));
}

function isPrivateIPv6(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // WHATWG wraps IPv6 hostnames in brackets: "[::1]"
  if (!h.startsWith("[") || !h.endsWith("]")) return false;
  const inner = h.slice(1, -1);

  // Loopback / unspecified
  if (inner === "::1" || inner === "0:0:0:0:0:0:0:1" || inner === "::" ||
      inner === "0:0:0:0:0:0:0:0") return true;

  // IPv4-mapped loopback/private: "[::ffff:7f00:1]" → 127.0.0.1
  const mapped = inner.match(/^::ffff:([0-9a-f]{1,4})\.([0-9a-f]{1,4})$/);
  if (mapped) return true;
  const dotted = inner.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dotted) return isPrivateIP(`${dotted[1]}.${dotted[2]}.${dotted[3]}.${dotted[4]}`);

  // Unique local (fc00::/7) — first hextet fc00–fdff
  const firstHex = parseInt(inner.split(":")[0] || "0", 16);
  if ((firstHex & 0xfe00) === 0xfc00) return true;

  // Link-local (fe80::/10) — first hextet range 0xfe80–0xfebf
  if ((firstHex & 0xffc0) === 0xfe80) return true;

  return false;
}

/**
 * Check whether a URL string is safe for SSRF-conscious navigation.
 * Throws SecurityError when blocked. Validates literal IPs (v4 + v6),
 * localhost variants, and non-http(s) protocols without DNS resolution.
 */
export function validateUrl(raw: string, ssrfProtection: boolean = false): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new SecurityError(`Invalid URL: "${raw}"`);
  }

  if (!ssrfProtection) return;

  // about:blank is a safe, network-free navigation target used as a default
  if (parsed.href === "about:blank") return;

  // Block non-http(s) protocols
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    logger.audit({ event: "ssrf_block", severity: "warn", detail: `protocol: ${parsed.protocol}`, source: "validateUrl" });
    throw new SecurityError(`URL protocol "${parsed.protocol}" is not allowed (only http/https)`);
  }

  const hostname = normalizeHostname(parsed.hostname.toLowerCase());

  // Block localhost variants
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname === "[0:0:0:0:0:0:0:1]" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    logger.audit({ event: "ssrf_block", severity: "warn", detail: `local network: ${hostname}`, source: "validateUrl" });
    throw new SecurityError(`URL target "${hostname}" is blocked (local network)`);
  }

  // Block private IP ranges
  if (isPrivateIP(hostname)) {
    logger.audit({ event: "ssrf_block", severity: "warn", detail: `private IP: ${hostname}`, source: "validateUrl" });
    throw new SecurityError(`URL target "${hostname}" is blocked (private IP range)`);
  }
}

/**
 * Full SSRF validation including DNS resolution of hostnames.
 * Catches public names that resolve to private ranges (e.g. localtest.me, nip.io, DNS rebinding).
 */
export async function validateUrlResolve(raw: string, ssrfProtection: boolean = false): Promise<void> {
  validateUrl(raw, ssrfProtection);
  if (!ssrfProtection) return;

  const parsed = new URL(raw);
  if (parsed.href === "about:blank") return;
  const hostname = normalizeHostname(parsed.hostname.toLowerCase());
  if (ipv4Match(hostname) || hostname.startsWith("[") || hostname === "localhost") return;

  const ips = await resolveHostname(hostname);
  if (ips.some((ip) => isPrivateIP(ip) || ip === "::1" || ip === "::")) {
    logger.audit({ event: "ssrf_block", severity: "warn", detail: `resolved private: ${hostname} → ${ips.join(",")}`, source: "validateUrlResolve" });
    throw new SecurityError(`URL target "${hostname}" resolves to a private/internal address`);
  }
}

/**
 * Route-guard predicate: rejects a (sub)request URL when SSRF protection is active.
 * Re-validation on every request also covers HTTP redirects and in-page resources
 * (img/script/fetch) that bypass the initial validateUrl.
 */
export async function assertSafeRequestUrl(raw: string, ssrfProtection: boolean = false): Promise<void> {
  if (!ssrfProtection) return;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new SecurityError(`Invalid URL: "${raw}"`);
  }
  if (parsed.href === "about:blank") return;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SecurityError(`URL protocol "${parsed.protocol}" is not allowed`);
  }
  const hostname = normalizeHostname(parsed.hostname.toLowerCase());
  if (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" ||
    hostname === "[::1]" || hostname === "[0:0:0:0:0:0:0:1]" ||
    hostname.endsWith(".localhost") || hostname.endsWith(".local")
  ) {
    throw new SecurityError(`URL target "${hostname}" is blocked (local network)`);
  }
  if (isPrivateIP(hostname)) {
    throw new SecurityError(`URL target "${hostname}" is blocked (private IP range)`);
  }
  if (hostname.startsWith("[") || hostname === "localhost") return;
  const ips = await resolveHostname(hostname);
  if (ips.some((ip) => isPrivateIP(ip) || ip === "::1" || ip === "::")) {
    throw new SecurityError(`URL target "${hostname}" resolves to a private/internal address`);
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(`[SECURITY] ${message}`);
    this.name = "SecurityError";
  }
}

export class LimitError extends Error {
  constructor(limit: string, max: number, actual: number) {
    super(
      `[LIMIT] ${limit} exceeds maximum of ${max} (received ${actual})`,
    );
    this.name = "LimitError";
  }
}

// ─── Path traversal prevention ──────────────────────────────

/**
 * Resolve a user-provided filename safely inside `baseDir`.
 * Throws SecurityError if the resolved path escapes the base directory.
 */
export function resolveSafePath(baseDir: string, userFilename: string): string {
  // Normalize the base dir to a clean absolute path
  const absoluteBase = path.resolve(baseDir);
  const resolved = path.resolve(absoluteBase, userFilename);

  // Enforce: resolved path MUST start with base dir
  if (!resolved.startsWith(absoluteBase + path.sep) && resolved !== absoluteBase) {
    throw new SecurityError(
      `Path traversal blocked: "${userFilename}" resolves outside output directory`,
    );
  }

  return resolved;
}

// ─── Input validation ───────────────────────────────────────

export function validateTerminalLines(lines: string[]): void {
  if (lines.length > LIMITS.TERMINAL_LINES) {
    throw new LimitError("terminal lines", LIMITS.TERMINAL_LINES, lines.length);
  }
  for (let i = 0; i < lines.length; i++) {
    if (typeof lines[i] !== "string") {
      throw new SecurityError(`Invalid line type at index ${i}`);
    }
  }
}

export function validateCodeInput(code: string): void {
  if (code.length > LIMITS.CODE_LENGTH) {
    throw new LimitError("code length", LIMITS.CODE_LENGTH, code.length);
  }
}

export function validateMarkdownInput(markdown: string): void {
  if (markdown.length > LIMITS.MARKDOWN_LENGTH) {
    throw new LimitError("markdown length", LIMITS.MARKDOWN_LENGTH, markdown.length);
  }
}

export function validateDiffInput(diff: string): void {
  if (diff.length > LIMITS.DIFF_LENGTH) {
    throw new LimitError("diff length", LIMITS.DIFF_LENGTH, diff.length);
  }
}

export function validateHtmlInput(html: string): void {
  if (html.length > LIMITS.HTML_LENGTH) {
    throw new LimitError("html length", LIMITS.HTML_LENGTH, html.length);
  }
}

// ─── File read validation ───────────────────────────────────

export interface FileReadPolicy {
  /** Max file size in bytes */
  maxSize: number;
  /** Glob of allowed paths (empty = no paths allowed — must configure SNAPMCP_ALLOWED_PATHS) */
  allowedPaths: string[];
}

/**
 * Validate that a file can be safely read.
 * Checks: file exists, is a regular file, respects size limits, respects allowed paths.
 */
export function validateFileRead(
  filePath: string,
  policy: FileReadPolicy,
): void {
  const resolved = path.resolve(filePath);

  // Check allowed paths
  if (policy.allowedPaths.length === 0) {
    logger.audit({ event: "file_read_blocked", severity: "warn", detail: `no allowed paths configured: ${filePath}`, source: "validateFileRead" });
    throw new SecurityError(
      `capture_file requires SNAPMCP_ALLOWED_PATHS to be configured. ` +
      `Set it to a semicolon-separated list of allowed directories. ` +
      `Example: SNAPMCP_ALLOWED_PATHS="/home/user/projects;/tmp"`,
    );
  }

  // Resolve symlinks so a symlink inside an allowed dir cannot escape it
  let real: string;
  try {
    real = fs.realpathSync(resolved);
  } catch {
    throw new SecurityError(`File not found: "${filePath}"`);
  }
  const allowed = policy.allowedPaths.some((allowedPath) => {
    let base: string;
    try {
      base = fs.realpathSync(path.resolve(allowedPath));
    } catch {
      base = path.resolve(allowedPath);
    }
    return real === base || real.startsWith(base + path.sep);
  });
  if (!allowed) {
    logger.audit({ event: "file_read_blocked", severity: "warn", detail: `outside allowed paths: ${filePath}`, source: "validateFileRead" });
    throw new SecurityError(
      `File "${filePath}" is not in any allowed path (see SNAPMCP_ALLOWED_PATHS)`,
    );
  }

  // Check file exists and is a regular file (on the real path)
  let stat: fs.Stats;
  try {
    stat = fs.statSync(real);
  } catch {
    throw new SecurityError(`File not found: "${filePath}"`);
  }

  if (!stat.isFile()) {
    throw new SecurityError(`Not a regular file: "${filePath}"`);
  }

  if (stat.size > policy.maxSize) {
    throw new LimitError(
      "file size",
      policy.maxSize,
      stat.size,
    );
  }
}

// ─── Chromium sandbox check ─────────────────────────────────

export interface SandboxStatus {
  sandboxEnabled: boolean;
  message: string;
}

/**
 * Check if Chromium is running with sandbox enabled.
 * Returns a warning message if sandbox is disabled.
 */
export function checkChromiumSandbox(): SandboxStatus {
  const executable = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];
  const sandboxEnv = process.env["PLAYWRIGHT_SANDBOX"];

  // Explicit sandbox override
  if (sandboxEnv === "1" || sandboxEnv === "true") {
    return { sandboxEnabled: true, message: "✓ Chromium sandbox enabled (forced via PLAYWRIGHT_SANDBOX)" };
  }

  // Check if --no-sandbox is in the executable args
  if (executable && executable.includes("--no-sandbox")) {
    return {
      sandboxEnabled: false,
      message: "⚠️  Chromium running without sandbox (--no-sandbox detected). " +
        "Add --cap-add=SYS_ADMIN or set PLAYWRIGHT_SANDBOX=1 for better isolation.",
    };
  }

  // Custom executable path — can't verify sandbox status
  if (executable) {
    return {
      sandboxEnabled: false,
      message: `⚠️  Custom Chromium executable (${executable}) — sandbox status unknown. ` +
        "Set PLAYWRIGHT_SANDBOX=1 to explicitly enable sandbox.",
    };
  }

  return { sandboxEnabled: true, message: "✓ Chromium sandbox enabled" };
}
