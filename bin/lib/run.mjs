// agt run — autonomous execution loop
// Dispatches agents, runs quality gates, manages state via harness.

import { execSync, spawnSync, execFileSync, spawn } from "child_process";
import { existsSync, readFileSync, mkdirSync, writeFileSync, appendFileSync, unlinkSync } from "fs";
import { join, resolve, dirname } from "path";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import {
  c, getFlag, readState, writeState, lockFile, generateNonce,
  WRITER_SIG, ALLOWED_TRANSITIONS, appendProgress,
} from "./util.mjs";
import { ghAvailable, createIssue, closeIssue, commentIssue, addToProject, setProjectItemStatus, getIssueBody, editIssue, buildTasksChecklist, buildTaskIssueBody, tickChecklistItem, markChecklistItemBlocked } from "./github.mjs";
import { FLOWS, selectFlow, buildBrainstormBrief, buildReviewBrief, PARALLEL_REVIEW_ROLES, mergeReviewFindings } from "./flows.mjs";
import { parseFindings, computeVerdict } from "./synthesize.mjs";
import { pushFeatureStatus, pushTaskStatus, syncFromHarness, closeFeatureIssues } from "./state-sync.mjs";
import { runCompoundGate } from "./compound-gate.mjs";
import { recordWarningIteration, checkEscalation } from "./iteration-escalation.mjs";
import { incrementReviewRounds, shouldEscalate, buildEscalationSummary } from "./review-escalation.mjs";
import { cmdInit } from "./init.mjs";
import { validateHandshake, createHandshake } from "./handshake.mjs";
import { buildContextBrief } from "./context.mjs";
import { selectTier, formatTierBaseline } from "./tiers.mjs";
import { outerLoop } from "./outer-loop.mjs";
import { buildReplanBrief, parseReplanOutput, applyReplan } from "./replan.mjs";

const __filename = fileURLToPath(import.meta.url);
const HARNESS = resolve(dirname(__filename), "..", "agt-harness.mjs");

// ── Harness wrapper ─────────────────────────────────────────────

