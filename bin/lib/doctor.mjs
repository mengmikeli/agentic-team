// agt doctor — health check for agentic-team setup
// Verifies Node.js, tools, project structure, and configuration.

import { existsSync, readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { execSync } from "child_process";
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
