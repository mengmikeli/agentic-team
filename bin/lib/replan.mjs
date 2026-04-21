// Autonomous re-planning for blocked tasks.
// When a task exhausts retries, a re-plan agent decides: split, inject, or abandon.

/**
 * Build a brief for the re-plan agent describing the blocked task and context.
 *
 * @param {object} task            - The blocked task object
 * @param {string|null} failureContext - Gate/review failure output
 * @param {object[]} remainingTasks - Tasks that come after the blocked task
 * @param {string|null} specContent - Feature SPEC.md content
 * @param {string} featureName     - Name of the feature being executed
 * @returns {string} Markdown brief for the re-plan agent
 */
export function buildReplanBrief(task, failureContext, remainingTasks, specContent, featureName) {
  const remainingList = remainingTasks.length > 0
    ? remainingTasks.map((t, idx) => `${idx + 1}. ${t.title} [${t.status}]`).join("\n")
    : "(none)";

  return `# Re-planning Request: ${featureName}

A task has been blocked after exhausting all retries. Analyze the failure and decide the best recovery action.

## Blocked Task
**ID:** ${task.id}
**Title:** ${task.title}

## Failure Context
${failureContext || "No failure details available."}

## Remaining Tasks (after this one)
${remainingList}

## Feature Spec
${specContent || "No spec available."}

---

You are a re-planning agent. Decide one of three actions:

- **split**: Break the blocked task into 2-3 smaller, more achievable sub-tasks
- **inject**: Insert one prerequisite task before a retry of the original task
- **abandon**: Accept the block and continue with remaining tasks as-is

Respond with ONLY a JSON block in this exact format:

\`\`\`json
{
  "verdict": "split",
  "rationale": "Brief explanation of your decision",
  "tasks": [
    { "title": "First sub-task title", "description": "What to implement" },
    { "title": "Second sub-task title", "description": "What to implement" }
  ]
}
\`\`\`

For "abandon", tasks array should be empty [].
For "split", provide 2-3 replacement sub-tasks.
For "inject", provide exactly 1 prerequisite task (the original task will be retried after it).`;
}

/**
 * Parse re-plan agent output and extract the JSON verdict.
 *
 * @param {string|null} output - Raw agent output
 * @returns {{ verdict: string, rationale: string, tasks: object[] } | null}
 */
export function parseReplanOutput(output) {
  if (!output) return null;

  // Extract JSON from ```json...``` fenced block
  const match = output.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1].trim());

    if (!["split", "inject", "abandon"].includes(parsed.verdict)) return null;
    if (typeof parsed.rationale !== "string" || !parsed.rationale) return null;
    if (!Array.isArray(parsed.tasks)) return null;

    // Validate task counts per verdict
    if (parsed.verdict === "split" && (parsed.tasks.length < 2 || parsed.tasks.length > 3)) return null;
    if (parsed.verdict === "inject" && parsed.tasks.length !== 1) return null;

    // Validate task shapes
    for (const t of parsed.tasks) {
      if (typeof t.title !== "string" || !t.title) return null;
    }

    return {
      verdict: parsed.verdict,
      rationale: parsed.rationale,
      tasks: parsed.tasks,
    };
  } catch {
    return null;
  }
}

/**
 * Apply re-plan result by injecting new tasks into the task array (mutates in place).
 * Caps at one re-plan per task: tasks with `replan` set are skipped.
 *
 * @param {object[]} tasks       - The full tasks array (mutated in place)
 * @param {object} blockedTask   - The task that was blocked
 * @param {{ verdict: string, rationale: string, tasks: object[] }} replanResult
 */
export function applyReplan(tasks, blockedTask, replanResult) {
  if (!replanResult || replanResult.verdict === "abandon") return;

  const blockedIdx = tasks.indexOf(blockedTask);
  if (blockedIdx === -1) return;

  const baseId = blockedTask.id;

  if (replanResult.verdict === "split") {
    blockedTask.replan = "split";

    const newTasks = replanResult.tasks.map((t, idx) => ({
      id: `${baseId}-s${idx + 1}`,
      title: t.title,
      description: t.description || "",
      status: "pending",
      attempts: 0,
      replanSource: baseId,
    }));

    tasks.splice(blockedIdx + 1, 0, ...newTasks);
  } else if (replanResult.verdict === "inject") {
    blockedTask.replan = "inject";

    const prereq = replanResult.tasks[0];
    const prereqTask = {
      id: `${baseId}-p1`,
      title: prereq.title,
      description: prereq.description || "",
      status: "pending",
      attempts: 0,
      replanSource: baseId,
    };

    // Retry clone of the original blocked task with reset attempts
    const retryTask = {
      id: `${baseId}-r1`,
      title: blockedTask.title,
      description: blockedTask.description || "",
      status: "pending",
      attempts: 0,
      replanSource: baseId,
    };

    tasks.splice(blockedIdx + 1, 0, prereqTask, retryTask);
  }
}
