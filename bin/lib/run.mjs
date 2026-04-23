// agt run — autonomous execution loop
// Dispatches agents, runs quality gates, manages state via harness.

import { execSync, spawnSync, execFileSync, spawn } from "child_process";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve, dirname } from "path";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import {
  c, getFlag, readState, writeState, generateNonce,
  WRITER_SIG, ALLOWED_TRANSITIONS,
} from "./util.mjs";
import { ghAvailable, createIssue, closeIssue, commentIssue, addToProject, setProjectItemStatus } from "./github.mjs";
import { FLOWS, selectFlow, buildBrainstormBrief, buildReviewBrief, PARALLEL_REVIEW_ROLES, mergeReviewFindings } from "./flows.mjs";
import { parseFindings, computeVerdict } from "./synthesize.mjs";
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

function runGateInline(cmd, featureDir, taskId) {
  let exitCode = 0;
  let stdout = "";
  let stderr = "";

  try {
    stdout = execSync(cmd, {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 120000,
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

  // Also update state via harness for tamper-detection
  if (verdict === "PASS") {
    harness("gate", "--cmd", "echo gate-recorded", "--dir", featureDir, "--task", taskId);
  }

  return { ok: true, verdict, exitCode, stdout: stdout.slice(0, 4096), stderr: stderr.slice(0, 4096) };
}

// ── Agent dispatch ──────────────────────────────────────────────

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

export function dispatchToAgent(agent, brief, cwd) {
  console.log(`  ${c.dim}Dispatching to ${agent}...${c.reset}`);

  try {
    if (agent === "claude") {
      const result = spawnSync("claude", ["--print", "--permission-mode", "bypassPermissions", brief], {
        encoding: "utf8",
        cwd,
        timeout: 600000, // 10 min max per task
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });
      if (result.stdout) console.log(`  ${c.dim}${result.stdout.slice(0, 2000)}${c.reset}`);
      return { ok: result.status === 0, output: result.stdout || "", error: result.stderr || "" };
    }

    if (agent === "codex") {
      const result = spawnSync("codex", ["--quiet", brief], {
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
    const child = spawn("claude", ["--print", "--permission-mode", "bypassPermissions", brief], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
    child.stdout?.on("data", d => { stdout += d; });
    child.stderr?.on("data", d => { stderr += d; });
    child.on("close", code => resolve({ ok: code === 0, output: stdout, error: stderr }));
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

function appendProgress(featureDir, entry) {
  const progressPath = join(featureDir, "progress.md");
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const line = `### ${timestamp}\n${entry}\n\n`;
  try {
    const existing = existsSync(progressPath) ? readFileSync(progressPath, "utf8") : "";
    writeFileSync(progressPath, existing + line);
  } catch {
    writeFileSync(progressPath, line);
  }
}

// ── Crash recovery helper ────────────────────────────────────────
// Exported for testing. Mutates state in-place and returns tasks to use.
// Returns { tasks, recovered: bool }.
export function applyCrashRecovery(state, plannedTasks, featureDir) {
  if (state && state.status === "executing") {
    const crashedAt = state._last_modified;
    for (const t of state.tasks) {
      if (t.status === "in-progress") t.status = "pending";
    }
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

async function _runSingleFeature(args, description) {
  if (!description) description = args.filter(a => !a.startsWith("-")).join(" ") || null;
  const cwd = process.cwd();
  const teamDir = join(cwd, ".team");
  const maxRetries = parseInt(getFlag(args, "retries") || "3", 10);
  const dryRun = args.includes("--dry-run");
  const flowOverride = getFlag(args, "flow");
  const tierOverride = getFlag(args, "tier");

  if (!existsSync(teamDir)) {
    console.log(`${c.red}No .team/ directory found.${c.reset} Run ${c.bold}agt init${c.reset} first.`);
    process.exit(1);
  }

  // ── Determine what to run ──

  let featureName;
  let featureDescription;

  if (description) {
    // Mode 1: explicit feature
    featureName = description
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

    // Find first uncompleted item
    const items = [...roadmapSection[1].matchAll(/^\d+\.\s*\*\*(.+?)\*\*\s*[-—]\s*(.+)$/gm)];
    if (items.length === 0) {
      console.log(`${c.yellow}Roadmap is empty. Nothing to run.${c.reset}`);
      return "exhausted";
    }

    // Check which features already exist or are marked done in roadmap
    const featuresDir = join(teamDir, "features");
    for (const item of items) {
      const fullText = item[2];
      // Skip items marked as done in the roadmap text
      if (/✅\s*done/i.test(fullText)) continue;

      const name = item[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const featureDir = join(featuresDir, name);
      const state = readState(featureDir);
      if (!state || state.status !== "completed") {
        featureName = name;
        featureDescription = `${item[1]} — ${item[2]}`;
        break;
      }
    }

    if (!featureName) {
      console.log(`${c.green}All roadmap items completed!${c.reset}`);
      return "exhausted";
    }
  }

  const featureDir = join(teamDir, "features", featureName);
  const gateCmd = detectGateCommand(cwd);
  const agent = findAgent();

  // ── Print banner ──

  console.log(`\n${c.bold}${c.cyan}⚡ agt run${c.reset}\n`);
  console.log(`${c.bold}Feature:${c.reset}  ${featureDescription}`);
  console.log(`${c.bold}Gate:${c.reset}     ${c.dim}${gateCmd}${c.reset}`);
  console.log(`${c.bold}Agent:${c.reset}    ${agent ? c.green + agent + c.reset : c.yellow + "manual (no claude/codex found)" + c.reset}`);
  console.log(`${c.bold}Retries:${c.reset}  ${maxRetries} per task`);
  if (dryRun) console.log(`${c.yellow}${c.bold}DRY RUN${c.reset} — no changes will be made\n`);
  console.log();

  // ── Initialize feature via harness ──

  if (!existsSync(featureDir)) {
    const initResult = harness("init", "--feature", featureName, "--dir", teamDir);
    if (!initResult.ok && !initResult.feature) {
      console.log(`${c.red}Failed to init feature:${c.reset} ${JSON.stringify(initResult)}`);
      process.exit(1);
    }
    console.log(`${c.green}✓${c.reset} Feature initialized: ${featureName}`);
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
  }
  tasks = recovery.tasks;

  // Notify start
  harness("notify", "--event", "feature-started", "--msg",
    `▶ Feature: ${featureName} (${tasks.length} tasks planned)`);

  // Initialize progress log
  initProgressLog(featureDir, featureName, tasks, tier);

  if (dryRun) {
    console.log(`${c.dim}Tasks:${c.reset}`);
    tasks.forEach((t, i) => console.log(`  ${i + 1}. ${t.title}`));
    console.log(`\n${c.yellow}Dry run complete. No tasks executed.${c.reset}`);
    return;
  }

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
      const issueNum = createIssue(
        `[${featureName}] ${task.title}`,
        `Auto-created by \`agt run\` for feature **${featureName}**.\n\nTask: ${task.title}`,
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
    console.log();
  }

  // ── Execute tasks ──

  let completed = 0;
  let blocked = 0;
  const startTime = Date.now();

  // ── Brainstorm phase (full-stack flow only) ──

  let brainstormOutput = null;
  if (agent && flow.phases.includes("brainstorm")) {
    console.log(`${c.cyan}▶ Brainstorming...${c.reset}`);
    const brainstormBrief = buildBrainstormBrief(featureName, featureDescription, cwd);
    const brainstormResult = dispatchToAgent(agent, brainstormBrief, cwd);
    if (brainstormResult.ok && brainstormResult.output) {
      brainstormOutput = brainstormResult.output.slice(0, 3000);
      console.log(`  ${c.green}✓ Brainstorm complete${c.reset}\n`);
    }
  }

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    console.log(`${c.bold}▶ Task ${i + 1}/${tasks.length}:${c.reset} ${task.title}`);

    // Create task directory structure before dispatch
    const taskDir = join(featureDir, "tasks", task.id);
    const artifactsDir = join(taskDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    // Transition to in-progress
    harness("transition", "--task", task.id, "--status", "in-progress", "--dir", featureDir);
    if (useGitHub && task.issueNumber && projectNum) setProjectItemStatus(task.issueNumber, projectNum, "in-progress");
    harness("notify", "--event", "task-started", "--msg", `▶ Task ${i + 1}/${tasks.length}: ${task.title}`);

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
      const gateResult = runGateInline(gateCmd, featureDir, task.id);

      if (gateResult.verdict === "PASS") {
        passed = true;

        // Auto-commit after gate pass
        try {
          execSync("git add -A", { cwd, shell: true, stdio: "pipe" });
          const hasChanges = execSync("git diff --cached --stat", { cwd, encoding: "utf8", shell: true, stdio: "pipe" }).trim();
          if (hasChanges) {
            execSync(`git commit -m "feat: ${task.title.replace(/"/g, '\\"').slice(0, 72)}"`, { cwd, shell: true, stdio: "pipe" });
            console.log(`  ${c.green}✓ Committed${c.reset}`);
          }
        } catch { /* no changes to commit, or git not available */ }

        // ── Review phases ──

        let reviewFailed = false;

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

            const findings = parseFindings(reviewResult.output);
            const synth = computeVerdict(findings);
            console.log(`  ${c.dim}Review verdict: ${synth.verdict} (🔴 ${synth.critical} 🟡 ${synth.warning} 🔵 ${synth.suggestion})${c.reset}`);
            if (synth.critical > 0) {
              reviewFailed = true;
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
          }
        }

        if (agent && flow.phases.includes("multi-review")) {
          console.log(`  ${c.cyan}▶ Parallel review (${PARALLEL_REVIEW_ROLES.join(", ")})...${c.reset}`);
          const roleFindings = await runParallelReviews(
            agent, PARALLEL_REVIEW_ROLES, featureName, task.title, gateResult.stdout, cwd,
          );
          const merged = mergeReviewFindings(roleFindings);
          // Save merged review as eval.md
          writeFileSync(join(taskDir, "eval.md"), merged);
          console.log(`  ${c.dim}${merged.slice(0, 1000)}${c.reset}`);
          const allText = roleFindings.map(f => f.output || "").join("\n");
          const findings = parseFindings(allText);
          const synth = computeVerdict(findings);
          console.log(`  ${c.dim}Synthesized verdict: ${synth.verdict} (🔴 ${synth.critical} 🟡 ${synth.warning} 🔵 ${synth.suggestion})${c.reset}`);
          if (synth.critical > 0) {
            reviewFailed = true;
            console.log(`  ${c.red}✗ Review FAIL — ${synth.critical} critical finding(s)${c.reset}`);
            findings.filter(f => f.severity === "critical").forEach(f =>
              console.log(`    ${c.red}${f.text}${c.reset}`)
            );
            lastFailure = `Review FAIL: ${synth.critical} critical finding(s)\n` + findings.filter(f => f.severity === "critical").map(f => f.text).join("\n");
          }
        }

        // If review found critical issues, treat as failure — retry the task
        if (reviewFailed) {
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
                applyReplan(tasks, task, replanResult);
                const updState = readState(featureDir);
                if (updState) { updState.tasks = tasks; writeState(featureDir, updState); }
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
        console.log(`  ${c.green}✓ Gate PASS${c.reset}\n`);
        appendProgress(featureDir, `**Task ${i + 1}: ${task.title}**\n- Verdict: ✅ PASS (attempt ${task.attempts})\n- Gate: \`${gateCmd}\` — exit 0`);
        if (task.issueNumber) { closeIssue(task.issueNumber, "Task completed — gate passed."); if (projectNum) setProjectItemStatus(task.issueNumber, projectNum, "done"); }
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
              applyReplan(tasks, task, replanResult);
              const updState = readState(featureDir);
              if (updState) { updState.tasks = tasks; writeState(featureDir, updState); }
              appendProgress(featureDir, `**Re-plan for task ${i + 1}: ${task.title}**\n- Verdict: ${replanResult.verdict}\n- Rationale: ${replanResult.rationale}`);
              console.log(`  ${c.cyan}↻ Re-plan: ${replanResult.verdict} — ${replanResult.tasks.length} task(s) injected${c.reset}\n`);
            } else {
              blocked++;
              console.log(`  ${c.red}✗ Blocked after ${maxRetries} attempts${c.reset}\n`);
              if (task.issueNumber) commentIssue(task.issueNumber, `Task blocked after ${maxRetries} attempts.`);
            }
          } else {
            blocked++;
            console.log(`  ${c.red}✗ Blocked after ${maxRetries} attempts${c.reset}\n`);
            if (task.issueNumber) commentIssue(task.issueNumber, `Task blocked after ${maxRetries} attempts.`);
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

  // Auto-push if there are commits to push
  try {
    const ahead = execSync("git rev-list --count @{u}..HEAD", { cwd, encoding: "utf8", shell: true, stdio: "pipe" }).trim();
    if (parseInt(ahead) > 0) {
      console.log(`${c.dim}Pushing ${ahead} commit(s)...${c.reset}`);
      execSync("git push", { cwd, shell: true, stdio: "pipe" });
      console.log(`${c.green}✓ Pushed${c.reset}`);
    }
  } catch { /* no upstream or push failed — not fatal */ }

  const duration = Math.round((Date.now() - startTime) / 1000);
  const durationStr = duration > 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`;

  // ── Completion report ──

  console.log(`${"═".repeat(50)}`);
  console.log(`${c.bold}Feature complete: ${featureName}${c.reset}`);
  console.log(`  ${c.green}✓${c.reset} ${completed}/${tasks.length} tasks done`);
  if (blocked > 0) console.log(`  ${c.red}✗${c.reset} ${blocked} blocked`);
  console.log(`  ${c.dim}Duration: ${durationStr}${c.reset}`);
  console.log(`${"═".repeat(50)}\n`);

  harness("notify", "--event", "feature-complete", "--msg",
    `Feature complete: ${featureName} — ${completed}/${tasks.length} done, ${blocked} blocked, ${durationStr}`);

  if (blocked > 0) {
    console.log(`${c.yellow}Blocked tasks need attention. Review and run again or fix manually.${c.reset}`);
    return "blocked";
  }
  return "done";
}
