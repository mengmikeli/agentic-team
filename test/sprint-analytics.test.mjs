// Tests for sprint analytics — computeSprintMetrics and helper functions
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  parseDateRange,
  parseSprints,
  findTargetSprint,
  computeCycleTime,
  computeFailureRate,
  computeGatePassRate,
  computeFlowUsage,
  computeReplanRate,
  computeSprintMetrics,
} from "../bin/lib/sprint-analytics.mjs";

// ── parseDateRange ──────────────────────────────────────────────

describe("parseDateRange", () => {
  it("parses 'Apr 14–18'", () => {
    const r = parseDateRange("Apr 14–18");
    assert.ok(r, "should return a range");
    assert.equal(r.start.getMonth(), 3); // April = 3 (0-indexed)
    assert.equal(r.start.getDate(), 14);
    assert.equal(r.end.getDate(), 18);
  });

  it("parses 'Apr 1–14'", () => {
    const r = parseDateRange("Apr 1–14");
    assert.ok(r);
    assert.equal(r.start.getDate(), 1);
    assert.equal(r.end.getDate(), 14);
  });

  it("parses single-day 'Apr 14'", () => {
    const r = parseDateRange("Apr 14");
    assert.ok(r);
    assert.equal(r.start.getDate(), 14);
    assert.equal(r.end.getDate(), 14);
  });

  it("returns null for invalid input", () => {
    const r = parseDateRange("not a date");
    assert.equal(r, null);
  });

  it("parses hyphen separator 'Apr 14-18'", () => {
    const r = parseDateRange("Apr 14-18");
    assert.ok(r);
    assert.equal(r.start.getDate(), 14);
    assert.equal(r.end.getDate(), 18);
  });
});

// ── parseSprints ────────────────────────────────────────────────

