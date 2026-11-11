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
import { TOOL_LIMITS } from "./capabilities.js";

// DNS lookup cache (hostname → IPs) with a short TTL. Failed lookups are not
// cached so transient resolver failures fail closed instead of becoming sticky.
const _dnsCache = new Map<string, { ips: string[]; ts: number }>();
const DNS_TTL_MS = 5_000;

async function resolveHostname(hostname: string, fresh = false): Promise<string[]> {
  const now = Date.now();
  const hit = _dnsCache.get(hostname);
  if (!fresh && hit && now - hit.ts < DNS_TTL_MS) return hit.ips;
  try {
    const result = await dns.promises.lookup(hostname, { all: true });
    const ips = result.map((a) => a.address);
    _dnsCache.set(hostname, { ips, ts: now });
    return ips;
  } catch {
    _dnsCache.delete(hostname);
    return [];
  }
}

// ─── Size limits ────────────────────────────────────────────
// These prevent resource exhaustion attacks
export const LIMITS = {
  /** Max lines in terminal capture */
  TERMINAL_LINES: TOOL_LIMITS.terminal.maxLines,
  /** Max total terminal payload in bytes */
  TERMINAL_BYTES: TOOL_LIMITS.terminal.maxBytes,
  /** Max code string length (bytes) */
  CODE_LENGTH: TOOL_LIMITS.code.maxBytes,
  /** Max markdown string length */
  MARKDOWN_LENGTH: TOOL_LIMITS.markdown.maxBytes,
  /** Max diff string length */
  DIFF_LENGTH: TOOL_LIMITS.diff.maxBytes,
  /** Max HTML string length */
  HTML_LENGTH: TOOL_LIMITS.html.maxBytes,
  /** Max file size to read (bytes) */
  FILE_READ_SIZE: TOOL_LIMITS.file.maxBytes,
} as const;

// ─── SSRF Protection — URL denylist ────────────────────────
// Blocks requests to private/internal networks to prevent SSRF.
const PRIVATE_CIDR = [
  { start: [0, 0, 0, 0], end: [0, 255, 255, 255] },
  { start: [10, 0, 0, 0], end: [10, 255, 255, 255] },
  { start: [100, 64, 0, 0], end: [100, 127, 255, 255] },
  { start: [127, 0, 0, 0], end: [127, 255, 255, 255] },
  { start: [169, 254, 0, 0], end: [169, 254, 255, 255] },
  { start: [172, 16, 0, 0], end: [172, 31, 255, 255] },
  { start: [192, 0, 0, 0], end: [192, 0, 255, 255] },
  { start: [192, 168, 0, 0], end: [192, 168, 255, 255] },
  { start: [198, 18, 0, 0], end: [198, 19, 255, 255] },
  { start: [224, 0, 0, 0], end: [239, 255, 255, 255] },
  { start: [240, 0, 0, 0], end: [255, 255, 255, 255] },
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
  // Skip DNS resolution — check if it's already an IP literal.
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return isPrivateIPv6(hostname);
  const octets = [ipv4Match[1], ipv4Match[2], ipv4Match[3], ipv4Match[4]].map(Number);
  if (octets.some((o) => o < 0 || o > 255)) return false;
  const ipNum = ipToNum(octets);
  return PRIVATE_CIDR.some((cidr) => ipNum >= ipToNum(cidr.start) && ipNum <= ipToNum(cidr.end));
}

/** Public helper for classifying an IP literal without DNS resolution. */
export function isPrivateIpAddress(address: string): boolean {
  return isPrivateIP(address);
}

