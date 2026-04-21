// Tests for at-harness commands
// Uses Node.js built-in test runner (node --test)

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync, execFileSync } from "child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const harnessPath = join(__dirname, "..", "bin", "agt-harness.mjs");
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
  // Some commands output text before JSON (e.g., notify prints to stdout then JSON)
  // Find the last line that looks like JSON
  const lines = out.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return JSON.parse(lines[i]); } catch {}
  }
  return JSON.parse(out.trim()); // fallback, will throw with original error
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
      assert.equal(result.event, "task-started");
    });

    it("rejects invalid event", () => {
      const result = harnessJSON(
        "notify", "--event", "invalid-event", "--msg", "test"
      );
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("invalid event"));
    });

    it("writes event to .team/.notify-stream", () => {
      harnessJSON("notify", "--event", "task-passed", "--msg", "Task done");
      const streamPath = join(testDir, ".team", ".notify-stream");
      assert.ok(existsSync(streamPath), ".notify-stream should exist");
      const lines = readFileSync(streamPath, "utf8").trim().split("\n").filter(Boolean);
      const last = JSON.parse(lines[lines.length - 1]);
      assert.equal(last.event, "task-passed");
      assert.equal(last.msg, "Task done");
      assert.ok(last.ts, "should have timestamp");
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

// ── Backlog enforcement tests ──────────────────────────────────────

import {
  extractWarnings, readBacklog, findNewWarnings,
  documentWarnings, carryForward,
} from "../bin/lib/backlog.mjs";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";

describe("backlog", () => {
  describe("extractWarnings", () => {
    it("returns empty array for empty input", () => {
      assert.deepEqual(extractWarnings(""), []);
      assert.deepEqual(extractWarnings(null), []);
    });

    it("extracts lines containing 'warning'", () => {
      const text = "ok\nwarning: deprecated\nerror: crash";
      const result = extractWarnings(text);
      assert.ok(result.includes("warning: deprecated"));
      assert.equal(result.length, 1);
    });

    it("extracts lines containing 'warn'", () => {
      const text = "some warn message\nall good";
      const result = extractWarnings(text);
      assert.ok(result.includes("some warn message"));
    });

    it("deduplicates identical warning lines", () => {
      const text = "warning: foo\nwarning: foo\nwarning: bar";
      const result = extractWarnings(text);
      assert.equal(result.filter(l => l === "warning: foo").length, 1);
    });

    it("ignores lines over 500 chars", () => {
      const long = "warning: " + "x".repeat(500);
      const result = extractWarnings(long);
      assert.equal(result.length, 0);
    });
  });

  describe("readBacklog", () => {
    it("returns empty lists when backlog.md does not exist", () => {
      const dir = mkdtempSync(join(tmpdir(), "backlog-test-"));
      const result = readBacklog(dir);
      assert.deepEqual(result.documented, []);
      assert.deepEqual(result.unresolved, []);
    });

    it("parses unchecked items as unresolved and documented", () => {
      const dir = mkdtempSync(join(tmpdir(), "backlog-test-"));
      writeFileSync(join(dir, "backlog.md"), "# Backlog\n\n- [ ] warn: foo\n- [x] warn: bar\n");
      const result = readBacklog(dir);
      assert.ok(result.documented.includes("warn: foo"));
      assert.ok(result.documented.includes("warn: bar"));
      assert.ok(result.unresolved.includes("warn: foo"));
      assert.equal(result.unresolved.length, 1);
    });
  });

  describe("documentWarnings", () => {
    it("creates backlog.md if absent", () => {
      const dir = mkdtempSync(join(tmpdir(), "backlog-test-"));
      documentWarnings(dir, ["warning: foo"], "gate");
      assert.ok(existsSync(join(dir, "backlog.md")));
      const content = readFileSync(join(dir, "backlog.md"), "utf8");
      assert.ok(content.includes("warning: foo"));
      assert.ok(content.includes("[gate]"));
    });

    it("appends to existing backlog.md", () => {
      const dir = mkdtempSync(join(tmpdir(), "backlog-test-"));
      documentWarnings(dir, ["warn: first"], "gate");
      documentWarnings(dir, ["warn: second"], "gate");
      const content = readFileSync(join(dir, "backlog.md"), "utf8");
      assert.ok(content.includes("warn: first"));
      assert.ok(content.includes("warn: second"));
    });

    it("does nothing when warnings list is empty", () => {
      const dir = mkdtempSync(join(tmpdir(), "backlog-test-"));
      documentWarnings(dir, [], "gate");
      assert.ok(!existsSync(join(dir, "backlog.md")));
    });
  });

  describe("findNewWarnings", () => {
    it("returns all warnings when backlog is empty", () => {
      const dir = mkdtempSync(join(tmpdir(), "backlog-test-"));
      const result = findNewWarnings(["warn: a", "warn: b"], dir);
      assert.equal(result.length, 2);
    });

    it("excludes warnings already in backlog", () => {
      const dir = mkdtempSync(join(tmpdir(), "backlog-test-"));
      documentWarnings(dir, ["warn: a"], "gate");
      const result = findNewWarnings(["warn: a", "warn: b"], dir);
      assert.ok(!result.includes("warn: a"));
      assert.ok(result.includes("warn: b"));
    });
  });

  describe("carryForward", () => {
    it("copies unresolved warnings to new feature dir", () => {
      const fromDir = mkdtempSync(join(tmpdir(), "backlog-from-"));
      const toDir = mkdtempSync(join(tmpdir(), "backlog-to-"));
      writeFileSync(join(fromDir, "backlog.md"), "# Backlog\n\n- [ ] warn: old issue\n- [x] warn: fixed\n");
      const count = carryForward(fromDir, toDir);
      assert.equal(count, 1);
      const content = readFileSync(join(toDir, "backlog.md"), "utf8");
      assert.ok(content.includes("warn: old issue"));
      assert.ok(!content.includes("warn: fixed"));
    });

    it("returns 0 when no unresolved warnings", () => {
      const fromDir = mkdtempSync(join(tmpdir(), "backlog-from-"));
      const toDir = mkdtempSync(join(tmpdir(), "backlog-to-"));
      writeFileSync(join(fromDir, "backlog.md"), "# Backlog\n\n- [x] warn: all fixed\n");
      const count = carryForward(fromDir, toDir);
      assert.equal(count, 0);
    });
  });

  describe("gate integration", () => {
    it("gate documents warnings in backlog.md", () => {
      const featureDir = join(testDir, "features", "backlog-gate-test");
      mkdirSync(featureDir, { recursive: true });
      const state = {
        version: "2.0",
        feature: "backlog-gate-test",
        status: "active",
        tasks: [],
        gates: [],
        transitionCount: 0,
        transitionHistory: [],
        _written_by: "at-harness",
        _last_modified: new Date().toISOString(),
        _write_nonce: "abcd1234abcd1234",
      };
      writeFileSync(join(featureDir, "STATE.json"), JSON.stringify(state, null, 2));

      // Run gate with a command that emits a warning line
      const result = harnessJSON(
        "gate", "--cmd", "echo 'warning: deprecated api'",
        "--dir", join("features", "backlog-gate-test")
      );
      assert.equal(result.ok, true);
      assert.equal(result.verdict, "PASS");
      assert.ok(typeof result.warnings === "number");
      assert.ok(typeof result.newWarnings === "number");

      // backlog.md should now exist with the warning documented
      const backlogPath = join(featureDir, "backlog.md");
      assert.ok(existsSync(backlogPath), "backlog.md should be created");
      const content = readFileSync(backlogPath, "utf8");
      assert.ok(content.includes("warning: deprecated api"));
    });

    it("init --prev carries warnings forward", () => {
      // Create a prev feature with an unresolved warning
      const prevDir = join(testDir, "features", "prev-feature");
      mkdirSync(prevDir, { recursive: true });
      writeFileSync(join(prevDir, "backlog.md"), "# Backlog\n\n- [ ] warn: old issue\n");

      // Init new feature with --prev (pass feature name; dir is "." resolved to testDir)
      const result = harnessJSON(
        "init", "--feature", "next-feature", "--dir", ".",
        "--prev", "prev-feature"
      );
      assert.equal(result.created, true);
      assert.equal(result.carriedWarnings, 1);

      const newBacklog = join(testDir, "features", "next-feature", "backlog.md");
      assert.ok(existsSync(newBacklog));
      const content = readFileSync(newBacklog, "utf8");
      assert.ok(content.includes("warn: old issue"));
    });
  });
});

// ── GitHub integration tests ──────────────────────────────────────

import { ghAvailable, createIssue, closeIssue, commentIssue, readTrackingConfig } from "../bin/lib/github.mjs";

describe("github integration", () => {
  it("ghAvailable returns a boolean", () => {
    const result = ghAvailable();
    assert.equal(typeof result, "boolean");
  });

  it("createIssue returns null for empty title", () => {
    assert.equal(createIssue("", "body"), null);
    assert.equal(createIssue(null, "body"), null);
  });

  it("closeIssue returns false for null number", () => {
    assert.equal(closeIssue(null, "comment"), false);
    assert.equal(closeIssue(undefined, "comment"), false);
  });

  it("commentIssue returns false for null number", () => {
    assert.equal(commentIssue(null, "body"), false);
    assert.equal(commentIssue(undefined, "body"), false);
  });

  it("commentIssue returns false for empty body", () => {
    assert.equal(commentIssue(1, ""), false);
    assert.equal(commentIssue(1, null), false);
  });
});

describe("readTrackingConfig", () => {
  it("returns null for nonexistent path", () => {
    assert.equal(readTrackingConfig("/nonexistent/path/PROJECT.md"), null);
  });

  it("returns null when tracking fields are missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "tracking-test-"));
    writeFileSync(join(dir, "PROJECT.md"), "# Project\n\n## Stack\nNode.js\n");
    assert.equal(readTrackingConfig(join(dir, "PROJECT.md")), null);
  });

  it("parses complete tracking section", () => {
    const dir = mkdtempSync(join(tmpdir(), "tracking-test-"));
    const md = [
      "# Project",
      "",
      "## Tracking",
      "- Status Field ID: PVTSSF_abc123",
      "- Todo Option ID: todo123",
      "- In Progress Option ID: inprog456",
      "- Done Option ID: done789",
    ].join("\n");
    writeFileSync(join(dir, "PROJECT.md"), md);
    const result = readTrackingConfig(join(dir, "PROJECT.md"));
    assert.ok(result !== null);
    assert.equal(result.statusFieldId, "PVTSSF_abc123");
    assert.equal(result.statusOptions.todo, "todo123");
    assert.equal(result.statusOptions["in-progress"], "inprog456");
    assert.equal(result.statusOptions.done, "done789");
  });
});
