// Tests for ticks field — increments on every → in-progress transition

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { applyReplan } from "../bin/lib/replan.mjs";
import { readState as utilReadState, writeState as utilWriteState } from "../bin/lib/util.mjs";

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

function harnessWithEnv(env, ...args) {
  return execFileSync("node", [harnessPath, ...args], {
    encoding: "utf8",
    cwd: testDir,
    timeout: 10000,
    env: { ...process.env, ...env },
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

function harnessWithEnvJSON(env, ...args) {
  const out = harnessWithEnv(env, ...args);
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

describe("tick-limit enforcement", () => {
  before(() => { mkdirSync(testDir, { recursive: true }); });

  it("rejects in-progress when ticks >= TASK_MAX_TICKS", () => {
    const dir = setupFeature("tick-limit-reject", [
      { id: "t1", status: "pending", title: "task one" },
    ]);
    const env = { TASK_MAX_TICKS: "2" };
    // dispatch 1: ticks 0→1
    harnessWithEnvJSON(env, "transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    harnessWithEnvJSON(env, "transition", "--task", "t1", "--status", "failed", "--dir", dir);
    // dispatch 2: ticks 1→2
    harnessWithEnvJSON(env, "transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    harnessWithEnvJSON(env, "transition", "--task", "t1", "--status", "failed", "--dir", dir);
    // dispatch 3 attempt: ticks=2 >= 2 → blocked
    const result = harnessWithEnvJSON(env, "transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    assert.equal(result.allowed, false);
    assert.match(result.reason, /tick-limit-exceeded/);
    const state = readState("tick-limit-reject");
    assert.equal(state.tasks[0].status, "blocked");
    assert.equal(state.tasks[0].lastReason, "tick-limit-exceeded");
  });

  it("invalid TASK_MAX_TICKS falls back to default of 6", () => {
    const dir = setupFeature("tick-limit-nan", [
      { id: "t1", status: "pending", title: "task one" },
    ]);
    const env = { TASK_MAX_TICKS: "abc" };
    // ticks=0 → 1: should be allowed (limit is 6, not 2)
    harnessWithEnvJSON(env, "transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    harnessWithEnvJSON(env, "transition", "--task", "t1", "--status", "failed", "--dir", dir);
    // ticks=1 → 2: still allowed (1 < 6)
    const result = harnessWithEnvJSON(env, "transition", "--task", "t1", "--status", "in-progress", "--dir", dir);
    assert.equal(result.allowed, true, "should be allowed: NaN falls back to 6, ticks=1 < 6");
  });
});

describe("oscillation detection", () => {
  before(() => { mkdirSync(testDir, { recursive: true }); });

  it("halts feature with exit code 1 after 3 reps of K=2 pattern", () => {
    const dir = setupFeature("osc-halt-k2", [
      { id: "t1", status: "pending", title: "task one" },
    ]);
    const env = { ...process.env, TASK_MAX_TICKS: "20" };

    function tr(status) {
      const out = execFileSync("node", [harnessPath, "transition", "--task", "t1", "--status", status, "--dir", dir], {
        encoding: "utf8", cwd: testDir, timeout: 10000, env,
      });
      const lines = out.trim().split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        try { return JSON.parse(lines[i]); } catch {}
      }
    }

    // Build 6-entry history: [IP, F, IP, F, IP, F]
    tr("in-progress");  // 1: pending→IP
    tr("failed");       // 2: IP→F
    tr("in-progress");  // 3: F→IP (retries=1)
    tr("failed");       // 4: IP→F
    tr("in-progress");  // 5: F→IP (retries=2) — warns at reps=2
    tr("failed");       // 6: IP→F

    // 7th transition: oscillation check sees 3 reps of [in-progress, failed] → exit(1)
    const result = spawnSync("node", [harnessPath, "transition", "--task", "t1", "--status", "in-progress", "--dir", dir], {
      encoding: "utf8", cwd: testDir, timeout: 10000, env,
    });
    assert.equal(result.status, 1, "expected exit code 1 for oscillation halt");
    const lines = result.stdout.trim().split("\n");
    let out;
    for (let i = lines.length - 1; i >= 0; i--) {
      try { out = JSON.parse(lines[i]); break; } catch {}
    }
    assert.equal(out.allowed, false);
    assert.equal(out.halt, true);
    assert.match(out.reason, /oscillation-halted/);
  });
});

describe("replan tick inheritance", () => {
  it("split replan: new tasks inherit ticks = blockedTask.ticks + 1", () => {
    const blockedTask = { id: "t1", title: "original", status: "blocked", ticks: 3, attempts: 2 };
    const tasks = [blockedTask];
    applyReplan(tasks, blockedTask, {
      verdict: "split",
      rationale: "split into pieces",
      tasks: [
        { title: "sub 1", description: "first part" },
        { title: "sub 2", description: "second part" },
      ],
    });
    assert.equal(tasks.length, 3);
    assert.equal(tasks[1].ticks, 4, "split task 1 should inherit ticks+1");
    assert.equal(tasks[2].ticks, 4, "split task 2 should inherit ticks+1");
  });

  it("inject replan: prereq and retry tasks inherit ticks = blockedTask.ticks + 1", () => {
    const blockedTask = { id: "t2", title: "original", status: "blocked", ticks: 2, attempts: 1 };
    const tasks = [blockedTask];
    applyReplan(tasks, blockedTask, {
      verdict: "inject",
      rationale: "inject a prereq",
      tasks: [{ title: "prereq task", description: "prerequisite" }],
    });
    assert.equal(tasks.length, 3);
    assert.equal(tasks[1].ticks, 3, "prereq task should inherit ticks+1");
    assert.equal(tasks[2].ticks, 3, "retry task should inherit ticks+1");
  });

  it("split replan: blocked task with ticks=0 produces ticks=1 in new tasks", () => {
    const blockedTask = { id: "t3", title: "original", status: "blocked", attempts: 1 };
    const tasks = [blockedTask];
    applyReplan(tasks, blockedTask, {
      verdict: "split",
      rationale: "split with no prior ticks",
      tasks: [
        { title: "sub 1", description: "" },
        { title: "sub 2", description: "" },
      ],
    });
    assert.equal(tasks[1].ticks, 1);
    assert.equal(tasks[2].ticks, 1);
  });
});

describe("replan tick inheritance — STATE.json sync", () => {
  const syncTestDir = join(__dirname, ".test-workspace-ticks-sync");
  before(() => { mkdirSync(syncTestDir, { recursive: true }); });
  after(() => { rmSync(syncTestDir, { recursive: true, force: true }); });

  it("syncing ticks from STATE.json before applyReplan gives correct ticks to replacement tasks", () => {
    // STATE.json has task with ticks: 5 (updated by harness subprocess)
    const stateTask = { id: "t-sync", title: "the task", status: "blocked", ticks: 5, attempts: 3 };
    const initialState = { status: "active", tasks: [stateTask], transitionHistory: [] };
    utilWriteState(syncTestDir, initialState);

    // In-memory task is stale: ticks is undefined (never synced from STATE.json)
    const staleTask = { id: "t-sync", title: "the task", status: "blocked", ticks: undefined, attempts: 3 };
    const inMemoryTasks = [staleTask];

    // Simulate the fixed run.mjs pattern: read fresh ticks before calling applyReplan
    const freshState = utilReadState(syncTestDir);
    if (freshState) {
      const ft = freshState.tasks.find(t => t.id === staleTask.id);
      if (ft !== undefined) staleTask.ticks = ft.ticks;
    }
    applyReplan(inMemoryTasks, staleTask, {
      verdict: "split",
      rationale: "needs split",
      tasks: [{ title: "part A", description: "" }, { title: "part B", description: "" }],
    });
    assert.equal(staleTask.ticks, 5, "stale task should be synced to ticks=5 from STATE.json");
    assert.equal(inMemoryTasks[1].ticks, 6, "replacement task 1 should get ticks=6 (5+1)");
    assert.equal(inMemoryTasks[2].ticks, 6, "replacement task 2 should get ticks=6 (5+1)");
  });

  it("merging new tasks into STATE.json does not overwrite harness-updated ticks on blocked task", () => {
    // STATE.json has blocked task with ticks: 4 (incremented by harness)
    const stateTask = { id: "t-merge", title: "blocker", status: "blocked", ticks: 4, attempts: 3 };
    const otherTask = { id: "t-other", title: "other", status: "pending", ticks: 0, attempts: 0 };
    const state = { status: "active", tasks: [stateTask, otherTask], transitionHistory: [] };
    utilWriteState(syncTestDir, state);

    // In-memory tasks with stale ticks
    const staleBlocked = { id: "t-merge", title: "blocker", status: "blocked", ticks: undefined, attempts: 3 };
    const staleOther = { id: "t-other", title: "other", status: "pending", ticks: 0, attempts: 0 };
    const inMemoryTasks = [staleBlocked, staleOther];

    // Sync ticks from fresh state
    const freshState = utilReadState(syncTestDir);
    if (freshState) {
      const ft = freshState.tasks.find(t => t.id === staleBlocked.id);
      if (ft !== undefined) staleBlocked.ticks = ft.ticks;
    }

    applyReplan(inMemoryTasks, staleBlocked, {
      verdict: "inject",
      rationale: "needs prereq",
      tasks: [{ title: "prereq", description: "" }],
    });

    // Simulate the fixed merge pattern
    const updState = utilReadState(syncTestDir);
    if (updState) {
      const existingIds = new Set(updState.tasks.map(t => t.id));
      const newTasks = inMemoryTasks.filter(t => !existingIds.has(t.id));
      const bi = updState.tasks.findIndex(t => t.id === staleBlocked.id);
      updState.tasks.splice(bi + 1, 0, ...newTasks);
      utilWriteState(syncTestDir, updState);
    }

    const finalState = utilReadState(syncTestDir);
    const finalBlocked = finalState.tasks.find(t => t.id === "t-merge");
    assert.equal(finalBlocked.ticks, 4, "blocked task ticks should be preserved from STATE.json (not overwritten by stale in-memory value)");
    const prereq = finalState.tasks.find(t => t.id === "t-merge-p1");
    assert.ok(prereq, "prereq task should be in STATE.json");
    assert.equal(prereq.ticks, 5, "prereq task ticks should be 4+1=5");
    const retry = finalState.tasks.find(t => t.id === "t-merge-r1");
    assert.ok(retry, "retry task should be in STATE.json");
    assert.equal(retry.ticks, 5, "retry task ticks should be 4+1=5");
    // other task should still be there
    assert.ok(finalState.tasks.find(t => t.id === "t-other"), "unrelated task should still be in STATE.json");
  });
});
