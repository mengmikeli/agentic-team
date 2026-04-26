// agt doctor — health check for agentic-team setup
// Verifies Node.js, tools, project structure, and configuration.

import { existsSync, readFileSync, readdirSync } from "fs";
import { closeFeatureIssues } from "./state-sync.mjs";
import { resolve, dirname, join } from "path";
import { execSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { c } from "./util.mjs";

// ── Individual check functions (exported for testing) ───────────

/**
 * Check Node.js version is ≥18.
 * @returns {{ status: 'pass'|'warn'|'fail', message: string }}
 */
export function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.replace(/^v/, ""), 10);
  if (major >= 18) {
    return { status: "pass", message: `Node.js ${version} (≥18 required)` };
  }
  return { status: "fail", message: `Node.js ${version} — requires ≥18` };
}

/**
 * Check if agt-harness is available.
 */
export function checkHarness(execFn = execSync) {
  try {
    // Check if the harness binary exists relative to this package
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const harnessPath = join(__dirname, "..", "at-harness.mjs");
    if (existsSync(harnessPath)) {
      return { status: "pass", message: "agt-harness available" };
    }
  } catch { /* fall through */ }

  try {
    execFn("agt-harness --help", { stdio: "pipe", timeout: 5000 });
    return { status: "pass", message: "agt-harness available" };
  } catch {
    return { status: "fail", message: "agt-harness not found" };
  }
}

/**
 * Check gh CLI and auth status.
 */
export function checkGhCli(execFn = execSync) {
  let ghVersion;
  try {
    ghVersion = execFn("gh --version", { stdio: "pipe", timeout: 5000 })
      .toString().trim().split("\n")[0];
  } catch {
    return { status: "fail", message: "gh CLI not installed" };
  }

  // Extract version number
  const vMatch = ghVersion.match(/(\d+\.\d+\.\d+)/);
  const ver = vMatch ? `v${vMatch[1]}` : "unknown version";

  try {
    const authOut = execFn("gh auth status 2>&1", {
      stdio: "pipe",
      timeout: 5000,
      shell: true,
    }).toString().trim();
    const userMatch = authOut.match(/Logged in to .+ (?:as|account) (\S+)/);
    const user = userMatch ? userMatch[1] : "authenticated";
    return { status: "pass", message: `gh CLI ${ver} (authenticated as ${user})` };
  } catch (err) {
    // gh auth status exits non-zero when not authenticated, but
    // sometimes the info is in stderr which gets captured with 2>&1
    const out = err.stdout?.toString() || err.stderr?.toString() || "";
    const userMatch = out.match(/Logged in to .+ (?:as|account) (\S+)/);
    if (userMatch) {
      return { status: "pass", message: `gh CLI ${ver} (authenticated as ${userMatch[1]})` };
    }
    return { status: "warn", message: `gh CLI ${ver} (not authenticated)` };
  }
}

/**
 * Check for coding agent CLIs (claude, codex).
 */
export function checkCodingAgent(execFn = execSync) {
  const whichCmd = process.platform === "win32" ? "where" : "which";

  // Check for claude
  try {
    execFn(`${whichCmd} claude`, { stdio: "pipe", timeout: 5000 });
    return { status: "pass", message: "claude CLI available" };
  } catch { /* not found */ }

  // Check for codex
  try {
    execFn(`${whichCmd} codex`, { stdio: "pipe", timeout: 5000 });
    return { status: "pass", message: "codex CLI available" };
  } catch { /* not found */ }

  return { status: "fail", message: "No coding agent found (need claude or codex)" };
}

/**
 * Check for pew CLI (optional).
 */
export function checkPew(execFn = execSync) {
  const whichCmd = process.platform === "win32" ? "where" : "which";
  try {
    execFn(`${whichCmd} pew`, { stdio: "pipe", timeout: 5000 });
    return { status: "pass", message: "pew available" };
  } catch {
    return { status: "warn", message: "pew not installed (token tracking disabled)" };
  }
}

