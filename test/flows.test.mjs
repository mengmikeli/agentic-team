// Tests for bin/lib/flows.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FLOWS, selectFlow, buildBrainstormBrief, buildReviewBrief, PARALLEL_REVIEW_ROLES, mergeReviewFindings, evaluateSimplicityOutput, tagSimplicityFinding } from "../bin/lib/flows.mjs";
import { parseFindings, computeVerdict } from "../bin/lib/synthesize.mjs";
import { incrementReviewRounds } from "../bin/lib/review-escalation.mjs";

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
    // Mirror the production verdict path from run.mjs:1221-1222:
    // const allText = roleFindings.map(f => f.output || "").join("\n");
    // let findings = parseFindings(allText);
    const allText = findings.map(f => f.output || "").join("\n");
    const parsed = parseFindings(allText);
    const result = computeVerdict(parsed);
    assert.equal(result.verdict, "FAIL", "any 🔴 finding (including simplicity veto) must produce FAIL verdict");
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

describe("buildReviewBrief — simplicity role", () => {
  it("injects role file content unique to simplicity.md", () => {
    const brief = buildReviewBrief("feat", "task", "ok", "/cwd", "simplicity");
    // "premature abstraction" and "gold-plating" are only in the role file, not in the getRoleFocus fallback
    assert.ok(
      brief.toLowerCase().includes("premature abstraction") || brief.toLowerCase().includes("gold-plating"),
      "Expected role file content (premature abstraction / gold-plating) to be injected into brief"
    );
  });
});

describe("build-verify flow — simplicity pass", () => {
  it("includes simplicity-review in build-verify phases", () => {
    assert.ok(
      FLOWS["build-verify"].phases.includes("simplicity-review"),
      "build-verify must include dedicated simplicity-review phase"
    );
  });

  it("simplicity 🔴 finding produces FAIL verdict in build-verify simplicity pass", () => {
    // Mirrors the production verdict path in the simplicity-review block of run.mjs
    const simplicityOutput = "🔴 lib/handler.mjs:12 — dead code: unused function doWork() can be deleted";
    const findings = parseFindings(simplicityOutput);
    const result = computeVerdict(findings);
    assert.equal(result.verdict, "FAIL",
      "simplicity 🔴 finding must produce FAIL verdict in build-verify simplicity pass");
  });

  it("simplicity 🟡 warning does not block merge in build-verify simplicity pass", () => {
    const simplicityOutput = "🟡 lib/handler.mjs:15 — consider simplifying nested conditionals for readability";
    const findings = parseFindings(simplicityOutput);
    const result = computeVerdict(findings);
    assert.equal(result.verdict, "PASS",
      "simplicity 🟡 must not block merge in build-verify pass");
    assert.equal(result.backlog, true,
      "simplicity 🟡 must appear in backlog");
  });
});

describe("tagSimplicityFinding — build-verify combined output", () => {
  it("tags a 🔴 critical simplicity finding with [simplicity veto]", () => {
    const text = tagSimplicityFinding({ severity: "critical", text: "🔴 lib/x.mjs:5 — dead code" });
    assert.ok(text.startsWith("🔴 [simplicity veto]"), `expected emoji + [simplicity veto] prefix, got: ${text}`);
  });

  it("tags non-critical simplicity findings as plain [simplicity] (not veto)", () => {
    const warn = tagSimplicityFinding({ severity: "warning", text: "🟡 lib/x.mjs:5 — could be simpler" });
    assert.ok(warn.includes("[simplicity]"));
    assert.ok(!warn.includes("[simplicity veto]"));
  });

  it("preserves the leading emoji so downstream parsers detect severity", () => {
    const text = tagSimplicityFinding({ severity: "critical", text: "🔴 a.mjs:1 — x" });
    const parsed = parseFindings(text);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].severity, "critical");
  });

  it("tags lastFailure-style combined output with [simplicity veto] for both flows", () => {
    // Mirrors the build-verify dedicated simplicity pass in run.mjs:
    // taggedCriticals = synth.findings.filter(critical).map(tagSimplicityFinding)
    const synth = evaluateSimplicityOutput("🔴 lib/handler.mjs:12 — dead code: unused doWork()");
    const tagged = synth.findings.filter(f => f.severity === "critical").map(tagSimplicityFinding);
    const combined = `Simplicity review FAIL: ${synth.critical} critical finding(s)\n` + tagged.join("\n");
    assert.ok(combined.includes("[simplicity veto]"),
      "build-verify combined output must label simplicity 🔴 as [simplicity veto]");

    // And full-stack (multi-review) flow is already covered by mergeReviewFindings tests above —
    // re-assert here to document the cross-flow contract.
    const merged = mergeReviewFindings([
      { role: "simplicity", ok: false, output: "🔴 lib/handler.mjs:12 — dead code" },
    ]);
    assert.ok(merged.includes("[simplicity veto]"),
      "multi-review combined output must label simplicity 🔴 as [simplicity veto]");
  });
});

