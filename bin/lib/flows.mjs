// Flow templates for agt run
// light-review: gate only
// build-verify: build + gate + review
// full-stack: brainstorm + build + multi-role review + gate

import { readFileSync } from "node:fs";
import { parseFindings, computeVerdict } from "./synthesize.mjs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRoleFile(role) {
  if (!role) return null;
  try {
    const slug = role.replace(/[^a-z0-9-]/g, "-");
    const filePath = resolve(__dirname, "../../roles", `${slug}.md`);
    return readFileSync(filePath, "utf8").trim();
  } catch (err) {
    console.warn(`[loadRoleFile] Could not load role file for "${role}": ${err.message}`);
    return null;
  }
}

export const FLOWS = {
  "light-review": {
    name: "light-review",
    label: "Light Review (gate only)",
    phases: ["implement", "gate"],
  },
  "build-verify": {
    name: "build-verify",
    label: "Build + Verify (build + gate + review)",
    phases: ["implement", "gate", "review", "simplicity-review"],
  },
  "full-stack": {
    name: "full-stack",
    label: "Full Stack (brainstorm + build + multi-role review + gate)",
    phases: ["brainstorm", "implement", "gate", "multi-review"],
  },
};

/**
 * Auto-select flow based on task count and description keywords.
 * - 6+ tasks or architectural keywords → full-stack
 * - 3-5 tasks or integration keywords  → build-verify
 * - otherwise                           → light-review
 */
export function selectFlow(description, tasks) {
  const desc = (description || "").toLowerCase();
  const taskCount = Array.isArray(tasks) ? tasks.length : 1;

  const fullStackKws = ["architecture", "brainstorm", "design system", "refactor", "migration", "redesign"];
  const buildVerifyKws = ["review", "audit", "verify", "integration", "authentication", "auth", "api"];

  if (fullStackKws.some(kw => desc.includes(kw)) || taskCount >= 6) {
    return FLOWS["full-stack"];
  }
  if (buildVerifyKws.some(kw => desc.includes(kw)) || taskCount >= 3) {
    return FLOWS["build-verify"];
  }
  return FLOWS["light-review"];
}

export function buildBrainstormBrief(featureName, description, cwd) {
  return `You are brainstorming the implementation approach for feature "${featureName}".

## Feature
${description}

## Working Directory
${cwd}

## Your Task
Analyze the requirements and produce a concise implementation plan:
1. Break down the work into specific, actionable sub-tasks
2. Identify key files to create or modify
3. Note any risks or dependencies
4. Suggest the implementation order

Output a concise markdown plan. Do NOT write any code yet.`;
}

export function buildReviewBrief(featureName, taskTitle, gateOutput, cwd, role) {
  const roleFileContent = loadRoleFile(role);
  const rolePrefix = roleFileContent
    ?? (role ? `You are acting as a ${role} reviewer.` : "You are doing a code review.");
  return `${rolePrefix}

Review the recent implementation for feature "${featureName}".

## Task That Was Implemented
${taskTitle}

## Working Directory
${cwd}

## Gate Output
\`\`\`
${(gateOutput || "Gate passed").slice(0, 2000)}
\`\`\`

## Your Approach

1. **Read the builder's handshake** at \`.team/features/${featureName}/tasks/*/handshake.json\`
   - What did the builder claim to build?
   - What artifacts did they list?
2. **Verify claims against evidence**
   - Do the artifact files actually exist?
   - Read \`tasks/*/artifacts/test-output.txt\` — does the test output match the claimed status?
   - Check the code: does it actually implement what was claimed?
3. **Write structured findings** using the format below

## Review Focus
${getRoleFocus(role)}

## Required Output Format
Each finding MUST be on its own line using this exact format:
  <emoji> <file>:<line> — <fix suggestion>

Severity emoji:
  🔴 = critical (blocks merge — any red = FAIL)
  🟡 = warning  (must go to backlog — yellow = PASS but flagged)
  🔵 = suggestion (optional improvement — no backlog impact)

Examples:
  🔴 bin/lib/run.mjs:42 — Missing input validation; add sanitize() before use
  🟡 bin/lib/util.mjs:15 — Error not caught; wrap in try/catch
  🔵 bin/lib/flows.mjs:7 — Consider extracting constant to module scope

If there are no findings, write exactly: No findings.

## Write Evaluation
Write your detailed evaluation to: \`.team/features/${featureName}/tasks/*/eval.md\`

The eval.md must include:
- Overall verdict (PASS, ITERATE, or FAIL)
- Per-criterion results with evidence
- Specific, actionable feedback

## Anti-Rationalization

| You're tempted to say | Reality | Do this instead |
|---|---|---|
| "Code looks correct" | You didn't run it — you're guessing | Cite the specific logic path that proves correctness |
| "No major issues found" | You probably only checked the happy path | List edge cases you checked, or admit you didn't |
| "Reviewed all files" | Did you? | List only files you actually opened and read |
| "Should work now" / "Looks fixed" | You didn't re-test after the fix | Run the actual verification command and paste the output |
| "I'll rubber-stamp it" | That defeats the entire system | If you can't reproduce it, it FAILS |

## Calibration
A criterion PASSES only when you have direct evidence it works. If you cannot reproduce the expected behavior, it FAILS. If something barely works but would frustrate a real user, that's a FAIL.`;
}

