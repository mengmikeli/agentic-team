## Parallel Review Findings

### [security]
---

## Findings

Files read for this review:
- `bin/lib/compound-gate.mjs` (full)
- `bin/lib/synthesize.mjs` (full)
- `bin/lib/review.mjs` (full)
- `bin/lib/handshake.mjs` (full)
- `test/compound-gate.test.mjs` (full)
- `test/synthesize-compound.test.mjs` (full)
- `test/synthesize.test.mjs` (full)
- `test/e2e.test.mjs` (steps 9–10)
- `task-6/artifacts/test-output.txt` (483 tests, 0 failures confirmed)

---

🟡 bin/lib/review.mjs:210 — `cmdReview` calls `computeVerdict(findings)` without first c

### [architect]
---

## Findings

🟡 bin/lib/run.mjs:1080 — Compound gate application block (~40 lines: evaluate, inject, append section, compute verdict, write handshake) is duplicated verbatim between the single-reviewer path (1080–1120) and parallel-reviewer path (1136–1171); extract into a shared helper to prevent the two paths drifting when gate logic changes

🟡 bin/lib/review.mjs:178 — `cmdReview` calls `parseFindings()` + `computeVerdict()` directly without invoking `runCompoundGate`, silently bypassing

### [devil's-advocate]
Now here are the structured findings:

---

🟡 bin/lib/compound-gate.mjs:169 — `section` shows layer names but no per-layer rationale; SPEC says "showing which layers tripped and **why**"; developer reading `eval.md` cannot tell which phrase triggered `thin-content` or which path failed `fabricated-refs` — add per-layer evidence strings to the section output

🟡 bin/lib/compound-gate.mjs:28 — `FILE_LINE_PATTERN` extension whitelist excludes `.py`, `.go`, `.rs`, `.sh`, etc.; reviews citing valid 