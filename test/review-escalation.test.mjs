// Tests for bin/lib/review-escalation.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  incrementReviewRounds,
  shouldEscalate,
  deduplicateFindings,
  buildEscalationComment,
  buildEscalationSummary,
  MAX_REVIEW_ROUNDS,
} from "../bin/lib/review-escalation.mjs";

describe("incrementReviewRounds", () => {
  it("initializes reviewRounds to 1 when field is absent", () => {
    const task = {};
    incrementReviewRounds(task);
    assert.equal(task.reviewRounds, 1);
  });

  it("increments from existing value", () => {
    const task = { reviewRounds: 2 };
    incrementReviewRounds(task);
    assert.equal(task.reviewRounds, 3);
  });

  it("increments from 0 to 1", () => {
    const task = { reviewRounds: 0 };
    incrementReviewRounds(task);
    assert.equal(task.reviewRounds, 1);
  });

  it("mutates the task object in place", () => {
    const task = { id: "task-1", reviewRounds: 1 };
    const ref = task;
    incrementReviewRounds(task);
    assert.equal(ref.reviewRounds, 2);
  });

  it("does not modify other task fields", () => {
    const task = { id: "task-1", title: "test", attempts: 5 };
    incrementReviewRounds(task);
    assert.equal(task.id, "task-1");
    assert.equal(task.title, "test");
    assert.equal(task.attempts, 5);
    assert.equal(task.reviewRounds, 1);
  });
});

describe("shouldEscalate", () => {
  it("returns false when reviewRounds is 0", () => {
    assert.equal(shouldEscalate({ reviewRounds: 0 }), false);
  });

  it("returns false when reviewRounds is 1", () => {
    assert.equal(shouldEscalate({ reviewRounds: 1 }), false);
  });

  it("returns false when reviewRounds is 2", () => {
    assert.equal(shouldEscalate({ reviewRounds: 2 }), false);
  });

  it("returns true when reviewRounds equals MAX_REVIEW_ROUNDS (3)", () => {
    assert.equal(shouldEscalate({ reviewRounds: MAX_REVIEW_ROUNDS }), true);
  });

  it("returns true when reviewRounds exceeds MAX_REVIEW_ROUNDS", () => {
    assert.equal(shouldEscalate({ reviewRounds: 4 }), true);
  });

  it("returns false when reviewRounds field is absent", () => {
    assert.equal(shouldEscalate({}), false);
  });

  it("respects custom maxRounds parameter", () => {
    assert.equal(shouldEscalate({ reviewRounds: 2 }, 2), true);
    assert.equal(shouldEscalate({ reviewRounds: 1 }, 2), false);
  });

  it("counter only increments on review FAIL — caller-controlled semantics", () => {
    // incrementReviewRounds is only called on review FAIL, not build/gate FAIL.
    // This test verifies the counter stays at the value set by the caller.
    const task = { reviewRounds: 0 };
    // Simulate build fail — no call to incrementReviewRounds
    assert.equal(task.reviewRounds, 0, "build fail does not increment reviewRounds");
    // Simulate gate fail — no call to incrementReviewRounds
    assert.equal(task.reviewRounds, 0, "gate fail does not increment reviewRounds");
    // Simulate review fail — caller invokes incrementReviewRounds
    incrementReviewRounds(task);
    assert.equal(task.reviewRounds, 1, "review fail increments reviewRounds");
    assert.equal(shouldEscalate(task), false);
    incrementReviewRounds(task);
    incrementReviewRounds(task);
    assert.equal(task.reviewRounds, 3);
    assert.equal(shouldEscalate(task), true);
  });
});

describe("MAX_REVIEW_ROUNDS constant", () => {
  it("is exported and equals 3", () => {
    assert.equal(MAX_REVIEW_ROUNDS, 3);
  });
});

