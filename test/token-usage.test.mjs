// Tests for token usage tracking in bin/lib/run.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  trackUsage,
  setUsageContext,
  getRunUsage,
  getPhaseUsage,
  getTaskUsage,
  resetRunUsage,
  buildTokenUsage,
} from "../bin/lib/run.mjs";

// Reset state before every test to avoid inter-test leakage
function reset() {
  resetRunUsage();
}

describe("resetRunUsage", () => {
  it("clears run totals to zero", () => {
    reset();
    trackUsage({ usage: { input_tokens: 10, output_tokens: 5 }, total_cost_usd: 0.01, duration_ms: 100 });
    resetRunUsage();
    const u = getRunUsage();
    assert.equal(u.dispatches, 0);
    assert.equal(u.inputTokens, 0);
    assert.equal(u.outputTokens, 0);
    assert.equal(u.costUsd, 0);
    assert.equal(u.durationMs, 0);
  });

  it("clears phase usage", () => {
    reset();
    setUsageContext("brainstorm", null);
    trackUsage({ usage: { input_tokens: 5 }, total_cost_usd: 0, duration_ms: 0 });
    resetRunUsage();
    assert.deepEqual(getPhaseUsage(), {});
  });

  it("clears task usage", () => {
    reset();
    setUsageContext("build", "task-1");
    trackUsage({ usage: { input_tokens: 5 }, total_cost_usd: 0, duration_ms: 0 });
    resetRunUsage();
    assert.deepEqual(getTaskUsage(), {});
  });

  it("resets current phase to 'build' and task to null", () => {
    reset();
    setUsageContext("review", "task-99");
    resetRunUsage();
    // Dispatch and confirm phase is 'build' again
    trackUsage({ usage: { input_tokens: 1 }, total_cost_usd: 0, duration_ms: 0 });
    const phases = getPhaseUsage();
    assert.ok(phases["build"], "should have accumulated to build phase after reset");
    assert.ok(!phases["review"], "review phase should be cleared");
  });
});

describe("trackUsage", () => {
  beforeEach(reset);

  it("accumulates to run total", () => {
    trackUsage({ usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 20, cache_creation_input_tokens: 10 }, total_cost_usd: 0.05, duration_ms: 500 });
    const u = getRunUsage();
    assert.equal(u.dispatches, 1);
    assert.equal(u.inputTokens, 100);
    assert.equal(u.outputTokens, 50);
    assert.equal(u.cacheRead, 20);
    assert.equal(u.cacheCreate, 10);
    assert.equal(u.costUsd, 0.05);
    assert.equal(u.durationMs, 500);
  });

  it("accumulates multiple dispatches", () => {
    trackUsage({ usage: { input_tokens: 10, output_tokens: 5 }, total_cost_usd: 0.01, duration_ms: 100 });
    trackUsage({ usage: { input_tokens: 20, output_tokens: 10 }, total_cost_usd: 0.02, duration_ms: 200 });
    const u = getRunUsage();
    assert.equal(u.dispatches, 2);
    assert.equal(u.inputTokens, 30);
    assert.equal(u.outputTokens, 15);
    assert.equal(u.costUsd, 0.03);
  });

  it("accumulates to the current phase bucket", () => {
    setUsageContext("brainstorm", null);
    trackUsage({ usage: { input_tokens: 50 }, total_cost_usd: 0, duration_ms: 0 });
    const phases = getPhaseUsage();
    assert.ok(phases["brainstorm"]);
    assert.equal(phases["brainstorm"].inputTokens, 50);
    assert.equal(phases["brainstorm"].dispatches, 1);
  });

  it("accumulates to the current task bucket", () => {
    setUsageContext("build", "task-42");
    trackUsage({ usage: { input_tokens: 30, output_tokens: 15 }, total_cost_usd: 0.03, duration_ms: 300 });
    const tasks = getTaskUsage();
    assert.ok(tasks["task-42"]);
    assert.equal(tasks["task-42"].inputTokens, 30);
    assert.equal(tasks["task-42"].outputTokens, 15);
  });

  it("records phase on task bucket at first dispatch", () => {
    setUsageContext("review", "task-7");
    trackUsage({ usage: { input_tokens: 5 }, total_cost_usd: 0, duration_ms: 0 });
    const tasks = getTaskUsage();
    assert.equal(tasks["task-7"].phase, "review");
  });

  it("does not accumulate to task bucket when task is null", () => {
    setUsageContext("build", null);
    trackUsage({ usage: { input_tokens: 5 }, total_cost_usd: 0, duration_ms: 0 });
    assert.deepEqual(getTaskUsage(), {});
  });

  it("handles missing usage fields gracefully", () => {
    trackUsage({});
    const u = getRunUsage();
    assert.equal(u.dispatches, 1);
    assert.equal(u.inputTokens, 0);
    assert.equal(u.costUsd, 0);
  });

  it("handles null/undefined input gracefully", () => {
    trackUsage(null);
    trackUsage(undefined);
    const u = getRunUsage();
    assert.equal(u.dispatches, 0);
  });

  it("separates accumulation by phase correctly", () => {
    setUsageContext("brainstorm", null);
    trackUsage({ usage: { input_tokens: 100 }, total_cost_usd: 0.1, duration_ms: 0 });
    setUsageContext("build", null);
    trackUsage({ usage: { input_tokens: 200 }, total_cost_usd: 0.2, duration_ms: 0 });
    const phases = getPhaseUsage();
    assert.equal(phases["brainstorm"].inputTokens, 100);
    assert.equal(phases["build"].inputTokens, 200);
  });
});

