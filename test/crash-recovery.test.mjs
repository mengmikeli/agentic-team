// Tests for crash-recovery behavior:
// 1. applyCrashRecovery() in run.mjs
// 2. Orphaned STATE.json.tmp.* cleanup in harness-init

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { applyCrashRecovery } from "../bin/lib/run.mjs";
import { readState, writeState } from "../bin/lib/util.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const harnessPath = join(__dirname, "..", "bin", "agt-harness.mjs");
const testDir = join(__dirname, ".crash-recovery-workspace");

function harness(...args) {
  return execFileSync("node", [harnessPath, ...args], {
    encoding: "utf8",
    cwd: testDir,
    timeout: 10000,
  });
}

function harnessJSON(...args) {
  const out = harness(...args);
  const lines = out.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return JSON.parse(lines[i]); } catch {}
  }
  return JSON.parse(out.trim());
}

function makeState(featureDir, overrides = {}) {
  const base = {
    version: "2.0",
    feature: "crash-test",
    status: "active",
    tasks: [
      { id: "task-1", title: "First task", status: "pending", attempts: 0 },
      { id: "task-2", title: "Second task", status: "pending", attempts: 0 },
    ],
    gates: [],
    transitionCount: 0,
    transitionHistory: [],
    _written_by: "at-harness",
    _last_modified: new Date().toISOString(),
    _write_nonce: "aabbccddaabbccdd",
  };
  const state = { ...base, ...overrides };
  writeFileSync(join(featureDir, "STATE.json"), JSON.stringify(state, null, 2) + "\n");
  return state;
}

describe("crash-recovery", () => {
  before(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("applyCrashRecovery — status: executing", () => {
    const featureName = "crash-test-executing";
    let featureDir;

    before(() => {
      featureDir = join(testDir, "features", featureName);
      mkdirSync(featureDir, { recursive: true });
    });

    it("detects crashed state and preserves tasks", () => {
      const crashedAt = "2025-01-01T00:00:00.000Z";
      const state = makeState(featureDir, {
        status: "executing",
        _last_modified: crashedAt,
        tasks: [
          { id: "task-1", title: "Passed task", status: "passed", attempts: 1 },
          { id: "task-2", title: "Crashed task", status: "in-progress", attempts: 1 },
          { id: "task-3", title: "Pending task", status: "pending", attempts: 0 },
        ],
      });

      const plannedTasks = [
        { id: "task-1", title: "New task from replan", status: "pending", attempts: 0 },
      ];

      const result = applyCrashRecovery(state, plannedTasks, featureDir);

      assert.equal(result.recovered, true, "should signal recovery");
      assert.equal(result.crashedAt, crashedAt, "should capture crash timestamp");
      assert.equal(result.tasks.length, 3, "should preserve all 3 checkpointed tasks, not 1 planned");
      assert.equal(result.tasks[0].status, "passed", "passed task unchanged");
      assert.equal(result.tasks[1].status, "pending", "in-progress task reset to pending");
      assert.equal(result.tasks[2].status, "pending", "pending task unchanged");
    });

    it("writes _recovered_from and _recovery_count to state", () => {
      const crashedAt = "2025-02-01T00:00:00.000Z";
      makeState(featureDir, {
        status: "executing",
        _last_modified: crashedAt,
        tasks: [{ id: "task-1", title: "Task", status: "in-progress", attempts: 1 }],
      });

      const state = readState(featureDir);
      applyCrashRecovery(state, [], featureDir);

      const recovered = readState(featureDir);
      assert.equal(recovered._recovered_from, crashedAt, "_recovered_from should be set");
      assert.equal(recovered._recovery_count, 1, "_recovery_count should be 1");
      assert.equal(recovered.status, "executing", "status stays executing");
    });

    it("increments _recovery_count on repeated crashes", () => {
      makeState(featureDir, {
        status: "executing",
        _last_modified: "2025-03-01T00:00:00.000Z",
        _recovery_count: 2,
        tasks: [{ id: "task-1", title: "Task", status: "pending", attempts: 0 }],
      });

      const state = readState(featureDir);
      applyCrashRecovery(state, [], featureDir);

      const recovered = readState(featureDir);
      assert.equal(recovered._recovery_count, 3, "_recovery_count should increment to 3");
    });
  });

  describe("applyCrashRecovery — status: paused (no recovery)", () => {
    const featureName = "crash-test-paused";
    let featureDir;

    before(() => {
      featureDir = join(testDir, "features", featureName);
      mkdirSync(featureDir, { recursive: true });
    });

    it("does not recover for paused state", () => {
      const plannedTasks = [
        { id: "task-1", title: "Fresh task", status: "pending", attempts: 0 },
      ];
      makeState(featureDir, {
        status: "paused",
        tasks: [
          { id: "old-task", title: "Old task", status: "passed", attempts: 1 },
        ],
      });

      const state = readState(featureDir);
      const result = applyCrashRecovery(state, plannedTasks, featureDir);

      assert.equal(result.recovered, false, "should not trigger recovery for paused");
      assert.equal(result.tasks.length, 1, "should use planned tasks");
      assert.equal(result.tasks[0].id, "task-1", "should use planned task id");
    });
  });

  describe("applyCrashRecovery — status: completed (no recovery)", () => {
    const featureName = "crash-test-completed";
    let featureDir;

    before(() => {
      featureDir = join(testDir, "features", featureName);
      mkdirSync(featureDir, { recursive: true });
    });

    it("does not recover for completed state", () => {
      const plannedTasks = [
        { id: "task-1", title: "Fresh task", status: "pending", attempts: 0 },
      ];
      makeState(featureDir, {
        status: "completed",
        tasks: [{ id: "old-task", title: "Old task", status: "passed", attempts: 1 }],
      });

      const state = readState(featureDir);
      const result = applyCrashRecovery(state, plannedTasks, featureDir);

      assert.equal(result.recovered, false, "should not trigger recovery for completed");
      assert.equal(result.tasks[0].id, "task-1");
    });
  });

  describe("harness init — orphaned tmp cleanup", () => {
    before(() => {
      mkdirSync(join(testDir, ".team"), { recursive: true });
    });

    it("removes orphaned STATE.json.tmp.* files on init --force", () => {
      // First init to create the feature dir
      harnessJSON("init", "--feature", "tmp-cleanup-test", "--dir", ".team");
      const featureDir = join(testDir, ".team", "features", "tmp-cleanup-test");

      // Plant orphaned tmp files simulating a crashed atomic write
      const orphan1 = join(featureDir, "STATE.json.tmp.12345.1234567890");
      const orphan2 = join(featureDir, "STATE.json.tmp.99999.9999999999");
      writeFileSync(orphan1, '{"orphaned":true}');
      writeFileSync(orphan2, '{"orphaned":true}');

      assert.ok(existsSync(orphan1), "orphan1 should exist before init");
      assert.ok(existsSync(orphan2), "orphan2 should exist before init");

      // Re-init with --force triggers the cleanup
      harnessJSON("init", "--feature", "tmp-cleanup-test", "--dir", ".team", "--force");

      assert.ok(!existsSync(orphan1), "orphan1 should be removed after init");
      assert.ok(!existsSync(orphan2), "orphan2 should be removed after init");
    });

    it("leaves non-tmp files untouched", () => {
      const featureDir = join(testDir, ".team", "features", "tmp-cleanup-test");
      const normal = join(featureDir, "STATE.json");
      assert.ok(existsSync(normal), "STATE.json should still exist");
    });
  });
});
