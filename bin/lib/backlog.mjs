// Backlog enforcement — track warnings per feature in backlog.md
// Gate cannot pass until warnings are documented.
// Unfixed warnings carry forward to the next feature.

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { atomicWriteSync } from "./util.mjs";

const WARN_PATTERN = /\bwarn(ing)?\b/i;

// Extract unique warning lines from command output (stdout or stderr).
export function extractWarnings(text) {
  if (!text) return [];
  return [...new Set(
    text.split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0 && l.length < 500 && WARN_PATTERN.test(l))
  )].slice(0, 50);
}

// Read backlog.md from a feature directory.
// Returns { documented: string[], unresolved: string[] }
export function readBacklog(featureDir) {
  const path = join(featureDir, "backlog.md");
  if (!existsSync(path)) return { documented: [], unresolved: [] };
  const lines = readFileSync(path, "utf8").split("\n").map(l => l.trim());
  const documented = lines
    .filter(l => /^- \[[ x]\]/.test(l))
    .map(l => l.replace(/^- \[[ x]\] /, ""));
  const unresolved = lines
    .filter(l => /^- \[ \]/.test(l))
    .map(l => l.replace(/^- \[ \] /, ""));
  return { documented, unresolved };
}

// Return warnings not yet present in backlog.md.
export function findNewWarnings(warnings, featureDir) {
  const { documented } = readBacklog(featureDir);
  return warnings.filter(
    w => !documented.some(d => d.includes(w) || w.includes(d.slice(0, 60)))
  );
}

// Append warnings as unchecked items to backlog.md, creating the file if needed.
export function documentWarnings(featureDir, warnings, source) {
  if (!warnings.length) return;
  const path = join(featureDir, "backlog.md");
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const header = existing || "# Backlog\n\nWarnings tracked during feature execution.\n\n";
  const date = new Date().toISOString().slice(0, 10);
  const newLines = warnings.map(w => `- [ ] [${source}] ${date}: ${w}`).join("\n");
  const content = existing
    ? existing.trimEnd() + "\n" + newLines + "\n"
    : header + newLines + "\n";
  atomicWriteSync(path, content);
}

// Copy unresolved warnings from one feature's backlog to another.
// Returns the number of warnings carried forward.
export function carryForward(fromFeatureDir, toFeatureDir) {
  const { unresolved } = readBacklog(fromFeatureDir);
  if (!unresolved.length) return 0;
  documentWarnings(toFeatureDir, unresolved, "carried-forward");
  return unresolved.length;
}
