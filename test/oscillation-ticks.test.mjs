// Tests for ticks field — increments on every → in-progress transition

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const harnessPath = join(__dirname, "..", "bin", "agt-harness.mjs");
const testDir = join(__dirname, ".test-workspace-ticks");

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

function makeState(tasks, extra = {}) {
  return {
    version: "2.0",
    feature: "ticks-test",
    status: "active",
    tasks,
    gates: [],
    transitionCount: 0,
    transitionHistory: [],
    _written_by: "at-harness",
    _last_modified: new Date().toISOString(),
    _write_nonce: "abcd1234abcd1234",
    ...extra,
  };
}

function readState(featureName) {
  const p = join(testDir, "features", featureName, "STATE.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

function setupFeature(featureName, tasks) {
  const dir = join(testDir, "features", featureName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "STATE.json"), JSON.stringify(makeState(tasks), null, 2));
  return join("features", featureName);
}

describe("ticks field", () => {
  before(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("ticks starts undefined on a new task (no ticks field)", () => {
    const dir = setupFeature("ticks-new", [
      { id: "t1", status: "pending", title: "task one" },
    ]);
    const state = readState("ticks-new");
    assert.equal(state.tasks[0].ticks, undefined);
  });

  it("ticks is 1 after first pending → in-progress", () => {
    const dir = setupFeature("ticks-first", [
      { id: "t1", status: "pending", title: "task one" },
    ]);
    const result = harnessJSON("transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    assert.equal(result.allowed, true);
    const state = readState("ticks-first");
    assert.equal(state.tasks[0].ticks, 1);
  });

  it("ticks is 2 after failed → in-progress retry", () => {
    const dir = setupFeature("ticks-retry", [
      { id: "t1", status: "pending", title: "task one" },
    ]);
    // pending → in-progress (ticks=1)
    harnessJSON("transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    // in-progress → failed
    harnessJSON("transition", "--task", "t1", "--status", "failed", "--dir", dir);
    // failed → in-progress (ticks=2)
    const result = harnessJSON("transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    assert.equal(result.allowed, true);
    const state = readState("ticks-retry");
    assert.equal(state.tasks[0].ticks, 2);
  });

  it("ticks is 2 after blocked → in-progress", () => {
    const dir = setupFeature("ticks-blocked", [
      { id: "t1", status: "pending", title: "task one" },
    ]);
    // pending → in-progress (ticks=1)
    harnessJSON("transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    // in-progress → blocked
    harnessJSON("transition", "--task", "t1", "--status", "blocked", "--dir", dir);
    // blocked → in-progress (ticks=2)
    const result = harnessJSON("transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    assert.equal(result.allowed, true);
    const state = readState("ticks-blocked");
    assert.equal(state.tasks[0].ticks, 2);
  });

  it("ticks does NOT increment on in-progress → passed", () => {
    const dir = setupFeature("ticks-passed", [
      { id: "t1", status: "pending", title: "task one" },
    ]);
    harnessJSON("transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    harnessJSON("transition", "--task", "t1", "--status", "passed", "--dir", dir);
    const state = readState("ticks-passed");
    // ticks should still be 1 — only incremented on → in-progress
    assert.equal(state.tasks[0].ticks, 1);
  });

  it("ticks does NOT increment on in-progress → failed", () => {
    const dir = setupFeature("ticks-failed", [
      { id: "t1", status: "pending", title: "task one" },
    ]);
    harnessJSON("transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    harnessJSON("transition", "--task", "t1", "--status", "failed", "--dir", dir);
    const state = readState("ticks-failed");
    assert.equal(state.tasks[0].ticks, 1);
  });

  it("ticks accumulates across multiple retries", () => {
    const dir = setupFeature("ticks-multi", [
      { id: "t1", status: "pending", title: "task one" },
    ]);
    // 3 in-progress dispatches using mixed states to avoid oscillation detection:
    // pending→IP(1), IP→failed, failed→IP(2), IP→blocked, blocked→IP(3)
    harnessJSON("transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    harnessJSON("transition", "--task", "t1", "--status", "failed", "--dir", dir);
    harnessJSON("transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    harnessJSON("transition", "--task", "t1", "--status", "blocked", "--dir", dir);
    const r = harnessJSON("transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    assert.equal(r.allowed, true);
    const state = readState("ticks-multi");
    assert.equal(state.tasks[0].ticks, 3);
  });

  it("ticks is backward-compatible — old tasks without ticks start from 0", () => {
    // Task without `ticks` field — treated as 0, so first dispatch → ticks=1
    const dir = setupFeature("ticks-compat", [
      { id: "t1", status: "pending", title: "task without ticks field" },
    ]);
    harnessJSON("transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    const state = readState("ticks-compat");
    assert.equal(state.tasks[0].ticks, 1);
  });

  it("ticks are per-task — other tasks unaffected", () => {
    const dir = setupFeature("ticks-pertask", [
      { id: "t1", status: "pending", title: "task one" },
      { id: "t2", status: "pending", title: "task two" },
    ]);
    harnessJSON("transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    harnessJSON("transition", "--task", "t1", "--status", "passed", "--dir", dir);
    harnessJSON("transition", "--task", "t2", "--status", "in-progress", "--dir", dir);
    const state = readState("ticks-pertask");
    const t1 = state.tasks.find(t => t.id === "t1");
    const t2 = state.tasks.find(t => t.id === "t2");
    assert.equal(t1.ticks, 1);
    assert.equal(t2.ticks, 1);
  });
});
