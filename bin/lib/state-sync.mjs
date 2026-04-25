// state-sync.mjs — GitHub-native state with local cache
// GitHub is the source of truth. STATE.json is a local cache written at every checkpoint.
// If they ever disagree, GitHub wins.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

import { readState, writeState } from "./util.mjs";
import { ghAvailable, closeIssue, commentIssue } from "./github.mjs";

// ── GitHub helpers ──────────────────────────────────────────────



// ── State sync: push to GitHub + write local cache ──────────────

/**
 * Update feature status. Pushes to GitHub issue + writes STATE.json cache.
 * @param {string} featureDir - Path to feature directory
 * @param {string} status - New status (executing, paused, completed, etc.)
 * @param {object} meta - Additional metadata to write
 */
export function pushFeatureStatus(featureDir, status, meta = {}) {
  const state = readState(featureDir) || {};
  state.status = status;
  state._last_modified = new Date().toISOString();
  Object.assign(state, meta);

  // Push to GitHub: update issue label or close
  if (ghAvailable() && state._approvalIssueNumber) {
    const issueNum = state._approvalIssueNumber;
    if (status === "completed") {
      closeIssue(issueNum, "Feature completed.");
    } else if (status === "paused") {
      commentIssue(issueNum, `⏸ Feature paused.`);
    }
  }

  // Write local cache
  writeState(featureDir, state);
  return state;
}

/**
 * Update task status. Pushes to GitHub issue + writes STATE.json cache.
 * @param {string} featureDir - Path to feature directory
 * @param {string} taskId - Task ID
 * @param {string} status - New status (pending, in-progress, passed, blocked)
 * @param {object} meta - Additional metadata (issueNumber, attempts, etc.)
 */
export function pushTaskStatus(featureDir, taskId, status, meta = {}) {
  const state = readState(featureDir);
  if (!state) return null;

  const task = (state.tasks || []).find(t => t.id === taskId);
  if (task) {
    task.status = status;
    Object.assign(task, meta);
  }

  state._last_modified = new Date().toISOString();

  // Push to GitHub: close issue on pass, comment on block
  if (ghAvailable() && task?.issueNumber) {
    const issueNum = task.issueNumber;
    if (status === "passed") {
      closeIssue(issueNum, "✅ Task completed — gate passed.");
    } else if (status === "blocked") {
      const reason = meta.lastReason || "blocked after max retries";
      commentIssue(issueNum, `❌ Task blocked: ${reason}`);
    } else if (status === "in-progress") {
      commentIssue(issueNum, `▶ Task started (attempt ${meta.attempts || 1})`);
    }
  }

  // Write local cache
  writeState(featureDir, state);
  return state;
}

/**
 * Sync all task statuses from STATE.json (harness-updated) into the cache.
 * Call this after harness transitions to ensure the cache reflects reality.
 * Also pushes new replan tasks that don't have issue numbers yet.
 * @param {string} featureDir - Path to feature directory
 * @param {Array} inMemoryTasks - The in-memory task array (may have replan additions)
 */
export function syncFromHarness(featureDir, inMemoryTasks) {
  const state = readState(featureDir);
  if (!state) return;

  // Merge: harness writes authoritative task statuses.
  // In-memory tasks may have new entries from replan.
  const stateTaskMap = new Map((state.tasks || []).map(t => [t.id, t]));

  for (const t of inMemoryTasks) {
    const existing = stateTaskMap.get(t.id);
    if (existing) {
      // Preserve harness-written fields, sync issueNumber from memory
      if (t.issueNumber && !existing.issueNumber) existing.issueNumber = t.issueNumber;
    } else {
      // New task from replan — add it
      stateTaskMap.set(t.id, { ...t });
    }
  }

  state.tasks = [...stateTaskMap.values()];
  state.status = "executing";
  state._last_modified = new Date().toISOString();
  writeState(featureDir, state);
}

/**
 * Rebuild local cache from GitHub. Use when cache is suspected stale.
 * @param {string} featureDir - Path to feature directory
 * @returns {object|null} Rebuilt state
 */
