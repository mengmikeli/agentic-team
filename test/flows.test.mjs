// Tests for bin/lib/flows.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FLOWS, selectFlow, buildBrainstormBrief, buildReviewBrief, PARALLEL_REVIEW_ROLES, mergeReviewFindings } from "../bin/lib/flows.mjs";
import { parseFindings, computeVerdict } from "../bin/lib/synthesize.mjs";

describe("FLOWS", () => {
  it("defines light-review with gate only", () => {
    assert.ok(FLOWS["light-review"]);
    assert.deepEqual(FLOWS["light-review"].phases, ["implement", "gate"]);
  });

  it("defines build-verify with parallel multi-review phase", () => {
    assert.ok(FLOWS["build-verify"]);
    assert.ok(FLOWS["build-verify"].phases.includes("multi-review"));
    assert.ok(FLOWS["build-verify"].phases.includes("gate"));
    assert.deepEqual(FLOWS["build-verify"].phases, ["implement", "gate", "multi-review"]);
  });

  it("build-verify dispatches 6 parallel reviews matching PARALLEL_REVIEW_ROLES", () => {
    // build-verify uses "multi-review" phase which dispatches one review per role in PARALLEL_REVIEW_ROLES
    assert.ok(FLOWS["build-verify"].phases.includes("multi-review"));
    assert.equal(PARALLEL_REVIEW_ROLES.length, 6);
    // Smoke-test merge over all 6 roles
    const findings = PARALLEL_REVIEW_ROLES.map((role, i) => ({
      role, ok: true, output: `🟡 file-${i}.mjs:${i + 1} — note from ${role}`,
    }));
    const merged = mergeReviewFindings(findings);
    for (const role of PARALLEL_REVIEW_ROLES) {
      assert.ok(merged.includes(`[${role}]`), `merged report should include [${role}]`);
    }
    assert.ok(merged.includes("## Parallel Review Findings"));
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
    // unique to roles/architect.md — not present in getRoleFocus() fallback
    assert.ok(
      brief.toLowerCase().includes("loosely coupled") || brief.toLowerCase().includes("over-architect") || brief.toLowerCase().includes("scalability"),
      "Expected role file content unique to architect.md to be injected"
    );
  });

  it("includes role-specific focus for security", () => {
    const brief = buildReviewBrief("feat", "task", "ok", "/cwd", "security");
    assert.ok(brief.toLowerCase().includes("security"));
    assert.ok(brief.includes("vulnerabilities") || brief.includes("validation"));
    // unique to roles/security.md — not present in getRoleFocus() fallback
    assert.ok(
      brief.toLowerCase().includes("threat modeling") || brief.toLowerCase().includes("adversaries") || brief.toLowerCase().includes("xss"),
      "Expected role file content unique to security.md to be injected"
    );
  });

  it("includes role-specific focus for pm", () => {
    const brief = buildReviewBrief("feat", "task", "ok", "/cwd", "pm");
    assert.ok(brief.toLowerCase().includes("pm") || brief.toLowerCase().includes("requirements"));
    // unique to roles/pm.md — not present in getRoleFocus() fallback
    assert.ok(
      brief.toLowerCase().includes("scope creep") || brief.toLowerCase().includes("acceptance criteria") || brief.toLowerCase().includes("sprint"),
      "Expected role file content unique to pm.md to be injected"
    );
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
      { role: "security", ok: true, output: "🔴 auth.mjs:10 — use bcrypt" },
      { role: "architect", ok: true, output: "🟡 api.mjs:5 — add retry" },
      { role: "tester", ok: true, output: "🔵 util.mjs:3 — add test" },
    ];
    const merged = mergeReviewFindings(findings);
    assert.ok(merged.includes("[security]"));
    assert.ok(merged.includes("[architect]"));
    assert.ok(merged.includes("[tester]"));
    assert.ok(merged.includes("use bcrypt"));
    assert.ok(merged.includes("add retry"));
    assert.ok(merged.includes("add test"));
  });

  it("sorts findings: critical before warning before suggestion", () => {
    const findings = [
      { role: "tester",    ok: true, output: "🔵 a.mjs:1 — suggestion" },
      { role: "security",  ok: true, output: "🟡 b.mjs:2 — warning" },
      { role: "architect", ok: true, output: "🔴 c.mjs:3 — critical" },
    ];
    const merged = mergeReviewFindings(findings);
    const criticalIdx  = merged.indexOf("🔴");
    const warningIdx   = merged.indexOf("🟡");
    const suggestionIdx = merged.indexOf("🔵");
    assert.ok(criticalIdx < warningIdx, "critical should appear before warning");
    assert.ok(warningIdx < suggestionIdx, "warning should appear before suggestion");
  });

  it("prefixes each finding with the role name", () => {
    const findings = [
      { role: "engineer", ok: true, output: "🔴 x.mjs:1 — fix this" },
    ];
    const merged = mergeReviewFindings(findings);
    assert.ok(merged.includes("🔴 [engineer]"), "finding line should have emoji then [role]");
  });

  it("handles empty output gracefully", () => {
    const findings = [
      { role: "security", ok: false, output: "" },
    ];
    const merged = mergeReviewFindings(findings);
    assert.ok(merged.includes("_No findings._"));
  });

  it("returns a string with a heading", () => {
    const findings = [{ role: "architect", ok: true, output: "Looks good." }];
    const merged = mergeReviewFindings(findings);
    assert.ok(typeof merged === "string");
    assert.ok(merged.includes("## Parallel Review Findings"));
  });

  it("labels simplicity 🔴 as [simplicity veto]", () => {
    const findings = [
      { role: "simplicity", ok: false, output: "🔴 lib/util.mjs:10 — dead code: unused helper" },
    ];
    const merged = mergeReviewFindings(findings);
    assert.ok(merged.includes("[simplicity veto]"), "critical simplicity finding must be labeled [simplicity veto]");
  });

  it("labels simplicity 🟡 as plain [simplicity] (not veto)", () => {
    const findings = [
      { role: "simplicity", ok: true, output: "🟡 lib/util.mjs:20 — consider simplifying" },
    ];
    const merged = mergeReviewFindings(findings);
    assert.ok(merged.includes("[simplicity]"), "warning simplicity finding should be plain [simplicity]");
    assert.ok(!merged.includes("[simplicity veto]"), "warning must not be labeled [simplicity veto]");
    const result = computeVerdict(parseFindings(merged));
    assert.equal(result.verdict, "PASS", "simplicity 🟡 must not block merge");
    assert.equal(result.backlog, true, "simplicity 🟡 must appear in backlog");
  });

  it("labels simplicity 🔵 as plain [simplicity] (not veto)", () => {
    const findings = [
      { role: "simplicity", ok: true, output: "🔵 lib/util.mjs:30 — minor style suggestion" },
    ];
    const merged = mergeReviewFindings(findings);
    assert.ok(merged.includes("[simplicity]"), "suggestion simplicity finding should be plain [simplicity]");
    assert.ok(!merged.includes("[simplicity veto]"), "suggestion must not be labeled [simplicity veto]");
  });

  it("simplicity 🔴 causes FAIL even when all other roles pass with no criticals", () => {
    const findings = [
      { role: "architect",  ok: true, output: "🔵 a.mjs:1 — minor suggestion" },
      { role: "engineer",   ok: true, output: "No findings." },
      { role: "simplicity", ok: true,  output: "🔴 lib/unused.mjs:5 — dead code: remove unused export" },
    ];
    const allText = findings.map(f => f.output || "").join("\n");
    const parsed = parseFindings(allText);
    const result = computeVerdict(parsed);
    assert.equal(result.verdict, "FAIL", "any 🔴 finding (including simplicity veto) must produce FAIL verdict");
  });

  it("starts with a synthesis header showing totals and per-role table before findings", () => {
    const findings = [
      { role: "security",  ok: true, output: "🔴 a.mjs:1 — fix\n🟡 b.mjs:2 — note" },
      { role: "architect", ok: true, output: "🟡 c.mjs:3 — refactor" },
      { role: "tester",    ok: true, output: "🔵 d.mjs:4 — add test" },
    ];
    const merged = mergeReviewFindings(findings);

    assert.ok(merged.includes("## Parallel Review Synthesis"), "synthesis header should appear");
    assert.ok(merged.includes("1 critical"), "totals should report 1 critical");
    assert.ok(merged.includes("2 warning"),  "totals should report 2 warning");
    assert.ok(merged.includes("1 suggestion"), "totals should report 1 suggestion");
    assert.ok(merged.includes("| Role |"), "per-role table header should be present");
    assert.ok(/\|\s*security\s*\|\s*1\s*\|\s*1\s*\|\s*0\s*\|/.test(merged), "security row should be 1/1/0");
    assert.ok(/\|\s*architect\s*\|\s*0\s*\|\s*1\s*\|\s*0\s*\|/.test(merged), "architect row should be 0/1/0");
    assert.ok(/\|\s*tester\s*\|\s*0\s*\|\s*0\s*\|\s*1\s*\|/.test(merged), "tester row should be 0/0/1");

    const synthIdx = merged.indexOf("## Parallel Review Synthesis");
    const findingsIdx = merged.indexOf("## Parallel Review Findings");
    assert.ok(synthIdx < findingsIdx, "synthesis header must come before findings");
  });
});

