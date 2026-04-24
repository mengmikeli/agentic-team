// Tests for bin/lib/flows.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FLOWS, selectFlow, buildBrainstormBrief, buildReviewBrief, PARALLEL_REVIEW_ROLES, mergeReviewFindings } from "../bin/lib/flows.mjs";

describe("FLOWS", () => {
  it("defines light-review with gate only", () => {
    assert.ok(FLOWS["light-review"]);
    assert.deepEqual(FLOWS["light-review"].phases, ["implement", "gate"]);
  });

  it("defines build-verify with review phase", () => {
    assert.ok(FLOWS["build-verify"]);
    assert.ok(FLOWS["build-verify"].phases.includes("review"));
    assert.ok(FLOWS["build-verify"].phases.includes("gate"));
  });

  it("defines full-stack with brainstorm and multi-review", () => {
    assert.ok(FLOWS["full-stack"]);
    assert.ok(FLOWS["full-stack"].phases.includes("brainstorm"));
    assert.ok(FLOWS["full-stack"].phases.includes("multi-review"));
    assert.ok(FLOWS["full-stack"].phases.includes("gate"));
  });
});

describe("selectFlow", () => {
  it("returns light-review for simple 1-task feature", () => {
    const tasks = [{ id: "task-1", title: "Add button", status: "pending" }];
    const flow = selectFlow("Add a button to the header", tasks);
    assert.equal(flow.name, "light-review");
  });

  it("returns light-review for 2-task simple feature", () => {
    const tasks = [
      { id: "task-1", title: "a", status: "pending" },
      { id: "task-2", title: "b", status: "pending" },
    ];
    const flow = selectFlow("Update styling", tasks);
    assert.equal(flow.name, "light-review");
  });

  it("returns build-verify for 3+ tasks", () => {
    const tasks = Array.from({ length: 3 }, (_, i) => ({
      id: `task-${i + 1}`, title: `Task ${i + 1}`, status: "pending",
    }));
    const flow = selectFlow("Add feature X", tasks);
    assert.equal(flow.name, "build-verify");
  });

  it("returns build-verify for 5 tasks", () => {
    const tasks = Array.from({ length: 5 }, (_, i) => ({
      id: `task-${i + 1}`, title: `Task ${i + 1}`, status: "pending",
    }));
    const flow = selectFlow("Build API endpoint", tasks);
    assert.equal(flow.name, "build-verify");
  });

  it("returns full-stack for 6+ tasks", () => {
    const tasks = Array.from({ length: 6 }, (_, i) => ({
      id: `task-${i + 1}`, title: `Task ${i + 1}`, status: "pending",
    }));
    const flow = selectFlow("Large feature", tasks);
    assert.equal(flow.name, "full-stack");
  });

  it("returns build-verify when description includes 'review'", () => {
    const tasks = [{ id: "task-1", title: "Review code", status: "pending" }];
    const flow = selectFlow("review the authentication module", tasks);
    assert.equal(flow.name, "build-verify");
  });

  it("returns build-verify when description includes 'api'", () => {
    const tasks = [{ id: "task-1", title: "Build API", status: "pending" }];
    const flow = selectFlow("add api endpoint for users", tasks);
    assert.equal(flow.name, "build-verify");
  });

  it("returns full-stack when description includes 'architecture'", () => {
    const tasks = [{ id: "task-1", title: "Redesign", status: "pending" }];
    const flow = selectFlow("architecture redesign of the core module", tasks);
    assert.equal(flow.name, "full-stack");
  });

  it("returns full-stack when description includes 'refactor'", () => {
    const tasks = [{ id: "task-1", title: "Refactor", status: "pending" }];
    const flow = selectFlow("refactor the data layer", tasks);
    assert.equal(flow.name, "full-stack");
  });

  it("handles null/empty description gracefully", () => {
    const tasks = [{ id: "task-1", title: "Do something", status: "pending" }];
    const flow = selectFlow(null, tasks);
    assert.equal(flow.name, "light-review");
  });

  it("handles empty task array gracefully", () => {
    const flow = selectFlow("simple fix", []);
    assert.equal(flow.name, "light-review");
  });

  it("returns full-stack for 'migration' keyword", () => {
    const tasks = [{ id: "task-1", title: "Migrate", status: "pending" }];
    const flow = selectFlow("database migration to new schema", tasks);
    assert.equal(flow.name, "full-stack");
  });
});

