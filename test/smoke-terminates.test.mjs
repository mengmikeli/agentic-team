// Smoke test (task-9): a task that always fails terminates via tick-limit-exceeded,
// not via MAX_TOTAL_TRANSITIONS, and within maxTaskTicks × 2 total transitions.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const harnessPath = join(__dirname, "..", "bin", "agt-harness.mjs");
const testDir = join(__dirname, ".test-workspace-smoke");

function setupFeature(featureName, tasks) {
  const dir = join(testDir, "features", featureName);
  mkdirSync(dir, { recursive: true });
  const state = {
    version: "2.0",
    feature: featureName,
    status: "active",
    tasks,
    gates: [],
    transitionCount: 0,
    transitionHistory: [],
    _written_by: "at-harness",
    _last_modified: new Date().toISOString(),
    _write_nonce: "abcd1234abcd1234",
  };
  writeFileSync(join(dir, "STATE.json"), JSON.stringify(state, null, 2));
  return join("features", featureName);
}

function readState(featureName) {
  const p = join(testDir, "features", featureName, "STATE.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

function tr(dir, status, env) {
  const result = spawnSync("node", [harnessPath, "transition", "--task", "t1", "--status", status, "--dir", dir], {
    encoding: "utf8",
    cwd: testDir,
    timeout: 10000,
    env: { ...process.env, ...env },
  });
  const lines = result.stdout.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return { parsed: JSON.parse(lines[i]), exitCode: result.status }; } catch {}
  }
  return { parsed: null, exitCode: result.status };
}

describe("smoke test — always-failing task terminates cleanly", () => {
  before(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("terminates via tick-limit-exceeded (not MAX_TOTAL_TRANSITIONS) within maxTaskTicks × 2 transitions", () => {
    // Use TASK_MAX_TICKS=3 so the test runs quickly: 3 dispatches × 2 transitions each = 6 total
    const MAX_TICKS = 3;
    const env = { TASK_MAX_TICKS: String(MAX_TICKS) };
    const dir = setupFeature("smoke-always-fails", [
      { id: "t1", status: "pending", title: "always-failing task" },
    ]);

    let lastResult;
    // Simulate task that always fails with varied exit paths to avoid triggering oscillation
    // detection before the tick limit. History: [IP, failed, IP, blocked, IP, failed]
    // K=2: [IP,blocked] vs [IP,failed] — not equal ✓  K=3: [IP,failed,IP] vs [blocked,IP,failed] — not equal ✓
    tr(dir, "in-progress", env);  // ticks: 0→1
    tr(dir, "failed", env);
    tr(dir, "in-progress", env);  // ticks: 1→2  (retry)
    tr(dir, "blocked", env);      // different exit so no K=2 oscillation
    tr(dir, "in-progress", env);  // ticks: 2→3
    tr(dir, "failed", env);

    // Next in-progress attempt must be rejected with tick-limit-exceeded
    lastResult = tr(dir, "in-progress", env);

    assert.equal(lastResult.parsed.allowed, false, "transition should be rejected at tick limit");
    assert.match(lastResult.parsed.reason, /tick-limit-exceeded/, "rejection reason must be tick-limit-exceeded");
    assert.equal(lastResult.exitCode, 0, "process should exit cleanly (exit code 0), not crash");

    const state = readState("smoke-always-fails");

    // Verify termination was NOT due to MAX_TOTAL_TRANSITIONS (100)
    assert.ok(
      state.transitionCount < 100,
      `transitionCount (${state.transitionCount}) should be far below MAX_TOTAL_TRANSITIONS (100)`,
    );

    // Verify termination happened within maxTaskTicks × 2 transitions
    const maxExpectedTransitions = MAX_TICKS * 2;
    assert.ok(
      state.transitionCount <= maxExpectedTransitions,
      `transitionCount (${state.transitionCount}) should be ≤ maxTaskTicks × 2 (${maxExpectedTransitions})`,
    );

    // Verify the task ended up blocked (not just abandoned mid-cycle)
    const task = state.tasks.find(t => t.id === "t1");
    assert.equal(task.status, "blocked", "task status should be blocked after tick-limit-exceeded");
    assert.equal(task.lastReason, "tick-limit-exceeded", "task lastReason should record why it was blocked");
    assert.equal(task.ticks, MAX_TICKS, `task ticks should equal MAX_TICKS (${MAX_TICKS})`);

    // Verify progress.md was written with a tick-limit entry
    const progressPath = join(testDir, "features", "smoke-always-fails", "progress.md");
    assert.ok(existsSync(progressPath), "progress.md should exist after tick-limit fires");
    const progressContent = readFileSync(progressPath, "utf8");
    assert.match(progressContent, /Tick limit exceeded/, "progress.md should contain tick-limit entry");
    assert.match(progressContent, /t1/, "progress.md entry should reference task id");
  });
});
