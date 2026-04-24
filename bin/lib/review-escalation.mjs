// Review escalation — track per-task review FAIL rounds and detect when
// the cap is exceeded.
//
// Pure functions with no side effects; no file I/O; no STATE.json reads.

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
