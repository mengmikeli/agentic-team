// agt review — review code changes or a specific file/PR
// Dispatches a reviewer agent, uses synthesize for mechanical verdict.

import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { c } from "./util.mjs";
import { buildReviewBrief } from "./flows.mjs";
import { parseFindings, computeVerdict } from "./synthesize.mjs";
import { runCompoundGate } from "./compound-gate.mjs";
import { findAgent, dispatchToAgent } from "./run.mjs";
import { buildContextBrief } from "./context.mjs";

// ── Detect what to review ───────────────────────────────────────

function getGitDiff(cwd) {
  try {
    // Uncommitted changes (staged + unstaged)
    let diff = execSync("git diff HEAD", { cwd, encoding: "utf8", timeout: 10000, shell: true, stdio: ["pipe", "pipe", "pipe"] }).trim();
    if (!diff) {
      // Maybe everything is staged
      diff = execSync("git diff --cached", { cwd, encoding: "utf8", timeout: 10000, shell: true, stdio: ["pipe", "pipe", "pipe"] }).trim();
    }
    if (!diff) {
      // Last commit vs previous
      diff = execSync("git diff HEAD~1 HEAD", { cwd, encoding: "utf8", timeout: 10000, shell: true, stdio: ["pipe", "pipe", "pipe"] }).trim();
    }
    return diff;
  } catch {
    return null;
  }
}

