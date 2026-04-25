// Tests for bin/lib/cron.mjs — cron-tick command
// Uses Node.js built-in test runner (node --test)

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
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
    const inProgressIdx = statusTransitions.findIndex(t => t.issueNumber === 7 && t.status === "in-progress");
    const doneIdx = statusTransitions.findIndex(t => t.issueNumber === 7 && t.status === "done");
    assert.ok(inProgressIdx !== -1, "Should transition issue to in-progress before running");
    assert.ok(doneIdx !== -1, "Should transition issue to done after success");
    assert.ok(inProgressIdx < doneIdx, "in-progress must come before done");
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
});
