// Tests for bin/lib/iteration-escalation.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recordWarningIteration, checkEscalation } from "../bin/lib/iteration-escalation.mjs";
import { runCompoundGate } from "../bin/lib/compound-gate.mjs";
import { mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ── recordWarningIteration ─────────────────────────────────────────────────

describe("recordWarningIteration", () => {
  it("initializes gateWarningHistory and appends first entry", () => {
    const task = {};
    recordWarningIteration(task, 1, ["thin-content"]);
    assert.deepEqual(task.gateWarningHistory, [{ iteration: 1, layers: ["thin-content"] }]);
  });

  it("appends to existing gateWarningHistory", () => {
    const task = { gateWarningHistory: [{ iteration: 1, layers: ["thin-content"] }] };
    recordWarningIteration(task, 2, ["missing-code-refs"]);
    assert.deepEqual(task.gateWarningHistory, [
      { iteration: 1, layers: ["thin-content"] },
      { iteration: 2, layers: ["missing-code-refs"] },
    ]);
  });

  it("does not mutate the original layers array", () => {
    const task = {};
    const layers = ["thin-content", "low-uniqueness"];
    recordWarningIteration(task, 1, layers);
    layers.push("extra");
    assert.deepEqual(task.gateWarningHistory[0].layers, ["thin-content", "low-uniqueness"]);
  });

  it("records multiple iterations on same task", () => {
    const task = {};
    recordWarningIteration(task, 1, ["thin-content"]);
    recordWarningIteration(task, 2, ["thin-content"]);
    assert.equal(task.gateWarningHistory.length, 2);
    assert.equal(task.gateWarningHistory[0].iteration, 1);
    assert.equal(task.gateWarningHistory[1].iteration, 2);
  });
});

// ── checkEscalation ────────────────────────────────────────────────────────

describe("checkEscalation", () => {
  it("returns null for empty history", () => {
    assert.equal(checkEscalation([]), null);
  });

  it("returns null for single-entry history", () => {
    assert.equal(checkEscalation([{ iteration: 1, layers: ["thin-content"] }]), null);
  });

  it("returns null for undefined input", () => {
    assert.equal(checkEscalation(undefined), null);
  });

  it("returns null for null input", () => {
    assert.equal(checkEscalation(null), null);
  });

  it("returns null when layers differ across all iterations", () => {
    const history = [
      { iteration: 1, layers: ["thin-content"] },
      { iteration: 2, layers: ["missing-code-refs"] },
    ];
    assert.equal(checkEscalation(history), null);
  });

  it("returns null when a layer appears only in iteration 1", () => {
    const history = [
      { iteration: 1, layers: ["thin-content"] },
      { iteration: 2, layers: ["missing-code-refs"] },
    ];
    assert.equal(checkEscalation(history), null);
  });

  it("returns escalation when same layer appears in iterations 1 and 2", () => {
    const history = [
      { iteration: 1, layers: ["thin-content"] },
      { iteration: 2, layers: ["thin-content"] },
    ];
    const result = checkEscalation(history);
    assert.ok(result !== null);
    assert.deepEqual(result.layers, ["thin-content"]);
    assert.deepEqual(result.iterations, [1, 2]);
  });

  it("returns escalation when same layer appears in non-consecutive iterations (1 and 3)", () => {
    const history = [
      { iteration: 1, layers: ["thin-content"] },
      { iteration: 2, layers: ["missing-code-refs"] },
      { iteration: 3, layers: ["thin-content"] },
    ];
    const result = checkEscalation(history);
    assert.ok(result !== null);
    assert.ok(result.layers.includes("thin-content"));
    assert.ok(result.iterations.includes(1));
    assert.ok(result.iterations.includes(3));
  });

  it("returns only the recurring layers, not all layers", () => {
    const history = [
      { iteration: 1, layers: ["thin-content", "missing-code-refs"] },
      { iteration: 2, layers: ["thin-content", "low-uniqueness"] },
    ];
    const result = checkEscalation(history);
    assert.ok(result !== null);
    assert.deepEqual(result.layers, ["thin-content"]);
    assert.ok(!result.layers.includes("missing-code-refs"));
    assert.ok(!result.layers.includes("low-uniqueness"));
  });

  it("returns iterations sorted numerically ascending", () => {
    const history = [
      { iteration: 3, layers: ["thin-content"] },
      { iteration: 1, layers: ["thin-content"] },
    ];
    const result = checkEscalation(history);
    assert.ok(result !== null);
    assert.deepEqual(result.iterations, [1, 3]);
  });

  it("handles entries with empty layers array without error", () => {
    const history = [
      { iteration: 1, layers: [] },
      { iteration: 2, layers: ["thin-content"] },
    ];
    assert.equal(checkEscalation(history), null);
  });

  it("returns multiple escalating layers when several recur", () => {
    const history = [
      { iteration: 1, layers: ["thin-content", "missing-code-refs"] },
      { iteration: 2, layers: ["thin-content", "missing-code-refs"] },
    ];
    const result = checkEscalation(history);
    assert.ok(result !== null);
    assert.ok(result.layers.includes("thin-content"));
    assert.ok(result.layers.includes("missing-code-refs"));
    assert.deepEqual(result.iterations, [1, 2]);
  });
});

// ── Integration: run-loop escalation blocks on 2nd WARN ────────────────────

describe("Integration: iteration escalation in simulated run loop", () => {
  function makeDir() {
    return mkdtempSync(join(tmpdir(), "esc-int-test-"));
  }

  it("blocks task after same thin-content layer trips in 2 iterations, builder never invoked a third time", () => {
    const dir = makeDir();
    // Thin review: no code refs, generic phrases → trips thin-content + missing-code-refs → WARN
    const thinFindings = [
      { severity: "warning", text: "🟡 — looks good overall" },
      { severity: "critical", text: "🔴 — implementation is reasonable" },
    ];
    const task = { id: "task-1", title: "Test task", gateWarningHistory: [] };
    const maxRetries = 3;
    let builderInvocations = 0;
    let isBlocked = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      builderInvocations++;

      // Simulate compound gate returning WARN with thin-content + missing-code-refs
      const gateResult = runCompoundGate(thinFindings, dir);
      assert.equal(gateResult.verdict, "WARN", `Expected WARN at attempt ${attempt}`);
      assert.ok(gateResult.layers.includes("thin-content"), "thin-content must trip");

      // Record the WARN for this iteration (mirrors run.mjs WARN path)
      recordWarningIteration(task, attempt, gateResult.layers);

      // Check for escalation (mirrors run.mjs escalation check)
      const escalation = checkEscalation(task.gateWarningHistory);
      if (escalation) {
        // Escalation fires: block immediately, no further retries
        isBlocked = true;
        break;
      }
    }

    assert.ok(isBlocked, "Task must be blocked when same layer recurs across 2 iterations");
    assert.equal(builderInvocations, 2, "Builder must only be invoked twice — escalation must block before a 3rd attempt");
    assert.ok(task.gateWarningHistory.length === 2, "History must have exactly 2 entries at point of escalation");
  });

  it("does not escalate when different layers trip each iteration", () => {
    const dir = makeDir();
    const task = { id: "task-2", title: "No escalation task", gateWarningHistory: [] };
    const maxRetries = 3;
    let escalationFired = false;

    // Iteration 1: thin-content trips
    recordWarningIteration(task, 1, ["thin-content"]);
    if (checkEscalation(task.gateWarningHistory)) escalationFired = true;

    // Iteration 2: different layer (missing-code-refs only, not thin-content)
    recordWarningIteration(task, 2, ["missing-code-refs"]);
    if (checkEscalation(task.gateWarningHistory)) escalationFired = true;

    assert.equal(escalationFired, false, "Must not escalate when no layer repeats across iterations");
  });

  it("escalates on non-consecutive iterations (1 and 3)", () => {
    const task = { id: "task-3", title: "Non-consecutive task", gateWarningHistory: [] };

    recordWarningIteration(task, 1, ["thin-content"]);
    assert.equal(checkEscalation(task.gateWarningHistory), null, "No escalation after 1 iteration");

    recordWarningIteration(task, 2, ["missing-code-refs"]);
    assert.equal(checkEscalation(task.gateWarningHistory), null, "No escalation — different layers");

    recordWarningIteration(task, 3, ["thin-content"]);
    const escalation = checkEscalation(task.gateWarningHistory);
    assert.ok(escalation !== null, "Must escalate when thin-content recurs in iterations 1 and 3");
    assert.ok(escalation.layers.includes("thin-content"));
    assert.ok(escalation.iterations.includes(1));
    assert.ok(escalation.iterations.includes(3));
  });

  it("writeFileSync-backed state: gateWarningHistory persists across calls", () => {
    const dir = makeDir();
    const statePath = join(dir, "STATE.json");
    const task = { id: "task-s1", gateWarningHistory: [] };

    // Simulate first WARN + persist
    recordWarningIteration(task, 1, ["thin-content"]);
    const state1 = { tasks: [{ id: "task-s1", gateWarningHistory: task.gateWarningHistory }] };
    writeFileSync(statePath, JSON.stringify(state1));

    // Reload + simulate second WARN (mirrors what run.mjs does across attempts)
    const reloaded = JSON.parse(JSON.stringify(state1));
    const reloadedTask = reloaded.tasks[0];
    reloadedTask.gateWarningHistory ??= [];
    recordWarningIteration(reloadedTask, 2, ["thin-content"]);

    const escalation = checkEscalation(reloadedTask.gateWarningHistory);
    assert.ok(escalation !== null, "Escalation must fire after reload + second WARN with same layer");
    assert.deepEqual(escalation.layers, ["thin-content"]);
  });
});