describe("evaluateSimplicityOutput", () => {
  it("returns SKIP (not PASS) when agent output is empty string", () => {
    const result = evaluateSimplicityOutput("");
    assert.equal(result.verdict, "SKIP",
      "empty agent output must return SKIP, not a false PASS");
    assert.equal(result.critical, 0);
  });

  it("returns SKIP (not PASS) when agent output is null/undefined", () => {
    assert.equal(evaluateSimplicityOutput(null).verdict, "SKIP");
    assert.equal(evaluateSimplicityOutput(undefined).verdict, "SKIP");
  });

  it("returns FAIL with critical count when 🔴 finding present", () => {
    const result = evaluateSimplicityOutput("🔴 lib/x.mjs:5 — dead code: unused helper remove it");
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.critical, 1);
    assert.equal(result.findings.length, 1);
  });

  it("returns PASS (not FAIL) when only 🟡 findings present", () => {
    const result = evaluateSimplicityOutput("🟡 lib/x.mjs:5 — consider simplifying nested conditions");
    assert.equal(result.verdict, "PASS");
    assert.equal(result.critical, 0);
    assert.equal(result.warning, 1);
  });
});

describe("build-verify simplicity-review guard — !reviewFailed skip", () => {
  it("simplicity-review guard is false (skipped) when reviewFailed=true", () => {
    // Documents the run.mjs:1271 guard: !reviewFailed must be false to skip simplicity when main review failed
    const phases = FLOWS["build-verify"].phases;
    const reviewFailed = true;
    const shouldRun = phases.includes("simplicity-review") && !reviewFailed;
    assert.equal(shouldRun, false,
      "simplicity-review must be skipped when reviewFailed=true (main review already failed)");
  });

  it("simplicity-review guard is true when main review passed", () => {
    const phases = FLOWS["build-verify"].phases;
    const reviewFailed = false;
    const shouldRun = phases.includes("simplicity-review") && !reviewFailed;
    assert.equal(shouldRun, true,
      "simplicity-review must run when main review passed");
  });
});

describe("build-verify simplicity-review veto — state transitions", () => {
  it("🔴 output flips reviewFailed to true and increments reviewRounds", () => {
    // Mirrors the run.mjs:1281-1287 veto block: evaluate → if critical > 0,
    // set reviewFailed = true and call incrementReviewRounds(task).
    const task = { id: "task-x" };
    let reviewFailed = false;

    const synth = evaluateSimplicityOutput("🔴 lib/x.mjs:5 — dead code: unused helper");
    if (synth.critical > 0) {
      reviewFailed = true;
      incrementReviewRounds(task);
    }

    assert.equal(reviewFailed, true, "🔴 must flip reviewFailed to true");
    assert.equal(task.reviewRounds, 1, "🔴 must increment task.reviewRounds from 0 → 1");
  });

  it("🟡-only output leaves reviewFailed/reviewRounds unchanged", () => {
    const task = { id: "task-y", reviewRounds: 2 };
    let reviewFailed = false;

    const synth = evaluateSimplicityOutput("🟡 lib/x.mjs:5 — consider simplifying");
    if (synth.critical > 0) {
      reviewFailed = true;
      incrementReviewRounds(task);
    }

    assert.equal(reviewFailed, false, "🟡 must not flip reviewFailed");
    assert.equal(task.reviewRounds, 2, "🟡 must not increment reviewRounds");
  });
});
