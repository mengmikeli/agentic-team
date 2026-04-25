// Extension registry — singleton that maps capabilities to extensions and fans out hook calls.
// Initialized lazily on first use; call resetRegistry() between test runs.

import { loadExtensions } from "./extension-loader.mjs";
import { runHook } from "./extension-runner.mjs";

// Single-cwd invariant: extensions are loaded once per process; all calls must share the same cwd.
let _extensions = null;

export function resetRegistry() {
  _extensions = null;
}

// Inject a pre-loaded list of extensions (test-only: bypasses disk scan)
export function setExtensions(list) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("setExtensions() is only available in test environments (NODE_ENV=test)");
  }
  _extensions = list;
}

/**
 * Fire a capability hook across all registered extensions that declare it.
 *
 * @param {string} capability - Hook name, e.g. "promptAppend"
 * @param {object} payload    - Hook-specific payload passed to each extension
 *   - promptAppend payload:   { prompt: string, taskId: string, phase: string }
 *   - verdictAppend payload:  { findings: Finding[], phase: string }
 *   - executeRun payload:     { taskId: string, cwd: string }
 *   - artifactEmit payload:   { artifacts: Artifact[], taskId: string, featureName: string }
 * @param {string} [cwd]      - Working directory used to locate .team/extensions/
 * @returns {Promise<Array>} Non-null results from each extension.
 *   - promptAppend return:  { append: string } — content appended to the agent brief
 *   - verdictAppend return: { findings: Finding[] } — extra findings merged into handshake output;
 *                           only fires during `agt-harness synthesize` (cmdSynthesize), not during
 *                           `agt run` (_runSingleFeature). Extensions declaring this hook have no
 *                           effect on the main run pipeline.
 *   - executeRun return:    { command: string, required?: boolean } — command spawned in task cwd;
 *                           non-zero exit with required: true causes task FAIL
 *   - artifactEmit return:  { artifacts: Array<{type: string, path: string, content?: string}> } —
 *                           each descriptor is written to the task artifacts dir (if content provided)
 *                           and merged into handshake.json
 * Never throws — errors are swallowed at the runHook level.
 */
export async function fireExtension(capability, payload, cwd = process.cwd()) {
  if (_extensions === null) {
    _extensions = await loadExtensions(cwd);
  }
  const results = [];
  for (const ext of _extensions) {
    if (!ext.capabilities.includes(capability)) continue;
    const result = await runHook(ext, capability, payload);
    if (result != null) results.push(result);
  }
  return results;
}
