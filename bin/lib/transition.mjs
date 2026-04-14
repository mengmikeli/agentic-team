// at-harness transition — validate state changes with cycle limits + oscillation detection
// Writes with nonce + file lock. Returns JSON verdict.

import { join } from "path";
import {
  getFlag, resolveDir, lockFile,
  readState, writeState,
  WRITER_SIG, ALLOWED_TRANSITIONS, VALID_TASK_STATUSES,
  IDEMPOTENCY_WINDOW_MS,
} from "./util.mjs";

const MAX_RETRIES_PER_TASK = 3;
const MAX_TOTAL_TRANSITIONS = 100;

export function cmdTransition(args) {
  const taskId = getFlag(args, "task");
  const status = getFlag(args, "status");
  const dir = resolveDir(args, getFlag(args, "dir", "."));
  const reason = getFlag(args, "reason");

  if (!taskId || !status) {
    console.error("Usage: at-harness transition --task <id> --status <status> --dir <path> [--reason <text>]");
    process.exit(1);
  }

  if (!VALID_TASK_STATUSES.has(status)) {
    console.log(JSON.stringify({
      allowed: false,
      reason: `invalid status: '${status}' (valid: ${[...VALID_TASK_STATUSES].join(", ")})`,
    }));
    return;
  }

  const state = readState(dir);
  if (!state) {
    console.log(JSON.stringify({ allowed: false, reason: "STATE.json not found" }));
    return;
  }

  if (state._written_by !== WRITER_SIG) {
    console.log(JSON.stringify({ allowed: false, reason: "STATE.json tamper detected — not written by at-harness" }));
    return;
  }

  // Acquire lock
  const statePath = join(dir, "STATE.json");
  const lock = lockFile(statePath, { command: "transition" });
  if (!lock.acquired) {
    console.log(JSON.stringify({ allowed: false, reason: "could not acquire lock", holder: lock.holder }));
    return;
  }

  try {
    const freshState = readState(dir);
    if (!freshState) {
      console.log(JSON.stringify({ allowed: false, reason: "STATE.json disappeared" }));
      return;
    }

    // Find task
    if (!freshState.tasks) {
      console.log(JSON.stringify({ allowed: false, reason: "no tasks in STATE.json" }));
      return;
    }

    const task = freshState.tasks.find(t => t.id === taskId);
    if (!task) {
      console.log(JSON.stringify({ allowed: false, reason: `task '${taskId}' not found` }));
      return;
    }

    // Validate transition is allowed
    const currentStatus = task.status || "pending";
    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(status)) {
      console.log(JSON.stringify({
        allowed: false,
        reason: `transition '${currentStatus}' → '${status}' not allowed (valid: ${(allowed || []).join(", ") || "none"})`,
      }));
      return;
    }

    // Check total transition limits
    if (!freshState.transitionCount) freshState.transitionCount = 0;
    if (freshState.transitionCount >= MAX_TOTAL_TRANSITIONS) {
      console.log(JSON.stringify({
        allowed: false,
        reason: `max total transitions (${MAX_TOTAL_TRANSITIONS}) reached`,
      }));
      return;
    }

    // Check retry limits (failed → in-progress count)
    if (currentStatus === "failed" && status === "in-progress") {
      const retryCount = (task.retries || 0);
      if (retryCount >= MAX_RETRIES_PER_TASK) {
        console.log(JSON.stringify({
          allowed: false,
          reason: `max retries (${MAX_RETRIES_PER_TASK}) reached for task '${taskId}'`,
        }));
        return;
      }
      task.retries = retryCount + 1;
    }

    // Oscillation detection (A→B→A pattern in recent history)
    if (!freshState.transitionHistory) freshState.transitionHistory = [];
    const recentHistory = freshState.transitionHistory.slice(-6);
    const taskHistory = recentHistory.filter(h => h.taskId === taskId);
    if (taskHistory.length >= 4) {
      const lastFour = taskHistory.slice(-4).map(h => h.status);
      // Check for A→B→A→B pattern
      if (lastFour[0] === lastFour[2] && lastFour[1] === lastFour[3]) {
        console.log(JSON.stringify({
          allowed: false,
          reason: `oscillation detected for task '${taskId}': ${lastFour.join(" → ")} → ${status}`,
        }));
        return;
      }
    }

    // Idempotency guard
    if (freshState.transitionHistory.length > 0) {
      const last = freshState.transitionHistory[freshState.transitionHistory.length - 1];
      if (last.taskId === taskId && last.status === status) {
        const lastTime = new Date(last.timestamp).getTime();
        if (Date.now() - lastTime < IDEMPOTENCY_WINDOW_MS) {
          console.log(JSON.stringify({
            allowed: false,
            reason: `idempotency guard: already transitioned task '${taskId}' to '${status}'`,
            duplicate: true,
          }));
          return;
        }
      }
    }

    // Apply transition
    const prevStatus = task.status;
    task.status = status;
    task.lastTransition = new Date().toISOString();
    if (reason) task.lastReason = reason;

    freshState.transitionCount++;
    freshState.transitionHistory.push({
      taskId,
      from: prevStatus,
      status,
      reason: reason || null,
      timestamp: new Date().toISOString(),
    });

    writeState(dir, freshState);

    console.log(JSON.stringify({
      allowed: true,
      reason: "ok",
      task: taskId,
      from: prevStatus,
      to: status,
      transitionCount: freshState.transitionCount,
    }));
  } finally {
    lock.release();
  }
}