describe("build-verify verdict — any 🔴 from any role causes FAIL", () => {
  for (const role of PARALLEL_REVIEW_ROLES) {
    it(`a 🔴 from ${role} alone produces FAIL`, () => {
      const outputs = PARALLEL_REVIEW_ROLES.map(r =>
        r === role
          ? `🔴 file.mjs:1 — critical issue from ${r}`
          : `🔵 file.mjs:1 — minor suggestion from ${r}`,
      );
      const result = computeVerdict(parseFindings(outputs.join("\n")));
      assert.equal(result.verdict, "FAIL", `🔴 from ${role} must produce FAIL`);
      assert.ok(result.critical >= 1, "must count at least 1 critical");
    });
  }

  it("multiple 🔴 from different roles still produces FAIL with correct count", () => {
    const outputs = [
      "🔴 a.mjs:1 — security issue",
      "🔴 b.mjs:2 — architecture issue",
      "🟡 c.mjs:3 — minor warning",
    ];
    const result = computeVerdict(parseFindings(outputs.join("\n")));
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.critical, 2);
    assert.equal(result.warning, 1);
  });

  it("zero 🔴 across all roles produces PASS", () => {
    const outputs = PARALLEL_REVIEW_ROLES.map(r => `🟡 file.mjs:1 — note from ${r}`);
    const result = computeVerdict(parseFindings(outputs.join("\n")));
    assert.equal(result.verdict, "PASS");
    assert.equal(result.critical, 0);
  });

  it("all-empty role outputs produce trivial PASS with zero findings", () => {
    const outputs = PARALLEL_REVIEW_ROLES.map(() => "");
    const result = computeVerdict(parseFindings(outputs.join("\n")));
    assert.equal(result.verdict, "PASS");
    assert.equal(result.critical, 0);
    assert.equal(result.warning, 0);
    assert.equal(result.suggestion, 0);
  });
});

describe("buildReviewBrief — devil's-advocate role", () => {
  it("includes devil's-advocate focus on risks and edge cases", () => {
    const brief = buildReviewBrief("feat", "task", "ok", "/cwd", "devil's-advocate");
    assert.ok(brief.toLowerCase().includes("risk") || brief.toLowerCase().includes("edge case") || brief.toLowerCase().includes("wrong"));
  });
  it("injects role file content unique to devil-advocate.md", () => {
    const brief = buildReviewBrief("feat", "task", "ok", "/cwd", "devil's-advocate");
    // "blast radius" and "stress-test" are only in the role file, not in the getRoleFocus fallback
    assert.ok(
      brief.toLowerCase().includes("blast radius") || brief.toLowerCase().includes("stress-test"),
      "Expected role file content (blast radius / stress-test) to be injected into brief"
    );
  });
});
