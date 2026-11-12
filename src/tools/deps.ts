/**
 * Shared dependencies injected into every snapmcp tool registration.
 *
 * @module
 */

import type { SnapConfig } from "../config.js";
import type { ToolResult } from "../results.js";

/** Dependencies every tool registration receives. */
export interface ToolDeps {
  /** Resolve an output path inside the configured output directory. */
  outPath: (prefix: string, name?: string) => string;
  /** Build a successful result for a saved artifact. */
  ok: (path: string) => ToolResult;
  /** Build a failed result from a thrown error. */
  fail: (err: unknown) => ToolResult;
  /** Active server configuration. */
  config: SnapConfig;
}
