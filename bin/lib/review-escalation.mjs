// Review escalation — track per-task review FAIL rounds and detect when
// the cap is exceeded.

import { existsSync, readFileSync } from "fs";
import { join } from "path";

export const MAX_REVIEW_ROUNDS = 3;

/**
 * Initialize task.reviewRounds if absent, then increment by 1.
 * Mutates the task object in place.
 * @param {object} task - Task object
 */
export function incrementReviewRounds(task) {
  if (typeof task.reviewRounds !== "number") {
    task.reviewRounds = 0;
  }
  task.reviewRounds += 1;
}

/**
 * Returns true when the task has hit or exceeded the review round cap.
 * @param {object} task - Task object with optional reviewRounds field
 * @param {number} [maxRounds] - Cap (default MAX_REVIEW_ROUNDS)
 * @returns {boolean}
 */
export function shouldEscalate(task, maxRounds = MAX_REVIEW_ROUNDS) {
  return (task.reviewRounds ?? 0) >= maxRounds;
}

/**
 * Deduplicates finding objects by their full text (same text across rounds = one entry).
 * @param {Array<{severity: string, text: string}>} allFindings
 * @returns {Array<{severity: string, text: string}>}
 */
export function deduplicateFindings(allFindings) {
  const seen = new Set();
  return allFindings.filter(f => {
    if (seen.has(f.text)) return false;
    seen.add(f.text);
    return true;
  });
}

/**
 * Build markdown body for a GitHub escalation comment (pure, no I/O).
 * @param {string} taskTitle
 * @param {number} reviewRounds
 * @param {Array<{severity: string, text: string}>} findings - already deduplicated
 * @returns {string}
 */
export function buildEscalationComment(taskTitle, reviewRounds, findings) {
  const rows = findings.map(f => {
    return `| ${f.severity} | ${f.text.replace(/\|/g, "\\|")} |`;
  });
  const table = rows.length > 0
    ? `| Severity | Finding |\n|---|---|\n${rows.join("\n")}`
    : "_No findings recorded._";
  return `## Review-Round Escalation: ${taskTitle}\n\nThis task has been **blocked** after ${reviewRounds} consecutive review FAIL round(s).\n\n### Deduplicated Findings\n\n${table}`;
}

/**
 * Read per-round handshake archives from taskDir, deduplicate findings, and build markdown comment.
 * @param {string} taskDir - Absolute path to the task directory
 * @param {string} taskTitle
 * @param {number} reviewRounds - Number of rounds that failed
 * @returns {string} Markdown comment body
 */
export function buildEscalationSummary(taskDir, taskTitle, reviewRounds) {
  const allFindings = [];
  for (let r = 1; r <= reviewRounds; r++) {
    const roundPath = join(taskDir, `handshake-round-${r}.json`);
    if (existsSync(roundPath)) {
      try {
        const hs = JSON.parse(readFileSync(roundPath, "utf8"));
        if (Array.isArray(hs.findingsList)) {
          allFindings.push(...hs.findingsList);
        }
      } catch { /* ignore malformed */ }
    }
  }
  return buildEscalationComment(taskTitle, reviewRounds, deduplicateFindings(allFindings));
}