describe("parseSprints", () => {
  it("parses sprint table from SPRINTS.md", () => {
    const tmpDir = join(tmpdir(), `sa-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    const sprintsPath = join(tmpDir, "SPRINTS.md");
    writeFileSync(sprintsPath, `# Sprint History\n\n| Sprint | Status | Version | Dates | Commits | Model |\n|--------|--------|---------|-------|---------|-------|\n| s3-hardening | ✅ Done | v2.1 | Apr 14–18 | 101 | swarm |\n| s4-next | 🚀 Active | v2.2 | Apr 21–28 | 5 | swarm |\n`);

    const sprints = parseSprints(sprintsPath);
    assert.equal(sprints.length, 2);
    assert.equal(sprints[0].name, "s3-hardening");
    assert.equal(sprints[0].status, "done");
    assert.equal(sprints[1].name, "s4-next");
    assert.equal(sprints[1].status, "active");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array if file doesn't exist", () => {
    const result = parseSprints("/nonexistent/path/SPRINTS.md");
    assert.deepEqual(result, []);
  });
});

// ── computeCycleTime ────────────────────────────────────────────

describe("computeCycleTime", () => {
  it("computes cycle time from transitionHistory + lastGate", () => {
    const t0 = new Date("2026-04-14T10:00:00.000Z");
    const t1 = new Date("2026-04-14T10:30:00.000Z"); // 30 minutes later

    const states = [{
      tasks: [{ id: "task-1", status: "passed", lastGate: { timestamp: t1.toISOString() } }],
      transitionHistory: [
        { taskId: "task-1", status: "in-progress", timestamp: t0.toISOString() },
      ],
    }];

    const times = computeCycleTime(states);
    assert.equal(times.length, 1);
    assert.ok(Math.abs(times[0] - 30) < 0.1, "cycle time should be ~30 minutes");
  });

  it("skips tasks without in-progress transition", () => {
    const states = [{
      tasks: [{ id: "task-1", status: "passed", lastGate: { timestamp: new Date().toISOString() } }],
      transitionHistory: [],
    }];
    const times = computeCycleTime(states);
    assert.equal(times.length, 0);
  });

  it("skips pending/in-progress tasks", () => {
    const states = [{
      tasks: [{ id: "task-1", status: "in-progress" }],
      transitionHistory: [
        { taskId: "task-1", status: "in-progress", timestamp: new Date().toISOString() },
      ],
    }];
    const times = computeCycleTime(states);
    assert.equal(times.length, 0);
  });

  it("handles multiple features and tasks", () => {
    const base = new Date("2026-04-14T10:00:00.000Z");
    const end1 = new Date(base.getTime() + 20 * 60000); // 20 min
    const end2 = new Date(base.getTime() + 60 * 60000); // 60 min

    const states = [
      {
        tasks: [{ id: "t1", status: "passed", lastGate: { timestamp: end1.toISOString() } }],
        transitionHistory: [{ taskId: "t1", status: "in-progress", timestamp: base.toISOString() }],
      },
      {
        tasks: [{ id: "t2", status: "failed", lastGate: { timestamp: end2.toISOString() } }],
        transitionHistory: [{ taskId: "t2", status: "in-progress", timestamp: base.toISOString() }],
      },
    ];

    const times = computeCycleTime(states);
    assert.equal(times.length, 2);
    assert.ok(times.includes(20));
    assert.ok(times.includes(60));
  });
});

// ── computeFailureRate ──────────────────────────────────────────

describe("computeFailureRate", () => {
  it("returns 0 when all tasks pass", () => {
    const states = [{
      tasks: [
        { status: "passed" },
        { status: "passed" },
      ],
    }];
    assert.equal(computeFailureRate(states), 0);
  });

  it("returns correct failure fraction", () => {
    const states = [{
      tasks: [
        { status: "passed" },
        { status: "failed" },
        { status: "failed" },
        { status: "skipped" },
      ],
    }];
    assert.ok(Math.abs(computeFailureRate(states) - 0.5) < 0.001);
  });

  it("returns null when no terminal tasks", () => {
    const states = [{ tasks: [{ status: "in-progress" }] }];
    assert.equal(computeFailureRate(states), null);
  });

  it("returns null when no tasks", () => {
    assert.equal(computeFailureRate([{ tasks: [] }]), null);
  });
});

// ── computeGatePassRate ─────────────────────────────────────────

describe("computeGatePassRate", () => {
  it("returns 1 when all gates pass", () => {
    const states = [{
      gates: [{ verdict: "PASS" }, { verdict: "PASS" }],
    }];
    assert.equal(computeGatePassRate(states), 1);
  });

  it("computes correct rate", () => {
    const states = [{
      gates: [{ verdict: "PASS" }, { verdict: "FAIL" }, { verdict: "PASS" }, { verdict: "PASS" }],
    }];
    assert.ok(Math.abs(computeGatePassRate(states) - 0.75) < 0.001);
  });

  it("returns null when no gates", () => {
    assert.equal(computeGatePassRate([{ gates: [] }]), null);
  });
});

// ── computeFlowUsage ────────────────────────────────────────────

describe("computeFlowUsage", () => {
  it("classifies by task count", () => {
    const states = [
      { tasks: [{ id: "t1" }] },                // 1 task → light
      { tasks: [{ id: "t1" }, { id: "t2" }] },  // 2 tasks → light
      { tasks: [{ id: "t1" }, { id: "t2" }, { id: "t3" }] }, // 3 tasks → build-verify
      { tasks: Array.from({ length: 5 }, (_, i) => ({ id: `t${i}` })) }, // 5 tasks → full-stack
    ];
    const usage = computeFlowUsage(states);
    assert.equal(usage.light, 2);
    assert.equal(usage["build-verify"], 1);
    assert.equal(usage["full-stack"], 1);
  });
});

// ── computeReplanRate ───────────────────────────────────────────

describe("computeReplanRate", () => {
  it("returns 0 when no replanned tasks", () => {
    const states = [{
      tasks: [{ id: "t1" }, { id: "t2" }],
    }];
    assert.equal(computeReplanRate(states), 0);
  });

  it("computes correct re-plan fraction", () => {
    const states = [{
      tasks: [
        { id: "t1" },
        { id: "t2", replanSource: "t1" },
        { id: "t3", replanSource: "t1" },
      ],
    }];
    assert.ok(Math.abs(computeReplanRate(states) - 2 / 3) < 0.001);
  });

  it("returns null when no tasks", () => {
    assert.equal(computeReplanRate([{ tasks: [] }]), null);
  });
});

// ── computeSprintMetrics (integration) ─────────────────────────

describe("computeSprintMetrics integration", () => {
  function createTmpTeamDir(sprints, project, features) {
    const dir = join(tmpdir(), `sa-int-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    mkdirSync(dir, { recursive: true });

    if (sprints) writeFileSync(join(dir, "SPRINTS.md"), sprints);
    if (project) writeFileSync(join(dir, "PROJECT.md"), project);

    mkdirSync(join(dir, "features"), { recursive: true });
    for (const [name, state] of Object.entries(features || {})) {
      mkdirSync(join(dir, "features", name), { recursive: true });
      writeFileSync(join(dir, "features", name, "STATE.json"), JSON.stringify(state));
    }

    return dir;
  }

  it("returns noData when no features match sprint", () => {
    const tmpDir = createTmpTeamDir(
      `# Sprints\n| Sprint | Status | Version | Dates |\n|--------|--------|---------|-------|\n| s1 | ✅ Done | v1 | Apr 1–5 |\n`,
      `# Project\n## Active Sprint\nNone\n`,
      {
        feat1: { createdAt: "2026-04-21T10:00:00Z", tasks: [], gates: [], transitionHistory: [] },
      }
    );

    try {
      const m = computeSprintMetrics(tmpDir);
      assert.equal(m.noData, true, "should report noData when no features in sprint range");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("computes metrics for matching features", () => {
    const t0 = "2026-04-14T10:00:00.000Z";
    const t1 = "2026-04-14T10:30:00.000Z"; // 30 min later

    const tmpDir = createTmpTeamDir(
      `# Sprints\n| Sprint | Status | Version | Dates |\n|--------|--------|---------|-------|\n| s3-hardening | ✅ Done | v2.1 | Apr 14–18 |\n`,
      `# Project\n## Active Sprint\nNone\n`,
      {
        feat1: {
          createdAt: "2026-04-14T10:00:00Z",
          tasks: [{ id: "t1", status: "passed", lastGate: { timestamp: t1, verdict: "PASS" } }],
          gates: [{ verdict: "PASS", taskId: "t1" }],
          transitionHistory: [{ taskId: "t1", status: "in-progress", timestamp: t0 }],
        },
      }
    );

    try {
      const m = computeSprintMetrics(tmpDir);
      assert.equal(m.features, 1);
      assert.ok(m.cycleTime.samples > 0, "should have cycle time samples");
      assert.ok(Math.abs(m.cycleTime.median - 30) < 0.1, "median should be ~30 min");
      assert.equal(m.gatePassRate, 1, "gate pass rate should be 100%");
      assert.equal(m.failureRate, 0, "failure rate should be 0%");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("handles team dir with no SPRINTS.md gracefully", () => {
    const tmpDir = join(tmpdir(), `sa-nosprint-${Date.now()}`);
    mkdirSync(join(tmpDir, "features"), { recursive: true });
    const state = { createdAt: new Date().toISOString(), tasks: [], gates: [], transitionHistory: [] };
    mkdirSync(join(tmpDir, "features", "f1"), { recursive: true });
    writeFileSync(join(tmpDir, "features", "f1", "STATE.json"), JSON.stringify(state));

    try {
      const m = computeSprintMetrics(tmpDir);
      assert.ok(!m.sprint || m.noData || m.features >= 0, "should not throw");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