/** Parse an IPv6 address into its 16 network-order bytes. */
function parseIPv6Bytes(input: string): number[] | null {
  let value = input.toLowerCase();

  // Convert an embedded dotted-quad into two hextets.
  if (value.includes(".")) {
    const lastColon = value.lastIndexOf(":");
    if (lastColon < 0) return null;
    const octets = value.slice(lastColon + 1).split(".");
    if (octets.length !== 4) return null;
    const numbers = octets.map(Number);
    if (numbers.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return null;
    }
    const high = (numbers[0] << 8) | numbers[1];
    const low = (numbers[2] << 8) | numbers[3];
    value = `${value.slice(0, lastColon + 1)}${high.toString(16)}:${low.toString(16)}`;
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;

  const hextets =
    halves.length === 2
      ? [...left, ...Array.from({ length: missing }, () => "0"), ...right]
      : left;
  if (hextets.length !== 8) return null;
  if (hextets.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;

  const words = hextets.map((part) => parseInt(part, 16));
  const bytes: number[] = [];
  for (const word of words) {
    bytes.push((word >>> 8) & 0xff, word & 0xff);
  }
  return bytes;
}

function isPrivateIPv6(hostname: string): boolean {
  // WHATWG URL hostnames wrap IPv6 literals in brackets ("[::1]"), while
  // dns.lookup returns bare addresses ("::1"). Accept both representations.
  const value = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  if (!value.includes(":")) return false;
  const bytes = parseIPv6Bytes(value);
  if (!bytes) return false;

  const allZero = bytes.every((byte) => byte === 0);
  const loopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
  if (allZero || loopback) return true;

  // Block the complete IPv4-mapped range (::ffff:0:0/96). Chromium and
  // Node can classify mapped addresses differently, so allowing the public
  // subset creates a bypass primitive for loopback/private targets.
  const ipv4Mapped = bytes.slice(0, 10).every((byte) => byte === 0) &&
    bytes[10] === 0xff && bytes[11] === 0xff;
  if (ipv4Mapped) return true;

  // IPv4-compatible/deprecated range (::/96), including ::127.0.0.1 forms.
  if (bytes.slice(0, 12).every((byte) => byte === 0)) return true;

  // Unique local (fc00::/7), link-local (fe80::/10), multicast (ff00::/8),
  // and deprecated site-local (fec0::/10).
  if ((bytes[0] & 0xfe) === 0xfc) return true;
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true;
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return true;
  if (bytes[0] === 0xff) return true;

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

  // Protocol validation is always enforced, independently of SSRF settings.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    logger.audit({ event: "ssrf_block", severity: "warn", detail: `protocol: ${parsed.protocol}`, source: "validateUrl" });
    throw new SecurityError(`URL protocol "${parsed.protocol}" is not allowed (only http/https)`);
  }

  // Credentials in a URL can leak through redirects, logs, and browser state.
  if (parsed.username || parsed.password) {
    logger.audit({ event: "ssrf_block", severity: "warn", detail: "URL contains embedded credentials", source: "validateUrl" });
    throw new SecurityError("URLs with embedded credentials are not allowed");
  }

  if (!ssrfProtection) return;

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
 * Blocks public names that resolve to private ranges (for example, localtest.me
 * or nip.io). Chromium does not pin this answer, so this is not complete
 * DNS-rebinding prevention.
 */
export async function validateUrlResolve(raw: string, ssrfProtection: boolean = false): Promise<void> {
  validateUrl(raw, ssrfProtection);
  if (!ssrfProtection) return;

  const parsed = new URL(raw);
  const hostname = normalizeHostname(parsed.hostname.toLowerCase());
  if (ipv4Match(hostname) || hostname.startsWith("[") || hostname === "localhost") return;

  const ips = await resolveHostname(hostname);
  if (ips.length === 0) {
    logger.audit({ event: "ssrf_block", severity: "warn", detail: `DNS resolution failed: ${hostname}`, source: "validateUrlResolve" });
    throw new SecurityError(`URL target "${hostname}" could not be resolved`);
  }
  if (ips.some((ip) => isPrivateIP(ip))) {
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
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SecurityError(`URL protocol "${parsed.protocol}" is not allowed`);
  }
  if (parsed.username || parsed.password) {
    throw new SecurityError("URLs with embedded credentials are not allowed");
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
  const ips = await resolveHostname(hostname, true);
  if (ips.length === 0) {
    throw new SecurityError(`URL target "${hostname}" could not be resolved`);
  }
  if (ips.some((ip) => isPrivateIP(ip))) {
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

function isPathInside(base: string, target: string): boolean {
  const relative = path.relative(base, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function realpathNearestExisting(target: string): string {
  let current = path.resolve(target);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return fs.realpathSync(current);
}

/**
 * Resolve a path for containment checks while preserving a missing leaf.
 * Existing path components are canonicalized, so a symlinked output root is
 * supported without allowing a nested symlink to escape that canonical root.
 * Broken symlinks are resolved manually because realpath cannot canonicalize
 * a link whose target does not exist yet.
 */
function canonicalPathForContainment(
  target: string,
  seenLinks: Set<string> = new Set(),
): string {
  let current = path.resolve(target);
  const missingSegments: string[] = [];

  while (true) {
    try {
      fs.lstatSync(current);
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
      const parent = path.dirname(current);
      if (parent === current) {
        return path.resolve(current, ...missingSegments);
      }
      missingSegments.unshift(path.basename(current));
      current = parent;
    }
  }

  const stat = fs.lstatSync(current);
  let canonicalExisting: string;
  if (stat.isSymbolicLink()) {
    if (seenLinks.has(current)) {
      throw new SecurityError(`Symlink cycle blocked while resolving output path`);
    }
    seenLinks.add(current);
    const linkTarget = fs.readlinkSync(current);
    const absoluteTarget = path.isAbsolute(linkTarget)
      ? path.resolve(linkTarget)
      : path.resolve(path.dirname(current), linkTarget);
    canonicalExisting = canonicalPathForContainment(absoluteTarget, seenLinks);
  } else {
    canonicalExisting = fs.realpathSync(current);
  }

  return path.resolve(canonicalExisting, ...missingSegments);
}

/**
 * Resolve a user-provided filename safely inside `baseDir`.
 * Throws SecurityError if the resolved path escapes the base directory or if
 * an existing symlink in the path points outside it.
 */
export function resolveSafePath(baseDir: string, userFilename: string): string {
  const absoluteBase = path.resolve(baseDir);

  // Percent-encoded separators are not decoded by the filesystem, but they are
  // commonly decoded by downstream consumers. Reject them conservatively so a
  // filename cannot become a traversal after a second interpretation.
  if (/%2f|%5c/i.test(userFilename)) {
    throw new SecurityError(
      `Path traversal blocked: "${userFilename}" contains an encoded path separator`,
    );
  }

  const resolved = path.resolve(absoluteBase, userFilename);

  if (!isPathInside(absoluteBase, resolved)) {
    throw new SecurityError(
      `Path traversal blocked: "${userFilename}" resolves outside output directory`,
    );
  }

  const realBase = realpathNearestExisting(absoluteBase);
  const canonicalTarget = canonicalPathForContainment(resolved);
  if (!isPathInside(realBase, canonicalTarget)) {
    throw new SecurityError(
      `Symlink escape blocked: "${userFilename}" resolves outside output directory`,
    );
  }

  return resolved;
}

/** Convert arbitrary text into a portable filename stem without path semantics. */
export function safeFileStem(value: string, fallback = "capture"): string {
  let stem = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[. -]+|[. -]+$/g, "")
    .slice(0, 80);

  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) {
    stem = `_${stem}`;
  }

  return stem || fallback;
}

// ─── Input validation ───────────────────────────────────────

export function validateTerminalLines(lines: string[]): void {
  if (lines.length > LIMITS.TERMINAL_LINES) {
    throw new LimitError("terminal lines", LIMITS.TERMINAL_LINES, lines.length);
  }
  let totalBytes = 0;
  for (let i = 0; i < lines.length; i++) {
    if (typeof lines[i] !== "string") {
      throw new SecurityError(`Invalid line type at index ${i}`);
    }
    totalBytes += Buffer.byteLength(lines[i], "utf8");
  }
  if (totalBytes > LIMITS.TERMINAL_BYTES) {
    throw new LimitError("terminal bytes", LIMITS.TERMINAL_BYTES, totalBytes);
  }
}

export function validateCodeInput(code: string): void {
  const bytes = Buffer.byteLength(code, "utf8");
  if (bytes > LIMITS.CODE_LENGTH) {
    throw new LimitError("code bytes", LIMITS.CODE_LENGTH, bytes);
  }
}

export function validateMarkdownInput(markdown: string): void {
  const bytes = Buffer.byteLength(markdown, "utf8");
  if (bytes > LIMITS.MARKDOWN_LENGTH) {
    throw new LimitError("markdown bytes", LIMITS.MARKDOWN_LENGTH, bytes);
  }
}

export function validateDiffInput(diff: string): void {
  const bytes = Buffer.byteLength(diff, "utf8");
  if (bytes > LIMITS.DIFF_LENGTH) {
    throw new LimitError("diff bytes", LIMITS.DIFF_LENGTH, bytes);
  }
}

export function validateHtmlInput(html: string): void {
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > LIMITS.HTML_LENGTH) {
    throw new LimitError("html bytes", LIMITS.HTML_LENGTH, bytes);
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
  const executable =
    process.env["SNAPMCP_CHROME_EXECUTABLE"] ||
    process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];
  const sandboxEnv = process.env["PLAYWRIGHT_SANDBOX"]?.toLowerCase();

  if (sandboxEnv === "0" || sandboxEnv === "false" || sandboxEnv === "no") {
    return {
      sandboxEnabled: false,
      message: "Chromium sandbox is explicitly disabled by PLAYWRIGHT_SANDBOX",
    };
  }

  if (executable && executable.includes("--no-sandbox")) {
    return {
      sandboxEnabled: false,
      message: "Chromium is configured with --no-sandbox",
    };
  }

  if (executable) {
    return {
      sandboxEnabled: false,
      message: `Custom Chromium executable (${executable}); sandbox status cannot be verified statically`,
    };
  }

  return {
    sandboxEnabled: true,
    message: "✓ Chromium sandbox enabled",
  };
}