describe("buildBrainstormBrief", () => {
  it("includes feature name and description", () => {
    const brief = buildBrainstormBrief("my-feature", "Build a login form", "/home/project");
    assert.ok(brief.includes("my-feature"));
    assert.ok(brief.includes("Build a login form"));
    assert.ok(brief.includes("/home/project"));
  });

  it("instructs not to write code yet", () => {
    const brief = buildBrainstormBrief("feat", "desc", "/cwd");
    assert.ok(brief.toLowerCase().includes("not") && brief.toLowerCase().includes("code"));
  });
});

describe("buildReviewBrief", () => {
  it("includes feature name and task title", () => {
    const brief = buildReviewBrief("my-feature", "Add auth", "Gate passed", "/cwd", null);
    assert.ok(brief.includes("my-feature"));
    assert.ok(brief.includes("Add auth"));
  });

  it("includes role-specific focus for architect", () => {
    const brief = buildReviewBrief("feat", "task", "ok", "/cwd", "architect");
    assert.ok(brief.toLowerCase().includes("architect"));
    assert.ok(brief.includes("maintainability") || brief.includes("structure"));
  });

  it("includes role-specific focus for security", () => {
    const brief = buildReviewBrief("feat", "task", "ok", "/cwd", "security");
    assert.ok(brief.toLowerCase().includes("security"));
    assert.ok(brief.includes("vulnerabilities") || brief.includes("validation"));
  });

  it("includes role-specific focus for pm", () => {
    const brief = buildReviewBrief("feat", "task", "ok", "/cwd", "pm");
    assert.ok(brief.toLowerCase().includes("pm") || brief.toLowerCase().includes("requirements"));
  });

  it("works without a role (generic review)", () => {
    const brief = buildReviewBrief("feat", "task", "ok", "/cwd", null);
    assert.ok(brief.includes("code review") || brief.includes("code quality"));
  });

  it("handles null gate output", () => {
    const brief = buildReviewBrief("feat", "task", null, "/cwd", null);
    assert.ok(brief.includes("Gate passed"));
  });
});

describe("PARALLEL_REVIEW_ROLES", () => {
  it("is an array with 6 roles", () => {
    assert.ok(Array.isArray(PARALLEL_REVIEW_ROLES));
    assert.ok(PARALLEL_REVIEW_ROLES.length === 6);
  });

  it("includes security and architect", () => {
    assert.ok(PARALLEL_REVIEW_ROLES.includes("security"));
    assert.ok(PARALLEL_REVIEW_ROLES.includes("architect"));
  });

  it("includes engineer, product, tester, and simplicity", () => {
    assert.ok(PARALLEL_REVIEW_ROLES.includes("engineer"));
    assert.ok(PARALLEL_REVIEW_ROLES.includes("product"));
    assert.ok(PARALLEL_REVIEW_ROLES.includes("tester"));
    assert.ok(PARALLEL_REVIEW_ROLES.includes("simplicity"));
  });
});

describe("mergeReviewFindings", () => {
  it("combines findings from multiple roles into a single report", () => {
    const findings = [
      { role: "security", ok: true, output: "No issues found." },
      { role: "architect", ok: true, output: "Structure looks good." },
      { role: "devil's-advocate", ok: true, output: "Consider edge case X." },
    ];
    const merged = mergeReviewFindings(findings);
    assert.ok(merged.includes("security"));
    assert.ok(merged.includes("architect"));
    assert.ok(merged.includes("devil's-advocate"));
    assert.ok(merged.includes("No issues found."));
    assert.ok(merged.includes("Structure looks good."));
    assert.ok(merged.includes("Consider edge case X."));
  });

  it("handles empty output gracefully", () => {
    const findings = [
      { role: "security", ok: false, output: "" },
    ];
    const merged = mergeReviewFindings(findings);
    assert.ok(merged.includes("security"));
    assert.ok(merged.includes("No output"));
  });

  it("returns a string with a heading", () => {
    const findings = [{ role: "architect", ok: true, output: "Looks good." }];
    const merged = mergeReviewFindings(findings);
    assert.ok(typeof merged === "string");
    assert.ok(merged.length > 0);
  });
});

describe("buildReviewBrief — devil's-advocate role", () => {
  it("includes devil's-advocate focus on risks and edge cases", () => {
    const brief = buildReviewBrief("feat", "task", "ok", "/cwd", "devil's-advocate");
    assert.ok(brief.toLowerCase().includes("risk") || brief.toLowerCase().includes("edge case") || brief.toLowerCase().includes("wrong"));
  });
});