function getRoleFocus(role) {
  switch (role) {
    case "architect":   return "Code structure, design patterns, modularity, and long-term maintainability.";
    case "engineer":    return "Implementation correctness, code quality, error handling, and performance.";
    case "product":     return "Whether the implementation matches the intended requirements and delivers user value.";
    case "tester":      return "Test coverage, edge cases, failure modes, and testability of the implementation.";
    case "security":    return "Security vulnerabilities, input validation, error handling, and safe defaults.";
    case "simplicity":  return "Unnecessary complexity, over-engineering, cognitive load, and deletability.";
    case "pm":          return "Whether the implementation matches the intended requirements and delivers user value.";
    case "devil's-advocate": return "Challenge assumptions, identify edge cases, surface hidden risks, and find what could go wrong.";
    default:            return "Overall code quality, correctness, and adherence to project conventions.";
  }
}

// Roles dispatched in parallel for the multi-review phase
export const PARALLEL_REVIEW_ROLES = ["architect", "engineer", "product", "tester", "security", "simplicity"];

/**
 * Merge findings from parallel reviewers into a single markdown report.
 * @param {Array<{role: string, ok: boolean, output: string}>} findings
 * @returns {string}
 */
export function mergeReviewFindings(findings) {
  const SEVERITY_ORDER = { critical: 0, warning: 1, suggestion: 2 };

  // Collect all findings with role prefix, tagged by severity
  const allFindings = [];
  for (const f of findings) {
    const parsed = parseFindings(f.output || "");
    for (const p of parsed) {
      // Format: 🔴 [role] file:line — … (emoji anchors severity at line-start)
      const prefixedText = f.role === "simplicity"
        ? tagSimplicityFinding(p)
        : tagFindingWithLabel(p, f.role);
      allFindings.push({ severity: p.severity, text: prefixedText });
    }
  }

  // Sort: critical → warning → suggestion
  allFindings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const lines = allFindings.map(f => f.text);
  const body = lines.length > 0 ? lines.join("\n") : "_No findings._";
  return `## Parallel Review Findings\n\n${body}`;
}

/**
 * Tag a finding text with [label], preserving any leading severity emoji.
 * @param {{text: string}} finding
 * @param {string} label
 * @returns {string}
 */
function tagFindingWithLabel(finding, label) {
  const emojiRe = /^([🔴🟡🔵])\s*/u;
  const m = finding.text.match(emojiRe);
  return m
    ? `${m[1]} [${label}] ${finding.text.slice(m[0].length)}`
    : `[${label}] ${finding.text}`;
}

/**
 * Tag a finding text with [simplicity veto] (critical) or [simplicity] (other).
 * Preserves leading severity emoji so downstream parsers still detect severity.
 * @param {{severity: string, text: string}} finding
 * @returns {string}
 */
export function tagSimplicityFinding(finding) {
  const label = finding.severity === "critical" ? "simplicity veto" : "simplicity";
  return tagFindingWithLabel(finding, label);
}

/**
 * Evaluate simplicity-review agent output.
 * Returns { verdict: "FAIL"|"PASS"|"SKIP", critical, warning, suggestion, findings }
 * "SKIP" means the agent produced no output — distinct from a clean PASS.
 * @param {string|null|undefined} output
 */
export function evaluateSimplicityOutput(output) {
  if (!output) {
    return { verdict: "SKIP", critical: 0, warning: 0, suggestion: 0, findings: [] };
  }
  const findings = parseFindings(output);
  const synth = computeVerdict(findings);
  return { verdict: synth.verdict, critical: synth.critical, warning: synth.warning, suggestion: synth.suggestion, findings };
}
