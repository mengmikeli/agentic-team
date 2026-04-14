// at-harness finalize — validate entire execution chain before marking feature complete
// Checks: all tasks have verdicts, no unapproved state edits, gate results present.

import { join } from "path";
import {
  getFlag, resolveDir, lockFile,
  readState, writeState, WRITER_SIG,
} from "./util.mjs";

export function cmdFinalize(args) {
  const dir = resolveDir(args, getFlag(args, "dir", "."));
  const strict = args.includes("--strict");

  const state = readState(dir);
  if (!state) {
    console.log(JSON.stringify({ finalized: false, error: "STATE.json not found" }));
    return;
  }

  if (state._written_by !== WRITER_SIG) {
    console.log(JSON.stringify({ finalized: false, error: "STATE.json tamper detected — not written by at-harness" }));
    return;
  }

  if (state.status === "completed") {
    console.log(JSON.stringify({
      finalized: true,
      feature: state.feature,
      note: "already finalized",
    }));
    return;
  }

  const errors = [];
  const tasks = state.tasks || [];

  // Check all tasks have terminal statuses
  for (const task of tasks) {
    if (!["passed", "skipped"].includes(task.status)) {
      errors.push(`task '${task.id}' has status '${task.status}' — must be passed or skipped`);
    }
  }

  // Strict mode: every non-skipped task must have a gate result
  if (strict) {
    for (const task of tasks) {
      if (task.status === "passed" && !task.lastGate) {
        errors.push(`task '${task.id}' is passed but has no gate result`);
      }
      if (task.status === "passed" && task.lastGate && task.lastGate.verdict !== "PASS") {
        errors.push(`task '${task.id}' is passed but last gate verdict was '${task.lastGate.verdict}'`);
      }
    }
  }

  // Check for unapproved edits (nonce must be from harness)
  if (!state._write_nonce) {
    errors.push("STATE.json missing _write_nonce — possible manual edit");
  }

  if (errors.length > 0) {
    console.log(JSON.stringify({ finalized: false, errors }));
    return;
  }

  // Acquire lock and finalize
  const statePath = join(dir, "STATE.json");
  const lock = lockFile(statePath, { command: "finalize" });
  if (!lock.acquired) {
    console.log(JSON.stringify({ finalized: false, error: "could not acquire lock", holder: lock.holder }));
    return;
  }

  try {
    const freshState = readState(dir);
    if (!freshState) {
      console.log(JSON.stringify({ finalized: false, error: "STATE.json disappeared" }));
      return;
    }

    if (freshState.status === "completed") {
      console.log(JSON.stringify({
        finalized: true,
        feature: freshState.feature,
        note: "already finalized",
      }));
      return;
    }

    freshState.status = "completed";
    freshState.completedAt = new Date().toISOString();

    // Compute summary metrics
    const taskCount = (freshState.tasks || []).length;
    const passedCount = (freshState.tasks || []).filter(t => t.status === "passed").length;
    const skippedCount = (freshState.tasks || []).filter(t => t.status === "skipped").length;
    const totalRetries = (freshState.tasks || []).reduce((sum, t) => sum + (t.retries || 0), 0);

    freshState.summary = {
      tasks: taskCount,
      passed: passedCount,
      skipped: skippedCount,
      retries: totalRetries,
      transitions: freshState.transitionCount || 0,
      gates: (freshState.gates || []).length,
      duration: freshState.createdAt
        ? `${Math.round((Date.now() - new Date(freshState.createdAt).getTime()) / 60000)}m`
        : null,
    };

    writeState(dir, freshState);

    console.log(JSON.stringify({
      finalized: true,
      feature: freshState.feature,
      summary: freshState.summary,
    }));
  } finally {
    lock.release();
  }
}
