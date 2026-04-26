// Tests for bin/lib/report.mjs — agt report command
// Uses Node.js built-in test runner (node --test)

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { spawnSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const agtPath = join(__dirname, "..", "bin", "agt.mjs");

import { cmdReport, buildReport } from "../bin/lib/report.mjs";

function createTmpDir() {
  const dir = join(tmpdir(), `report-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeState(overrides = {}) {
  return {
    version: "2.0",
    feature: "test-feature",
    status: "completed",
    tasks: [
      { id: "task-1", title: "Do something", status: "passed", attempts: 1 },
      { id: "task-2", title: "Do something else", status: "passed", attempts: 0 },
    ],
    gates: [
      { taskId: "task-1", verdict: "PASS", command: "npm test", exitCode: 0 },
      { taskId: "task-2", verdict: "PASS", command: "npm test", exitCode: 0 },
    ],
    transitionCount: 4,
    createdAt: "2026-01-01T10:00:00.000Z",
    completedAt: "2026-01-01T11:00:00.000Z",
    _last_modified: "2026-01-01T11:00:00.000Z",
    _written_by: "at-harness",
    _write_nonce: "abc123",
    ...overrides,
  };
}

describe("buildReport", () => {
  it("includes feature name in header", () => {
    const state = makeState({ feature: "my-cool-feature" });
    const report = buildReport(state);
    assert.ok(report.includes("my-cool-feature"), "Should include feature name");
  });

  it("includes Task Summary section with Title column", () => {
    const state = makeState();
    const report = buildReport(state);
    assert.ok(report.includes("## Task Summary"), "Should have Task Summary section");
    assert.ok(report.includes("| Task | Title | Status | Attempts | Gate Verdict |"), "Should have 5-column header");
    assert.ok(report.includes("task-1"), "Should include task-1");
    assert.ok(report.includes("Do something"), "Should include task title");
    assert.ok(report.includes("PASS"), "Should show gate verdict");
  });

  it("shows — for task title when title is absent", () => {
    const state = makeState({
      tasks: [
        { id: "task-1", status: "passed", attempts: 1 },
      ],
    });
    const report = buildReport(state);
    // Table row should have — for missing title
    assert.ok(report.includes("| task-1 | — |"), "Should show — for missing title");
  });

  it("includes What Shipped section for passed tasks", () => {
    const state = makeState();
    const report = buildReport(state);
    assert.ok(report.includes("## What Shipped"), "Should have What Shipped section");
    assert.ok(report.includes("- Do something"), "Should list passed task title");
    assert.ok(report.includes("- Do something else"), "Should list second passed task title");
  });

  it("omits What Shipped section when no tasks passed", () => {
    const state = makeState({
      tasks: [
        { id: "task-1", title: "Blocked task", status: "blocked", attempts: 1 },
      ],
    });
    const report = buildReport(state);
    assert.ok(!report.includes("## What Shipped"), "Should not have What Shipped section when no tasks passed");
  });

  it("shows — for tasks with no gate runs", () => {
    const state = makeState({
      gates: [],
    });
    const report = buildReport(state);
    assert.ok(report.includes("—"), "Should show — for missing gate verdict");
  });

  it("includes Cost Breakdown section with dispatch and gate counts", () => {
    const state = makeState();
    const report = buildReport(state);
    assert.ok(report.includes("## Cost Breakdown"), "Should have Cost Breakdown section");
    assert.ok(report.includes("Dispatches"), "Should include dispatch count");
    assert.ok(report.includes("Gate runs"), "Should include gate run count");
    assert.ok(report.includes("N/A"), "Should show N/A for USD cost");
  });

  it("includes Blocked section with lastReason for blocked tasks", () => {
    const state = makeState({
      feature: "blocked-feature",
      status: "executing",
      tasks: [
        { id: "task-1", title: "Hard task", status: "blocked", attempts: 2, lastReason: "Gate failed repeatedly" },
        { id: "task-2", title: "Easy task", status: "passed", attempts: 1 },
      ],
    });
    const report = buildReport(state);
    assert.ok(report.includes("## Blocked / Failed Tasks"), "Should include Blocked / Failed Tasks section");
    assert.ok(report.includes("Gate failed repeatedly"), "Should include lastReason");
    assert.ok(report.includes("BLOCKED"), "Should show BLOCKED label");
  });

  it("does not show Blocked section when no problem tasks", () => {
    const state = makeState();
    const report = buildReport(state);
    assert.ok(!report.includes("## Blocked"), "Should not show Blocked section for all-passed tasks");
  });

  it("includes Recommendations for tasks with >= 3 attempts", () => {
    const state = makeState({
      tasks: [
        { id: "task-1", title: "Retry task", status: "passed", attempts: 3 },
      ],
    });
    const report = buildReport(state);
    assert.ok(report.includes("## Recommendations"), "Should have Recommendations section");
    assert.ok(report.includes("task-1"), "Should mention the retried task");
  });

  it("does NOT include Recommendations for tasks with only 2 attempts", () => {
    const state = makeState({
      tasks: [
        { id: "task-1", title: "Retry task", status: "passed", attempts: 2 },
      ],
    });
    const report = buildReport(state);
    assert.ok(!report.includes("Consider simplifying task task-1"), "Should not fire recommendation for attempts < 3");
  });

  it("includes gate warning recommendation when task has gateWarningHistory", () => {
    const state = makeState({
      tasks: [
        { id: "task-1", title: "Warn task", status: "passed", attempts: 1, gateWarningHistory: [{ iteration: 1, layers: ["fabricated-refs"] }] },
      ],
    });
    const report = buildReport(state);
    assert.ok(report.includes("## Recommendations"), "Should have Recommendations section");
    assert.ok(report.includes("gate warnings"), "Should mention gate warnings");
    assert.ok(report.includes("fabricated-refs"), "Should include warning layer");
  });

  it("handles blocked task without lastReason without throwing", () => {
    const state3 = makeState({
      tasks: [
        { id: "task-1", status: "blocked", attempts: 0 },
      ],
    });
    const report = buildReport(state3);
    assert.ok(!report.includes("Reason:"), "Should not include Reason: line when lastReason is absent");
  });

  it("handles failed task without lastReason without throwing", () => {
    const state3 = makeState({
      tasks: [
        { id: "task-1", status: "failed", attempts: 1 },
      ],
    });
    const report = buildReport(state3);
    assert.ok(!report.includes("Reason:"), "Should not include Reason: line when lastReason is absent");
  });

  it("marks in-progress features in header", () => {
    const state = makeState({ status: "executing", completedAt: undefined });
    const report = buildReport(state);
    assert.ok(report.includes("run in progress"), "Should mark in-progress with 'run in progress' label");
  });

  it("marks failed features in header", () => {
    const state = makeState({ status: "failed" });
    const report = buildReport(state);
    assert.ok(report.includes("failed"), "Should show failed status in header");
    assert.ok(!report.includes("run in progress"), "Should not show 'run in progress' for a failed feature");
  });

  it("shows [FAILED] label for failed tasks in blocked/failed section", () => {
    const state = makeState({
      feature: "failed-feature",
      status: "failed",
      tasks: [
        { id: "task-1", title: "Bad task", status: "failed", attempts: 2, lastReason: "Unrecoverable error" },
      ],
    });
    const report = buildReport(state);
    assert.ok(report.includes("## Blocked / Failed Tasks"), "Should have Blocked/Failed section");
    assert.ok(report.includes("[FAILED]"), "Should show [FAILED] label");
    assert.ok(report.includes("Unrecoverable error"), "Should include lastReason");
  });

  it("marks completed features in header", () => {
    const state = makeState({ status: "completed" });
    const report = buildReport(state);
    assert.ok(report.includes("completed"), "Should show completed status");
  });

  it("stalled feature recommendation when all tasks are blocked", () => {
    const state = makeState({
      status: "executing",
      tasks: [
        { id: "task-1", status: "blocked", attempts: 1 },
        { id: "task-2", status: "blocked", attempts: 1 },
      ],
    });
    const report = buildReport(state);
    assert.ok(report.includes("stalled"), "Should recommend stalled for all-blocked feature");
  });

  it("marks blocked features in header", () => {
    const state = makeState({ status: "blocked" });
    const report = buildReport(state);
    assert.ok(report.includes("blocked"), "Should show blocked status in header");
    assert.ok(!report.includes("run in progress"), "Should not show 'run in progress' for a blocked feature");
  });

  it("renders tokenUsage.byPhase in Cost Breakdown", () => {
    const state = makeState({
      tokenUsage: {
        total: { costUsd: 0.01 },
        byPhase: { build: { costUsd: 0.006 }, gate: { costUsd: 0.004 } },
      },
    });
    const report = buildReport(state);
    assert.ok(report.includes("$0.0060"), "Should show per-phase cost for build");
    assert.ok(report.includes("$0.0040"), "Should show per-phase cost for gate");
  });

  it("escapes pipe characters in task.title in the table row", () => {
    const state = makeState({
      tasks: [
        { id: "task-1", title: "Fix | pipe | issue", status: "passed", attempts: 1 },
      ],
      gates: [
        { taskId: "task-1", verdict: "PASS", command: "npm test", exitCode: 0 },
      ],
    });
    const report = buildReport(state);
    const lines = report.split("\n");
    const tableRow = lines.find(l => l.includes("task-1") && l.includes("passed"));
    assert.ok(tableRow, "Should have a table row for task-1");
    // Pipe in title should be escaped so markdown renderers treat them as literals
    assert.ok(tableRow.includes("\\|"), "Pipe in title should be escaped with backslash");
    // Count unescaped pipes (column delimiters) — should be 6 (outer + 4 inner separators)
    const unescapedPipes = tableRow.split(/(?<!\\)\|/).length - 1;
    assert.equal(unescapedPipes, 6, `Table row should have 6 unescaped pipe delimiters but got ${unescapedPipes}: ${tableRow}`);
  });

  it("renders N/A duration for invalid createdAt ISO string", () => {
    const state = makeState({
      createdAt: "not-a-date",
      completedAt: "2026-01-01T11:00:00.000Z",
    });
    const report = buildReport(state);
    assert.ok(!report.includes("NaN"), "Should not contain NaN for invalid createdAt");
    assert.ok(report.includes("Duration: N/A"), "Should show N/A for invalid createdAt");
  });

  it("falls back to task.id in What Shipped when title is absent", () => {
    const state = makeState({
      tasks: [
        { id: "task-1", status: "passed", attempts: 1 },
      ],
    });
    const report = buildReport(state);
    assert.ok(report.includes("## What Shipped"), "Should have What Shipped section");
    assert.ok(report.includes("- task-1"), "Should fall back to task.id when title is absent");
  });
});

describe("cmdReport", () => {
  let tmpDir;
  let exitCode;
  let output;
  let originalExit;

  beforeEach(() => {
    tmpDir = createTmpDir();
    output = [];
    exitCode = null;
    originalExit = process.exit;
    process.exit = (code) => { exitCode = code ?? 0; throw new Error(`process.exit(${code})`); };
  });

  afterEach(() => {
    process.exit = originalExit;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeDeps(featureExists, state) {
    const writtenFiles = {};
    const stderrOutput = [];
    return {
      readState: () => state,
      existsSync: () => featureExists,
      writeFileSync: (path, data) => { writtenFiles[path] = data; },
      stdout: { write: (s) => { output.push(s); } },
      stderr: { write: (s) => { stderrOutput.push(s); } },
      exit: (code) => { exitCode = code; throw new Error(`exit(${code})`); },
      cwd: () => tmpDir,
      _writtenFiles: writtenFiles,
      _stderrOutput: stderrOutput,
    };
  }

  // ── 1. Missing feature name ───────────────────────────────────

  it("exits 1 with usage when no feature name given", () => {
    const deps = makeDeps(false, null);
    try { cmdReport([], deps); } catch {}
    assert.equal(exitCode, 1);
    assert.ok(deps._stderrOutput.join("").includes("Usage:"), `Expected Usage in stderr: ${deps._stderrOutput.join("")}`);
  });

  // ── 2. Missing feature directory ─────────────────────────────

  it("exits 1 when feature directory does not exist", () => {
    const deps = makeDeps(false, null);
    try { cmdReport(["no-such-feature"], deps); } catch {}
    assert.equal(exitCode, 1);
    assert.ok(deps._stderrOutput.join("").includes("not found"), `Expected 'not found' in stderr: ${deps._stderrOutput.join("")}`);
  });

  // ── 3. Missing STATE.json ─────────────────────────────────────

  it("exits 1 when STATE.json is missing", () => {
    const deps = makeDeps(true, null);
    try { cmdReport(["my-feature"], deps); } catch {}
    assert.equal(exitCode, 1);
    assert.ok(deps._stderrOutput.join("").includes("STATE.json"), `Expected STATE.json in stderr: ${deps._stderrOutput.join("")}`);
  });

  // ── 4. Stdout default output ──────────────────────────────────

  it("prints report to stdout for a completed feature", () => {
    const state = makeState();
    const deps = makeDeps(true, state);
    cmdReport(["test-feature"], deps);
    const out = output.join("");
    assert.ok(out.includes("test-feature"), "Should include feature name");
    assert.ok(out.includes("Task Summary"), "Should include Task Summary section");
    assert.ok(out.includes("task-1"), "Should include task-1");
    assert.ok(out.includes("passed"), "Should show passed status");
    assert.equal(exitCode, null, "Should not exit with error");
  });

  // ── 5. --output md writes REPORT.md ──────────────────────────

  it("writes REPORT.md to feature dir when --output md is given", () => {
    const state = makeState();
    const deps = makeDeps(true, state);
    cmdReport(["test-feature", "--output", "md"], deps);
    const reportPath = join(tmpDir, ".team", "features", "test-feature", "REPORT.md");
    assert.ok(deps._writtenFiles[reportPath], "Should write REPORT.md");
    assert.ok(deps._writtenFiles[reportPath].includes("test-feature"), "REPORT.md should contain feature name");
    assert.ok(output.join("").includes("written to"), "Should print confirmation");
  });

  // ── 6. --output md does not print report to stdout ───────────

  it("does not print full report to stdout when --output md is given", () => {
    const state = makeState();
    const deps = makeDeps(true, state);
    cmdReport(["test-feature", "--output", "md"], deps);
    const out = output.join("");
    assert.ok(!out.includes("## Task Summary"), "Should not print Task Summary to stdout in md mode");
  });

  // ── 7. Blocked tasks in report ───────────────────────────────

  it("includes blocked tasks and their reasons in stdout report", () => {
    const state = makeState({
      feature: "blocked-feature",
      status: "executing",
      tasks: [
        { id: "task-1", title: "Hard task", status: "blocked", attempts: 2, lastReason: "Gate failed repeatedly" },
        { id: "task-2", title: "Easy task", status: "passed", attempts: 1 },
      ],
    });
    const deps = makeDeps(true, state);
    cmdReport(["blocked-feature"], deps);
    const out = output.join("");
    assert.ok(out.includes("Blocked"), "Should include Blocked section");
    assert.ok(out.includes("Gate failed repeatedly"), "Should include lastReason");
  });

  // ── 8. agt help report has usage string ──────────────────────

  it("agt help report: outputs usage, --output flag, and example", () => {
    const result = spawnSync("node", [agtPath, "help", "report"], {
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(result.status, 0, `agt help report should exit 0; stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes("agt report"), "Should include usage with 'agt report'");
    assert.ok(result.stdout.includes("--output"), "Should mention --output flag");
    assert.ok(result.stdout.includes("agt report my-feature"), "Should include an example");
  });

  // ── 9. --output md with flag before feature name ─────────────

  it("writes REPORT.md when --output md precedes the feature name", () => {
    const state = makeState();
    const deps = makeDeps(true, state);
    cmdReport(["--output", "md", "test-feature"], deps);
    const reportPath = join(tmpDir, ".team", "features", "test-feature", "REPORT.md");
    assert.ok(deps._writtenFiles[reportPath], "Should write REPORT.md");
    assert.ok(output.join("").includes("written to"), "Should print confirmation");
    assert.ok(!output.join("").includes("## Task Summary"), "Should not print report to stdout");
  });

  // ── 10. --output with unsupported format ────────────────────

  it("exits 1 when --output value is not md", () => {
    const deps = makeDeps(true, makeState());
    try { cmdReport(["my-feature", "--output", "txt"], deps); } catch {}
    assert.equal(exitCode, 1);
    assert.ok(deps._stderrOutput.join("").includes("unsupported output format"), `Expected unsupported format error: ${deps._stderrOutput.join("")}`);
  });

  // ── 11. --output without value ──────────────────────────────

  it("exits 1 when --output has no value", () => {
    const deps = makeDeps(true, makeState());
    try { cmdReport(["my-feature", "--output"], deps); } catch {}
    assert.equal(exitCode, 1);
    assert.ok(deps._stderrOutput.join("").includes("unsupported output format"), `Expected unsupported format error: ${deps._stderrOutput.join("")}`);
  });

  // ── 12. Path traversal rejected ─────────────────────────────

  it("exits 1 when feature name contains path traversal", () => {
    const deps = makeDeps(true, makeState());
    try { cmdReport(["../../etc"], deps); } catch {}
    assert.equal(exitCode, 1);
    assert.ok(deps._stderrOutput.join("").includes("invalid feature name"), `Expected invalid feature name: ${deps._stderrOutput.join("")}`);
  });

  it("exits 1 when feature name is '.'", () => {
    const deps = makeDeps(true, makeState());
    try { cmdReport(["."], deps); } catch {}
    assert.equal(exitCode, 1);
    assert.ok(deps._stderrOutput.join("").includes("invalid feature name"), `Expected invalid feature name for '.': ${deps._stderrOutput.join("")}`);
  });

  it("exits 1 when feature name is '..'", () => {
    const deps = makeDeps(true, makeState());
    try { cmdReport([".."], deps); } catch {}
    assert.equal(exitCode, 1);
    assert.ok(deps._stderrOutput.join("").includes("invalid feature name"), `Expected invalid feature name for '..': ${deps._stderrOutput.join("")}`);
  });
});
