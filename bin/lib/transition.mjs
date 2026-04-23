// at-harness transition — validate state changes with cycle limits + oscillation detection
// Writes with nonce + file lock. Returns JSON verdict.

import { join } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import {
  getFlag, resolveDir, lockFile,
  readState, writeState,
  WRITER_SIG, ALLOWED_TRANSITIONS, VALID_TASK_STATUSES,
  IDEMPOTENCY_WINDOW_MS,
} from "./util.mjs";

const MAX_RETRIES_PER_TASK = 3;
const MAX_TOTAL_TRANSITIONS = 100;
const _rawMaxTicks = parseInt(process.env.TASK_MAX_TICKS ?? "6", 10);
const maxTaskTicks = Number.isInteger(_rawMaxTicks) && _rawMaxTicks > 0 ? _rawMaxTicks : 6;

function appendProgressInDir(dir, entry) {
  const progressPath = join(dir, "progress.md");
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const line = `### ${timestamp}\n${entry}\n\n`;
  try {
    const existing = existsSync(progressPath) ? readFileSync(progressPath, "utf8") : "";
    writeFileSync(progressPath, existing + line);
  } catch {
    try { writeFileSync(progressPath, line); } catch { /* best-effort */ }
  }
}

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

    // Oscillation detection — runs before retry check so [failed, in-progress] pattern is detectable
    if (!freshState.transitionHistory) freshState.transitionHistory = [];
    const taskStatuses = freshState.transitionHistory
      .filter(h => h.taskId === taskId)
      .map(h => h.status);

    let oscillation = null;
    const N = taskStatuses.length;
    for (let K = 2; K <= Math.floor(N / 2); K++) {
      const first = taskStatuses.slice(N - 2 * K, N - K);
      const second = taskStatuses.slice(N - K, N);
      if (first.join(",") !== second.join(",")) continue;

      // Pattern found — count consecutive trailing repetitions
      const pat = first;
      let reps = 2;
      let pos = N - 2 * K;
      while (pos - K >= 0) {
        const seg = taskStatuses.slice(pos - K, pos);
        if (seg.join(",") === pat.join(",")) { reps++; pos -= K; }
        else break;
      }
      oscillation = { K, reps, pattern: pat };
      break;
    }

    if (oscillation) {
      const patStr = oscillation.pattern.join(" → ");
      if (oscillation.reps >= 3) {
        freshState.status = "oscillation-halted";
        writeState(dir, freshState);
        appendProgressInDir(dir, `**Oscillation halted** on task \`${taskId}\`: pattern [${patStr}] repeated ${oscillation.reps}×. Feature stopped.`);
        console.log(JSON.stringify({
          allowed: false,
          halt: true,
          reason: `oscillation-halted: task '${taskId}' pattern [${patStr}] repeated ${oscillation.reps}×`,
        }));
        lock.release();
        process.exit(1);
      } else {
        // reps == 2: warn
        process.stderr.write(`[at-harness warn] oscillation detected for task '${taskId}': [${patStr}] ×${oscillation.reps}\n`);
        appendProgressInDir(dir, `**Oscillation warning** on task \`${taskId}\`: pattern [${patStr}] repeated ${oscillation.reps}×.`);
      }
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

    // Check tick limit (→ in-progress)
    if (status === "in-progress") {
      const currentTicks = Number.isInteger(task.ticks) ? task.ticks : 0;
      if (currentTicks >= maxTaskTicks) {
        task.status = "blocked";
        task.lastReason = "tick-limit-exceeded";
        writeState(dir, freshState);
        appendProgressInDir(dir, `**Tick limit exceeded** for task \`${taskId}\`: ${currentTicks} ticks ≥ ${maxTaskTicks}. Task blocked.`);
        console.log(JSON.stringify({
          allowed: false,
          reason: `tick-limit-exceeded: task '${taskId}' has ${currentTicks} ticks (limit: ${maxTaskTicks})`,
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

    // Increment tick counter on every agent dispatch (→ in-progress)
    if (status === "in-progress") {
      task.ticks = (Number.isInteger(task.ticks) ? task.ticks : 0) + 1;
    }

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
