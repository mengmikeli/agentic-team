// agt run — autonomous execution loop
// Dispatches agents, runs quality gates, manages state via harness.

import { execSync, spawnSync, execFileSync } from "child_process";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve, dirname } from "path";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import {
  c, getFlag, readState, writeState, generateNonce,
  WRITER_SIG, ALLOWED_TRANSITIONS,
} from "./util.mjs";

const __filename = fileURLToPath(import.meta.url);
const HARNESS = resolve(dirname(__filename), "..", "at-harness.mjs");

// ── Harness wrapper ─────────────────────────────────────────────

function harness(...args) {
  try {
    const result = execFileSync(process.execPath, [HARNESS, ...args], {
      encoding: "utf8",
      timeout: 180000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    try { return JSON.parse(result.trim()); } catch { return { raw: result.trim() }; }
  } catch (err) {
    const stdout = err.stdout?.toString() || "";
    try { return JSON.parse(stdout.trim()); } catch { return { ok: false, error: stdout || err.message }; }
  }
}

// ── Agent dispatch ──────────────────────────────────────────────

function findAgent() {
  // Try Claude Code first
  try {
    execSync("which claude 2>/dev/null || where claude 2>nul", { encoding: "utf8", stdio: "pipe" });
    return "claude";
  } catch {}
  // Try codex
  try {
    execSync("which codex 2>/dev/null || where codex 2>nul", { encoding: "utf8", stdio: "pipe" });
    return "codex";
  } catch {}
  return null;
}

function dispatchToAgent(agent, brief, cwd) {
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

function dispatchManual(brief) {
  console.log(`\n  ${c.yellow}No coding agent found (claude/codex).${c.reset}`);
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

function buildTaskBrief(task, featureName, gateCmd, cwd, failureContext) {
  let brief = `You are implementing a task for feature "${featureName}".

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
`;

  if (failureContext) {
    brief += `
## Previous Attempt Failed
The quality gate failed on the previous attempt. Here's the output:
\`\`\`
${failureContext.slice(0, 2000)}
\`\`\`
Fix the issues and try again.
`;
  }

  return brief;
}

// ── Main execution loop ─────────────────────────────────────────

export async function cmdRun(args) {
  const description = args.filter(a => !a.startsWith("-")).join(" ");
  const cwd = process.cwd();
  const teamDir = join(cwd, ".team");
  const maxRetries = parseInt(getFlag(args, "retries") || "3", 10);
  const dryRun = args.includes("--dry-run");

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
      process.exit(0);
    }

    // Check which features already exist
    const featuresDir = join(teamDir, "features");
    for (const item of items) {
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
      process.exit(0);
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
    const initResult = harness("init", "--feature", featureName, "--dir", join(teamDir, "features"));
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

  const tasks = planTasks(featureDescription, spec);
  console.log(`${c.green}✓${c.reset} Planned ${tasks.length} task(s)\n`);

  // Write tasks to state
  const state = readState(featureDir);
  if (state) {
    state.tasks = tasks;
    state.status = "executing";
    writeState(featureDir, state);
  }

  // Notify start
  harness("notify", "--event", "feature-started", "--msg",
    `▶ Feature: ${featureName} (${tasks.length} tasks planned)`);

  if (dryRun) {
    console.log(`${c.dim}Tasks:${c.reset}`);
    tasks.forEach((t, i) => console.log(`  ${i + 1}. ${t.title}`));
    console.log(`\n${c.yellow}Dry run complete. No tasks executed.${c.reset}`);
    return;
  }

  // ── Execute tasks ──

  let completed = 0;
  let blocked = 0;
  const startTime = Date.now();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    console.log(`${c.bold}▶ Task ${i + 1}/${tasks.length}:${c.reset} ${task.title}`);

    // Transition to in-progress
    harness("transition", "--task", task.id, "--status", "in-progress", "--dir", featureDir);
    harness("notify", "--event", "task-started", "--msg", `▶ Task ${i + 1}/${tasks.length}: ${task.title}`);

    let passed = false;
    let lastFailure = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      task.attempts = attempt;

      if (attempt > 1) {
        console.log(`  ${c.yellow}Retry ${attempt}/${maxRetries}${c.reset}`);
      }

      // Build task brief
      const brief = buildTaskBrief(task, featureName, gateCmd, cwd, lastFailure);

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
        break;
      }

      // Run quality gate
      console.log(`  ${c.dim}Running gate: ${gateCmd}${c.reset}`);
      const gateResult = harness("gate", "--cmd", gateCmd, "--dir", featureDir, "--task", task.id);

      if (gateResult.verdict === "PASS") {
        passed = true;
        harness("transition", "--task", task.id, "--status", "passed", "--dir", featureDir);
        harness("notify", "--event", "task-passed", "--msg", `✓ Task ${i + 1}/${tasks.length}: ${task.title}`);
        completed++;
        console.log(`  ${c.green}✓ Gate PASS${c.reset}\n`);
        break;
      } else {
        console.log(`  ${c.red}✗ Gate FAIL${c.reset} (exit ${gateResult.exitCode})`);
        if (gateResult.stderr) console.log(`  ${c.dim}${gateResult.stderr.slice(0, 500)}${c.reset}`);
        lastFailure = `Exit code: ${gateResult.exitCode}\nstdout: ${gateResult.stdout?.slice(0, 1000) || ""}\nstderr: ${gateResult.stderr?.slice(0, 1000) || ""}`;

        if (attempt === maxRetries) {
          harness("transition", "--task", task.id, "--status", "blocked",
            "--dir", featureDir, "--reason", `Failed after ${maxRetries} attempts`);
          harness("notify", "--event", "task-blocked", "--msg",
            `✗ Task ${i + 1}/${tasks.length}: ${task.title} — failed after ${maxRetries} attempts`);
          blocked++;
          console.log(`  ${c.red}✗ Blocked after ${maxRetries} attempts${c.reset}\n`);
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
    process.exit(1);
  }
}
