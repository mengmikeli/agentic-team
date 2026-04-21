// Tests for the autonomous re-planning module (bin/lib/replan.mjs)
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildReplanBrief, parseReplanOutput, applyReplan } from "../bin/lib/replan.mjs";

// ── parseReplanOutput ────────────────────────────────────────────

describe("parseReplanOutput", () => {
  it("parses valid split output", () => {
    const output = `Some analysis text.

\`\`\`json
{
  "verdict": "split",
  "rationale": "Task is too large",
  "tasks": [
    { "title": "Part A", "description": "Do part A" },
    { "title": "Part B", "description": "Do part B" }
  ]
}
\`\`\``;
    const result = parseReplanOutput(output);
    assert.ok(result);
    assert.equal(result.verdict, "split");
    assert.equal(result.rationale, "Task is too large");
    assert.equal(result.tasks.length, 2);
    assert.equal(result.tasks[0].title, "Part A");
  });

  it("parses valid inject output", () => {
    const output = `\`\`\`json
{
  "verdict": "inject",
  "rationale": "Needs a prerequisite",
  "tasks": [
    { "title": "Install dependency", "description": "Run npm install x" }
  ]
}
\`\`\``;
    const result = parseReplanOutput(output);
    assert.ok(result);
    assert.equal(result.verdict, "inject");
    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0].title, "Install dependency");
  });

  it("parses valid abandon output", () => {
    const output = `\`\`\`json
{
  "verdict": "abandon",
  "rationale": "Task is not feasible",
  "tasks": []
}
\`\`\``;
    const result = parseReplanOutput(output);
    assert.ok(result);
    assert.equal(result.verdict, "abandon");
    assert.equal(result.tasks.length, 0);
  });

  it("returns null for missing JSON block", () => {
    const result = parseReplanOutput("Just some text without a JSON block");
    assert.equal(result, null);
  });

  it("returns null for invalid verdict", () => {
    const output = `\`\`\`json
{
  "verdict": "retry",
  "rationale": "try again",
  "tasks": []
}
\`\`\``;
    assert.equal(parseReplanOutput(output), null);
  });

  it("returns null for split with too few tasks", () => {
    const output = `\`\`\`json
{
  "verdict": "split",
  "rationale": "Split it",
  "tasks": [{ "title": "Only one" }]
}
\`\`\``;
    assert.equal(parseReplanOutput(output), null);
  });

  it("returns null for split with too many tasks", () => {
    const output = `\`\`\`json
{
  "verdict": "split",
  "rationale": "Split it",
  "tasks": [
    { "title": "A" }, { "title": "B" }, { "title": "C" }, { "title": "D" }
  ]
}
\`\`\``;
    assert.equal(parseReplanOutput(output), null);
  });

  it("returns null for inject with wrong task count", () => {
    const output = `\`\`\`json
{
  "verdict": "inject",
  "rationale": "Inject two",
  "tasks": [{ "title": "A" }, { "title": "B" }]
}
\`\`\``;
    assert.equal(parseReplanOutput(output), null);
  });

  it("returns null for null input", () => {
    assert.equal(parseReplanOutput(null), null);
  });

  it("returns null for empty string", () => {
    assert.equal(parseReplanOutput(""), null);
  });

  it("returns null for task with missing title", () => {
    const output = `\`\`\`json
{
  "verdict": "inject",
  "rationale": "test",
  "tasks": [{ "description": "no title" }]
}
\`\`\``;
    assert.equal(parseReplanOutput(output), null);
  });
});

// ── buildReplanBrief ─────────────────────────────────────────────

describe("buildReplanBrief", () => {
  const task = { id: "task-3", title: "Add authentication" };
  const failureCtx = "Exit code: 1\nError: module not found";
  const remaining = [{ title: "Add tests", status: "pending" }];
  const spec = "# Feature: Auth\n- [ ] Add login\n- [ ] Add logout";
  const featureName = "auth-feature";

  it("includes feature name", () => {
    const brief = buildReplanBrief(task, failureCtx, remaining, spec, featureName);
    assert.ok(brief.includes(featureName));
  });

  it("includes task id and title", () => {
    const brief = buildReplanBrief(task, failureCtx, remaining, spec, featureName);
    assert.ok(brief.includes(task.id));
    assert.ok(brief.includes(task.title));
  });

  it("includes failure context", () => {
    const brief = buildReplanBrief(task, failureCtx, remaining, spec, featureName);
    assert.ok(brief.includes("module not found"));
  });

  it("includes remaining tasks", () => {
    const brief = buildReplanBrief(task, failureCtx, remaining, spec, featureName);
    assert.ok(brief.includes("Add tests"));
  });

  it("includes spec content", () => {
    const brief = buildReplanBrief(task, failureCtx, remaining, spec, featureName);
    assert.ok(brief.includes("Add login"));
  });

  it("handles null failure context gracefully", () => {
    const brief = buildReplanBrief(task, null, [], null, featureName);
    assert.ok(brief.includes("No failure details available."));
  });

  it("shows (none) for empty remaining tasks", () => {
    const brief = buildReplanBrief(task, null, [], null, featureName);
    assert.ok(brief.includes("(none)"));
  });
});

