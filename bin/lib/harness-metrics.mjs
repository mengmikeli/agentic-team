// at-harness metrics — compute feature metrics from STATE.json + git log
// Returns JSON with commits, duration, token usage, tasks completed/blocked.

import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { getFlag, resolveDir, readState } from "./util.mjs";

export function cmdHarnessMetrics(args) {
  const dir = resolveDir(args, getFlag(args, "dir", "."));

  const state = readState(dir);
  if (!state) {
    console.log(JSON.stringify({ ok: false, error: "STATE.json not found" }));
    return;
  }

  const metrics = {
    feature: state.feature || "unknown",
    status: state.status || "unknown",
    tasks: {
      total: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      pending: 0,
      inProgress: 0,
    },
    gates: {
      total: (state.gates || []).length,
      passed: (state.gates || []).filter(g => g.verdict === "PASS").length,
      failed: (state.gates || []).filter(g => g.verdict === "FAIL").length,
    },
    transitions: state.transitionCount || 0,
    retries: 0,
    duration: null,
    git: null,
  };

  // Task stats
  for (const task of (state.tasks || [])) {
    metrics.tasks.total++;
    switch (task.status) {
      case "passed":     metrics.tasks.passed++;     break;
      case "failed":     metrics.tasks.failed++;     break;
      case "blocked":    metrics.tasks.blocked++;    break;
      case "skipped":    metrics.tasks.skipped++;    break;
      case "pending":    metrics.tasks.pending++;    break;
      case "in-progress": metrics.tasks.inProgress++; break;
    }
    metrics.retries += task.retries || 0;
  }

  // Duration
  if (state.createdAt) {
    const end = state.completedAt ? new Date(state.completedAt) : new Date();
    const ms = end.getTime() - new Date(state.createdAt).getTime();
    metrics.duration = {
      ms,
      minutes: Math.round(ms / 60000),
      human: formatDuration(ms),
    };
  }

  // Git stats (best-effort)
  try {
    const since = state.createdAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const log = execSync(
      `git log --oneline --since="${since}" 2>/dev/null | wc -l`,
      { encoding: "utf8", timeout: 5000 }
    ).trim();
    metrics.git = {
      commitsSince: parseInt(log) || 0,
      since,
    };
  } catch {
    metrics.git = null;
  }

  console.log(JSON.stringify({ ok: true, metrics }));
}

function formatDuration(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours < 24) return `${hours}h ${remainMins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
