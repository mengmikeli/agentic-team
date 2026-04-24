/**
 * Pure helpers for identifying the active (in-progress) task in a feature.
 * Used by dashboard-ui components and unit tests.
 */

/**
 * Returns true if the task is a quality-gate task that should be excluded
 * from the active task display.
 * @param {{ title?: string }} task
 */
export function isGateTask(task) {
  return task.title === 'Quality gate passes';
}

/**
 * Returns the first non-gate in-progress task, or null if none exists.
 * @param {Array<{ title?: string; status: string }>} tasks
 */
export function getActiveTask(tasks) {
  return tasks.find(t => !isGateTask(t) && t.status === 'in-progress') ?? null;
}
