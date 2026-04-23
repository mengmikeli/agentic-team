## Parallel Review Findings

### [security]
---

## Findings

🔴 `bin/lib/compound-gate.mjs:94-95` — `join(repoRoot, p)` does not bound `p` to repoRoot; resolve the joined path and assert `abs.startsWith(resolve(repoRoot) + sep)` before calling `existsSync` — otherwise a `..` traversal in a finding text bypasses the fabricated-refs layer entirely

🟡 `bin/lib/compound-gate.mjs:28` — `/\S+:\d+/` matches URLs (`https://host:443`) and timestamps (`12:30`), allowing Layer 2 to be satisfied without citing a real file:line position; tighten to 

### [architect]
---

**Findings:**

🔴 `bin/lib/synthesize.mjs:1` — `runCompoundGate` is never imported or called; add the import and invoke it after `parseFindings()`, appending the gate section and overriding verdict on FAIL

🟡 `bin/lib/compound-gate.mjs:51` — `jaccardSimilarity` returns 1.0 when both trigram sets are empty (sentences < 4 words); replace with `if (a.size === 0 || b.size === 0) return 0` to avoid false duplicate detection on short findings

🟡 `bin/lib/compound-gate.mjs:81` — `FILE_EXT_PATTER

### [devil's-advocate]
---

## Findings

🔴 `bin/lib/synthesize.mjs:1` — `runCompoundGate` is never imported or called; the gate is dead code in production — integrate: `import { runCompoundGate } from "./compound-gate.mjs"`, call after `parseFindings()`, append `section` to `eval.md`, inject a synthetic critical finding if `verdict === "FAIL"`

🔴 `bin/lib/synthesize.mjs:108` — `computeVerdict` runs with no compound gate check; a shallow review that trips ≥3 layers will still return PASS — gate must run before `compu