/**
 * Check if .team/ directory exists.
 */
export function checkTeamDir(cwd = process.cwd()) {
  const teamDir = resolve(cwd, ".team");
  if (existsSync(teamDir)) {
    return { status: "pass", message: ".team/ directory" };
  }
  return { status: "fail", message: ".team/ directory missing" };
}

/**
 * Check if a file exists in .team/.
 * @param {string} filename - e.g. "PRODUCT.md"
 * @param {boolean} required - if false, use warn instead of fail
 */
export function checkTeamFile(filename, required = true, cwd = process.cwd()) {
  const filePath = resolve(cwd, ".team", filename);
  if (existsSync(filePath)) {
    return { status: "pass", message: filename };
  }
  return {
    status: required ? "fail" : "warn",
    message: `${filename} missing`,
  };
}

/**
 * Check if PROJECT.md has a "## Quality Gate" section with a code block.
 */
export function checkQualityGate(cwd = process.cwd()) {
  const projectPath = resolve(cwd, ".team", "PROJECT.md");
  if (!existsSync(projectPath)) {
    return { status: "fail", message: "No quality gate configured (PROJECT.md missing)" };
  }

  try {
    const content = readFileSync(projectPath, "utf8");
    // Find "## Quality Gate" section
    const qgMatch = content.match(/^## Quality Gate\b/m);
    if (!qgMatch) {
      return { status: "fail", message: "No quality gate configured" };
    }

    // Check for a code block after the heading
    const afterHeading = content.slice(qgMatch.index);
    // Look for ``` before the next ## heading
    const nextSection = afterHeading.match(/\n## /);
    const section = nextSection
      ? afterHeading.slice(0, nextSection.index)
      : afterHeading;

    if (/```/.test(section)) {
      return { status: "pass", message: "Quality gate configured" };
    }
    return { status: "fail", message: "No quality gate configured (no code block found)" };
  } catch {
    return { status: "fail", message: "No quality gate configured (cannot read PROJECT.md)" };
  }
}

/**
 * Check if PROJECT.md has a "## Tracking" section with a project URL.
 */
export function checkProjectBoard(cwd = process.cwd()) {
  const projectPath = resolve(cwd, ".team", "PROJECT.md");
  if (!existsSync(projectPath)) {
    return { status: "fail", message: "GitHub Project board not configured (PROJECT.md missing)" };
  }

  try {
    const content = readFileSync(projectPath, "utf8");
    const trackMatch = content.match(/^## Tracking\b/m);
    if (!trackMatch) {
      return { status: "fail", message: "GitHub Project board not configured" };
    }

    const afterHeading = content.slice(trackMatch.index);
    const nextSection = afterHeading.match(/\n## /);
    const section = nextSection
      ? afterHeading.slice(0, nextSection.index)
      : afterHeading;

    // Look for a URL (github.com project link or any https URL)
    if (/https?:\/\/\S+/.test(section)) {
      return { status: "pass", message: "GitHub Project board configured" };
    }
    return { status: "fail", message: "GitHub Project board not configured (no URL found)" };
  } catch {
    return { status: "fail", message: "GitHub Project board not configured (cannot read PROJECT.md)" };
  }
}

// ── Main doctor command ─────────────────────────────────────────

export function cmdDoctor(args = []) {
  const cwd = process.cwd();

  // Phase-level checks
  if (args.includes("--fix")) {
    runAutoFix(cwd);
    return;
  }

  if (args.includes("--phase")) {
    const result = runPhaseChecks(cwd, {
      skipTests: args.includes("--skip-tests"),
      skipGitHub: args.includes("--skip-github"),
    });
    process.exit(result.ok ? 0 : 1);
  }

  console.log(`\n${c.bold}agt doctor${c.reset}\n`);

  const checks = [
    checkNodeVersion(),
    checkHarness(),
    checkGhCli(),
    checkCodingAgent(),
    checkPew(),
    checkTeamDir(cwd),
    checkTeamFile("PRODUCT.md", true, cwd),
    checkTeamFile("PROJECT.md", true, cwd),
    checkTeamFile("AGENTS.md", false, cwd),   // optional
    checkQualityGate(cwd),
    checkProjectBoard(cwd),
  ];

  let passed = 0;
  let warnings = 0;
  let errors = 0;

  for (const check of checks) {
    let icon, color;
    switch (check.status) {
      case "pass":
        icon = "✅";
        color = c.green;
        passed++;
        break;
      case "warn":
        icon = "⚠️";
        color = c.yellow;
        warnings++;
        break;
      case "fail":
        icon = "❌";
        color = c.red;
        errors++;
        break;
    }
    console.log(`${color}${icon} ${check.message}${c.reset}`);
  }

  const total = checks.length;
  console.log(
    `\n${c.bold}Health:${c.reset} ${passed}/${total} checks passed` +
    (warnings ? `, ${warnings} warning${warnings > 1 ? "s" : ""}` : "") +
    (errors ? `, ${errors} error${errors > 1 ? "s" : ""}` : "")
  );
  console.log();
}

// ── Phase-level integrity checks ────────────────────────────────


/**
 * Check roadmap integrity: no items marked Done with 0 tasks passed.
 */
export function checkRoadmapIntegrity(cwd = process.cwd()) {
  const productPath = join(cwd, ".team", "PRODUCT.md");
  if (!existsSync(productPath)) return { status: "warn", message: "No PRODUCT.md found" };
  
  const content = readFileSync(productPath, "utf8");
  const doneItems = [...content.matchAll(/(\d+)\.\s*\*\*(.+?)\*\*\s*[—-]\s*✅\s*Done/gm)];
  const featDir = join(cwd, ".team", "features");
  const fakes = [];

  for (const [, num, name] of doneItems) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    // Find matching feature dir
    if (!existsSync(featDir)) continue;
    for (const d of readdirSync(featDir, { withFileTypes: true })) {
      if (!d.isDirectory() || !d.name.includes(slug.slice(0, 15))) continue;
      const sp = join(featDir, d.name, "STATE.json");
      if (!existsSync(sp)) continue;
      try {
        const state = JSON.parse(readFileSync(sp, "utf8"));
        const passed = (state.tasks || []).filter(t => t.status === "passed").length;
        const total = (state.tasks || []).length;
        if (total > 0 && passed === 0) {
          fakes.push(`#${num} ${name} (0/${total} passed)`);
        }
      } catch {}
      break;
    }
  }

  if (fakes.length > 0) {
    return { status: "fail", message: `Roadmap has ${fakes.length} fake-done item(s): ${fakes.join("; ")}` };
  }
  return { status: "pass", message: `Roadmap integrity: ${doneItems.length} done items verified` };
}

