// Tests for bin/lib/cron.mjs — cron-tick command
// Uses Node.js built-in test runner (node --test)

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { cmdCronTick } from "../bin/lib/cron.mjs";

function createTmpDir() {
  const dir = join(tmpdir(), `cron-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Minimal tracking config
const TRACKING_CONFIG = {
  statusFieldId: "field-123",
  statusOptions: {
    "todo": "opt-todo",
    "in-progress": "opt-inprogress",
    "done": "opt-done",
    "ready": "opt-ready",
  },
};

// Helper to create PROJECT.md with a project number
function writeProjectMd(teamDir, projectNumber = 42) {
  writeFileSync(
    join(teamDir, "PROJECT.md"),
    `# Project\nhttps://github.com/users/test/projects/${projectNumber}\n`,
  );
}

describe("cmdCronTick", () => {
  let tmpDir;
  let teamDir;
  let originalCwd;
  let originalExit;
  let exitCode;

  beforeEach(() => {
    tmpDir = createTmpDir();
    teamDir = join(tmpDir, ".team");
    mkdirSync(teamDir, { recursive: true });

    originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    // Capture exit codes instead of terminating
    originalExit = process.exit;
    exitCode = null;
    process.exit = (code) => { exitCode = code ?? 0; throw new Error(`process.exit(${code})`); };
  });

  afterEach(() => {
    process.cwd = originalCwd;
    process.exit = originalExit;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── 1. No ready items ─────────────────────────────────────────

  it("exits 0 with 'no ready items' when board has no Ready issues", async () => {
    writeProjectMd(teamDir);
    const logs = [];
    const origLog = console.log;
    console.log = (...a) => { logs.push(a.join(" ")); };

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 1, title: "Some issue", status: "Todo", id: "item-1" },
        { issueNumber: 2, title: "In progress", status: "In Progress", id: "item-2" },
      ],
      runSingleFeature: async () => { throw new Error("should not be called"); },
      setProjectItemStatus: () => false,
      commentIssue: () => false,
      lockFile: () => ({ acquired: true, release: () => {} }),
    };

    await cmdCronTick([], deps);
    console.log = origLog;

    assert.ok(logs.some(l => l.includes("no ready items")), `Expected 'no ready items' in: ${logs.join(", ")}`);
  });

  // ── 2. Lock already held ──────────────────────────────────────

  it("exits 0 with 'already running' message when lock is held", async () => {
    writeProjectMd(teamDir);
    const logs = [];
    const origLog = console.log;
    console.log = (...a) => { logs.push(a.join(" ")); };

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [],
      runSingleFeature: async () => { throw new Error("should not be called"); },
      setProjectItemStatus: () => false,
      commentIssue: () => false,
      lockFile: () => ({ acquired: false, holder: { pid: 99999, command: "cron-tick" } }),
    };

    try {
      await cmdCronTick([], deps);
    } catch (e) {
      // process.exit throws in test
    }
    console.log = origLog;

    assert.ok(
      logs.some(l => l.includes("already running")),
      `Expected 'already running' in: ${logs.join(", ")}`,
    );
    assert.equal(exitCode, 0);
  });

  // ── 3. Successful dispatch ────────────────────────────────────

  it("transitions status to in-progress then done on successful dispatch", async () => {
    writeProjectMd(teamDir);
    const statusTransitions = [];
    let runCalled = false;

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 7, title: "Add dark mode", status: "Ready", id: "item-7" },
        { issueNumber: 8, title: "Fix login", status: "Ready", id: "item-8" },
      ],
      runSingleFeature: async (args, title) => {
        runCalled = true;
        assert.equal(title, "Add dark mode", "Should dispatch first ready item");
        return "done";
      },
      setProjectItemStatus: (issueNumber, projectNumber, status) => {
        statusTransitions.push({ issueNumber, projectNumber, status });
        return true;
      },
      commentIssue: () => false,
      lockFile: () => ({ acquired: true, release: () => {} }),
    };

    await cmdCronTick([], deps);

    assert.ok(runCalled, "runSingleFeature should have been called");
    assert.ok(statusTransitions.some(t => t.issueNumber === 7 && t.status === "in-progress"),
      "Should transition issue to in-progress before running");
    assert.ok(statusTransitions.some(t => t.issueNumber === 7 && t.status === "done"),
      "Should transition issue to done after success");
  });

  // ── 4. Failed dispatch ────────────────────────────────────────

  it("reverts to ready and comments on failed dispatch", async () => {
    writeProjectMd(teamDir);
    const statusTransitions = [];
    const comments = [];

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 5, title: "Broken feature", status: "Ready", id: "item-5" },
      ],
      runSingleFeature: async () => { throw new Error("agent exploded"); },
      setProjectItemStatus: (issueNumber, projectNumber, status) => {
        statusTransitions.push({ issueNumber, projectNumber, status });
        return true;
      },
      commentIssue: (issueNumber, body) => { comments.push({ issueNumber, body }); return true; },
      lockFile: () => ({ acquired: true, release: () => {} }),
    };

    await cmdCronTick([], deps);

    assert.ok(statusTransitions.some(t => t.issueNumber === 5 && t.status === "in-progress"),
      "Should transition to in-progress before dispatch");
    assert.ok(statusTransitions.some(t => t.issueNumber === 5 && t.status === "ready"),
      "Should revert to ready after failure");
    assert.ok(comments.some(c => c.issueNumber === 5 && c.body.includes("agent exploded")),
      "Should comment failure message on issue");
  });

  // ── 5. Not configured ─────────────────────────────────────────

  it("exits 1 when tracking config is not available", async () => {
    const deps = {
      readTrackingConfig: () => null,
      readProjectNumber: () => 42,
      listProjectItems: () => [],
      runSingleFeature: async () => {},
      setProjectItemStatus: () => false,
      commentIssue: () => false,
      lockFile: () => ({ acquired: true, release: () => {} }),
    };

    try {
      await cmdCronTick([], deps);
    } catch (e) {
      // process.exit throws in test
    }

    assert.equal(exitCode, 1, "Should exit 1 when tracking config is missing");
  });
});
