import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { resolveSafePath, safeFileStem, SecurityError } from "./security.js";

/** Extensions accepted by image-producing tools. */
export const IMAGE_OUTPUT_EXTENSIONS = [".png", ".jpg", ".jpeg"] as const;

/**
 * Resolve and create an output directory that is confined to `baseDir`.
 * Absolute paths are accepted only when they resolve inside `baseDir`.
 */
export function resolveOutputDirectory(baseDir: string, requested?: string): string {
  const base = path.resolve(baseDir);
  fs.mkdirSync(base, { recursive: true });

  const outputDir = requested ? resolveSafePath(base, requested) : base;
  fs.mkdirSync(outputDir, { recursive: true });

  // Re-check after creation so a pre-existing symlink cannot redirect writes.
  const relative = path.relative(base, outputDir);
  return resolveSafePath(base, relative || ".");
}

/**
 * Resolve a named output file and enforce one of the allowed extensions.
 * The extension is part of the public contract because it controls the
 * on-disk format and MIME type.
 */
export function resolveNamedOutput(
  baseDir: string,
  filename: string,
  allowedExtensions: readonly string[],
): string {
  const base = path.resolve(baseDir);
  const normalized = filename.trim();
  if (!normalized) {
    throw new SecurityError("Output filename cannot be empty");
  }

  const extension = path.extname(normalized).toLowerCase();
  const allowed = allowedExtensions.map((value) => value.toLowerCase());
  if (!allowed.includes(extension)) {
    throw new SecurityError(
      `Unsupported output extension "${extension || "(none)"}" (expected ${allowed.join(", ")})`,
    );
  }

  const resolved = resolveSafePath(base, normalized);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

/**
 * Create a unique output path inside a previously resolved output directory.
 */
export function createOutputPath(
  baseDir: string,
  outputDir: string,
  stem: string,
  extension: string,
): string {
  const base = path.resolve(baseDir);
  const directory = path.resolve(outputDir);
  if (!directory.startsWith(base + path.sep) && directory !== base) {
    throw new SecurityError("Output directory resolves outside the configured output directory");
  }

  const suffix = randomBytes(4).toString("hex");
  const filename = `${safeFileStem(stem)}-${Date.now()}-${suffix}.${extension.replace(/^\./, "")}`;
  const resolved = resolveSafePath(base, path.relative(base, path.join(directory, filename)));
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}