/**
 * Check for stale executing features with no live process.
 */
export function checkStaleExecuting(cwd = process.cwd()) {
  const featDir = join(cwd, ".team", "features");
  if (!existsSync(featDir)) return { status: "pass", message: "No features to check" };

  const stale = [];
  for (const d of readdirSync(featDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const sp = join(featDir, d.name, "STATE.json");
    if (!existsSync(sp)) continue;
    try {
      const state = JSON.parse(readFileSync(sp, "utf8"));
      if (["active", "executing"].includes(state.status)) {
        stale.push(d.name);
      }
    } catch {}
  }

  if (stale.length === 0) return { status: "pass", message: "No stale executing features" };

  // Check if agt run is alive
  try {
    const result = spawnSync("pgrep", ["-f", "agt.mjs run"], { encoding: "utf8", timeout: 2000, stdio: ["pipe", "pipe", "pipe"] });
    if (result.status === 0 && result.stdout.trim()) {
      return { status: "pass", message: `${stale.length} executing feature(s) — agt run is alive` };
    }
  } catch {}

  return { status: "fail", message: `${stale.length} feature(s) stuck as executing with no agt process: ${stale.join(", ")}` };
}

/**
 * Check for orphaned GitHub issues (open issues for completed features).
 */
export function checkOrphanedIssues(cwd = process.cwd()) {
  try {
    const result = spawnSync("gh", ["issue", "list", "--state", "open", "--json", "number,title", "--limit", "50"],
      { encoding: "utf8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"], cwd });
    if (result.status !== 0) return { status: "warn", message: "Could not check GitHub issues (gh not available)" };
    
    const issues = JSON.parse(result.stdout);
    const featDir = join(cwd, ".team", "features");
    if (!existsSync(featDir)) return { status: "pass", message: `${issues.length} open issue(s)` };

    const orphaned = [];
    for (const issue of issues) {
      // Extract feature name from issue title: [feature-name] task title
      const match = issue.title.match(/^\[([^\]]+)\]/);
      if (!match) continue;
      const featName = match[1];
      const sp = join(featDir, featName, "STATE.json");
      if (!existsSync(sp)) continue;
      try {
        const state = JSON.parse(readFileSync(sp, "utf8"));
        if (state.status === "completed") {
          orphaned.push(`#${issue.number}`);
        }
      } catch {}
    }

    if (orphaned.length > 0) {
      return { status: "warn", message: `${orphaned.length} orphaned issue(s) for completed features: ${orphaned.join(", ")}` };
    }
    return { status: "pass", message: `${issues.length} open issue(s), none orphaned` };
  } catch {
    return { status: "warn", message: "Could not check GitHub issues" };
  }
}

