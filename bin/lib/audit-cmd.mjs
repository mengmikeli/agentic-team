// agt audit — cross-project health check
// Reads .team/ structure, checks git status, feature state, stale tracking.

import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { c, readState, relativeTime } from "./util.mjs";

// ── Helpers ─────────────────────────────────────────────────────

function getGitStatus(cwd) {
  try {
    const status = execSync("git status --porcelain", {
      cwd, encoding: "utf8", timeout: 5000, shell: true, stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return status ? status.split("\n").length : 0;
  } catch {
    return -1; // git not available
  }
}

function getGitBranch(cwd) {
  try {
    return execSync("git branch --show-current", {
      cwd, encoding: "utf8", timeout: 5000, shell: true, stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function getUnpushedCommits(cwd) {
  try {
    const count = execSync("git rev-list --count @{u}..HEAD", {
      cwd, encoding: "utf8", timeout: 5000, shell: true, stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return parseInt(count) || 0;
  } catch {
    return 0;
  }
}

function getOpenPRCount(cwd) {
  try {
    const result = execSync("gh pr list --state open --json number 2>/dev/null", {
      cwd, encoding: "utf8", timeout: 10000, shell: true, stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const prs = JSON.parse(result);
    return prs.length;
  } catch {
    return -1; // gh not available
  }
}

// ── Feature audit ───────────────────────────────────────────────

function auditFeatures(teamDir) {
  const featuresDir = join(teamDir, "features");
  if (!existsSync(featuresDir)) return [];

  const results = [];
  try {
    const entries = readdirSync(featuresDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const featureDir = join(featuresDir, entry.name);
      const state = readState(featureDir);

      const feature = {
        name: entry.name,
        status: state?.status || "unknown",
        lastModified: state?._last_modified || null,
        issues: [],
      };

      // Check for stuck features (in-progress for too long)
      if (state?.status === "executing" || state?.status === "in-progress") {
        if (state._last_modified) {
          const age = Date.now() - new Date(state._last_modified).getTime();
          const hours = age / (1000 * 60 * 60);
          if (hours > 24) {
            feature.issues.push(`Stuck in ${state.status} for ${Math.floor(hours)}h`);
          }
        }
      }

      // Check for blocked tasks
      if (state?.tasks) {
        const blocked = state.tasks.filter(t => t.status === "blocked");
        if (blocked.length > 0) {
          feature.issues.push(`${blocked.length} blocked task(s)`);
        }
      }

      // Check for missing SPEC.md
      if (!existsSync(join(featureDir, "SPEC.md"))) {
        if (state?.status !== "completed") {
          feature.issues.push("Missing SPEC.md");
        }
      }

      // Check for stale progress.md
      const progressPath = join(featureDir, "progress.md");
      if (existsSync(progressPath)) {
        try {
          const stat = statSync(progressPath);
          const age = Date.now() - stat.mtimeMs;
          const days = age / (1000 * 60 * 60 * 24);
          if (days > 7 && state?.status !== "completed") {
            feature.issues.push(`progress.md stale (${Math.floor(days)}d)`);
          }
        } catch {}
      }

      results.push(feature);
    }
  } catch {}

  return results;
}

// ── Project audit ───────────────────────────────────────────────

function auditProject(cwd) {
  const teamDir = join(cwd, ".team");
  const report = {
    path: cwd,
    name: null,
    checks: [],
  };

  // Read project name
  const productPath = join(teamDir, "PRODUCT.md");
  if (existsSync(productPath)) {
    try {
      const content = readFileSync(productPath, "utf8");
      const nameMatch = content.match(/^#\s+(.+?)(?:\s*—|\n)/m);
      report.name = nameMatch ? nameMatch[1].trim() : null;
    } catch {}
  }

  // Check .team/ structure
  if (!existsSync(teamDir)) {
    report.checks.push({ icon: "❌", label: ".team/ directory", detail: "missing" });
    return report;
  }
  report.checks.push({ icon: "✅", label: ".team/ directory", detail: "present" });

  // Check required files
  const requiredFiles = ["PRODUCT.md", "PROJECT.md", "AGENTS.md"];
  for (const file of requiredFiles) {
    if (existsSync(join(teamDir, file))) {
      report.checks.push({ icon: "✅", label: file, detail: "present" });
    } else {
      report.checks.push({ icon: "❌", label: file, detail: "missing" });
    }
  }

  // Git status
  const uncommitted = getGitStatus(cwd);
  if (uncommitted === -1) {
    report.checks.push({ icon: "⚠️", label: "Git", detail: "not available" });
  } else if (uncommitted === 0) {
    report.checks.push({ icon: "✅", label: "Git", detail: "clean working tree" });
  } else {
    report.checks.push({ icon: "⚠️", label: "Git", detail: `${uncommitted} uncommitted change(s)` });
  }

  // Branch
  const branch = getGitBranch(cwd);
  if (branch) {
    report.checks.push({ icon: "✅", label: "Branch", detail: branch });
  }

  // Unpushed commits
  const unpushed = getUnpushedCommits(cwd);
  if (unpushed > 0) {
    report.checks.push({ icon: "⚠️", label: "Unpushed", detail: `${unpushed} commit(s)` });
  }

  // Open PRs
  const openPRs = getOpenPRCount(cwd);
  if (openPRs > 0) {
    report.checks.push({ icon: "⚠️", label: "Open PRs", detail: `${openPRs}` });
  } else if (openPRs === 0) {
    report.checks.push({ icon: "✅", label: "Open PRs", detail: "none" });
  }

  // Features
  const features = auditFeatures(teamDir);
  const completed = features.filter(f => f.status === "completed").length;
  const active = features.filter(f => f.status === "executing" || f.status === "in-progress").length;
  const blocked = features.filter(f => f.issues.length > 0).length;

  if (features.length > 0) {
    report.checks.push({
      icon: blocked > 0 ? "⚠️" : "✅",
      label: "Features",
      detail: `${features.length} total (${completed} done, ${active} active, ${blocked} with issues)`,
    });
  } else {
    report.checks.push({ icon: "✅", label: "Features", detail: "none tracked" });
  }

  report.features = features;
  return report;
}

// ── Print report ────────────────────────────────────────────────

function printReport(report) {
  const name = report.name || report.path;
  console.log(`\n${c.bold}${name}${c.reset}`);
  console.log(`${c.dim}${report.path}${c.reset}\n`);

  for (const check of report.checks) {
    console.log(`  ${check.icon} ${c.bold}${check.label}:${c.reset} ${check.detail}`);
  }

  // Print feature details if there are issues
  if (report.features) {
    const withIssues = report.features.filter(f => f.issues.length > 0);
    if (withIssues.length > 0) {
      console.log(`\n  ${c.yellow}${c.bold}Feature Issues:${c.reset}`);
      for (const feature of withIssues) {
        const statusIcon = feature.status === "completed" ? "✅" :
          feature.status === "executing" ? "🔄" :
          feature.status === "blocked" ? "🚫" : "❓";
        console.log(`    ${statusIcon} ${c.bold}${feature.name}${c.reset} (${feature.status})`);
        for (const issue of feature.issues) {
          console.log(`      ⚠️  ${issue}`);
        }
      }
    }
  }
}

// ── Main command ────────────────────────────────────────────────

export async function cmdAudit(args) {
  console.log(`\n${c.bold}${c.cyan}⚡ agt audit${c.reset}\n`);

  const cwd = process.cwd();
  const projects = [];

  // Check for PROJECTS.md (multi-project tracking)
  const projectsFile = join(cwd, "PROJECTS.md");
  if (existsSync(projectsFile)) {
    try {
      const content = readFileSync(projectsFile, "utf8");
      const pathMatches = [...content.matchAll(/^\s*[-*]\s*(?:\[.\]\s*)?`?([^\s`]+)`?\s/gm)];
      for (const m of pathMatches) {
        const p = resolve(cwd, m[1]);
        if (existsSync(join(p, ".team"))) {
          projects.push(p);
        }
      }
    } catch {}
  }

  // If no PROJECTS.md or no matches, audit current project
  if (projects.length === 0) {
    projects.push(cwd);
  }

  let totalIssues = 0;

  for (const projectPath of projects) {
    const report = auditProject(projectPath);
    printReport(report);

    const issues = report.checks.filter(ch => ch.icon === "❌" || ch.icon === "⚠️").length;
    if (report.features) {
      for (const f of report.features) {
        totalIssues += f.issues.length;
      }
    }
    totalIssues += issues;
  }

  // Summary
  console.log(`\n${"═".repeat(50)}`);
  if (totalIssues === 0) {
    console.log(`${c.green}${c.bold}All clear! No issues found.${c.reset}`);
  } else {
    console.log(`${c.yellow}${c.bold}${totalIssues} issue(s) found across ${projects.length} project(s).${c.reset}`);
  }
  console.log(`${"═".repeat(50)}\n`);
}
