## Parallel Review Findings

### [security]
---

## Security Review — compound-evaluation-gate

**Overall: PASS (2 backlog items)**

### Findings

🟡 `bin/lib/compound-gate.mjs:94` — `detectFabricatedRefs` has no type guard on `repoRoot`; `resolve(undefined)` throws `TypeError`, crashing the layer instead of tripping it safely; add `if (typeof repoRoot !== 'string') return false` at function entry

🟡 `bin/lib/compound-gate.mjs:151` — `runCompoundGate` has no guard on `findings` being a non-array; passing `null` throws before any layer ru

### [architect]
---

## Review: `compound-evaluation-gate` — Each layer is a named export, independently testable

**Verdict: PASS**

### Findings

🟡 `bin/lib/compound-gate.mjs:108` — Layer 4 false-positive guard only searches *forward* from the matched path. If a reviewer writes `"this file is absent — ghost.mjs:1"` (missing-file language before the filename), the 60-char window misses it and the layer incorrectly trips. Fix: extend window to `slice(Math.max(0, m.index - 60), m.index + p.length + 60)` and add

### [devil's-advocate]
Now here are the structured findings:

---

**Overall verdict: PASS** (5 🟡 warnings, 3 🔵 suggestions — no 🔴 critical)

The specific task criterion (named exports + independent testability) is fully met. All 5 layer functions are individually exported and have dedicated test suites. 477/477 tests pass.

---

**Structured findings:**

🟡 `bin/lib/compound-gate.mjs:108` — Layer 4 false-positive guard window is right-anchored only; text like `"not found: ghost.mjs:1"` where "not found" precedes t