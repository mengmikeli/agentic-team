// Iteration escalation — detect when compound-gate WARN layers recur
// across ≥2 distinct review iterations on a single task.
//
// Pure functions with no side effects; no file I/O; no STATE.json reads.

/**
 * Append a WARN iteration record to task.gateWarningHistory.
 * Mutates the task object in place.
 * @param {object} task - Task object with optional gateWarningHistory array
 * @param {number} iteration - Current attempt/iteration number
 * @param {string[]} layers - Compound gate layers that triggered WARN
 */
export function recordWarningIteration(task, iteration, layers) {
  if (!Array.isArray(task.gateWarningHistory)) {
    task.gateWarningHistory = [];
  }
  task.gateWarningHistory.push({ iteration, layers: [...layers] });
}

/**
 * Check if any layer name recurs across ≥2 distinct iterations in the history.
 * @param {Array<{iteration: number, layers: string[]}>} gateWarningHistory
 * @returns {{ layers: string[], iterations: number[] } | null}
 *   null if no escalation; otherwise the escalating layers and the iteration
 *   numbers they appeared in (sorted ascending).
 */
export function checkEscalation(gateWarningHistory) {
  if (!Array.isArray(gateWarningHistory) || gateWarningHistory.length < 2) {
    return null;
  }

  // Build a map: layer → Set of iteration numbers it appeared in
  const layerToIterations = new Map();
  for (const entry of gateWarningHistory) {
    const iter = entry.iteration;
    for (const layer of (entry.layers || [])) {
      if (!layerToIterations.has(layer)) {
        layerToIterations.set(layer, new Set());
      }
      layerToIterations.get(layer).add(iter);
    }
  }

  // Collect layers that appear in ≥2 distinct iterations
  const escalatingLayers = [];
  const iterationSet = new Set();
  for (const [layer, iters] of layerToIterations) {
    if (iters.size >= 2) {
      escalatingLayers.push(layer);
      for (const i of iters) iterationSet.add(i);
    }
  }

  if (escalatingLayers.length === 0) return null;
  return {
    layers: escalatingLayers,
    iterations: [...iterationSet].sort((a, b) => a - b),
  };
}