describe("buildTokenUsage", () => {
  beforeEach(reset);

  it("returns { byTask, byPhase, total } shape", () => {
    const result = buildTokenUsage();
    assert.ok("byTask" in result);
    assert.ok("byPhase" in result);
    assert.ok("total" in result);
  });

  it("total reflects accumulated run usage", () => {
    trackUsage({ usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10, cache_creation_input_tokens: 5 }, total_cost_usd: 0.05, duration_ms: 400 });
    const { total } = buildTokenUsage();
    assert.equal(total.inputTokens, 100);
    assert.equal(total.outputTokens, 50);
    assert.equal(total.cachedInput, 15);   // cacheRead + cacheCreate
    assert.equal(total.costUsd, 0.05);
    assert.equal(total.durationMs, 400);
    assert.equal(total.dispatches, 1);
  });

  it("byPhase maps phase keys with correct fields", () => {
    setUsageContext("brainstorm", null);
    trackUsage({ usage: { input_tokens: 50, output_tokens: 25 }, total_cost_usd: 0.02, duration_ms: 200 });
    const { byPhase } = buildTokenUsage();
    assert.ok(byPhase["brainstorm"]);
    assert.equal(byPhase["brainstorm"].inputTokens, 50);
    assert.equal(byPhase["brainstorm"].outputTokens, 25);
    assert.ok("cachedInput" in byPhase["brainstorm"]);
  });

  it("byTask maps task IDs and preserves phase field", () => {
    setUsageContext("review", "task-5");
    trackUsage({ usage: { input_tokens: 80 }, total_cost_usd: 0.04, duration_ms: 600 });
    const { byTask } = buildTokenUsage();
    assert.ok(byTask["task-5"]);
    assert.equal(byTask["task-5"].phase, "review");
    assert.equal(byTask["task-5"].inputTokens, 80);
  });

  it("cachedInput = cacheRead + cacheCreate", () => {
    trackUsage({ usage: { input_tokens: 0, cache_read_input_tokens: 30, cache_creation_input_tokens: 20 }, total_cost_usd: 0, duration_ms: 0 });
    const { total } = buildTokenUsage();
    assert.equal(total.cachedInput, 50);
  });

  it("returns empty byTask and byPhase when nothing tracked", () => {
    const { byTask, byPhase, total } = buildTokenUsage();
    assert.deepEqual(byTask, {});
    assert.deepEqual(byPhase, {});
    assert.equal(total.dispatches, 0);
    assert.equal(total.costUsd, 0);
  });
});

describe("resetRunUsage — isolation between simulated features", () => {
  it("second feature does not accumulate first feature's tokens", () => {
    // Simulate feature 1
    reset();
    setUsageContext("build", "task-1");
    trackUsage({ usage: { input_tokens: 1000, output_tokens: 500 }, total_cost_usd: 1.0, duration_ms: 1000 });
    const feature1 = buildTokenUsage();

    // Reset (as _runSingleFeature now does before each feature)
    resetRunUsage();

    // Simulate feature 2
    setUsageContext("build", "task-2");
    trackUsage({ usage: { input_tokens: 200, output_tokens: 100 }, total_cost_usd: 0.2, duration_ms: 200 });
    const feature2 = buildTokenUsage();

    // Feature 2 should NOT include feature 1's tokens
    assert.equal(feature2.total.inputTokens, 200, "feature 2 input should not include feature 1's tokens");
    assert.equal(feature2.total.costUsd, 0.2, "feature 2 cost should not include feature 1's cost");
    assert.ok(!feature2.byTask["task-1"], "feature 2 should not contain task-1 from feature 1");

    // Feature 1 data was captured correctly before reset
    assert.equal(feature1.total.inputTokens, 1000);
  });
});