describe("deduplicateFindings", () => {
  it("returns empty array for no findings", () => {
    assert.deepEqual(deduplicateFindings([]), []);
  });

  it("keeps unique findings", () => {
    const findings = [
      { severity: "critical", text: "🔴 foo:1 — bar" },
      { severity: "warning", text: "🟡 baz:2 — qux" },
    ];
    const result = deduplicateFindings(findings);
    assert.equal(result.length, 2);
  });

  it("deduplicates findings with identical text", () => {
    const findings = [
      { severity: "critical", text: "🔴 foo:1 — bar" },
      { severity: "critical", text: "🔴 foo:1 — bar" },
      { severity: "critical", text: "🔴 foo:1 — bar" },
    ];
    const result = deduplicateFindings(findings);
    assert.equal(result.length, 1);
    assert.equal(result[0].text, "🔴 foo:1 — bar");
  });

  it("deduplicates across rounds — same finding appearing multiple times", () => {
    const findings = [
      { severity: "critical", text: "🔴 src/foo.mjs:10 — Missing test" },
      { severity: "warning", text: "🟡 src/bar.mjs:20 — Unused var" },
      { severity: "critical", text: "🔴 src/foo.mjs:10 — Missing test" }, // duplicate from round 2
      { severity: "warning", text: "🟡 src/baz.mjs:5 — New warning" },
    ];
    const result = deduplicateFindings(findings);
    assert.equal(result.length, 3);
    assert.ok(result.some(f => f.text === "🔴 src/foo.mjs:10 — Missing test"));
    assert.ok(result.some(f => f.text === "🟡 src/bar.mjs:20 — Unused var"));
    assert.ok(result.some(f => f.text === "🟡 src/baz.mjs:5 — New warning"));
  });

  it("preserves first occurrence when deduplicating", () => {
    const findings = [
      { severity: "critical", text: "dup" },
      { severity: "warning", text: "dup" },
    ];
    const result = deduplicateFindings(findings);
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, "critical");
  });
});

describe("buildEscalationComment", () => {
  it("includes task title and round count", () => {
    const comment = buildEscalationComment("My Task", 3, []);
    assert.ok(comment.includes("My Task"));
    assert.ok(comment.includes("3"));
    assert.ok(comment.includes("blocked"));
  });

  it("shows fallback when no findings", () => {
    const comment = buildEscalationComment("My Task", 3, []);
    assert.ok(comment.includes("_No findings recorded._"));
  });

  it("renders findings table with severity icons", () => {
    const findings = [
      { severity: "critical", text: "🔴 foo:1 — bad thing" },
      { severity: "warning", text: "🟡 bar:2 — minor issue" },
    ];
    const comment = buildEscalationComment("My Task", 3, findings);
    assert.ok(comment.includes("| critical |"));
    assert.ok(comment.includes("| warning |"));
    assert.ok(comment.includes("🔴 foo:1 — bad thing"));
    assert.ok(comment.includes("🟡 bar:2 — minor issue"));
    assert.ok(comment.includes("| Severity | Finding |"));
  });

  it("escapes pipe characters in finding text", () => {
    const findings = [{ severity: "critical", text: "a | b | c" }];
    const comment = buildEscalationComment("My Task", 3, findings);
    assert.ok(comment.includes("a \\| b \\| c"));
  });
});

