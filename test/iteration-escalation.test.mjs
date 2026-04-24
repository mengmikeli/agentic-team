// Tests for bin/lib/iteration-escalation.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recordWarningIteration, checkEscalation } from "../bin/lib/iteration-escalation.mjs";

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
