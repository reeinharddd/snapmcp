/**
 * Shell-free command execution.
 *
 * snapmcp only ever runs a small, fixed set of read-only OS probes (for
 * example `dconf read` or `defaults read`) to detect the host terminal theme.
 * Those probes are executed without a shell so that no value read from the
 * environment can be interpreted as shell syntax.
 *
 * `node:child_process` is imported as a namespace because Bun on Windows does
 * not expose every named export of the module (for example `execFileSync`),
 * and a named import would fail at link time. `spawnSync` is preferred and
 * `execFileSync` is the fallback, so every supported runtime works.
 */

import * as childProcess from "node:child_process";

export interface RunCommandOptions {
  /** Milliseconds before the command is killed. */
  timeout?: number;
  /** Inherit the parent stdio instead of capturing stdout. */
  inherit?: boolean;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  status: number;
}

/**
 * Run a command with an argument vector, never through a shell.
 *
 * Throws when the command cannot be started or exits with a non-zero status,
 * matching the behaviour the callers rely on.
 */
export function runCommand(
  file: string,
  args: string[],
  options: RunCommandOptions = {},
): CommandResult {
  const { timeout, inherit = false } = options;

  if (typeof childProcess.spawnSync === "function") {
    const result = childProcess.spawnSync(file, args, {
      encoding: "utf8",
      timeout,
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    if (result.error) throw result.error;
    const status = result.status ?? 1;
    if (status !== 0) {
      throw new Error(
        `Command "${file}" exited with status ${status}: ${(result.stderr ?? "").trim()}`,
      );
    }

    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      status,
    };
  }

  if (typeof childProcess.execFileSync === "function") {
    const stdout = childProcess.execFileSync(file, args, {
      encoding: "utf8",
      timeout,
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    return { stdout: stdout ?? "", stderr: "", status: 0 };
  }

  throw new Error(
    "Unable to run a command: node:child_process exposes neither spawnSync nor execFileSync",
  );
}
