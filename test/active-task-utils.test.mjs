// Tests for bin/lib/active-task-utils.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isGateTask, getActiveTask } from "../bin/lib/active-task-utils.mjs";

describe("isGateTask", () => {
  it("returns true for quality gate task", () => {
    assert.equal(isGateTask({ title: "Quality gate passes" }), true);
  });

  it("returns false for regular task", () => {
    assert.equal(isGateTask({ title: "Implement feature X" }), false);
  });

  it("returns false when title is undefined", () => {
    assert.equal(isGateTask({}), false);
  });

  it("is case-sensitive", () => {
    assert.equal(isGateTask({ title: "quality gate passes" }), false);
  });
});

describe("getActiveTask", () => {
  it("returns null for empty task list", () => {
    assert.equal(getActiveTask([]), null);
  });

  it("returns null when all tasks are pending", () => {
    const tasks = [
      { id: "task-1", title: "Task One", status: "pending" },
      { id: "task-2", title: "Task Two", status: "pending" },
    ];
    assert.equal(getActiveTask(tasks), null);
  });

  it("returns null when all tasks are passed", () => {
    const tasks = [
      { id: "task-1", title: "Task One", status: "passed" },
      { id: "task-2", title: "Task Two", status: "passed" },
    ];
    assert.equal(getActiveTask(tasks), null);
  });

  it("returns the in-progress task", () => {
    const tasks = [
      { id: "task-1", title: "Task One", status: "passed" },
      { id: "task-2", title: "Task Two", status: "in-progress" },
      { id: "task-3", title: "Task Three", status: "pending" },
    ];
    const result = getActiveTask(tasks);
    assert.equal(result?.id, "task-2");
  });

  it("returns the first in-progress task when multiple exist", () => {
    const tasks = [
      { id: "task-1", title: "Task One", status: "in-progress" },
      { id: "task-2", title: "Task Two", status: "in-progress" },
    ];
    const result = getActiveTask(tasks);
    assert.equal(result?.id, "task-1");
  });

  it("skips gate task even when it is in-progress", () => {
    const tasks = [
      { id: "task-1", title: "Quality gate passes", status: "in-progress" },
      { id: "task-2", title: "Task Two", status: "in-progress" },
    ];
    const result = getActiveTask(tasks);
    assert.equal(result?.id, "task-2");
  });

  it("returns null when only gate task is in-progress", () => {
    const tasks = [
      { id: "task-1", title: "Quality gate passes", status: "in-progress" },
    ];
    assert.equal(getActiveTask(tasks), null);
  });

  it("returns correct task with attempts field present", () => {
    const tasks = [
      { id: "task-1", title: "Task One", status: "passed", attempts: 1 },
      { id: "task-2", title: "Task Two", status: "in-progress", attempts: 3 },
    ];
    const result = getActiveTask(tasks);
    assert.equal(result?.id, "task-2");
    assert.equal(result?.attempts, 3);
  });
});