function getGitLog(cwd, count = 10) {
  try {
    return execSync(`git log --oneline -${count}`, {
      cwd, encoding: "utf8", timeout: 5000, shell: true, stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function readFileContents(path, maxLen = 8000) {
  try {
    const content = readFileSync(path, "utf8");
    return content.slice(0, maxLen);
  } catch {
    return null;
  }
}

function readDirRecursive(dir, maxFiles = 20) {
  const files = [];
  function walk(d) {
    if (files.length >= maxFiles) return;
    try {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        if (files.length >= maxFiles) return;
        const full = join(d, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
          walk(full);
        } else {
          files.push(full);
        }
      }
    } catch {}
  }
  walk(dir);
  return files;
}

// ── Build review brief ──────────────────────────────────────────

function buildReviewContext(target, cwd) {
  const sections = [];

  // Git log for context
  const gitLog = getGitLog(cwd);
  if (gitLog) {
    sections.push(`## Recent Git History\n\`\`\`\n${gitLog}\n\`\`\``);
  }

  // Project conventions
  const conventionPaths = [
    join(cwd, ".team", "PROJECT.md"),
    join(cwd, "CLAUDE.md"),
    join(cwd, "AGENTS.md"),
  ];
  for (const p of conventionPaths) {
    if (existsSync(p)) {
      const content = readFileContents(p, 2000);
      if (content) {
        sections.push(`## Conventions (${p.split("/").pop()})\n${content}`);
        break;
      }
    }
  }

  // Feature context if .team/ exists
  const teamDir = join(cwd, ".team");
  if (existsSync(join(teamDir, "features"))) {
    try {
      const featureDir = join(teamDir, "features");
      const brief = buildContextBrief(featureDir, cwd);
      if (brief) sections.push(brief);
    } catch {}
  }

  return sections.join("\n\n");
}

function buildFullReviewBrief(target, diff, cwd) {
  const context = buildReviewContext(target, cwd);

  let reviewTarget;
  if (diff) {
    reviewTarget = `## Code to Review\n\`\`\`diff\n${diff.slice(0, 6000)}\n\`\`\``;
  } else if (target) {
    reviewTarget = `## Review Target\n${target}`;
  } else {
    reviewTarget = `## Review Target\nNo changes detected.`;
  }

  return `You are reviewing code changes. Analyze for correctness, security, performance, and maintainability.

## Working Directory
${cwd}

${reviewTarget}

${context}

## Required Output Format
Each finding MUST be on its own line using this exact format:
  <emoji> <file>:<line> — <fix suggestion>

Severity emoji:
  🔴 = critical (blocks merge — any red = FAIL)
  🟡 = warning  (should fix — yellow = PASS but flagged)
  🔵 = suggestion (optional improvement)

If there are no findings, write exactly: No findings.

At the end, write a brief summary paragraph with your overall assessment.`;
}

// ── Main command ────────────────────────────────────────────────

export async function cmdReview(args) {
  const cwd = process.cwd();
  const target = args.filter(a => !a.startsWith("-")).join(" ").trim();

  console.log(`\n${c.bold}${c.cyan}⚡ agt review${c.reset}\n`);

  // Find agent
  const agent = findAgent();
  if (!agent) {
    console.log(`${c.red}No coding agent found (claude/codex).${c.reset} Review requires an agent.`);
    process.exit(1);
  }
  console.log(`${c.bold}Agent:${c.reset}    ${c.green}${agent}${c.reset}`);

  // Determine what to review
  let diff = null;
  let reviewDescription;

  if (!target) {
    // Review uncommitted changes
    diff = getGitDiff(cwd);
    if (!diff) {
      console.log(`${c.yellow}No uncommitted changes found.${c.reset}`);
      return;
    }
    const lines = diff.split("\n").length;
    reviewDescription = `uncommitted changes (${lines} lines)`;
  } else if (existsSync(join(cwd, target))) {
    // Review specific file or directory
    const stat = statSync(join(cwd, target));
    if (stat.isDirectory()) {
      const files = readDirRecursive(join(cwd, target));
      diff = files.map(f => {
        const content = readFileContents(f, 2000);
        return content ? `--- ${f}\n${content}` : null;
      }).filter(Boolean).join("\n\n");
      reviewDescription = `directory: ${target} (${files.length} files)`;
    } else {
      diff = readFileContents(join(cwd, target));
      reviewDescription = `file: ${target}`;
    }
  } else {
    // Treat as a description
    reviewDescription = target;
  }

  console.log(`${c.bold}Reviewing:${c.reset} ${reviewDescription}\n`);

  // Build and dispatch
  const brief = buildFullReviewBrief(target, diff, cwd);
  console.log(`${c.dim}Dispatching reviewer...${c.reset}`);
  const result = dispatchToAgent(agent, brief, cwd);

  if (!result.ok) {
    console.log(`${c.red}Review failed: ${result.error}${c.reset}`);
    process.exit(1);
  }

  // Parse findings through synthesize
  const output = result.output || "";
  const findings = parseFindings(output);

  // Apply compound gate
  const gateResult = runCompoundGate(findings, cwd);
  if (gateResult.verdict === "FAIL") {
    findings.unshift({
      severity: "critical",
      text: `🔴 compound-gate.mjs:0 — Shallow review detected: ${gateResult.layers.join(", ")}`,
    });
  } else if (gateResult.verdict === "WARN") {
    findings.unshift({
      severity: "warning",
      text: `🟡 compound-gate.mjs:0 — Thin review warning: ${gateResult.layers.join(", ")}`,
    });
  }

  const verdict = computeVerdict(findings);

  // Print verdict
  console.log(`\n${"═".repeat(50)}`);
  if (verdict.verdict === "PASS") {
    console.log(`${c.green}${c.bold}✓ PASS${c.reset}`);
  } else {
    console.log(`${c.red}${c.bold}✗ FAIL${c.reset}`);
  }
  console.log(`  🔴 ${verdict.critical} critical  🟡 ${verdict.warning} warning  🔵 ${verdict.suggestion} suggestion`);
  console.log(`${"═".repeat(50)}\n`);

  // Print findings grouped by severity
  if (findings.length > 0) {
    const criticals = findings.filter(f => f.severity === "critical");
    const warnings = findings.filter(f => f.severity === "warning");
    const suggestions = findings.filter(f => f.severity === "suggestion");

    if (criticals.length) {
      console.log(`${c.red}${c.bold}Critical:${c.reset}`);
      criticals.forEach(f => console.log(`  ${f.text}`));
      console.log();
    }
    if (warnings.length) {
      console.log(`${c.yellow}${c.bold}Warnings:${c.reset}`);
      warnings.forEach(f => console.log(`  ${f.text}`));
      console.log();
    }
    if (suggestions.length) {
      console.log(`${c.blue}${c.bold}Suggestions:${c.reset}`);
      suggestions.forEach(f => console.log(`  ${f.text}`));
      console.log();
    }
  } else {
    console.log(`${c.green}No findings. Clean code!${c.reset}\n`);
  }

  // Print raw summary (last paragraph of output)
  const paragraphs = output.split("\n\n").filter(p => p.trim());
  if (paragraphs.length > 0) {
    const lastParagraph = paragraphs[paragraphs.length - 1].trim();
    if (lastParagraph && !lastParagraph.includes("🔴") && !lastParagraph.includes("🟡") && !lastParagraph.includes("🔵")) {
      console.log(`${c.dim}${lastParagraph.slice(0, 500)}${c.reset}\n`);
    }
  }
}