/**
 * Check test suite passes.
 */
export function checkTests(cwd = process.cwd()) {
  try {
    const result = spawnSync("npm", ["test"], { encoding: "utf8", timeout: 120000, stdio: ["pipe", "pipe", "pipe"], cwd });
    const failMatch = (result.stdout || "").match(/ℹ fail (\d+)/);
    const passMatch = (result.stdout || "").match(/ℹ pass (\d+)/);
    const failures = failMatch ? parseInt(failMatch[1]) : -1;
    const passes = passMatch ? parseInt(passMatch[1]) : 0;
    
    if (result.status === 0 && failures === 0) {
      return { status: "pass", message: `Test suite: ${passes} tests passing` };
    }
    return { status: "fail", message: `Test suite: ${failures} failure(s) out of ${passes} tests` };
  } catch {
    return { status: "warn", message: "Could not run test suite" };
  }
}

/**
 * Run phase-level checks. Called by dogfood mode at phase boundaries.
 * Returns { passed, failed, warnings, checks }.
 */
/**
 * Check for duplicate feature dirs (slug mismatch).
 */
export function checkDuplicateFeatures(cwd = process.cwd()) {
  const featDir = join(cwd, ".team", "features");
  if (!existsSync(featDir)) return { status: "pass", message: "No features to check" };
  
  const dirs = readdirSync(featDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  const prefixes = new Map();
  const dupes = [];
  
  for (const d of dirs) {
    const prefix = d.slice(0, 20);
    if (prefixes.has(prefix)) {
      dupes.push(`${prefixes.get(prefix)} vs ${d}`);
    } else {
      prefixes.set(prefix, d);
    }
  }
  
  if (dupes.length > 0) {
    return { status: "warn", message: `${dupes.length} possible duplicate feature dir(s): ${dupes.join("; ")}` };
  }
  return { status: "pass", message: "No duplicate feature dirs" };
}

/**
 * Check for features that completed with 0 tasks.
 */
export function checkZeroTaskCompletions(cwd = process.cwd()) {
  const featDir = join(cwd, ".team", "features");
  if (!existsSync(featDir)) return { status: "pass", message: "No features to check" };
  
  const zeroTask = [];
  for (const d of readdirSync(featDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const sp = join(featDir, d.name, "STATE.json");
    if (!existsSync(sp)) continue;
    try {
      const state = JSON.parse(readFileSync(sp, "utf8"));
      if (state.status === "completed" && (state.tasks || []).length === 0) {
        zeroTask.push(d.name);
      }
    } catch {}
  }
  
  if (zeroTask.length > 0) {
    return { status: "fail", message: `${zeroTask.length} feature(s) completed with 0 tasks: ${zeroTask.join(", ")}` };
  }
  return { status: "pass", message: "No zero-task completions" };
}

/**
 * Auto-fix known issues. Called by dogfood mode or `agt doctor --fix`.
 */
export function runAutoFix(cwd = process.cwd()) {
  console.log(`\n${c.bold}Auto-Fix${c.reset}\n`);
  let fixed = 0;

  // Fix 1: Close orphaned issues for completed/failed features
  const featDir = join(cwd, ".team", "features");
  if (existsSync(featDir)) {
    for (const d of readdirSync(featDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const sp = join(featDir, d.name, "STATE.json");
      if (!existsSync(sp)) continue;
      try {
        const state = JSON.parse(readFileSync(sp, "utf8"));
        if (["completed", "failed"].includes(state.status)) {
          const openTasks = (state.tasks || []).filter(t => 
            t.issueNumber && !["passed", "blocked"].includes(t.status)
          );
          if (openTasks.length > 0) {
            const closed = closeFeatureIssues(join(featDir, d.name), `auto-fix: feature ${state.status}`);
            if (closed > 0) {
              console.log(`  ${c.green}\u2713${c.reset} Closed ${closed} orphaned issues for ${d.name}`);
              fixed += closed;
            }
          }
        }
      } catch {}
    }
  }

  // Fix 2: Revert fake-done roadmap items
  const productPath = join(cwd, ".team", "PRODUCT.md");
  if (existsSync(productPath)) {
    let product = readFileSync(productPath, "utf8");
    const re = /^(\d+)\.\s*\*\*(.+?)\*\*\s*[\u2014-]\s*\u2705\s*Done/gm;
    let match;
    while ((match = re.exec(product)) !== null) {
      const num = match[1];
      const name = match[2];
      // Check if genuinely done
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20);
      for (const d of readdirSync(featDir, { withFileTypes: true })) {
        if (!d.isDirectory() || !d.name.includes(slug)) continue;
        const sp = join(featDir, d.name, "STATE.json");
        if (!existsSync(sp)) break;
        const state = JSON.parse(readFileSync(sp, "utf8"));
        const passed = (state.tasks || []).filter(t => t.status === "passed").length;
        const total = (state.tasks || []).length;
        if (total > 0 && passed === 0) {
          // Fake done — but don't edit PRODUCT.md here, just report
          console.log(`  ${c.yellow}\u26a0${c.reset} Fake-done: #${num} ${name} (0/${total} passed) — revert manually`);
        }
        break;
      }
    }
  }

  if (fixed === 0) console.log(`  ${c.dim}Nothing to fix${c.reset}`);
  return fixed;
}

export function runPhaseChecks(cwd = process.cwd(), opts = {}) {
  console.log(`\n${c.bold}Phase Health Check${c.reset}\n`);

  const checks = [
    checkRoadmapIntegrity(cwd),
    checkStaleExecuting(cwd),
    checkDuplicateFeatures(cwd),
    checkZeroTaskCompletions(cwd),
    ...(opts.skipTests ? [] : [checkTests(cwd)]),
    ...(opts.skipGitHub ? [] : [checkOrphanedIssues(cwd)]),
  ];

  let passed = 0, warnings = 0, failed = 0;
  for (const check of checks) {
    const icon = check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
    const color = check.status === "pass" ? c.green : check.status === "warn" ? c.yellow : c.red;
    console.log(`${color}${icon} ${check.message}${c.reset}`);
    if (check.status === "pass") passed++;
    else if (check.status === "warn") warnings++;
    else failed++;
  }

  console.log(`\n${c.bold}Phase check:${c.reset} ${passed}/${checks.length} passed` +
    (warnings ? `, ${warnings} warning(s)` : "") +
    (failed ? `, ${failed} BLOCKING` : "") + "\n");

  return { passed, failed, warnings, checks, ok: failed === 0 };
}
