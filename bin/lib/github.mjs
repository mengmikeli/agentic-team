// GitHub Issues integration via gh CLI.
// Gracefully degrades when gh is not available or not authenticated.

import { spawnSync } from "child_process";

function runGh(...args) {
  try {
    const result = spawnSync("gh", args, {
      encoding: "utf8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    if (result.status !== 0) return null;
    return result.stdout.trim();
  } catch {
    return null;
  }
}

/** Check if gh CLI is available and authenticated. */
export function ghAvailable() {
  try {
    const result = spawnSync("gh", ["auth", "status"], {
      encoding: "utf8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/** Create a GitHub issue. Returns the issue number, or null on failure. */
export function createIssue(title, body) {
  if (!title) return null;
  const output = runGh("issue", "create", "--title", title, "--body", body || "");
  if (!output) return null;
  const match = output.match(/\/issues\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/** Close a GitHub issue by number. Returns true on success. */
export function closeIssue(number, comment) {
  if (!number) return false;
  const args = ["issue", "close", String(number)];
  if (comment) args.push("--comment", comment);
  return runGh(...args) !== null;
}

/** Add a comment to a GitHub issue. Returns true on success. */
export function commentIssue(number, body) {
  if (!number || !body) return false;
  return runGh("issue", "comment", String(number), "--body", body) !== null;
}
