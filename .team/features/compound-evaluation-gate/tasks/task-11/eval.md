## Parallel Review Findings

### [security]
**Verdict: PASS** (2 warnings → backlog, 3 suggestions → optional)

---

## Findings

🟡 `bin/lib/compound-gate.mjs:19` — `detectThinContent` (and `detectMissingCodeRefs:33`, `detectLowUniqueness:61`, `detectAspirationalClaims:145`) call `findings.filter()` without checking `Array.isArray(findings)`; direct callers bypassing `runCompoundGate` get a TypeError on null/non-array input — add `if (!Array.isArray(findings)) return false;` at the top of each exported layer function.

🟡 `bin/lib/compou

### [architect]
**Findings:**

🟡 bin/lib/synthesize.mjs:118 — Compound gate injection block (run gate → prepend synthetic finding) copy-pasted 4× across synthesize.mjs, review.mjs, run.mjs:1081, run.mjs:1137; extract to a shared `applyCompoundGate(findings, gateResult)` helper to prevent divergence when threshold or text changes
🟡 bin/lib/compound-gate.mjs:19 — Exported layer functions (`detectThinContent`, `detectMissingCodeRefs`, `detectLowUniqueness`, `detectFabricatedRefs`, `detectAspirationalClaims`) cal

### [devil's-advocate]
The evaluation is written. Here are the structured findings from my devil's-advocate review:

---

🟡 `bin/lib/compound-gate.mjs:99` — `f.text.matchAll(FILE_EXT_PATTERN)` throws TypeError when a finding's `text` field is absent or non-string; the array guard at line 159 does not protect against this — add `if (typeof f.text !== 'string') continue;` before the inner `matchAll` call

🟡 `bin/lib/synthesize.mjs:133` — `## Compound Gate` section only written to disk when `--append-section` is passed