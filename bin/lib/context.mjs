// Context briefs — gather project context for reviewer dispatch.
// Reads SPEC.md, git log, project conventions, known TODOs/limitations.
// Injected into reviewer briefs so they review against intent, not assumptions.

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

/**
 * Build a context brief for a reviewer.
 * Gathers:
 *   - SPEC.md (design intent)
 *   - git log -10 (recent context)
 *   - Project conventions (from PROJECT.md or CLAUDE.md)
 *   - Known TODOs/limitations
 *
 * @param {string} featureDir - Path to the feature directory
 * @param {string} cwd - Project working directory
 * @returns {string} Context brief markdown
 */
export function buildContextBrief(featureDir, cwd) {
  const sections = [];

  // 1. Read SPEC.md (design intent)
  const specPath = join(featureDir, "SPEC.md");
  if (existsSync(specPath)) {
    try {
      const spec = readFileSync(specPath, "utf8").trim();
      if (spec) {
        sections.push(`## Design Intent (SPEC.md)\n${spec.slice(0, 2000)}`);
      }
    } catch {}
  }

  // 2. Recent git history
  try {
    const gitLog = execSync("git log --oneline -10", {
      cwd,
      encoding: "utf8",
      timeout: 5000,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (gitLog) {
      sections.push(`## Recent Git History\n\`\`\`\n${gitLog}\n\`\`\``);
    }
  } catch {}

  // 3. Project conventions
  const conventionPaths = [
    join(cwd, ".team", "PROJECT.md"),
    join(cwd, "CLAUDE.md"),
    join(cwd, ".claude", "CLAUDE.md"),
    join(cwd, "AGENTS.md"),
  ];

  for (const convPath of conventionPaths) {
    if (existsSync(convPath)) {
      try {
        const content = readFileSync(convPath, "utf8").trim();
        if (content) {
          const filename = convPath.split("/").pop();
          // Extract relevant sections (conventions, style, rules)
          const relevant = extractConventions(content);
          if (relevant) {
            sections.push(`## Project Conventions (${filename})\n${relevant.slice(0, 1500)}`);
          }
          break; // Use the first found
        }
      } catch {}
    }
  }

  // 4. Known TODOs/limitations
  const todoSources = [
    join(featureDir, "backlog.md"),
    join(featureDir, "progress.md"),
  ];

  for (const todoPath of todoSources) {
    if (existsSync(todoPath)) {
      try {
        const content = readFileSync(todoPath, "utf8").trim();
        if (content) {
          const filename = todoPath.split("/").pop();
          sections.push(`## Known Issues (${filename})\n${content.slice(0, 1000)}`);
        }
      } catch {}
    }
  }

  if (sections.length === 0) {
    return "## Context\nNo additional project context available.";
  }

  return `# Context Brief\n\n${sections.join("\n\n")}`;
}

/**
 * Extract convention-relevant sections from a project file.
 * Looks for headings about: conventions, style, rules, stack, quality.
 */
function extractConventions(content) {
  const lines = content.split("\n");
  const relevantKeywords = [
    "convention", "style", "rule", "stack", "quality", "gate",
    "test", "lint", "format", "build", "architecture", "pattern",
  ];

  const sections = [];
  let currentSection = null;
  let capturing = false;

  for (const line of lines) {
    // Check for heading
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      if (capturing && currentSection) {
        sections.push(currentSection);
      }
      const headingText = headingMatch[1].toLowerCase();
      capturing = relevantKeywords.some(kw => headingText.includes(kw));
      currentSection = capturing ? line + "\n" : null;
      continue;
    }

    if (capturing && currentSection) {
      currentSection += line + "\n";
    }
  }

  if (capturing && currentSection) {
    sections.push(currentSection);
  }

  return sections.join("\n").trim() || content.slice(0, 800);
}
