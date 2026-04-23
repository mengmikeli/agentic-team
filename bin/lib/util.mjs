// Shared utilities for agentic-team harness and CLI.
// Nonce generation, file locking, atomic writes, CLI flag parsing.

import { writeFileSync, readFileSync, renameSync, unlinkSync, existsSync } from "fs";
import { resolve, join } from "path";
import { createHash, randomBytes } from "crypto";

// ── Constants ───────────────────────────────────────────────────

export const WRITER_SIG = "at-harness";
export const IDEMPOTENCY_WINDOW_MS = 5000;

export const VALID_TASK_STATUSES = new Set([
  "pending", "in-progress", "passed", "failed", "blocked", "skipped",
]);

export const VALID_VERDICTS = new Set(["PASS", "FAIL"]);

export const VALID_EVENTS = new Set([
  "feature-started", "task-started", "task-passed", "task-failed",
  "task-blocked", "progress", "anomaly", "feature-complete",
]);

export const ALLOWED_TRANSITIONS = {
  "pending":     ["in-progress"],
  "in-progress": ["passed", "failed", "blocked"],
  "failed":      ["in-progress", "skipped"],
  "blocked":     ["in-progress", "skipped"],
  "skipped":     [],
  "passed":      [],
};

// ── CLI flag parsing ────────────────────────────────────────────

export function getFlag(args, name, fallback = null) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] != null ? args[idx + 1] : fallback;
}

export function hasFlag(args, name) {
  return args.includes(`--${name}`);
}

// ── Nonce generation ────────────────────────────────────────────

export function generateNonce() {
  return createHash("sha256")
    .update(Date.now().toString() + randomBytes(16).toString("hex"))
    .digest("hex")
    .slice(0, 16);
}

// ── Atomic file write (rename-based) ────────────────────────────

export function atomicWriteSync(filePath, data) {
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, data);
  renameSync(tmp, filePath);
}

// ── Progress log helper ─────────────────────────────────────────

export function appendProgress(featureDir, entry) {
  const progressPath = join(featureDir, "progress.md");
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const line = `### ${timestamp}\n${entry}\n\n`;
  try {
    const existing = existsSync(progressPath) ? readFileSync(progressPath, "utf8") : "";
    writeFileSync(progressPath, existing + line);
  } catch {
    try { writeFileSync(progressPath, line); } catch { /* best-effort */ }
  }
}

// ── Safe directory resolution ───────────────────────────────────

export function resolveDir(args, defaultDir = ".team") {
  const raw = getFlag(args, "dir", defaultDir);
  return resolve(raw);
}

// ── Advisory file locking ───────────────────────────────────────

const _sleepBuf = new Int32Array(new SharedArrayBuffer(4));
function sleepMs(ms) {
  Atomics.wait(_sleepBuf, 0, 0, ms);
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function lockFile(filePath, opts = {}) {
  const { timeout = 5000, command = "unknown" } = opts;
  const lockPath = `${filePath}.lock`;
  const deadline = Date.now() + timeout;
  const maxRetries = 200;
  let retries = 0;

  while (retries++ < maxRetries) {
    if (existsSync(lockPath)) {
      let holder;
      try {
        holder = JSON.parse(readFileSync(lockPath, "utf8"));
      } catch {
        try { unlinkSync(lockPath); } catch { /* race */ }
        continue;
      }

      if (holder && !isPidAlive(holder.pid)) {
        try { unlinkSync(lockPath); } catch { /* race */ }
        continue;
      }

      if (Date.now() >= deadline) {
        return { acquired: false, holder };
      }
      sleepMs(50);
      continue;
    }

    const lockData = {
      pid: process.pid,
      timestamp: new Date().toISOString(),
      command,
    };

    try {
      writeFileSync(lockPath, JSON.stringify(lockData, null, 2) + "\n", { flag: "wx" });
    } catch (err) {
      if (err.code === "EEXIST") {
        if (Date.now() >= deadline) {
          try {
            const existing = JSON.parse(readFileSync(lockPath, "utf8"));
            return { acquired: false, holder: existing };
          } catch {
            return { acquired: false, holder: null };
          }
        }
        sleepMs(50);
        continue;
      }
      if (Date.now() >= deadline) return { acquired: false, holder: null };
      sleepMs(50);
      continue;
    }

    const release = () => {
      try {
        if (existsSync(lockPath)) {
          const current = JSON.parse(readFileSync(lockPath, "utf8"));
          if (current.pid === process.pid) unlinkSync(lockPath);
        }
      } catch { /* best-effort */ }
    };

    return { acquired: true, release };
  }

  return { acquired: false, holder: null };
}

// ── ANSI color helpers ──────────────────────────────────────────

export const c = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  red:     "\x1b[31m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  cyan:    "\x1b[36m",
  white:   "\x1b[37m",
  gray:    "\x1b[90m",
  bgRed:   "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow:"\x1b[43m",
  bgBlue:  "\x1b[44m",
};

// ── STATE.json helpers ──────────────────────────────────────────

export function readState(dir) {
  const statePath = resolve(dir, "STATE.json");
  if (!existsSync(statePath)) return null;
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

export function writeState(dir, state) {
  const statePath = resolve(dir, "STATE.json");
  state._written_by = WRITER_SIG;
  state._last_modified = new Date().toISOString();
  state._write_nonce = generateNonce();
  atomicWriteSync(statePath, JSON.stringify(state, null, 2) + "\n");
}

// ── Time formatting ─────────────────────────────────────────────

export function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
