// Extension registry — singleton that maps capabilities to extensions and fans out hook calls.
// Initialized lazily on first use; call resetRegistry() between test runs.

import { loadExtensions } from "./extension-loader.mjs";
import { runHook } from "./extension-runner.mjs";

let _extensions = null;

async function getExtensions(cwd) {
  if (_extensions === null) {
    _extensions = await loadExtensions(cwd);
  }
  return _extensions;
}

export function resetRegistry() {
  _extensions = null;
}

// Inject a pre-loaded list of extensions (used in tests to bypass disk scan)
export function setExtensions(list) {
  _extensions = list;
}

// Fire a capability hook across all registered extensions that declare it.
// Returns an array of non-null results from each extension.
// Never throws — errors are swallowed at the runHook level.
export async function fireExtension(capability, payload, cwd = process.cwd()) {
  const exts = await getExtensions(cwd);
  const results = [];
  for (const ext of exts) {
    if (!ext.capabilities.includes(capability)) continue;
    const result = await runHook(ext, capability, payload);
    if (result !== null) results.push(result);
  }
  return results;
}
