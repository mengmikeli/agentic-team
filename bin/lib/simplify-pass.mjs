// Self-simplification pass — runs after all tasks pass, before finalize.
// Dispatches an agent to remove dead code and unnecessary complexity from
// files changed in this feature. Reverts if the quality gate fails.

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname_local = dirname(__filename);

// ── File filtering ───────────────────────────────────────────────

const CODE_EXT = /\.(mjs|js|ts|tsx|jsx|py|rb|go|rs|java|c|cpp|h|cs|swift|kt|sh|bash)$/i;
const SKIP_RE = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.lock$/,
  /node_modules\//,
  /\.min\./,
  /\.d\.ts$/,
  /\bdist[/\\]/,
  /\bbuild[/\\]/,
];

export function isCodeFile(path) {
  if (!CODE_EXT.test(path)) return false;
  return !SKIP_RE.some(re => re.test(path));
}

// ── Role file loader ─────────────────────────────────────────────

function loadSimplifyRole() {
  try {
    return readFileSync(resolve(__dirname_local, "../../roles/simplify-pass.md"), "utf8").trim();
  } catch {
    return "";
  }
}

// ── Changed-files detection ──────────────────────────────────────

export function getChangedFiles(base, cwd, _execFn = execSync) {
  try {
    const out = _execFn(`git diff --name-only ${base}..HEAD`, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return (out || "").trim().split("\n").filter(f => f && isCodeFile(f));
  } catch {
    return [];
  }
}

// ── Findings parser ───────────────────────────────────────────────

/**
 * Parse simplify findings from agent output.
 * Looks for the last JSON line with critical/warning keys.
 */
export function parseSimplifyFindings(output) {
  if (!output) return null;
  const lines = output.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) continue;
    try {
      const obj = JSON.parse(line);
      if (typeof obj.critical === "number" && typeof obj.warning === "number") {
        return { critical: obj.critical, warning: obj.warning, suggestion: obj.suggestion || 0 };
      }
    } catch { /* not valid JSON */ }
  }
  return null;
}

// ── Brief builder ────────────────────────────────────────────────

export function buildSimplifyBrief(files) {
  const role = loadSimplifyRole();
  return `${role ? role + "\n\n" : ""}## Files to Simplify

${files.map(f => `- ${f}`).join("\n")}
`;
}

// ── Main pass ────────────────────────────────────────────────────

/**
 * Run the self-simplification pass.
 *
 * @param {object} opts
 * @param {string}   opts.featureDir  - feature state directory (for gate evidence)
 * @param {string}   opts.gateCmd     - quality gate command to re-run
 * @param {string}   opts.cwd         - working directory (worktree path)
 * @param {string}   opts.agent       - "claude" | "codex" | null
 * @param {Function} opts.dispatchFn  - (agent, brief, cwd) → { ok, output }
 * @param {Function} opts.runGateFn   - (cmd, featureDir, taskId, cwd) → { verdict, exitCode }
 * @param {Function} [opts.execFn]    - injectable execSync for git commands (for tests)
 * @returns {{ filesReviewed, filesChanged, skipped, reverted? }}
 */
export function runSimplifyPass({ featureDir, gateCmd, cwd, agent, dispatchFn, runGateFn, execFn = execSync }) {
  if (!agent || !gateCmd) {
    return { filesReviewed: 0, filesChanged: 0, skipped: true };
  }

  // Determine merge-base — try main then master
  let base;
  for (const branch of ["main", "master"]) {
    try {
      base = execFn(`git merge-base HEAD ${branch}`, {
        cwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (base) break;
    } catch { /* try next */ }
  }
  if (!base) {
    return { filesReviewed: 0, filesChanged: 0, skipped: true, reason: "could not determine merge-base" };
  }

  const files = getChangedFiles(base, cwd, execFn);
  if (files.length === 0) {
    return { filesReviewed: 0, filesChanged: 0, skipped: false };
  }

  // Record HEAD before agent runs so we can revert on gate failure
  let preSha;
  try {
    preSha = execFn("git rev-parse HEAD", {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return { filesReviewed: files.length, filesChanged: 0, skipped: true, reason: "could not get HEAD sha" };
  }

  // Dispatch agent
  const brief = buildSimplifyBrief(files);
  const result = dispatchFn(agent, brief, cwd);
  if (!result.ok) {
    return { filesReviewed: files.length, filesChanged: 0, skipped: false };
  }

  const findings = parseSimplifyFindings(result.output) || { critical: 0, warning: 0, suggestion: 0 };

  // Detect what actually changed after agent ran
  let postSha = preSha;
  try {
    postSha = execFn("git rev-parse HEAD", {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch { /* use preSha */ }

  const committed = postSha !== preSha;
  let changedCount = 0;
  if (committed) {
    try {
      const diff = execFn(`git diff --name-only ${preSha}..HEAD`, {
        cwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      changedCount = (diff || "").trim().split("\n").filter(Boolean).length;
    } catch {}
  } else {
    try {
      const diff = execFn("git diff --name-only HEAD", {
        cwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      changedCount = (diff || "").trim().split("\n").filter(Boolean).length;
    } catch {}
  }

  if (changedCount === 0) {
    return { filesReviewed: files.length, filesChanged: 0, skipped: false, findings };
  }

  // Re-run quality gate to validate simplifications don't break anything
  let gateResult;
  try {
    gateResult = runGateFn(gateCmd, featureDir, null, cwd);
  } catch {
    gateResult = { verdict: "FAIL", exitCode: 1 };
  }
  if (gateResult.verdict === "PASS") {
    return { filesReviewed: files.length, filesChanged: changedCount, skipped: false, findings };
  }

  // Gate failed — revert simplify-pass changes
  try {
    if (committed) {
      execFn(`git reset --hard ${preSha}`, {
        cwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } else {
      execFn("git checkout HEAD -- .", {
        cwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFn("git clean -fd", {
        cwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    }
  } catch { /* best-effort revert */ }

  return { filesReviewed: files.length, filesChanged: 0, reverted: true, skipped: false, findings };
}
