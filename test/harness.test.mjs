// Tests for at-harness commands
// Uses Node.js built-in test runner (node --test)

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync, execFileSync } from "child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const harnessPath = join(__dirname, "..", "bin", "at-harness.mjs");
const testDir = join(__dirname, ".test-workspace");

function harness(...args) {
  return execFileSync("node", [harnessPath, ...args], {
    encoding: "utf8",
    cwd: testDir,
    timeout: 10000,
  });
}

function harnessJSON(...args) {
  const out = harness(...args);
  return JSON.parse(out.trim());
}

describe("at-harness", () => {
  before(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("init", () => {
    it("creates feature STATE.json", () => {
      const result = harnessJSON("init", "--feature", "test-feature", "--dir", ".");
      assert.equal(result.created, true);
      assert.equal(result.feature, "test-feature");

      const statePath = join(testDir, "features", "test-feature", "STATE.json");
      assert.ok(existsSync(statePath), "STATE.json should exist");

      const state = JSON.parse(readFileSync(statePath, "utf8"));
      assert.equal(state.version, "2.0");
      assert.equal(state.feature, "test-feature");
      assert.equal(state.status, "active");
      assert.equal(state._written_by, "at-harness");
      assert.ok(state._write_nonce, "should have nonce");
    });

    it("refuses duplicate init without --force", () => {
      const result = harnessJSON("init", "--feature", "test-feature", "--dir", ".");
      assert.equal(result.created, false);
      assert.ok(result.error.includes("already exists"));
    });

    it("allows --force to overwrite", () => {
      const result = harnessJSON("init", "--feature", "test-feature", "--dir", ".", "--force");
      assert.equal(result.created, true);
    });
  });

  describe("transition", () => {
    before(() => {
      // Create feature with tasks
      const featureDir = join(testDir, "features", "trans-test");
      mkdirSync(featureDir, { recursive: true });
      const state = {
        version: "2.0",
        feature: "trans-test",
        status: "active",
        tasks: [
          { id: "task-1", status: "pending", description: "Test task 1" },
          { id: "task-2", status: "pending", description: "Test task 2" },
        ],
        gates: [],
        transitionCount: 0,
        transitionHistory: [],
        _written_by: "at-harness",
        _last_modified: new Date().toISOString(),
        _write_nonce: "abcd1234abcd1234",
      };
      writeFileSync(join(featureDir, "STATE.json"), JSON.stringify(state, null, 2));
    });

    it("allows pending → in-progress", () => {
      const result = harnessJSON(
        "transition", "--task", "task-1", "--status", "in-progress",
        "--dir", join("features", "trans-test")
      );
      assert.equal(result.allowed, true);
      assert.equal(result.from, "pending");
      assert.equal(result.to, "in-progress");
    });

    it("allows in-progress → passed", () => {
      const result = harnessJSON(
        "transition", "--task", "task-1", "--status", "passed",
        "--dir", join("features", "trans-test")
      );
      assert.equal(result.allowed, true);
      assert.equal(result.to, "passed");
    });

    it("rejects invalid transition (passed → pending)", () => {
      const result = harnessJSON(
        "transition", "--task", "task-1", "--status", "pending",
        "--dir", join("features", "trans-test")
      );
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes("not allowed"));
    });

    it("rejects invalid status", () => {
      const result = harnessJSON(
        "transition", "--task", "task-2", "--status", "banana",
        "--dir", join("features", "trans-test")
      );
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes("invalid status"));
    });

    it("rejects unknown task", () => {
      const result = harnessJSON(
        "transition", "--task", "nonexistent", "--status", "in-progress",
        "--dir", join("features", "trans-test")
      );
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes("not found"));
    });
  });

  describe("gate", () => {
    before(() => {
      const featureDir = join(testDir, "features", "gate-test");
      mkdirSync(featureDir, { recursive: true });
      const state = {
        version: "2.0",
        feature: "gate-test",
        status: "active",
        tasks: [
          { id: "task-g1", status: "in-progress", description: "Gate test task" },
        ],
        gates: [],
        transitionCount: 0,
        transitionHistory: [],
        _written_by: "at-harness",
        _last_modified: new Date().toISOString(),
        _write_nonce: "abcd1234abcd1234",
      };
      writeFileSync(join(featureDir, "STATE.json"), JSON.stringify(state, null, 2));
    });

    it("PASS for successful command", () => {
      const result = harnessJSON(
        "gate", "--cmd", "echo hello", "--dir", join("features", "gate-test")
      );
      assert.equal(result.ok, true);
      assert.equal(result.verdict, "PASS");
      assert.equal(result.exitCode, 0);
    });

    it("FAIL for failing command", () => {
      const result = harnessJSON(
        "gate", "--cmd", "exit 1", "--dir", join("features", "gate-test")
      );
      assert.equal(result.ok, true);
      assert.equal(result.verdict, "FAIL");
      assert.equal(result.exitCode, 1);
    });

    it("writes gate result to STATE.json", () => {
      const statePath = join(testDir, "features", "gate-test", "STATE.json");
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      assert.ok(state.gates.length >= 2, "should have at least 2 gate results");
      assert.equal(state.gates[0].verdict, "PASS");
      assert.equal(state.gates[1].verdict, "FAIL");
    });
  });

  describe("notify", () => {
    it("outputs notification JSON to stdout", () => {
      const result = harnessJSON(
        "notify", "--event", "task-started", "--msg", "Starting task 1"
      );
      assert.equal(result.ok, true);
      assert.equal(result.notification.event, "task-started");
      assert.equal(result.notification.message, "Starting task 1");
    });

    it("rejects invalid event", () => {
      const result = harnessJSON(
        "notify", "--event", "invalid-event", "--msg", "test"
      );
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("invalid event"));
    });
  });

  describe("finalize", () => {
    it("rejects when tasks not all done", () => {
      // Use trans-test feature which has task-2 still pending
      const result = harnessJSON(
        "finalize", "--dir", join("features", "trans-test")
      );
      assert.equal(result.finalized, false);
      assert.ok(result.errors.some(e => e.includes("pending")));
    });

    it("succeeds when all tasks passed/skipped", () => {
      const featureDir = join(testDir, "features", "done-test");
      mkdirSync(featureDir, { recursive: true });
      const state = {
        version: "2.0",
        feature: "done-test",
        status: "active",
        tasks: [
          { id: "t1", status: "passed" },
          { id: "t2", status: "skipped" },
        ],
        gates: [],
        transitionCount: 2,
        transitionHistory: [],
        createdAt: new Date().toISOString(),
        _written_by: "at-harness",
        _last_modified: new Date().toISOString(),
        _write_nonce: "abcd1234abcd1234",
      };
      writeFileSync(join(featureDir, "STATE.json"), JSON.stringify(state, null, 2));

      const result = harnessJSON("finalize", "--dir", join("features", "done-test"));
      assert.equal(result.finalized, true);
      assert.ok(result.summary);
      assert.equal(result.summary.passed, 1);
      assert.equal(result.summary.skipped, 1);
    });
  });

  describe("metrics", () => {
    it("computes metrics from STATE.json", () => {
      const result = harnessJSON(
        "metrics", "--dir", join("features", "gate-test")
      );
      assert.equal(result.ok, true);
      assert.ok(result.metrics);
      assert.equal(result.metrics.feature, "gate-test");
      assert.ok(result.metrics.gates.total >= 2);
    });
  });

  describe("tamper detection", () => {
    it("rejects manually edited STATE.json", () => {
      const featureDir = join(testDir, "features", "tampered");
      mkdirSync(featureDir, { recursive: true });
      const state = {
        version: "2.0",
        feature: "tampered",
        status: "active",
        tasks: [{ id: "t1", status: "pending" }],
        gates: [],
        transitionCount: 0,
        transitionHistory: [],
        _written_by: "human-edit",  // Wrong signature!
        _last_modified: new Date().toISOString(),
        _write_nonce: "abcd1234abcd1234",
      };
      writeFileSync(join(featureDir, "STATE.json"), JSON.stringify(state, null, 2));

      const result = harnessJSON(
        "transition", "--task", "t1", "--status", "in-progress",
        "--dir", join("features", "tampered")
      );
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes("tamper"));
    });
  });
});
