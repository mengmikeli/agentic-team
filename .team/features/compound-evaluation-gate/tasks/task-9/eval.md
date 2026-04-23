## Parallel Review Findings

### [security]
---

**Security review complete.** Here are the findings:

🟡 `bin/lib/review.mjs:214` — WARN compound gate result (1–2 layers tripped) is silently dropped in `cmdReview`; `cmdSynthesize` correctly injects a `🟡` warning finding but `cmdReview` has no `else if (gateResult.verdict === "WARN")` branch — add it to match `synthesize.mjs:124-128`

🔵 `bin/lib/compound-gate.mjs:86` — `MISSING_FILE_CONTEXT` regex doesn't include "nonexistent"; a reviewer writing `ghost.mjs:1 — module is nonexistent` wi

### [architect]
**Verdict: PASS**

---

**Findings:**

🟡 bin/lib/compound-gate.mjs:97 — `backPathRe` is a `/g`-flagged regex declared inside `detectFabricatedRefs`; `lastIndex` is manually reset at line 114. This is fragile — a future edit adding a second `.test()` call or reordering the reset will silently break per-path matching. Extract as a module-level constant and reset before use.

🟡 bin/lib/compound-gate.mjs:28 — `FILE_LINE_PATTERN` recognises only `mjs|ts|js|json|md|cjs|jsx|tsx|mts`. In a polyglot re

### [devil's-advocate]
**Verdict: PASS (with backlog items)**

---

Structured findings (each on its own line):

🟡 test/synthesize-compound.test.mjs:50 — DETAILED_EVAL_MD PASS fixture hardcodes real production filenames (`bin/lib/compound-gate.mjs`, `bin/lib/synthesize.mjs`); if either is renamed `detectFabricatedRefs` silently flips the test to FAIL — write named temp files into a temp dir as `compound-gate.test.mjs:407` does

🟡 bin/lib/review.mjs:214 — `cmdReview` WARN path (1–2 tripped layers) silently dropped; n