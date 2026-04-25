// Extension loader — scans .team/extensions/ (project-local) and ~/.team/extensions/ (user-global)
// Validates each extension manifest and returns a flat list of validated extensions.

import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

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
      const filePath = join(dir, file);

      try {
        const mod = await import(filePath);
        const ext = mod.default ?? mod;
        // validate extension manifest
        if (
          ext !== null &&
          typeof ext === "object" &&
          typeof ext.name === "string" &&
          ext.name.length > 0 &&
          typeof ext.version === "string" &&
          Array.isArray(ext.capabilities) &&
          typeof ext.hooks === "object" &&
          ext.hooks !== null
        ) {
          extensions.push({ ...ext, _path: filePath });
        }
      } catch {
        // skip invalid or erroring extensions
      }
    }
  }

  return extensions;
}
