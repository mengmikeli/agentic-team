// Tests for bin/lib/review-escalation.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  incrementReviewRounds,
  shouldEscalate,
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