// ── applyReplan ──────────────────────────────────────────────────

describe("applyReplan", () => {
  function makeTask(id, title) {
    return { id, title, status: "pending", attempts: 0 };
  }

  it("split injects sub-tasks after blocked task", () => {
    const blockedTask = makeTask("task-2", "Build API");
    const tasks = [makeTask("task-1", "Setup"), blockedTask, makeTask("task-3", "Deploy")];

    applyReplan(tasks, blockedTask, {
      verdict: "split",
      rationale: "Too big",
      tasks: [
        { title: "Build routes", description: "REST endpoints" },
        { title: "Build models", description: "DB models" },
      ],
    });

    assert.equal(tasks.length, 5);
    assert.equal(tasks[0].id, "task-1");
    assert.equal(tasks[1].id, "task-2"); // original blocked
    assert.equal(tasks[2].id, "task-2-s1");
    assert.equal(tasks[3].id, "task-2-s2");
    assert.equal(tasks[4].id, "task-3");
  });

  it("split annotates blocked task with replan field", () => {
    const blockedTask = makeTask("task-1", "Do thing");
    const tasks = [blockedTask];

    applyReplan(tasks, blockedTask, {
      verdict: "split",
      rationale: "Split it",
      tasks: [{ title: "A" }, { title: "B" }],
    });

    assert.equal(blockedTask.replan, "split");
  });

  it("split sets replanSource on new tasks", () => {
    const blockedTask = makeTask("task-1", "Do thing");
    const tasks = [blockedTask];

    applyReplan(tasks, blockedTask, {
      verdict: "split",
      rationale: "Split it",
      tasks: [{ title: "A" }, { title: "B" }],
    });

    assert.equal(tasks[1].replanSource, "task-1");
    assert.equal(tasks[2].replanSource, "task-1");
  });

  it("inject inserts prereq and retry clone after blocked task", () => {
    const blockedTask = makeTask("task-2", "Build API");
    const tasks = [makeTask("task-1", "Setup"), blockedTask, makeTask("task-3", "Deploy")];

    applyReplan(tasks, blockedTask, {
      verdict: "inject",
      rationale: "Needs prereq",
      tasks: [{ title: "Install lib", description: "npm install x" }],
    });

    assert.equal(tasks.length, 5);
    assert.equal(tasks[2].id, "task-2-p1");
    assert.equal(tasks[2].title, "Install lib");
    assert.equal(tasks[3].id, "task-2-r1");
    assert.equal(tasks[3].title, "Build API");
    assert.equal(tasks[3].attempts, 0);
  });

  it("inject annotates blocked task with replan field", () => {
    const blockedTask = makeTask("task-1", "Do thing");
    const tasks = [blockedTask];

    applyReplan(tasks, blockedTask, {
      verdict: "inject",
      rationale: "Inject prereq",
      tasks: [{ title: "Prereq" }],
    });

    assert.equal(blockedTask.replan, "inject");
  });

  it("inject sets replanSource on new tasks", () => {
    const blockedTask = makeTask("task-2", "Do thing");
    const tasks = [blockedTask];

    applyReplan(tasks, blockedTask, {
      verdict: "inject",
      rationale: "Inject prereq",
      tasks: [{ title: "Prereq" }],
    });

    assert.equal(tasks[1].replanSource, "task-2");
    assert.equal(tasks[2].replanSource, "task-2");
  });

  it("new tasks from inject start with pending status and zero attempts", () => {
    const blockedTask = makeTask("task-1", "Do thing");
    blockedTask.attempts = 3;
    const tasks = [blockedTask];

    applyReplan(tasks, blockedTask, {
      verdict: "inject",
      rationale: "Inject prereq",
      tasks: [{ title: "Prereq" }],
    });

    assert.equal(tasks[1].status, "pending");
    assert.equal(tasks[1].attempts, 0);
    assert.equal(tasks[2].status, "pending");
    assert.equal(tasks[2].attempts, 0);
  });

  it("abandon leaves tasks unchanged", () => {
    const blockedTask = makeTask("task-1", "Do thing");
    const tasks = [blockedTask, makeTask("task-2", "Other")];
    const originalLength = tasks.length;

    applyReplan(tasks, blockedTask, {
      verdict: "abandon",
      rationale: "Not feasible",
      tasks: [],
    });

    assert.equal(tasks.length, originalLength);
    assert.equal(blockedTask.replan, undefined);
  });

  it("no-ops when replanResult is null", () => {
    const blockedTask = makeTask("task-1", "Do thing");
    const tasks = [blockedTask];

    applyReplan(tasks, blockedTask, null);
    assert.equal(tasks.length, 1);
  });

  it("no-ops when blocked task is not in tasks array", () => {
    const blockedTask = makeTask("task-99", "Ghost task");
    const tasks = [makeTask("task-1", "Real task")];

    applyReplan(tasks, blockedTask, {
      verdict: "split",
      rationale: "Split",
      tasks: [{ title: "A" }, { title: "B" }],
    });

    assert.equal(tasks.length, 1);
  });
});
