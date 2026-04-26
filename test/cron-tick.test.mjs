// Tests for bin/lib/cron.mjs — cron-tick command
// Uses Node.js built-in test runner (node --test)

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

import { cmdCronTick, cmdCronSetup } from "../bin/lib/cron.mjs";

const agtPath = join(fileURLToPath(new URL(".", import.meta.url)), "..", "bin", "agt.mjs");

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

// Helper to create a lock stub with a release spy.
// Spread into deps: { ...makeLockSpy() } contributes lockFile to deps.
// After the test, check spy.releaseCalls === 1 to verify the finally block ran.
function makeLockSpy() {
  const spy = { releaseCalls: 0 };
  spy.lockFile = () => ({ acquired: true, release: () => { spy.releaseCalls++; } });
  return spy;
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
    const lockSpy = makeLockSpy();

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 1, title: "Some issue", status: "Todo", id: "item-1" },
        { issueNumber: 2, title: "Completed issue", status: "Done", id: "item-2" },
      ],
      runSingleFeature: async () => { throw new Error("should not be called"); },
      setProjectItemStatus: () => false,
      commentIssue: () => false,
      lockFile: lockSpy.lockFile,
    };

    try {
      console.log = (...a) => { logs.push(a.join(" ")); };
      await cmdCronTick([], deps);
    } finally {
      console.log = origLog;
    }

    assert.ok(logs.some(l => l.includes("no ready items")), `Expected 'no ready items' in: ${logs.join(", ")}`);
    assert.equal(lockSpy.releaseCalls, 1, "lock.release should be called once");
  });

  // ── 2. Lock already held ──────────────────────────────────────

  it("exits 0 with 'already running' message when lock is held", async () => {
    writeProjectMd(teamDir);
    const logs = [];
    const origLog = console.log;

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
      console.log = (...a) => { logs.push(a.join(" ")); };
      try {
        await cmdCronTick([], deps);
      } catch (e) {
        // process.exit throws in test
      }
    } finally {
      console.log = origLog;
    }

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
    let runArgs = null;
    const lockSpy = makeLockSpy();

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 7, title: "Add dark mode", status: "Ready", id: "item-7" },
        { issueNumber: 8, title: "Fix login", status: "Ready", id: "item-8" },
      ],
      runSingleFeature: async (args, title) => {
        runCalled = true;
        runArgs = args;
        assert.equal(title, "Add dark mode", "Should dispatch first ready item");
        return "done";
      },
      setProjectItemStatus: (issueNumber, projectNumber, status) => {
        statusTransitions.push({ issueNumber, projectNumber, status });
        return true;
      },
      commentIssue: () => false,
      lockFile: lockSpy.lockFile,
    };

    await cmdCronTick([], deps);

    assert.ok(runCalled, "runSingleFeature should have been called");
    assert.deepEqual(runArgs, [], "runSingleFeature must be called with empty args, not forwarded CLI args");
    const inProgressIdx = statusTransitions.findIndex(t => t.issueNumber === 7 && t.status === "in-progress");
    const doneIdx = statusTransitions.findIndex(t => t.issueNumber === 7 && t.status === "done");
    assert.ok(inProgressIdx !== -1, "Should transition issue to in-progress before running");
    assert.ok(doneIdx !== -1, "Should transition issue to done after success");
    assert.ok(inProgressIdx < doneIdx, "in-progress must come before done");
    assert.equal(lockSpy.releaseCalls, 1, "lock.release should be called once");
  });

  // ── 3b. Board API failure warning ────────────────────────────

  it("logs a warning when setProjectItemStatus returns false but continues", async () => {
    writeProjectMd(teamDir);
    const warns = [];
    const origWarn = console.warn;
    const lockSpy = makeLockSpy();

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 9, title: "Needs board update", status: "Ready", id: "item-9" },
      ],
      runSingleFeature: async () => "done",
      setProjectItemStatus: () => false,
      commentIssue: () => false,
      lockFile: lockSpy.lockFile,
    };

    try {
      console.warn = (...a) => { warns.push(a.join(" ")); };
      await cmdCronTick([], deps);
    } finally {
      console.warn = origWarn;
    }

    assert.ok(warns.some(w => w.includes("in-progress")), `Expected in-progress warning in: ${warns.join(", ")}`);
    assert.ok(warns.some(w => w.includes("done")), `Expected done warning in: ${warns.join(", ")}`);
    assert.equal(lockSpy.releaseCalls, 1, "lock.release should be called once");
  });

  // ── 4. Failed dispatch ────────────────────────────────────────

  it("reverts to ready and comments on failed dispatch", async () => {
    writeProjectMd(teamDir);
    const statusTransitions = [];
    const comments = [];
    const lockSpy = makeLockSpy();

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
      lockFile: lockSpy.lockFile,
    };

    await cmdCronTick([], deps);

    assert.ok(statusTransitions.some(t => t.issueNumber === 5 && t.status === "in-progress"),
      "Should transition to in-progress before dispatch");
    assert.ok(statusTransitions.some(t => t.issueNumber === 5 && t.status === "ready"),
      "Should revert to ready after failure");
    assert.ok(comments.some(c => c.issueNumber === 5 && c.body.includes("agent exploded")),
      "Should comment failure message on issue");
    assert.equal(lockSpy.releaseCalls, 1, "lock.release should be called once");
  });

  // ── 4b. Failed dispatch — commentIssue returns false ─────────
  it("warns when commentIssue returns false on dispatch failure", async () => {
    writeProjectMd(teamDir);
    const warns = [];
    const origWarn = console.warn;
    const lockSpy = makeLockSpy();

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 11, title: "Failing feature", status: "Ready", id: "item-11" },
      ],
      runSingleFeature: async () => { throw new Error("feature failed"); },
      setProjectItemStatus: () => true,
      commentIssue: () => false,
      lockFile: lockSpy.lockFile,
    };

    try {
      console.warn = (...a) => { warns.push(a.join(" ")); };
      await cmdCronTick([], deps);
    } finally {
      console.warn = origWarn;
    }

    assert.ok(warns.some(w => w.includes("failed to comment")), `Expected 'failed to comment' warning in: ${warns.join(", ")}`);
    assert.equal(lockSpy.releaseCalls, 1, "lock.release should be called once");
  });

  // ── 4c. Failed dispatch — commentIssue throws ─────────────────
  it("swallows commentIssue throw and preserves original error log", async () => {
    writeProjectMd(teamDir);
    const errors = [];
    const warns = [];
    const origError = console.error;
    const origWarn = console.warn;
    const lockSpy = makeLockSpy();

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 12, title: "Throwing feature", status: "Ready", id: "item-12" },
      ],
      runSingleFeature: async () => { throw new Error("run exploded"); },
      setProjectItemStatus: () => true,
      commentIssue: () => { throw new Error("GH auth error"); },
      lockFile: lockSpy.lockFile,
    };

    try {
      console.error = (...a) => { errors.push(a.join(" ")); };
      console.warn = (...a) => { warns.push(a.join(" ")); };
      await cmdCronTick([], deps);
    } finally {
      console.error = origError;
      console.warn = origWarn;
    }

    // Original error must appear in console.error
    assert.ok(errors.some(e => e.includes("run exploded")), `Expected 'run exploded' in errors: ${errors.join(", ")}`);
    // commentIssue error must be warned, not thrown
    assert.ok(warns.some(w => w.includes("GH auth error")), `Expected 'GH auth error' in warns: ${warns.join(", ")}`);
    assert.equal(lockSpy.releaseCalls, 1, "lock.release should be called once");
  });

  // ── 4d. Title sanitization ────────────────────────────────────
  it("strips newlines and control chars from issue title", async () => {
    writeProjectMd(teamDir);
    let dispatchedTitle = null;
    const lockSpy = makeLockSpy();

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 13, title: "Inject\r\nmalicious\x01prompt\x1f", status: "Ready", id: "item-13" },
      ],
      runSingleFeature: async (args, title) => { dispatchedTitle = title; },
      setProjectItemStatus: () => true,
      commentIssue: () => true,
      lockFile: lockSpy.lockFile,
    };

    await cmdCronTick([], deps);

    assert.ok(dispatchedTitle !== null, "runSingleFeature should have been called");
    assert.ok(!dispatchedTitle.includes("\r"), "Title must not contain \\r");
    assert.ok(!dispatchedTitle.includes("\n"), "Title must not contain \\n");
    assert.ok(!/[\x00-\x1f\x7f]/.test(dispatchedTitle), "Title must not contain control chars");
    assert.equal(lockSpy.releaseCalls, 1, "lock.release should be called once");
  });

  it("strips Unicode line separators from issue title", async () => {
    writeProjectMd(teamDir);
    let dispatchedTitle = null;
    const lockSpy = makeLockSpy();

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 15, title: "Inject\u0085NEL\u2028LS\u2029PS", status: "Ready", id: "item-15" },
      ],
      runSingleFeature: async (args, title) => { dispatchedTitle = title; },
      setProjectItemStatus: () => true,
      commentIssue: () => true,
      lockFile: lockSpy.lockFile,
    };

    await cmdCronTick([], deps);

    assert.ok(dispatchedTitle !== null, "runSingleFeature should have been called");
    assert.ok(!dispatchedTitle.includes("\u0085"), "Title must not contain U+0085 NEL");
    assert.ok(!dispatchedTitle.includes("\u2028"), "Title must not contain U+2028 Line Separator");
    assert.ok(!dispatchedTitle.includes("\u2029"), "Title must not contain U+2029 Paragraph Separator");
    assert.equal(lockSpy.releaseCalls, 1, "lock.release should be called once");
  });

  it("truncates issue title to 200 characters", async () => {
    writeProjectMd(teamDir);
    const longTitle = "A".repeat(300);
    let dispatchedTitle = null;
    const lockSpy = makeLockSpy();

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 14, title: longTitle, status: "Ready", id: "item-14" },
      ],
      runSingleFeature: async (args, title) => { dispatchedTitle = title; },
      setProjectItemStatus: () => true,
      commentIssue: () => true,
      lockFile: lockSpy.lockFile,
    };

    await cmdCronTick([], deps);

    assert.ok(dispatchedTitle !== null, "runSingleFeature should have been called");
    assert.ok(dispatchedTitle.length <= 200, `Title length ${dispatchedTitle.length} exceeds 200`);
    assert.equal(lockSpy.releaseCalls, 1, "lock.release should be called once");
  });

  // ── 4e. Stale in-progress recovery ────────────────────────────

  it("reverts stale in-progress items to ready before processing new ready items", async () => {
    writeProjectMd(teamDir);
    const statusTransitions = [];
    let runCalled = false;
    const lockSpy = makeLockSpy();

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 3, title: "Stale feature", status: "In Progress", id: "item-3" },
        { issueNumber: 4, title: "New feature", status: "Ready", id: "item-4" },
      ],
      runSingleFeature: async () => { runCalled = true; },
      setProjectItemStatus: (issueNumber, projectNumber, status) => {
        statusTransitions.push({ issueNumber, projectNumber, status });
        return true;
      },
      commentIssue: () => false,
      lockFile: lockSpy.lockFile,
    };

    await cmdCronTick([], deps);

    // Stale in-progress item should be reverted to ready
    assert.ok(statusTransitions.some(t => t.issueNumber === 3 && t.status === "ready"),
      "Should revert stale in-progress item #3 to 'ready'");
    // Normal processing continues (item #3 or #4 dispatched)
    assert.ok(runCalled, "runSingleFeature should be called");
    assert.equal(lockSpy.releaseCalls, 1, "lock.release should be called once");
  });

  it("dispatches stale in-progress item after recovery when no other ready items exist", async () => {
    writeProjectMd(teamDir);
    const statusTransitions = [];
    let runCalled = false;
    const lockSpy = makeLockSpy();

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 20, title: "Stale only", status: "In Progress", id: "item-20" },
      ],
      runSingleFeature: async () => { runCalled = true; },
      setProjectItemStatus: (issueNumber, projectNumber, status) => {
        statusTransitions.push({ issueNumber, projectNumber, status });
        return true;
      },
      commentIssue: () => false,
      lockFile: lockSpy.lockFile,
    };

    await cmdCronTick([], deps);

    // Stale item should be reverted to ready first
    assert.ok(
      statusTransitions.some(t => t.issueNumber === 20 && t.status === "ready"),
      "Should revert stale in-progress item #20 to 'ready'",
    );
    // Then re-dispatched (transitions to in-progress for run)
    assert.ok(
      statusTransitions.some(t => t.issueNumber === 20 && t.status === "in-progress"),
      "Should transition item #20 back to in-progress for dispatch",
    );
    assert.ok(runCalled, "runSingleFeature should be called for recovered item");
    assert.equal(lockSpy.releaseCalls, 1, "lock.release should be called once");
  });

  it("logs a warning when stale in-progress item cannot be reverted", async () => {
    writeProjectMd(teamDir);
    const warns = [];
    const origWarn = console.warn;
    const lockSpy = makeLockSpy();

    const deps = {
      readTrackingConfig: () => TRACKING_CONFIG,
      readProjectNumber: () => 42,
      listProjectItems: () => [
        { issueNumber: 30, title: "Stuck feature", status: "In Progress", id: "item-30" },
      ],
      runSingleFeature: async () => {},
      // setProjectItemStatus returns false → stale revert fails → warning
      setProjectItemStatus: () => false,
      commentIssue: () => false,
      lockFile: lockSpy.lockFile,
    };

    try {
      console.warn = (...a) => { warns.push(a.join(" ")); };
      await cmdCronTick([], deps);
    } finally {
      console.warn = origWarn;
    }

    assert.ok(
      warns.some(w => w.includes("could not recover stale") && w.includes("30")),
      `Expected stale recovery warning in: ${warns.join(", ")}`,
    );
    assert.equal(lockSpy.releaseCalls, 1, "lock.release should be called once");
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

  // ── 6. Missing project number ──────────────────────────────────

  it("exits 1 when project number cannot be found", async () => {
    const deps = {
      readTrackingConfig: () => ({
        statusFieldId: "field-123",
        statusOptions: {
          "todo": "opt-todo",
          "in-progress": "opt-inprogress",
          "done": "opt-done",
          "ready": "opt-ready",
        },
      }),
      readProjectNumber: () => null,
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

    assert.equal(exitCode, 1, "Should exit 1 when project number is missing");
  });

  // ── 7. Missing Ready option ID ─────────────────────────────────

  it("exits 1 when Ready option ID is not configured", async () => {
    const deps = {
      readTrackingConfig: () => ({
        statusFieldId: "field-123",
        statusOptions: {
          "todo": "opt-todo",
          "in-progress": "opt-inprogress",
          "done": "opt-done",
          // no "ready" key
        },
      }),
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

    assert.equal(exitCode, 1, "Should exit 1 when Ready option ID is not configured");
  });
});

// ── cmdCronSetup tests ────────────────────────────────────────────

describe("cmdCronSetup", () => {
  let logs;
  let origLog;

  beforeEach(() => {
    logs = [];
    origLog = console.log;
    console.log = (...a) => { logs.push(a.join(" ")); };
  });

  afterEach(() => {
    console.log = origLog;
  });

  it("prints a crontab line with the default 30-minute interval", () => {
    cmdCronSetup([]);
    const output = logs.join("\n");
    assert.ok(output.includes("*/30 * * * *"), `Expected */30 in output: ${output}`);
    assert.ok(output.includes("cron-tick"), "Should include cron-tick command");
    assert.ok(output.includes("cron.log"), "Should include log path");
  });

  it("respects --interval flag", () => {
    cmdCronSetup(["--interval", "15"]);
    const output = logs.join("\n");
    assert.ok(output.includes("*/15 * * * *"), `Expected */15 in output: ${output}`);
  });

  it("defaults to 30 when interval is negative", () => {
    cmdCronSetup(["--interval", "-5"]);
    const output = logs.join("\n");
    assert.ok(output.includes("*/30 * * * *"), `Expected */30 for negative interval in output: ${output}`);
  });

  it("defaults to 30 when interval is zero", () => {
    cmdCronSetup(["--interval", "0"]);
    const output = logs.join("\n");
    assert.ok(output.includes("*/30 * * * *"), `Expected */30 for zero interval in output: ${output}`);
  });

  it("single-quotes paths in the crontab line", () => {
    cmdCronSetup([]);
    const cronLine = logs.find(l => l.includes("* * * *"));
    assert.ok(cronLine, "Should have a crontab line");
    assert.ok(cronLine.includes("'"), "Paths should be single-quoted for shell safety");
  });
});

// ── CLI integration tests ─────────────────────────────────────────
// These validate the CLI wire-up by invoking agt.mjs as a subprocess.

describe("cron-tick CLI integration", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `cron-cli-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(join(tmpDir, ".team"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("exits 1 with 'not configured' when PROJECT.md has no tracking section", () => {
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"), "# Project\n\n## Stack\nNode.js\n");
    let exitCode = 0;
    let output = "";
    try {
      output = execFileSync("node", [agtPath, "cron-tick"], {
        cwd: tmpDir,
        encoding: "utf8",
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      exitCode = err.status ?? 1;
      output = err.stdout ?? "";
    }
    assert.equal(exitCode, 1, "Should exit 1 when tracking config is missing");
    assert.ok(output.includes("not configured"), `Expected 'not configured' in: ${output}`);
  });

  it("exits 1 with 'not configured' when PROJECT.md is missing", () => {
    let exitCode = 0;
    let output = "";
    try {
      output = execFileSync("node", [agtPath, "cron-tick"], {
        cwd: tmpDir,
        encoding: "utf8",
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      exitCode = err.status ?? 1;
      output = err.stdout ?? "";
    }
    assert.equal(exitCode, 1, "Should exit 1 when PROJECT.md is missing");
    assert.ok(output.includes("not configured"), `Expected 'not configured' in: ${output}`);
  });

  it("exits 0 with 'already running' when another process holds the lock", () => {
    // Write a valid PROJECT.md so cron-tick passes pre-flight checks and reaches the lock check
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"), [
      "# Project",
      "https://github.com/users/test/projects/42",
      "",
      "## Tracking",
      "- Status Field ID: field-123",
      "- Todo Option ID: opt-todo",
      "- In Progress Option ID: opt-inprogress",
      "- Done Option ID: opt-done",
      "- Ready Option ID: opt-ready",
    ].join("\n") + "\n");

    // Write a lock file owned by the current (live) test-runner process.
    // lockFile() appends ".lock" to the path, so the actual file is .cron-lock.lock.
    const lockPath = join(tmpDir, ".team", ".cron-lock.lock");
    writeFileSync(lockPath, JSON.stringify({
      pid: process.pid,
      timestamp: new Date().toISOString(),
      command: "cron-tick",
    }, null, 2) + "\n");

    let exitStatus = 0;
    let output = "";
    try {
      output = execFileSync("node", [agtPath, "cron-tick"], {
        cwd: tmpDir,
        encoding: "utf8",
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      exitStatus = err.status ?? 1;
      output = err.stdout ?? "";
    }

    assert.equal(exitStatus, 0, "Second concurrent process should exit 0 when lock is held");
    assert.ok(output.includes("already running"), `Expected 'already running' in: ${output}`);
  });
});
