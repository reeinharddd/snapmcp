/**
 * Simple structured logger for snapmcp.
 *
 * Usage:
 *   import { logger, setLogLevel } from "./logger.js";
 *   logger.info("Server started");
 *   logger.debug("Verbose detail"); // only shown when log level is debug
 *
 * Log levels: error (0) < warn (1) < info (2) < debug (3)
 * Controlled by SNAPMCP_LOG_LEVEL env var.
 */

export type LogLevel = "error" | "warn" | "info" | "debug";

const LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function formatTimestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function log(level: LogLevel, ...args: unknown[]): void {
  if (LEVELS[level] <= LEVELS[currentLevel]) {
    const prefix = level.toUpperCase().padEnd(5);
    console.error(`[${prefix} ${formatTimestamp()}]`, ...args);
  }
}

export const logger = {
  error: (...args: unknown[]) => log("error", ...args),
  warn: (...args: unknown[]) => log("warn", ...args),
  info: (...args: unknown[]) => log("info", ...args),
  debug: (...args: unknown[]) => log("debug", ...args),
};