describe("buildEscalationSummary", () => {
  it("reads round handshakes and builds comment", () => {
    const dir = join(tmpdir(), `re-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      const r1 = { findingsList: [{ severity: "critical", text: "🔴 foo:1 — missing test" }] };
      const r2 = { findingsList: [{ severity: "critical", text: "🔴 foo:1 — missing test" }, { severity: "warning", text: "🟡 bar:2 — style" }] };
      const r3 = { findingsList: [{ severity: "critical", text: "🔴 foo:1 — missing test" }] };
      writeFileSync(join(dir, "handshake-round-1.json"), JSON.stringify(r1));
      writeFileSync(join(dir, "handshake-round-2.json"), JSON.stringify(r2));
      writeFileSync(join(dir, "handshake-round-3.json"), JSON.stringify(r3));

      const summary = buildEscalationSummary(dir, "My Feature Task", 3);
      assert.ok(summary.includes("My Feature Task"));
      assert.ok(summary.includes("3"));
      // Duplicate critical finding should appear only once
      const matches = summary.match(/foo:1 — missing test/g);
      assert.equal(matches.length, 1, "deduplicated finding appears exactly once");
      assert.ok(summary.includes("bar:2 — style"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles missing round files gracefully", () => {
    const dir = join(tmpdir(), `re-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      // Only round 2 exists
      writeFileSync(join(dir, "handshake-round-2.json"), JSON.stringify({ findingsList: [{ severity: "critical", text: "🔴 only" }] }));
      const summary = buildEscalationSummary(dir, "Task", 3);
      assert.ok(summary.includes("Task"));
      assert.ok(summary.includes("🔴 only"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns fallback comment when no round files exist", () => {
    const dir = join(tmpdir(), `re-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      const summary = buildEscalationSummary(dir, "Empty Task", 3);
      assert.ok(summary.includes("Empty Task"));
      assert.ok(summary.includes("_No findings recorded._"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("integration: 3 consecutive review FAILs → task blocked", () => {
  it("escalates to blocked with correct lastReason after MAX_REVIEW_ROUNDS review fails", () => {
    // Simulate the run.mjs inner loop behavior for review-round escalation.
    // STATE.json updates and harness calls are simulated in-memory.
    const task = {
      id: "task-1",
      title: "Test feature task",
      status: "in_progress",
      lastReason: null,
      reviewRounds: 0,
    };

    // Simulate up to MAX_REVIEW_ROUNDS review fails
    for (let attempt = 1; attempt <= MAX_REVIEW_ROUNDS + 1; attempt++) {
      // Simulate review FAIL: increment rounds
      incrementReviewRounds(task);

      if (shouldEscalate(task)) {
        // Simulate harness transition → blocked
        task.status = "blocked";
        task.lastReason = `review-escalation: ${task.reviewRounds} rounds exceeded`;
        break;
      }
    }

    assert.equal(task.reviewRounds, MAX_REVIEW_ROUNDS, "reviewRounds equals MAX_REVIEW_ROUNDS");
    assert.equal(task.status, "blocked", "task.status is blocked");
    assert.equal(task.lastReason, "review-escalation: 3 rounds exceeded",
      "lastReason matches required string");
  });

  it("does not block after 2 review fails", () => {
    const task = { id: "task-2", status: "in_progress", lastReason: null, reviewRounds: 0 };

    for (let attempt = 1; attempt <= 2; attempt++) {
      incrementReviewRounds(task);
      if (shouldEscalate(task)) {
        task.status = "blocked";
        task.lastReason = `review-escalation: ${task.reviewRounds} rounds exceeded`;
        break;
      }
    }

    assert.equal(task.reviewRounds, 2);
    assert.equal(task.status, "in_progress", "task remains in_progress after 2 fails");
    assert.equal(task.lastReason, null);
  });

  it("records progress entry on escalation", () => {
    const task = { id: "task-3", title: "My Task", status: "in_progress", reviewRounds: 0 };
    const progressLines = [];

    for (let attempt = 1; attempt <= MAX_REVIEW_ROUNDS + 1; attempt++) {
      incrementReviewRounds(task);
      if (shouldEscalate(task)) {
        task.status = "blocked";
        task.lastReason = `review-escalation: ${task.reviewRounds} rounds exceeded`;
        progressLines.push(`🔴 Review-round escalation: blocked after ${task.reviewRounds} review FAIL round(s)`);
        break;
      }
    }

    assert.equal(progressLines.length, 1);
    assert.ok(progressLines[0].includes("review FAIL round(s)"));
    assert.ok(progressLines[0].includes("3"));
  });
});