function harness(...args) {
  try {
    const result = execFileSync(process.execPath, [HARNESS, ...args], {
      encoding: "utf8",
      timeout: 180000,
      shell: false,
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
    try { return JSON.parse(result.trim()); } catch { return { raw: result.trim() }; }
  } catch (err) {
    const stdout = err.stdout?.toString() || "";
    const stderr = err.stderr?.toString() || "";
    if (stderr) console.error(`  ${c.dim}harness stderr: ${stderr.slice(0, 500)}${c.reset}`);
    try { return JSON.parse(stdout.trim()); } catch { return { ok: false, error: stdout || stderr || err.message }; }
  }
}

// ── Inline gate runner (bypasses harness subprocess issues on Windows) ──

export function runGateInline(cmd, featureDir, taskId, cwd = process.cwd()) {
  let exitCode = 0;
  let stdout = "";
  let stderr = "";

  try {
    stdout = execSync(cmd, {
      cwd,
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024, // 50MB — large test suites produce a lot of output
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    if (err.signal) {
      exitCode = 1;
      stderr = `Process killed by signal: ${err.signal}`;
    } else if (err.status != null) {
      exitCode = err.status;
    } else {
      exitCode = 1;
    }
    stdout = err.stdout || "";
    stderr = stderr || err.stderr || err.message || "";
  }

  const verdict = exitCode === 0 ? "PASS" : "FAIL";

  // Write evidence artifacts to task directory
  if (taskId) {
    const taskDir = join(featureDir, "tasks", taskId);
    const artifactsDir = join(taskDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    if (stdout) {
      writeFileSync(join(artifactsDir, "test-output.txt"), stdout);
    }
    if (stderr) {
      writeFileSync(join(artifactsDir, "gate-stderr.txt"), stderr);
    }

    // Write gate handshake
    const artifacts = [];
    if (stdout) artifacts.push({ type: "test-result", path: "artifacts/test-output.txt" });
    if (stderr) artifacts.push({ type: "cli-output", path: "artifacts/gate-stderr.txt" });
    if (artifacts.length === 0) {
      writeFileSync(join(artifactsDir, "gate-result.txt"), `exit code: ${exitCode}\n`);
      artifacts.push({ type: "cli-output", path: "artifacts/gate-result.txt" });
    }

    const gateHandshake = createHandshake({
      taskId,
      nodeType: "gate",
      status: exitCode === 0 ? "completed" : "failed",
      verdict,
      summary: `Gate command: ${cmd} — exit code ${exitCode}`,
      artifacts,
      findings: { critical: exitCode === 0 ? 0 : 1, warning: 0, suggestion: 0 },
    });

    writeFileSync(join(taskDir, "handshake.json"), JSON.stringify(gateHandshake, null, 2) + "\n");

    // Validate the gate handshake
    const validation = validateHandshake(gateHandshake, { basePath: taskDir });
    if (!validation.valid) {
      console.log(`  ${c.yellow}Gate handshake validation warnings: ${validation.errors.join("; ")}${c.reset}`);
    }
  }

  // Record gate result in STATE.json gates array directly (avoids subprocess overwriting real artifacts)
  try {
    const statePath = join(featureDir, "STATE.json");
    const lock = lockFile(statePath, { command: "runGateInline" });
    if (lock.acquired) {
      try {
        const s = readState(featureDir);
        if (s) {
          if (!s.gates) s.gates = [];
          s.gates.push({
            command: cmd,
            exitCode,
            verdict,
            stdout: stdout.slice(0, 4096),
            stderr: stderr.slice(0, 4096),
            timestamp: new Date().toISOString(),
            taskId: taskId || null,
          });
          writeState(featureDir, s);
        }
      } finally {
        lock.release();
      }
    }
  } catch { /* best-effort */ }

  return { ok: true, verdict, exitCode, stdout: stdout.slice(0, 4096), stderr: stderr.slice(0, 4096) };
}

// ── Git worktree helpers ─────────────────────────────────────────

export function slugToBranch(slug) {
  return slug
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\-\.]/g, "")
    .slice(0, 72);
}

export function createWorktreeIfNeeded(slug, mainCwd, _execFn = execFileSync) {
  const worktreePath = join(mainCwd, ".team", "worktrees", slug);
  const branchName = "feature/" + slugToBranch(slug);
  if (existsSync(worktreePath)) {
    console.log(`  ${c.dim}Reusing existing worktree: ${worktreePath}${c.reset}`);
    return worktreePath;
  }
  _execFn("git", ["worktree", "add", worktreePath, "-B", branchName], { cwd: mainCwd, stdio: "pipe" });
  console.log(`  ${c.green}✓ Worktree created: ${worktreePath} (${branchName})${c.reset}`);
  return worktreePath;
}

export function removeWorktree(worktreePath, mainCwd, _execFn = execFileSync) {
  try {
    _execFn("git", ["worktree", "remove", "--force", worktreePath], { cwd: mainCwd, stdio: "pipe" });
  } catch { /* already gone or not a worktree — not fatal */ }
}

// ── Token usage tracking ───────────────────────────────────────

function _emptyBucket() {
  return { dispatches: 0, inputTokens: 0, cacheRead: 0, cacheCreate: 0, outputTokens: 0, costUsd: 0, durationMs: 0 };
}

const _runUsage = _emptyBucket();
const _phaseUsage = {};   // phase -> bucket ("brainstorm", "build", "review", "gate")
const _taskUsage = {};    // taskId -> bucket
let _currentPhase = "build";
let _currentTask = null;

export function trackUsage(jsonResult) {
  if (!jsonResult) return;
  const u = jsonResult.usage || {};
  const entry = {
    input: u.input_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheCreate: u.cache_creation_input_tokens || 0,
    output: u.output_tokens || 0,
    cost: jsonResult.total_cost_usd || 0,
    duration: jsonResult.duration_ms || 0,
  };

  // Accumulate to run total
  _runUsage.dispatches++;
  _runUsage.inputTokens += entry.input;
  _runUsage.cacheRead += entry.cacheRead;
  _runUsage.cacheCreate += entry.cacheCreate;
  _runUsage.outputTokens += entry.output;
  _runUsage.costUsd += entry.cost;
  _runUsage.durationMs += entry.duration;

  // Accumulate to phase
  if (!_phaseUsage[_currentPhase]) _phaseUsage[_currentPhase] = _emptyBucket();
  const ph = _phaseUsage[_currentPhase];
  ph.dispatches++; ph.inputTokens += entry.input; ph.cacheRead += entry.cacheRead;
  ph.cacheCreate += entry.cacheCreate; ph.outputTokens += entry.output;
  ph.costUsd += entry.cost; ph.durationMs += entry.duration;

  // Accumulate to task
  if (_currentTask) {
    if (!_taskUsage[_currentTask]) {
      _taskUsage[_currentTask] = _emptyBucket();
      // Phase label frozen at first dispatch for this task (intentional: task identity
      // is established at creation time; setUsageContext phase shifts do not re-label).
      _taskUsage[_currentTask].phase = _currentPhase;
    }
    const tk = _taskUsage[_currentTask];
    tk.dispatches++; tk.inputTokens += entry.input; tk.cacheRead += entry.cacheRead;
    tk.cacheCreate += entry.cacheCreate; tk.outputTokens += entry.output;
    tk.costUsd += entry.cost; tk.durationMs += entry.duration;
  }
}

export function setUsageContext(phase, taskId) { _currentPhase = phase; _currentTask = taskId; }
export function getRunUsage() { return { ..._runUsage }; }
export function getPhaseUsage() { return { ..._phaseUsage }; }
export function getTaskUsage() { return { ..._taskUsage }; }
export function resetRunUsage() {
  Object.assign(_runUsage, _emptyBucket());
  for (const k of Object.keys(_phaseUsage)) delete _phaseUsage[k];
  for (const k of Object.keys(_taskUsage)) delete _taskUsage[k];
  _currentPhase = "build"; _currentTask = null;
}

export function buildTokenUsage() {
  const mapBucket = (b) => ({
    dispatches: b.dispatches,
    inputTokens: b.inputTokens,
    cachedInput: (b.cacheRead || 0) + (b.cacheCreate || 0),
    outputTokens: b.outputTokens,
    costUsd: b.costUsd,
    durationMs: b.durationMs,
  });
  return {
    byTask: Object.fromEntries(
      Object.entries(_taskUsage).map(([k, v]) => [k, { ...mapBucket(v), phase: v.phase || "build" }])
    ),
    byPhase: Object.fromEntries(
      Object.entries(_phaseUsage).map(([k, v]) => [k, mapBucket(v)])
    ),
    total: mapBucket(_runUsage),
  };
}

// ── Agent dispatch (exported for outer loop) ───────────────────

export function findAgent() {
  // Try Claude Code first
  try {
    execSync(process.platform === "win32" ? "where claude" : "which claude", { encoding: "utf8", stdio: "pipe" });
    return "claude";
  } catch {}
  // Try codex
  try {
    execSync(process.platform === "win32" ? "where codex" : "which codex", { encoding: "utf8", stdio: "pipe" });
    return "codex";
  } catch {}
  return null;
}

export function dispatchToAgent(agent, brief, cwd, _spawnFn = spawnSync) {
  console.log(`  ${c.dim}Dispatching to ${agent}...${c.reset}`);

  try {
    if (agent === "claude") {
      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const result = _spawnFn("claude", ["--print", "--output-format", "json", "--permission-mode", "bypassPermissions", brief], {
          encoding: "utf8",
          cwd,
          timeout: 600000,
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env },
        });
        let output = result.stdout || "";
        let parsed = null;
        try {
          parsed = JSON.parse(output);
          trackUsage(parsed);
          output = parsed.result || "";
        } catch {}

        // Retry on rate limit (429)
        const is429 = (result.stderr || "").includes("429") || (result.stderr || "").includes("rate limit");
        if (is429 && attempt < MAX_RETRIES) {
          const wait = attempt * 30;
          console.log(`  ${c.yellow}Rate limited (429). Waiting ${wait}s before retry ${attempt + 1}/${MAX_RETRIES}...${c.reset}`);
          _spawnFn("sleep", [String(wait)], { stdio: "pipe" });
          continue;
        }

        if (output) console.log(`  ${c.dim}${output.slice(0, 2000)}${c.reset}`);
        return { ok: result.status === 0, output, error: result.stderr || "", usage: parsed?.usage || null, cost: parsed?.total_cost_usd || null };
      }
    }

    if (agent === "codex") {
      // NOTE: codex does not return usage/cost fields; trackUsage() is not called here.
      // Features built via codex will always show tokenUsage: null in the dashboard.
      const result = _spawnFn("codex", ["--quiet", brief], {
        encoding: "utf8",
        cwd,
        timeout: 600000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      if (result.stdout) console.log(`  ${c.dim}${result.stdout.slice(0, 2000)}${c.reset}`);
      return { ok: result.status === 0, output: result.stdout || "", error: result.stderr || "" };
    }
  } catch (err) {
    return { ok: false, output: "", error: err.message };
  }

  return { ok: false, output: "", error: "no agent available" };
}

// ── Async agent dispatch for parallel use ────────────────────────

function dispatchToAgentAsync(agent, brief, cwd) {
  return new Promise((resolve) => {
    if (agent !== "claude") {
      resolve({ ok: false, output: "", error: "async dispatch only supports claude" });
      return;
    }
    let stdout = "";
    let stderr = "";
    const child = spawn("claude", ["--print", "--output-format", "json", "--permission-mode", "bypassPermissions", brief], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
    child.stdout?.on("data", d => { stdout += d; });
    child.stderr?.on("data", d => { stderr += d; });
    child.on("close", code => {
      let output = stdout;
      try {
        const parsed = JSON.parse(stdout);
        trackUsage(parsed);
        output = parsed.result || "";
      } catch { /* plain text fallback */ }
      resolve({ ok: code === 0, output, error: stderr });
    });
    child.on("error", err => resolve({ ok: false, output: "", error: err.message }));
  });
}

function runParallelReviews(agent, roles, featureName, taskTitle, gateOutput, cwd) {
  const promises = roles.map(role => {
    const brief = buildReviewBrief(featureName, taskTitle, gateOutput, cwd, role);
    return dispatchToAgentAsync(agent, brief, cwd)
      .then(result => ({ role, ok: result.ok, output: result.output || "" }));
  });
  return Promise.all(promises);
}

function dispatchManual(brief) {  console.log(`\n  ${c.yellow}No coding agent found (claude/codex).${c.reset}`);
  console.log(`  ${c.bold}Task brief:${c.reset}\n`);
  console.log(`  ${c.dim}${brief.slice(0, 3000)}${c.reset}\n`);
  console.log(`  ${c.yellow}Complete this task manually, then press Enter to run the gate.${c.reset}`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question("  Press Enter when done (or 'skip' to skip): ", ans => {
    rl.close();
    if (ans.trim().toLowerCase() === "skip") r({ ok: false, output: "", error: "skipped by user" });
    else r({ ok: true, output: "manual completion", error: "" });
  }));
}

// ── Gate command detection ──────────────────────────────────────

function detectGateCommand(cwd) {
  // Check .team/PROJECT.md for configured gate
  try {
    const projectMd = readFileSync(join(cwd, ".team", "PROJECT.md"), "utf8");
    // Match ```bash or ``` or ```sh blocks under ## Quality Gate
    const gateSection = projectMd.match(/## Quality Gate[\s\S]*?```(?:bash|sh)?\n([\s\S]*?)```/);
    if (gateSection) return gateSection[1].trim();
  } catch {}

  // Auto-detect from project type
  if (existsSync(join(cwd, "package.json"))) {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
    const cmds = [];
    if (pkg.scripts?.test) cmds.push("npm test");
    if (pkg.scripts?.check) cmds.push("npm run check");
    if (pkg.scripts?.build) cmds.push("npm run build");
    if (cmds.length) return cmds.join(" && ");
  }
  if (existsSync(join(cwd, "Cargo.toml"))) return "cargo test && cargo build";
  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "setup.py"))) return "python -m pytest";

  return 'echo "no gate configured"';
}

// ── Task planning ───────────────────────────────────────────────

function planTasks(description, spec) {
  // Parse spec for structured tasks if available
  if (spec) {
    const taskMatches = [...spec.matchAll(/^[-*]\s*\[[ x]\]\s*(.+)$/gm)];
    if (taskMatches.length > 0) {
      return taskMatches.map((m, i) => ({
        id: `task-${i + 1}`,
        title: m[1].trim(),
        status: "pending",
        attempts: 0,
      }));
    }
  }

  // Simple single-task plan from description
  return [{
    id: "task-1",
    title: description,
    status: "pending",
    attempts: 0,
  }];
}

function buildTaskBrief(task, featureName, gateCmd, cwd, failureContext, brainstormOutput, tier) {
  // Determine mode: Build (first pass), Fix (after FAIL), Polish (after ITERATE)
  let mode = "Build";
  let modeInstruction = "";
  if (failureContext) {
    if (failureContext.includes("Review FAIL") || failureContext.includes("ITERATE")) {
      mode = failureContext.includes("ITERATE") ? "Polish" : "Fix";
    } else {
      mode = "Fix";
    }
  }

  if (mode === "Build") {
    modeInstruction = `### Mode: Build (first pass)
You are building from scratch. Implement the task fully and verify it works.`;
  } else if (mode === "Fix") {
    modeInstruction = `### Mode: Fix (after FAIL — things are broken)
Read the failure context below carefully. Fix broken functionality and critical issues.
Things are broken — make them work. The failure output tells you what failed.`;
  } else {
    modeInstruction = `### Mode: Polish (after ITERATE — push toward excellence)
All criteria pass but quality isn't excellent yet. Focus on the lowest-quality areas and push them toward 4+.
This is about refinement, not fixing breakage.`;
  }

  let brief = `You are implementing a task for feature "${featureName}".

${modeInstruction}

## Task
${task.title}

## Working Directory
${cwd}

## Requirements
- Make the minimal changes needed to complete this task
- Write tests if the project has a test framework
- Commit your changes with a descriptive message

## Quality Gate
After your changes, this command must pass:
\`\`\`
${gateCmd}
\`\`\`

## Handshake Output (REQUIRED)
You MUST write a handshake.json file when done. This is the contract that proves your work.
Write it to: .team/features/${featureName}/tasks/${task.id}/handshake.json

\`\`\`json
{
  "taskId": "${task.id}",
  "nodeType": "build",
  "runId": "run_${task.attempts || 1}",
  "status": "completed",
  "verdict": null,
  "summary": "<what you built, 2-3 sentences>",
  "timestamp": "<ISO8601>",
  "artifacts": [
    { "type": "code", "path": "<project-relative path, e.g. src/foo.mjs or bin/lib/bar.mjs>" }
  ],
  "findings": { "critical": 0, "warning": 0, "suggestion": 0 }
}
\`\`\`

The artifacts list must include every file you created or modified.
**Important**: artifact paths must be relative to the project root (${cwd}), NOT relative to this handshake.json file.
For example, use \`bin/lib/run.mjs\`, not \`../../../../bin/lib/run.mjs\`.

## Verification Requirement
Before claiming you're done:
1. Run the quality gate command above
2. Paste the actual output (not what you expect)
3. If tests exist, run them and paste results

## Anti-Rationalization

| You're tempted to say | Reality | Do this instead |
|---|---|---|
| "Should work now" | You didn't run it | Run the actual command and paste the output |
| "Minor change, no test needed" | Minor changes cause regressions | Run the existing test suite, paste results |
| "Code looks correct by inspection" | Inspection misses runtime behavior | Execute the code path end-to-end |
| "I'll skip the handshake" | The harness will reject your work | Write the handshake.json — it's mandatory |
`;

  if (brainstormOutput) {
    brief += `
## Implementation Plan (from brainstorm)
${brainstormOutput}
`;
  }

  if (failureContext) {
    brief += `
## Previous Attempt Failed
${mode === "Fix" ? "The quality gate or review failed. Here's the context:" : "The reviewer wants polish improvements:"}
\`\`\`
${failureContext.slice(0, 3000)}
\`\`\`
Fix the issues and try again. Do NOT repeat the same mistakes.
`;
  }

  // Inject tier baseline
  if (tier && tier.baseline && tier.baseline.length > 0) {
    brief += "\n" + formatTierBaseline(tier) + "\n";
  }

  return brief;
}

// ── Progress log helpers ────────────────────────────────────────

function initProgressLog(featureDir, featureName, tasks, tier) {
  const progressPath = join(featureDir, "progress.md");
  const taskList = tasks.map((t, i) => `${i + 1}. ${t.title}`).join("\n");
  const content = `# Progress: ${featureName}\n\n**Started:** ${new Date().toISOString()}\n**Tier:** ${tier?.name || "functional"}\n**Tasks:** ${tasks.length}\n\n## Plan\n${taskList}\n\n## Execution Log\n\n`;
  writeFileSync(progressPath, content);
}


// ── Crash recovery helper ────────────────────────────────────────
// Exported for testing. Mutates state in-place and returns tasks to use.
// Returns { tasks, recovered: bool }.
export function applyCrashRecovery(state, plannedTasks, featureDir) {
  if (state && (state.status === "executing" || state.status === "active")) {
    const crashedAt = state._last_modified;
    
    // Don't trigger crash recovery if this run just started (same process)
    const runStartedAt = state._runStartedAt;
    if (runStartedAt && (Date.now() - new Date(runStartedAt).getTime()) < 120000) {
      // Started less than 2 minutes ago — not a crash, just normal flow
      state.tasks = plannedTasks;
      state.status = "executing";
      writeState(featureDir, state);
      return { tasks: plannedTasks, recovered: false };
    }

    const recoveredTasks = Array.isArray(state.tasks) ? state.tasks : plannedTasks;

    // Check if all tasks are terminal (blocked/failed) — this isn't a crash, it's a failed run
    const pendingOrInProgress = recoveredTasks.filter(t => ["pending", "in-progress"].includes(t.status));
    const allTerminal = recoveredTasks.length > 0 && pendingOrInProgress.length === 0;

    if (allTerminal) {
      // Previous run failed completely — close old issues and start fresh
      closeFeatureIssues(featureDir, "superseded by retry");
      state.tasks = plannedTasks;
      state.status = "executing";
      state._previous_run_failed = crashedAt;
      state._recovery_count = (state._recovery_count || 0) + 1;
      writeState(featureDir, state);
      return { tasks: plannedTasks, recovered: false, previousRunFailed: true };
    }

    // Normal crash recovery — reset in-progress to pending, keep passed/skipped
    for (const t of recoveredTasks) {
      if (t.status === "in-progress") t.status = "pending";
    }
    state.tasks = recoveredTasks;
    state._recovered_from = crashedAt;
    state._recovery_count = (state._recovery_count || 0) + 1;
    state.status = "executing";
    writeState(featureDir, state);
    return { tasks: state.tasks, recovered: true, crashedAt };
  }
  if (state) {
    state.tasks = plannedTasks;
    state.status = "executing";
    writeState(featureDir, state);
  }
  return { tasks: plannedTasks, recovered: false };
}

// ── Main execution loop ─────────────────────────────────────────

export async function cmdRun(args) {
  const description = args.filter(a => !a.startsWith("-")).join(" ");
  const continuous = !description; // no args = continuous roadmap mode

  if (continuous) {
    // Smart entry: ensure project is ready before starting outer loop
    const ready = await ensureProjectReady();
    if (!ready) return;

    await outerLoop(args, {
      findAgent,
      dispatchToAgent,
      runSingleFeature: _runSingleFeature,
    });
  } else {
    await _runSingleFeature(args, description);
  }
}

// ── Smart entry flow ────────────────────────────────────────────

const PROJECT_MARKERS = [
  "package.json", "Cargo.toml", "go.mod", "pyproject.toml",
  "setup.py", "Makefile", "CMakeLists.txt", "pom.xml",
  "build.gradle", "Gemfile", "mix.exs", "deno.json",
  ".git", "tsconfig.json", "composer.json",
];

function hasProjectFiles(dir) {
  return PROJECT_MARKERS.some(f => existsSync(join(dir, f)));
}

function askLine(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function ensureProjectReady() {
  let cwd = process.cwd();
  const teamDir = join(cwd, ".team");

  // Step 1: Check for .team/ directory
  if (!existsSync(teamDir)) {
    if (hasProjectFiles(cwd)) {
      // Looks like a project but not set up
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await askLine(rl, `${c.cyan}This looks like a project. Set it up with agt? (y/n): ${c.reset}`);
      rl.close();
      if (answer.trim().toLowerCase() !== "y") {
        return false;
      }
      // Run init inline
      await new Promise(resolve => {
        cmdInit(["."]);
        // cmdInit uses its own readline; give it a tick to finish
        setTimeout(resolve, 100);
      });
      // Re-check — cmdInit may have created .team/
      if (!existsSync(join(cwd, ".team"))) return false;
    } else {
      // No project files — ask what to do
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await askLine(rl, `${c.cyan}Start a new project here or open an existing one? (new/path): ${c.reset}`);
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === "new") {
        await new Promise(resolve => {
          cmdInit(["."]);
          setTimeout(resolve, 100);
        });
        if (!existsSync(join(cwd, ".team"))) return false;
      } else if (trimmed && trimmed !== "path") {
        // Treat as a path
        const target = resolve(cwd, trimmed);
        if (!existsSync(target)) {
          console.log(`${c.red}Path not found: ${target}${c.reset}`);
          return false;
        }
        process.chdir(target);
        return ensureProjectReady(); // Restart check in new dir
      } else {
        // They typed "path" literally — ask for the actual path
        const rl2 = createInterface({ input: process.stdin, output: process.stdout });
        const pathAnswer = await askLine(rl2, `${c.cyan}Enter project path: ${c.reset}`);
        rl2.close();
        const target = resolve(cwd, pathAnswer.trim());
        if (!existsSync(target)) {
          console.log(`${c.red}Path not found: ${target}${c.reset}`);
          return false;
        }
        process.chdir(target);
        return ensureProjectReady();
      }
    }
  }

  // Step 2: Check for PRODUCT.md
  const productPath = join(process.cwd(), ".team", "PRODUCT.md");
  if (!existsSync(productPath)) {
    console.log(`\n${c.yellow}No product definition found. Let's set one up.${c.reset}\n`);
    await runProductInit(process.cwd());
    if (!existsSync(productPath)) {
      console.log(`${c.red}PRODUCT.md was not created. Cannot continue.${c.reset}`);
      return false;
    }
  }

  return true;
}

async function runProductInit(cwd) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => askLine(rl, q);

  console.log(`${c.bold}── Product Definition ──${c.reset}\n`);

  const name = await ask(`${c.cyan}Project name: ${c.reset}`) || "my-project";
  const vision = await ask(`${c.cyan}Vision (what are you building?): ${c.reset}`) || "Build something great";
  const users = await ask(`${c.cyan}Who is this for?: ${c.reset}`) || "Developers";
  const goals = await ask(`${c.cyan}Key goals (comma-separated): ${c.reset}`) || "Ship v1";

  console.log(`\n${c.bold}── Roadmap ──${c.reset}`);
  console.log(`${c.dim}Enter roadmap items one per line. Empty line to finish.${c.reset}\n`);

  const roadmapItems = [];
  let idx = 1;
  while (true) {
    const item = await ask(`${c.cyan}  ${idx}. ${c.reset}`);
    if (!item.trim()) break;
    roadmapItems.push(item.trim());
    idx++;
  }

  rl.close();

  if (roadmapItems.length === 0) {
    roadmapItems.push("Initial release");
  }

  const goalsList = goals.split(",").map((g, i) => `${i + 1}. ${g.trim()}`).join("\n");
  const roadmapList = roadmapItems.map((item, i) =>
    `${i + 1}. **${item}** — ${item}`
  ).join("\n");

  const productMd = `# ${name} — Product

## Vision
${vision}

## Users
${users}

## Success Metrics
${goalsList}

## Roadmap
${roadmapList}
`;

  const teamDir = join(cwd, ".team");
  mkdirSync(teamDir, { recursive: true });
  writeFileSync(join(teamDir, "PRODUCT.md"), productMd);
  console.log(`\n${c.green}✓ PRODUCT.md created${c.reset}`);
}

async function _runSingleFeature(args, description, providedLabel = '', explicitSlug = '') {
  // Reset token usage so each feature gets its own clean counters (prevents
  // accumulation across features in multi-feature outer-loop runs)
  resetRunUsage();

  if (!description) description = args.filter(a => !a.startsWith("-")).join(" ") || null;
  const mainCwd = process.cwd();
  let cwd = mainCwd;
  const teamDir = join(mainCwd, ".team");
  const maxRetries = parseInt(getFlag(args, "retries") || "3", 10);
  const dryRun = args.includes("--dry-run");
  const flowOverride = getFlag(args, "flow");
  const tierOverride = getFlag(args, "tier");

  if (!existsSync(teamDir)) {
    console.log(`${c.red}No .team/ directory found.${c.reset} Run ${c.bold}agt init${c.reset} first.`);
    process.exit(1);
  }

  // Lazily ensure .team/runbooks/ exists (may not be present in older projects)
  mkdirSync(join(teamDir, "runbooks"), { recursive: true });

  // ── Determine what to run ──

  let featureName;
  let featureDescription;
  let featureLabel = providedLabel;  // e.g. "P3/#10" for roadmap display; may be overridden in Mode 2

  if (description) {
    // Mode 1: explicit feature
    featureName = explicitSlug || description
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    featureDescription = description;
  } else {
    // Mode 2: pick from roadmap
    const productPath = join(teamDir, "PRODUCT.md");
    if (!existsSync(productPath)) {
      console.log(`${c.red}No PRODUCT.md found and no feature description given.${c.reset}`);
      console.log(`Run ${c.bold}agt run "feature description"${c.reset} or create PRODUCT.md with a roadmap.`);
      process.exit(1);
    }

    const product = readFileSync(productPath, "utf8");
    const roadmapSection = product.match(/## Roadmap\n([\s\S]*?)(?=\n##|$)/);
    if (!roadmapSection) {
      console.log(`${c.red}No roadmap section found in PRODUCT.md.${c.reset}`);
      process.exit(1);
    }

    // Find first uncompleted item (capture item number for labeling)
    const roadmapText = roadmapSection[1];
    const items = [...roadmapText.matchAll(/(\d+)\.\s*\*\*(.+?)\*\*\s*[-—]\s*(.+)$/gm)];
    if (items.length === 0) {
      console.log(`${c.yellow}Roadmap is empty. Nothing to run.${c.reset}`);
      return "exhausted";
    }

    // Detect phase headers for labeling
    const phaseMap = new Map(); // offset → phase number
    for (const m of roadmapText.matchAll(/^###\s*Phase\s*(\d+)/gm)) {
      phaseMap.set(m.index, m[1]);
    }
    const phaseOffsets = [...phaseMap.keys()].sort((a, b) => a - b);
    function getPhase(offset) {
      let phase = null;
      for (const po of phaseOffsets) {
        if (po <= offset) phase = phaseMap.get(po);
        else break;
      }
      return phase;
    }

    // Check which features already exist or are marked done in roadmap
    const featuresDir = join(teamDir, "features");
    for (const item of items) {
      const fullText = item[3];
      // Skip items marked as done in the roadmap text
      if (/✅\s*done/i.test(fullText)) continue;

      const itemNum = item[1];
      const name = item[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const featureDir = join(featuresDir, name);
      const state = readState(featureDir);
      if (!state || state.status !== "completed") {
        const phase = getPhase(item.index);
        featureLabel = phase ? `P${phase}/#${itemNum}` : `#${itemNum}`;
        featureName = name;
        featureDescription = `${item[2]} — ${item[3]}`;
        break;
      }
    }

    if (!featureName) {
      console.log(`${c.green}All roadmap items completed!${c.reset}`);
      return "exhausted";
    }
  }

  // Read project code from PROJECT.md (first word of "## What" or repo name)
  let projectCode = 'AGT';
  try {
    const projMd = readFileSync(join(teamDir, 'PROJECT.md'), 'utf8');
    const repoMatch = projMd.match(/## Repo\n.*?([\w-]+)$/m);
    const whatMatch = projMd.match(/## What\n(.+)/);
    if (repoMatch) {
      const repo = repoMatch[1];
      // Use short codes: sequoia-seed → TRY, api-tasteful-work → API, agentic-team → AGT
      const codeMap = { 'sequoia-seed': 'TRY', 'api-tasteful-work': 'API', 'agentic-team': 'AGT' };
      projectCode = codeMap[repo] || repo.slice(0, 4).toUpperCase();
    }
  } catch {}

  const featureDir = join(teamDir, "features", featureName);
  const gateCmd = detectGateCommand(mainCwd);
  const agent = findAgent();

  // ── Print banner ──

  console.log(`\n${c.bold}${c.cyan}⚡ agt run${c.reset}\n`);
  console.log(`${c.bold}Feature:${c.reset}  ${featureLabel ? `[${featureLabel}] ` : ''}${featureDescription}`);
  console.log(`${c.bold}Gate:${c.reset}     ${c.dim}${gateCmd}${c.reset}`);
  console.log(`${c.bold}Agent:${c.reset}    ${agent ? c.green + agent + c.reset : c.yellow + "manual (no claude/codex found)" + c.reset}`);
  console.log(`${c.bold}Retries:${c.reset}  ${maxRetries} per task`);
  if (dryRun) console.log(`${c.yellow}${c.bold}DRY RUN${c.reset} — no changes will be made\n`);
  console.log();

  // ── Initialize feature via harness ──

  const statePath = join(featureDir, "STATE.json");
  if (!existsSync(statePath)) {
    const initResult = harness("init", "--feature", featureName, "--dir", teamDir);
    if (!initResult.ok && !initResult.feature) {
      console.log(`${c.red}Failed to init feature:${c.reset} ${JSON.stringify(initResult)}`);
      process.exit(1);
    }
    console.log(`${c.green}✓${c.reset} Feature initialized: ${featureName}`);
  }

  // ── Validate: feature must be trackable before execution ──
  {
    const initState = readState(featureDir);
    if (!initState) {
      console.log(`${c.red}✗ STATE.json missing after init — feature is not trackable.${c.reset}`);
      console.log(`  This means the dashboard and harness can't see this feature.`);
      console.log(`  Try: ${c.bold}agt-harness init --feature ${featureName} --dir ${teamDir} --force${c.reset}`);
      process.exit(1);
    }
    if (!['active', 'executing', 'paused', 'completed'].includes(initState.status) && !initState._recovered_from) {
      initState.status = 'executing';
      initState._last_modified = new Date().toISOString();
      writeState(featureDir, initState);
    }
    // Track current run start time (createdAt is preserved for audit trail)
    initState._runStartedAt = new Date().toISOString();
    initState.status = 'executing';
    writeState(featureDir, initState);
    // Persist roadmap label so dashboard and outer loop re-entry can read it without re-parsing
    if (featureLabel) {
      const labelState = readState(featureDir);
      if (labelState && labelState.roadmapLabel !== featureLabel) {
        labelState.roadmapLabel = featureLabel;
        writeState(featureDir, labelState);
      }
    }
    console.log(`${c.green}✓${c.reset} Feature trackable: ${initState.status}`);
  }

  // ── Read or create spec ──

  const specPath = join(featureDir, "SPEC.md");
  let spec = null;
  if (existsSync(specPath)) {
    spec = readFileSync(specPath, "utf8");
  } else {
    // Write a minimal spec from the description
    const specContent = `# Feature: ${featureDescription}\n\n## Goal\n${featureDescription}\n\n## Done when\n- [ ] ${featureDescription}\n- [ ] Quality gate passes\n`;
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(specPath, specContent);
    spec = specContent;
    console.log(`${c.green}✓${c.reset} Spec written: ${specPath}`);
  }

  // ── Plan tasks ──

  let tasks = planTasks(featureDescription, spec);
  console.log(`${c.green}✓${c.reset} Planned ${tasks.length} task(s)\n`);

  // ── Select execution flow ──

  const flow = (flowOverride && FLOWS[flowOverride]) || selectFlow(featureDescription, tasks);
  const tier = selectTier(tierOverride, featureDescription);
  console.log(`${c.bold}Flow:${c.reset}     ${flow.label}`);
  console.log(`${c.bold}Tier:${c.reset}     🎯 ${tier.label}\n`);

  // Write tasks to state (with crash-recovery detection)
  const state = readState(featureDir);
  const recovery = applyCrashRecovery(state, tasks, featureDir);
  if (recovery.recovered) {
    console.log(`${c.yellow}[crash-recovery]${c.reset} Resuming from crashed state at ${recovery.crashedAt}`);
  } else if (recovery.previousRunFailed) {
    console.log(`${c.yellow}[fresh-start]${c.reset} Previous run failed (all tasks blocked). Starting with fresh task plan.`);
  }
  tasks = recovery.tasks;

  // Write planned tasks to STATE.json immediately so dashboard shows them
  syncFromHarness(featureDir, tasks);

  // Notify start
  harness("notify", "--event", "feature-started", "--msg",
    `▶ Feature: ${featureName} (${tasks.length} tasks planned)`);

  // Initialize progress log (skip on recovery to preserve pre-crash history)
  if (!recovery.recovered) {
    initProgressLog(featureDir, featureName, tasks, tier);
  }

  if (dryRun) {
    console.log(`${c.dim}Tasks:${c.reset}`);
    tasks.forEach((t, i) => console.log(`  ${i + 1}. ${t.title}`));
    console.log(`\n${c.yellow}Dry run complete. No tasks executed.${c.reset}`);
    return;
  }

  // ── Create git worktree for isolated execution ──

  let worktreePath = null;
  let completed = 0;
  let blocked = 0;
  const startTime = Date.now();
  try {
    worktreePath = createWorktreeIfNeeded(featureName, mainCwd);
    cwd = worktreePath;
  } catch (err) {
    throw new Error(`Cannot create worktree for "${featureName}": ${err.message}`);
  }

  try {
  // ── Create GitHub issues ──

  const useGitHub = ghAvailable();
  let projectNum = null;
  if (useGitHub) {
    // Extract project number from PROJECT.md
    try {
      const projMd = readFileSync(join(teamDir, "PROJECT.md"), "utf8");
      const m = projMd.match(/projects\/(\d+)/);
      if (m) projectNum = parseInt(m[1]);
    } catch {}
    console.log(`${c.dim}Creating GitHub issues...${c.reset}`);
    for (const task of tasks) {
      if (task.issueNumber) continue; // already has an issue (e.g. from crash recovery)
      const issueNum = createIssue(
        `[${projectCode}]${featureLabel ? ` [${featureLabel}]` : ''} ${task.title}`,
        buildTaskIssueBody(featureName, featureLabel, task.title, state?.approvalIssueNumber),
      );
      if (issueNum) {
        task.issueNumber = issueNum;
        // Add to project board if configured
        try {
          const projectMd = readFileSync(join(teamDir, "PROJECT.md"), "utf8");
          const projMatch = projectMd.match(/projects\/(\d+)/);
          if (projMatch) addToProject(issueNum, parseInt(projMatch[1]));
        } catch {}
        console.log(`  ${c.green}✓${c.reset} #${issueNum}: ${task.title}`);
      }
    }
    // Persist issue numbers to state
    const ghState = readState(featureDir);
    if (ghState) {
      ghState.tasks = tasks;
      writeState(featureDir, ghState);
    }
    // Append ## Tasks checklist to parent approval issue
    if (state?.approvalIssueNumber) {
      const checklist = buildTasksChecklist(tasks);
      if (checklist) {
        const currentBody = getIssueBody(state.approvalIssueNumber);
        if (currentBody !== null && !currentBody.includes("## Tasks")) {
          editIssue(state.approvalIssueNumber, currentBody + checklist);
        }
      }
    }
    console.log();
  }

  // ── Execute tasks ──

  // Sync in-memory task list to STATE.json so the dashboard reflects real-time progress
  function syncTaskState() {
    syncFromHarness(featureDir, tasks);
  }

  // ── Brainstorm phase (full-stack flow only) ──

  let brainstormOutput = null;
  if (agent && flow.phases.includes("brainstorm")) {
    console.log(`${c.cyan}▶ Brainstorming...${c.reset}`);
    setUsageContext("brainstorm", null);
    const brainstormBrief = buildBrainstormBrief(featureName, featureDescription, cwd);
    const brainstormResult = dispatchToAgent(agent, brainstormBrief, cwd);
    if (brainstormResult.ok && brainstormResult.output) {
      brainstormOutput = brainstormResult.output.slice(0, 3000);
      console.log(`  ${c.green}✓ Brainstorm complete${c.reset}\n`);
    }
  }

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    // Check for pause signal before each task
    if (existsSync(join(featureDir, ".pause"))) {
      console.log(`\n${c.yellow}⏸ Pause requested — stopping after current state is saved.${c.reset}`);
      syncTaskState();
      // Update state to paused
      const ps = readState(featureDir);
      if (ps) { ps.status = 'paused'; ps.pausedAt = new Date().toISOString(); writeState(featureDir, ps); }
      // Clean up signal
      try { unlinkSync(join(featureDir, '.pause')); } catch {}
      console.log(`  Paused at task ${i + 1}/${tasks.length}. Resume with ${c.bold}agt run${c.reset}\n`);
      return "paused";
    }

    console.log(`${c.bold}▶ Task ${i + 1}/${tasks.length}:${c.reset} ${task.title}`);
    setUsageContext("build", task.id);

    // Create task directory structure before dispatch
    const taskDir = join(featureDir, "tasks", task.id);
    const artifactsDir = join(taskDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    // Transition to in-progress
    const transitionResult = harness("transition", "--task", task.id, "--status", "in-progress", "--dir", featureDir);
    if (transitionResult && transitionResult.allowed === false) {
      if (transitionResult.halt === true) {
        // Oscillation halt — stop the entire feature
        // Note: transition.mjs already wrote the progress.md entry; no duplicate needed here
        console.log(`${c.red}${c.bold}⚠ Oscillation halt: ${transitionResult.reason}${c.reset}\n`);
        harness("notify", "--event", "anomaly", "--msg",
          `⚠ Oscillation halt in ${featureName}: ${transitionResult.reason}`);
        break;
      }
      // Tick-limit or other rejection — skip this task
      console.log(`  ${c.yellow}⊘ Transition rejected: ${transitionResult.reason}${c.reset}`);
      // Note: transition.mjs already wrote the progress.md entry for tick-limit-exceeded
      if (!transitionResult.reason?.startsWith("tick-limit-exceeded")) {
        appendProgress(featureDir, `**Task ${i + 1}: ${task.title}**\n- Transition rejected: ${transitionResult.reason}`);
      }
      blocked++;
      syncTaskState();
      continue;
    }
    if (useGitHub && task.issueNumber && projectNum) setProjectItemStatus(task.issueNumber, projectNum, "in-progress");
    harness("notify", "--event", "task-started", "--msg", `▶ Task ${i + 1}/${tasks.length}: ${task.title}`);
    syncTaskState();

    let passed = false;
    let lastFailure = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      task.attempts = attempt;

      if (attempt > 1) {
        console.log(`  ${c.yellow}Retry ${attempt}/${maxRetries}${c.reset}`);
        // Include previous eval.md in failure context for Fix/Polish mode
        const prevEvalPath = join(taskDir, "eval.md");
        if (existsSync(prevEvalPath)) {
          try {
            const prevEval = readFileSync(prevEvalPath, "utf8");
            lastFailure = (lastFailure || "") + "\n\n## Previous Review (eval.md)\n" + prevEval.slice(0, 2000);
          } catch {}
        }
      }

      // Build task brief
      const brief = buildTaskBrief(task, featureName, gateCmd, cwd, lastFailure, brainstormOutput, tier);

      // Dispatch
      let result;
      if (agent) {
        result = dispatchToAgent(agent, brief, cwd);
      } else {
        result = await dispatchManual(brief);
      }

      if (!result.ok && result.error === "skipped by user") {
        harness("transition", "--task", task.id, "--status", "blocked",
          "--dir", featureDir, "--reason", "skipped by user");
        blocked++;
        console.log(`  ${c.yellow}⊘ Skipped${c.reset}\n`);
        if (task.issueNumber) commentIssue(task.issueNumber, "Task skipped by user.");
        break;
      }

      // Validate builder's handshake if it wrote one
      // Builder artifact paths are project-relative (relative to cwd), not task-dir-relative
      const builderHandshakePath = join(taskDir, "handshake.json");
      if (existsSync(builderHandshakePath)) {
        try {
          const builderHS = JSON.parse(readFileSync(builderHandshakePath, "utf8"));
          const hsValidation = validateHandshake(builderHS, { basePath: cwd });
          if (hsValidation.valid) {
            console.log(`  ${c.green}✓ Builder handshake valid${c.reset}`);
          } else {
            console.log(`  ${c.yellow}⚠ Builder handshake issues: ${hsValidation.errors.slice(0, 3).join("; ")}${c.reset}`);
          }
        } catch {
          console.log(`  ${c.dim}Builder handshake not parseable — continuing${c.reset}`);
        }
      }

      // Run quality gate — inline to avoid Windows subprocess issues
      console.log(`  ${c.dim}Running gate: ${gateCmd}${c.reset}`);
      const gateResult = runGateInline(gateCmd, featureDir, task.id, cwd);

      if (gateResult.verdict === "PASS") {
        passed = true;

        // Auto-commit after gate pass
        try {
          execFileSync("git", ["add", "-A"], { cwd, stdio: "pipe" });
          const hasChanges = execFileSync("git", ["diff", "--cached", "--stat"], { cwd, encoding: "utf8", stdio: "pipe" }).trim();
          if (hasChanges) {
            execFileSync("git", ["commit", "-m", `feat: ${task.title.slice(0, 72)}`], { cwd, stdio: "pipe" });
            console.log(`  ${c.green}✓ Committed${c.reset}`);
          }
        } catch { /* no changes to commit, or git not available */ }

        // ── Review phases ──

        let reviewFailed = false;
        let escalationFired = false;

        if (agent && flow.phases.includes("review")) {
          console.log(`  ${c.cyan}▶ Review...${c.reset}`);
          const contextBrief = buildContextBrief(featureDir, cwd);
          const reviewBrief = buildReviewBrief(featureName, task.title, gateResult.stdout, cwd, null) + "\n\n" + contextBrief;
          const reviewResult = dispatchToAgent(agent, reviewBrief, cwd);
          if (reviewResult.output) {
            // Save review output as eval.md in task artifacts
            const evalPath = join(taskDir, "eval.md");
            writeFileSync(evalPath, reviewResult.output);
            console.log(`  ${c.green}✓ eval.md written${c.reset}`);

            let findings = parseFindings(reviewResult.output);
            const compoundGateResult = runCompoundGate(findings, cwd);
            if (compoundGateResult.verdict === "FAIL") {
              findings = [
                { severity: "critical", text: `🔴 compound-gate.mjs:0 — Shallow review detected: ${compoundGateResult.layers.join(", ")}` },
                ...findings,
              ];
            } else if (compoundGateResult.verdict === "WARN") {
              console.log(`  ${c.yellow}⚠ Compound gate WARN: ${compoundGateResult.layers.join(", ")}${c.reset}`);
              findings = [
                { severity: "warning", text: `🟡 compound-gate.mjs:0 — Thin review warning: ${compoundGateResult.layers.join(", ")}` },
                ...findings,
              ];
              recordWarningIteration(task, attempt, compoundGateResult.layers);
              const warnState = readState(featureDir);
              if (warnState) {
                const warnTask = warnState.tasks?.find(t => t.id === task.id);
                if (warnTask) { warnTask.gateWarningHistory = task.gateWarningHistory; writeState(featureDir, warnState); }
              }
            }
            appendFileSync(evalPath, "\n\n" + compoundGateResult.section);
            const escalation = checkEscalation(task.gateWarningHistory);
            if (escalation) {
              escalationFired = true;
              const escalMsg = `🔴 iteration-escalation — Persistent eval warning: ${escalation.layers.join(", ")} recurred in iterations ${escalation.iterations.join(", ")}`;
              findings = [{ severity: "critical", text: escalMsg }, ...findings];
              appendProgress(featureDir, `**Task ${i + 1}: ${task.title}**\n- 🔴 Iteration escalation: ${escalation.layers.join(", ")} recurred in iterations ${escalation.iterations.join(", ")}`);
              console.log(`  ${c.red}⚠ Iteration escalation — ${escalation.layers.join(", ")} recurred in iterations ${escalation.iterations.join(", ")}${c.reset}`);
            }
            const synth = computeVerdict(findings);
            console.log(`  ${c.dim}Review verdict: ${synth.verdict} (🔴 ${synth.critical} 🟡 ${synth.warning} 🔵 ${synth.suggestion})${c.reset}`);
            if (synth.critical > 0) {
              reviewFailed = true;
              incrementReviewRounds(task);
              const rrState = readState(featureDir);
              if (rrState) {
                const rrTask = rrState.tasks?.find(t => t.id === task.id);
                if (rrTask) { rrTask.reviewRounds = task.reviewRounds; writeState(featureDir, rrState); }
              }
              console.log(`  ${c.red}✗ Review FAIL — ${synth.critical} critical finding(s)${c.reset}`);
              findings.filter(f => f.severity === "critical").forEach(f =>
                console.log(`    ${c.red}${f.text}${c.reset}`)
              );
              lastFailure = `Review FAIL: ${synth.critical} critical finding(s)\n` + findings.filter(f => f.severity === "critical").map(f => f.text).join("\n");
            }
            if (synth.backlog) {
              findings.filter(f => f.severity === "warning").forEach(f =>
                console.log(`    ${c.yellow}${f.text}${c.reset}`)
              );
            }
            // Write review handshake with compound gate result
            const reviewHandshake = createHandshake({
              taskId: task.id,
              nodeType: "review",
              status: synth.critical > 0 ? "failed" : "completed",
              verdict: synth.verdict,
              summary: `Review: ${synth.verdict} (${synth.critical} critical, ${synth.warning} warning, ${synth.suggestion} suggestion). Compound gate: ${compoundGateResult.verdict}`,
              artifacts: [{ type: "evaluation", path: "eval.md" }],
              findings: { critical: synth.critical, warning: synth.warning, suggestion: synth.suggestion },
              compoundGate: { tripped: compoundGateResult.tripped, layers: compoundGateResult.layers, verdict: compoundGateResult.verdict },
            });
            writeFileSync(join(taskDir, "handshake.json"), JSON.stringify(reviewHandshake, null, 2) + "\n");
            if (synth.critical > 0 && task.reviewRounds) {
              const roundHs = { ...reviewHandshake, findingsList: findings.filter(f => f.severity === "critical" || f.severity === "warning").map(f => ({ severity: f.severity, text: f.text })) };
              writeFileSync(join(taskDir, `handshake-round-${task.reviewRounds}.json`), JSON.stringify(roundHs, null, 2) + "\n");
            }
          }
        }

        if (agent && flow.phases.includes("multi-review")) {
          console.log(`  ${c.cyan}▶ Parallel review (${PARALLEL_REVIEW_ROLES.join(", ")})...${c.reset}`);
          setUsageContext("review", task.id);
          const roleFindings = await runParallelReviews(
            agent, PARALLEL_REVIEW_ROLES, featureName, task.title, gateResult.stdout, cwd,
          );
          const merged = mergeReviewFindings(roleFindings);
          console.log(`  ${c.dim}${merged.slice(0, 1000)}${c.reset}`);
          const allText = roleFindings.map(f => f.output || "").join("\n");
          let findings = parseFindings(allText);
          const compoundGateResult = runCompoundGate(findings, cwd);
          // Collect synthetic finding lines so eval.md is written once — after all verdicts are assembled
          const syntheticEvalLines = [];
          if (compoundGateResult.verdict === "FAIL") {
            const synLine = `🔴 compound-gate.mjs:0 — Shallow review detected: ${compoundGateResult.layers.join(", ")}`;
            findings = [{ severity: "critical", text: synLine }, ...findings];
            syntheticEvalLines.push(synLine);
          } else if (compoundGateResult.verdict === "WARN") {
            console.log(`  ${c.yellow}⚠ Compound gate WARN: ${compoundGateResult.layers.join(", ")}${c.reset}`);
            const synLine = `🟡 compound-gate.mjs:0 — Thin review warning: ${compoundGateResult.layers.join(", ")}`;
            findings = [{ severity: "warning", text: synLine }, ...findings];
            syntheticEvalLines.push(synLine);
            recordWarningIteration(task, attempt, compoundGateResult.layers);
            const warnStateP = readState(featureDir);
            if (warnStateP) {
              const warnTaskP = warnStateP.tasks?.find(t => t.id === task.id);
              if (warnTaskP) { warnTaskP.gateWarningHistory = task.gateWarningHistory; writeState(featureDir, warnStateP); }
            }
          }
          const escalationP = checkEscalation(task.gateWarningHistory);
          if (escalationP) {
            escalationFired = true;
            const escalMsgP = `🔴 iteration-escalation — Persistent eval warning: ${escalationP.layers.join(", ")} recurred in iterations ${escalationP.iterations.join(", ")}`;
            findings = [{ severity: "critical", text: escalMsgP }, ...findings];
            syntheticEvalLines.push(escalMsgP);
            appendProgress(featureDir, `**Task ${i + 1}: ${task.title}**\n- 🔴 Iteration escalation: ${escalationP.layers.join(", ")} recurred in iterations ${escalationP.iterations.join(", ")}`);
            console.log(`  ${c.red}⚠ Iteration escalation — ${escalationP.layers.join(", ")} recurred in iterations ${escalationP.iterations.join(", ")}${c.reset}`);
          }
          // Write eval.md now that verdict is fully assembled — synthetic findings appear as parseable lines
          const evalContent = merged +
            (syntheticEvalLines.length > 0 ? "\n\n" + syntheticEvalLines.join("\n") : "") +
            "\n\n" + compoundGateResult.section;
          writeFileSync(join(taskDir, "eval.md"), evalContent);
          const synth = computeVerdict(findings);
          console.log(`  ${c.dim}Synthesized verdict: ${synth.verdict} (🔴 ${synth.critical} 🟡 ${synth.warning} 🔵 ${synth.suggestion})${c.reset}`);
          if (synth.critical > 0) {
            reviewFailed = true;
            incrementReviewRounds(task);
            const rrStateP = readState(featureDir);
            if (rrStateP) {
              const rrTaskP = rrStateP.tasks?.find(t => t.id === task.id);
              if (rrTaskP) { rrTaskP.reviewRounds = task.reviewRounds; writeState(featureDir, rrStateP); }
            }
            console.log(`  ${c.red}✗ Review FAIL — ${synth.critical} critical finding(s)${c.reset}`);
            findings.filter(f => f.severity === "critical").forEach(f =>
              console.log(`    ${c.red}${f.text}${c.reset}`)
            );
            lastFailure = `Review FAIL: ${synth.critical} critical finding(s)\n` + findings.filter(f => f.severity === "critical").map(f => f.text).join("\n");
          }
          // Write review handshake with compound gate result
          const multiReviewHandshake = createHandshake({
            taskId: task.id,
            nodeType: "review",
            status: synth.critical > 0 ? "failed" : "completed",
            verdict: synth.verdict,
            summary: `Parallel review: ${synth.verdict} (${synth.critical} critical, ${synth.warning} warning, ${synth.suggestion} suggestion). Compound gate: ${compoundGateResult.verdict}`,
            artifacts: [{ type: "evaluation", path: "eval.md" }],
            findings: { critical: synth.critical, warning: synth.warning, suggestion: synth.suggestion },
            compoundGate: { tripped: compoundGateResult.tripped, layers: compoundGateResult.layers, verdict: compoundGateResult.verdict },
          });
          writeFileSync(join(taskDir, "handshake.json"), JSON.stringify(multiReviewHandshake, null, 2) + "\n");
          if (synth.critical > 0 && task.reviewRounds) {
            const roundHs = { ...multiReviewHandshake, findingsList: findings.filter(f => f.severity === "critical" || f.severity === "warning").map(f => ({ severity: f.severity, text: f.text })) };
            writeFileSync(join(taskDir, `handshake-round-${task.reviewRounds}.json`), JSON.stringify(roundHs, null, 2) + "\n");
          }
        }

        // If review found critical issues, treat as failure — retry the task
        if (reviewFailed) {
          if (shouldEscalate(task)) {
            // Review-round escalation: block when cap is hit
            const escalationSummary = buildEscalationSummary(taskDir, task.title, task.reviewRounds);
            if (task.issueNumber) commentIssue(task.issueNumber, escalationSummary);
            if (task.issueNumber && state?.approvalIssueNumber) {
              const parentBody = getIssueBody(state.approvalIssueNumber);
              if (parentBody !== null) {
                const updated = markChecklistItemBlocked(parentBody, task.title, task.issueNumber);
                if (updated !== parentBody) editIssue(state.approvalIssueNumber, updated);
              }
            }
            harness("transition", "--task", task.id, "--status", "blocked",
              "--dir", featureDir, "--reason", `review-escalation: ${task.reviewRounds} rounds exceeded`);
            blocked++;
            appendProgress(featureDir, `**Task ${i + 1}: ${task.title}**\n- 🔴 Review-round escalation: blocked after ${task.reviewRounds} review FAIL round(s)`);
            console.log(`  ${c.red}✗ Blocked by review-round escalation — ${task.reviewRounds} review FAILs exceeded cap${c.reset}\n`);
            break;
          }
          if (escalationFired) {
            // Iteration escalation: block immediately, no further retries allowed
            harness("transition", "--task", task.id, "--status", "blocked",
              "--dir", featureDir, "--reason", "Iteration escalation: same compound-gate layer recurred across multiple iterations");
            blocked++;
            console.log(`  ${c.red}✗ Blocked by iteration escalation — no further retries${c.reset}\n`);
            break;
          }
          console.log(`  ${c.red}✗ Review blocked task — will retry${c.reset}\n`);
          appendProgress(featureDir, `**Task ${i + 1}: ${task.title}**\n- Verdict: 🟡 Review FAIL (attempt ${task.attempts})\n- Will retry with review feedback`);
          if (attempt === maxRetries) {
            harness("transition", "--task", task.id, "--status", "blocked",
              "--dir", featureDir, "--reason", `Review FAIL after ${maxRetries} attempts`);
            if (!task.replan && agent) {
              const replanBrief = buildReplanBrief(task, lastFailure, tasks.slice(i + 1), spec, featureName);
              const replanRaw = dispatchToAgent(agent, replanBrief, cwd);
              const replanResult = parseReplanOutput(replanRaw.output);
              if (replanResult && replanResult.verdict !== "abandon") {
                const preReplanState = readState(featureDir);
                if (preReplanState) { const ft = preReplanState.tasks.find(t => t.id === task.id); if (ft !== undefined) task.ticks = ft.ticks; }
                applyReplan(tasks, task, replanResult);
                const updState = readState(featureDir);
                if (updState) { const existingIds = new Set(updState.tasks.map(t => t.id)); const newTasks = tasks.filter(t => !existingIds.has(t.id)); const bi = updState.tasks.findIndex(t => t.id === task.id); updState.tasks.splice(bi + 1, 0, ...newTasks); writeState(featureDir, updState); }
                appendProgress(featureDir, `**Re-plan for task ${i + 1}: ${task.title}**\n- Verdict: ${replanResult.verdict}\n- Rationale: ${replanResult.rationale}`);
                console.log(`  ${c.cyan}↻ Re-plan: ${replanResult.verdict} — ${replanResult.tasks.length} task(s) injected${c.reset}\n`);
              } else {
                blocked++;
                console.log(`  ${c.red}✗ Blocked after ${maxRetries} attempts${c.reset}\n`);
              }
            } else {
              blocked++;
              console.log(`  ${c.red}✗ Blocked after ${maxRetries} attempts${c.reset}\n`);
            }
          }
          continue; // retry the task with review feedback
        }

        harness("transition", "--task", task.id, "--status", "passed", "--dir", featureDir);
        harness("notify", "--event", "task-passed", "--msg", `✓ Task ${i + 1}/${tasks.length}: ${task.title}`);
        completed++;
        syncTaskState();
        console.log(`  ${c.green}✓ Gate PASS${c.reset}\n`);
        appendProgress(featureDir, `**Task ${i + 1}: ${task.title}**\n- Verdict: ✅ PASS (attempt ${task.attempts})\n- Gate: \`${gateCmd}\` — exit 0`);
        pushTaskStatus(featureDir, task.id, "passed", { issueNumber: task.issueNumber, attempts: task.attempts });
        if (task.issueNumber && state?.approvalIssueNumber) {
          const parentBody = getIssueBody(state.approvalIssueNumber);
          if (parentBody !== null) {
            const updated = tickChecklistItem(parentBody, task.title, task.issueNumber);
            if (updated !== parentBody) editIssue(state.approvalIssueNumber, updated);
          }
        }
        break;
      } else {
        console.log(`  ${c.red}✗ Gate FAIL${c.reset} (exit ${gateResult.exitCode})`);
        if (gateResult.stderr) console.log(`  ${c.dim}${gateResult.stderr.slice(0, 500)}${c.reset}`);
        lastFailure = `Exit code: ${gateResult.exitCode}\nstdout: ${gateResult.stdout?.slice(0, 1000) || ""}\nstderr: ${gateResult.stderr?.slice(0, 1000) || ""}`;
        appendProgress(featureDir, `**Task ${i + 1}: ${task.title}**\n- Verdict: ❌ FAIL (attempt ${task.attempts}/${maxRetries})\n- Gate exit code: ${gateResult.exitCode}`);

        if (attempt === maxRetries) {
          harness("transition", "--task", task.id, "--status", "blocked",
            "--dir", featureDir, "--reason", `Failed after ${maxRetries} attempts`);
          harness("notify", "--event", "task-blocked", "--msg",
            `✗ Task ${i + 1}/${tasks.length}: ${task.title} — failed after ${maxRetries} attempts`);
          if (!task.replan && agent) {
            const replanBrief = buildReplanBrief(task, lastFailure, tasks.slice(i + 1), spec, featureName);
            const replanRaw = dispatchToAgent(agent, replanBrief, cwd);
            const replanResult = parseReplanOutput(replanRaw.output);
            if (replanResult && replanResult.verdict !== "abandon") {
              const preReplanState = readState(featureDir);
              if (preReplanState) { const ft = preReplanState.tasks.find(t => t.id === task.id); if (ft !== undefined) task.ticks = ft.ticks; }
              applyReplan(tasks, task, replanResult);
              const updState = readState(featureDir);
              if (updState) { const existingIds = new Set(updState.tasks.map(t => t.id)); const newTasks = tasks.filter(t => !existingIds.has(t.id)); const bi = updState.tasks.findIndex(t => t.id === task.id); updState.tasks.splice(bi + 1, 0, ...newTasks); writeState(featureDir, updState); }
              appendProgress(featureDir, `**Re-plan for task ${i + 1}: ${task.title}**\n- Verdict: ${replanResult.verdict}\n- Rationale: ${replanResult.rationale}`);
              console.log(`  ${c.cyan}↻ Re-plan: ${replanResult.verdict} — ${replanResult.tasks.length} task(s) injected${c.reset}\n`);
            } else {
              blocked++;
              syncTaskState();
              console.log(`  ${c.red}✗ Blocked after ${maxRetries} attempts${c.reset}\n`);
              pushTaskStatus(featureDir, task.id, "blocked", { issueNumber: task.issueNumber, lastReason: `blocked after ${maxRetries} attempts` });
            }
          } else {
            blocked++;
            syncTaskState();
            console.log(`  ${c.red}✗ Blocked after ${maxRetries} attempts${c.reset}\n`);
            pushTaskStatus(featureDir, task.id, "blocked", { issueNumber: task.issueNumber, lastReason: `blocked after ${maxRetries} attempts` });
          }
        }
      }
    }

    // Check for oscillation (simple: 3+ consecutive failures across tasks)
    if (blocked >= 3) {
      console.log(`${c.red}${c.bold}⚠ 3 consecutive blocks — possible systemic issue. Stopping.${c.reset}\n`);
      harness("notify", "--event", "anomaly", "--msg",
        `⚠ 3 consecutive blocks in ${featureName} — stopping execution`);
      break;
    }

    // Midpoint summary
    if (i === Math.floor(tasks.length / 2) - 1 && tasks.length > 2) {
      const msg = `Progress: ${completed}/${tasks.length} done, ${blocked} blocked.`;
      console.log(`${c.cyan}${msg}${c.reset}`);
      harness("notify", "--event", "progress", "--msg", msg);
    }
  }

  // ── Finalize ──

  const finalizeResult = harness("finalize", "--dir", featureDir);

  // Persist token usage to STATE.json for dashboard visibility
  if (_runUsage.dispatches > 0) {
    try {
      const s = readState(featureDir);
      if (s) { s.tokenUsage = buildTokenUsage(); writeState(featureDir, s); }
    } catch { /* best-effort */ }
  }

  // Auto-push feature branch commits
  try {
    console.log(`${c.dim}Pushing feature branch...${c.reset}`);
    execFileSync("git", ["push", "--set-upstream", "origin", "HEAD"], { cwd, stdio: "pipe" });
    console.log(`${c.green}✓ Pushed${c.reset}`);
  } catch { /* push failed — not fatal */ }

  // Remove worktree now that execution is complete
  } finally {
    if (worktreePath) removeWorktree(worktreePath, mainCwd);
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  const durationStr = duration > 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`;

  // ── Completion report ──

  const usage = getRunUsage();
  const phases = getPhaseUsage();
  const taskCosts = getTaskUsage();
  const formatTokens = (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n);
  const totalTokens = (b) => b.inputTokens + b.cacheRead + b.outputTokens;

  console.log(`${"═".repeat(50)}`);
  console.log(`${c.bold}Feature complete: ${featureLabel ? `[${featureLabel}] ` : ''}${featureName}${c.reset}`);
  console.log(`  ${c.green}✓${c.reset} ${completed}/${tasks.length} tasks done`);
  if (blocked > 0) console.log(`  ${c.red}✗${c.reset} ${blocked} blocked`);
  console.log(`  ${c.dim}Duration: ${durationStr}${c.reset}`);
  if (usage.dispatches > 0) {
    console.log(`  ${c.dim}Dispatches: ${usage.dispatches}${c.reset}`);
    console.log(`  ${c.dim}Tokens: ${formatTokens(totalTokens(usage))} (in: ${formatTokens(usage.inputTokens)}, cached: ${formatTokens(usage.cacheRead)}, out: ${formatTokens(usage.outputTokens)})${c.reset}`);
    if (usage.costUsd > 0) console.log(`  ${c.dim}Cost: $${usage.costUsd.toFixed(2)}${c.reset}`);

    // Phase breakdown
    const phaseOrder = ["brainstorm", "build", "review"];
    const activePhases = phaseOrder.filter(p => phases[p]);
    if (activePhases.length > 0) {
      console.log(`  ${c.dim}By phase:${c.reset}`);
      for (const p of activePhases) {
        const ph = phases[p];
        console.log(`    ${c.dim}${p}: ${ph.dispatches} dispatches, ${formatTokens(totalTokens(ph))} tokens${ph.costUsd > 0 ? `, $${ph.costUsd.toFixed(2)}` : ''}${c.reset}`);
      }
    }

    // Top expensive tasks
    const taskEntries = Object.entries(taskCosts).sort((a, b) => b[1].costUsd - a[1].costUsd);
    if (taskEntries.length > 0 && taskEntries[0][1].costUsd > 0) {
      console.log(`  ${c.dim}Top tasks by cost:${c.reset}`);
      for (const [tid, tu] of taskEntries.slice(0, 5)) {
        const taskObj = tasks.find(t => t.id === tid);
        const label = taskObj ? taskObj.title.slice(0, 40) : tid;
        console.log(`    ${c.dim}${tid}: $${tu.costUsd.toFixed(2)} (${tu.dispatches} dispatches, ${formatTokens(totalTokens(tu))})${c.reset}`);
      }
    }
  }
  console.log(`${"═".repeat(50)}\n`);

  // Write usage to progress log
  if (usage.dispatches > 0) {
    let summary = `**Run Summary**\n- Tasks: ${completed}/${tasks.length} done, ${blocked} blocked\n- Duration: ${durationStr}\n- Dispatches: ${usage.dispatches}\n- Tokens: ${formatTokens(totalTokens(usage))} (in: ${formatTokens(usage.inputTokens)}, cached: ${formatTokens(usage.cacheRead)}, out: ${formatTokens(usage.outputTokens)})\n- Cost: $${usage.costUsd.toFixed(2)}`;
    const activePhases2 = ["brainstorm", "build", "review"].filter(p => phases[p]);
    if (activePhases2.length > 0) {
      summary += `\n- By phase: ${activePhases2.map(p => `${p} $${phases[p].costUsd.toFixed(2)}`).join(', ')}`;
    }
    appendProgress(featureDir, summary);
  }

  harness("notify", "--event", "feature-complete", "--msg",
    `Feature complete: ${featureName} — ${completed}/${tasks.length} done, ${blocked} blocked, ${durationStr}${usage.costUsd > 0 ? `, $${usage.costUsd.toFixed(2)}` : ''}`);

  if (blocked > 0) {
    console.log(`${c.yellow}Blocked tasks need attention. Review and run again or fix manually.${c.reset}`);
    closeFeatureIssues(featureDir, "feature blocked — tasks need attention");
    return "blocked";
  }
  return "done";
}

export const runSingleFeature = _runSingleFeature;
