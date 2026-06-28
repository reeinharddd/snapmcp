/**
 * Structured logger with audit support for snapmcp.
 *
 * Usage:
 *   import { logger, setLogLevel, setLogFile, closeAuditLog } from "./logger.js";
 *   logger.info("Server started");
 *   logger.audit({ event: "file_read", severity: "info", detail: "path/to/file" });
 *
 * Log levels: error (0) < warn (1) < info (2) < debug (3)
 * Controlled by SNAPMCP_LOG_LEVEL env var.
 *
 * Audit logging writes structured JSON to SNAPMCP_LOG_FILE when configured.
 */

import fs from "node:fs";

export type LogLevel = "error" | "warn" | "info" | "debug";

/** Categorized audit event types */
export enum AuditEventType {
  SsrfBlock = "ssrf_block",
  CaptureBrowser = "capture_browser",
  CapturePdf = "capture_pdf",
  FileRead = "file_read",
  PathTraversal = "path_traversal",
  LimitExceeded = "limit_exceeded",
}

export interface AuditEvent {
  /** ISO timestamp (auto-filled by logger.audit if omitted) */
  ts?: string;
  event: string;
  severity: "info" | "warn" | "error";
  detail?: string;
  source?: string;
}

const LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

let currentLevel: LogLevel = "info";
let logStream: fs.WriteStream | null = null;

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

export function setLogFile(filePath: string): void {
  if (logStream) logStream.end();
  const dir = filePath.slice(0, filePath.lastIndexOf("/"));
  if (dir) fs.mkdirSync(dir, { recursive: true });
  logStream = fs.createWriteStream(filePath, { flags: "a" });
}

export function closeAuditLog(): void {
  if (logStream) { logStream.end(); logStream = null; }
}

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function log(level: LogLevel, ...args: unknown[]): void {
  if (LEVELS[level] <= LEVELS[currentLevel]) {
    const tag = level.toUpperCase().padEnd(5);
    console.error(`[${tag} ${ts()}]`, ...args);
  }
}

export const logger = {
  error:  (...args: unknown[]) => log("error",  ...args),
  warn:   (...args: unknown[]) => log("warn",   ...args),
  info:   (...args: unknown[]) => log("info",   ...args),
  debug:  (...args: unknown[]) => log("debug",  ...args),

  audit: (event: AuditEvent): void => {
    log("info", `[AUDIT] ${event.event}${event.detail ? ` — ${event.detail}` : ""}`);
    if (logStream) {
      logStream.write(`${JSON.stringify({ ...event, ts: new Date().toISOString() })}\n`);
    }
  },
};
