// Flow templates for agt run
// light-review: gate only
// build-verify: build + gate + review
// full-stack: brainstorm + build + multi-role review + gate

export const FLOWS = {
  "light-review": {
    name: "light-review",
    label: "Light Review (gate only)",
    phases: ["implement", "gate"],
  },
  "build-verify": {
    name: "build-verify",
    label: "Build + Verify (build + gate + review)",
    phases: ["implement", "gate", "review"],
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
  const rolePrefix = role ? `You are acting as a ${role} reviewer.` : "You are doing a code review.";
  return `${rolePrefix} Review the recent implementation for feature "${featureName}".

## Task That Was Implemented
${taskTitle}

## Working Directory
${cwd}

## Gate Output
\`\`\`
${(gateOutput || "Gate passed").slice(0, 1000)}
\`\`\`

## Review Focus
${getRoleFocus(role)}

Provide concise feedback. If there are blocking issues, describe them clearly. Otherwise, confirm the implementation looks good.`;
}

function getRoleFocus(role) {
  switch (role) {
    case "architect": return "Code structure, design patterns, modularity, and long-term maintainability.";
    case "security":  return "Security vulnerabilities, input validation, error handling, and safe defaults.";
    case "pm":        return "Whether the implementation matches the intended requirements and delivers user value.";
    default:          return "Overall code quality, correctness, and adherence to project conventions.";
  }
}
