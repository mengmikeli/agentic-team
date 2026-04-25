// Extension loader — scans .team/extensions/ (project-local) and ~/.team/extensions/ (user-global)
// Validates each extension manifest and returns a flat list of validated extensions.

import { existsSync, readdirSync } from "fs";
import { join, normalize } from "path";
import { homedir } from "os";

function isValidExtension(ext) {
  return (
    ext !== null &&
    typeof ext === "object" &&
    typeof ext.name === "string" &&
    ext.name.length > 0 &&
    typeof ext.version === "string" &&
    Array.isArray(ext.capabilities) &&
    typeof ext.hooks === "object" &&
    ext.hooks !== null
  );
}

// Prevent directory traversal: resolved path must stay within base dir
function safePath(base, file) {
  const full = normalize(join(base, file));
  return full.startsWith(normalize(base) + (process.platform === "win32" ? "\\" : "/")) ||
    full === normalize(base)
    ? full
    : null;
}

export async function loadExtensions(cwd = process.cwd()) {
  const dirs = [
    join(cwd, ".team", "extensions"),
    join(homedir(), ".team", "extensions"),
  ];

  const extensions = [];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;

    let files;
    try {
      files = readdirSync(dir).filter(f => f.endsWith(".mjs") || f.endsWith(".js"));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = safePath(dir, file);
      if (!filePath) continue;

      try {
        const mod = await import(filePath);
        const ext = mod.default ?? mod;
        if (isValidExtension(ext)) {
          extensions.push({ ...ext, _path: filePath });
        }
      } catch {
        // skip invalid or erroring extensions
      }
    }
  }

  return extensions;
}
