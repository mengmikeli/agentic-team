## Parallel Review Findings

### [security]
---

## Security Review — compound-evaluation-gate

**Verdict: PASS**

### Findings

🟡 bin/lib/compound-gate.mjs:99 — `detectFabricatedRefs` does not guard against `f.text` being null/undefined; `f.text.matchAll(...)` throws TypeError if a caller passes findings with null text; add `if (typeof f.text !== 'string') continue;` in the inner loop

🟡 bin/lib/compound-gate.mjs:63 — `detectLowUniqueness` calls `f.text.split(...)` without a null/string guard; same crash path; add a type guard in the `

### [architect]
---

## Review Complete

**Verdict: PASS**

### Findings

🟡 bin/lib/compound-gate.mjs:97 — `backPathRe` is a `/g` regex defined once at function scope and reused across the nested inner loop; the load-bearing `lastIndex = 0` reset at line 114 has no explanatory comment — a future maintainer removing it silently breaks backward-window detection for findings 2+; add comment: `// must reset — stateful /g regex reused across inner loop iterations`

🔵 bin/lib/compound-gate.mjs:81,97 — `FILE_EXT_PAT

### [devil's-advocate]
---

Here are the findings:

🟡 bin/lib/run.mjs:1086 — WARN (1–2 layers tripped) only prints to console; no critical finding injected, no backlog entry created; a review tripping 2 compound-gate layers passes with zero tracked remediation; inject a 🟡 warning-severity compound-gate finding so it surfaces in synthesize backlog
🟡 test/synthesize-compound.test.mjs:34 — No test covers WARN (1–2 layer) path; the "WARN does not block" contract is untested convention; add a fixture tripping exactly 2 