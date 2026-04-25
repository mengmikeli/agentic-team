// Extension runner — invokes individual hook functions with timeout and circuit-breaker protection.
// Errors and timeouts are swallowed; return null so callers skip gracefully.

const TIMEOUT_MS = 5000;
const MAX_FAILURES = 3;

// Per-extension failure counters (keyed by extension name)
const _failures = new Map();

export function isCircuitBroken(name) {
  return (_failures.get(name) ?? 0) >= MAX_FAILURES;
}

export function resetCircuitBreakers() {
  _failures.clear();
}

function recordFailure(name) {
  _failures.set(name, (_failures.get(name) ?? 0) + 1);
}

export async function runHook(extension, hookName, payload) {
  const { name, hooks } = extension;

  if (isCircuitBroken(name)) return null;

  const hookFn = hooks[hookName];
  if (typeof hookFn !== "function") return null;

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("hook timeout")), TIMEOUT_MS)
    );
    const result = await Promise.race([
      Promise.resolve(hookFn(payload)),
      timeoutPromise,
    ]);
    return result;
  } catch {
    recordFailure(name);
    return null;
  }
}
