## Parallel Review Findings

🟡 [architect] `run.mjs:1284` — Context exposes live `findings` array reference; extension hook could mutate existing findings before `computeVerdict` runs; fix with `findings.map(f => ({...f}))` (carried forward)
🟡 [architect] `extensions.mjs:135` — `typeof f.severity === "string"` accepts any string; typos like `"crtical"` silently produce ignored findings; consider severity allowlisting
🟡 [architect] `SPEC.md:9` — SPEC lists 4 hook types, only 2 implemented; update to reflect actual scope (carried forward, gap grew)
🟡 [engineer] bin/lib/run.mjs:1284 — Context passes `findings` as direct references; a malicious extension can mutate `ctx.findings[0].severity` to downgrade criticals before `computeVerdict` runs. Fix: shallow-clone objects with `findings.map(f => ({...f}))`. Same issue at line 1371.
🟡 [engineer] bin/lib/extensions.mjs:135 — No severity allowlist; any string passes the `typeof` check. `{ severity: "fatal", text: "..." }` is accepted but silently ignored by `computeVerdict`'s filters.
🟡 [engineer] bin/lib/run.mjs:1284 — SPEC says context must include `verdict` (line 32), but `mergeVerdictAppend` is called before `computeVerdict` so no verdict exists yet. Spec contract broken for extensions expecting `ctx.verdict`.
🟡 [product] SPEC.md:23 — Acceptance criterion says "before compound gate runs" but implementation runs verdictAppend *after* compound gate (`run.mjs:1256` vs `1284`); update spec wording to match actual ordering
🟡 [product] run.mjs:1285 — Spec requires `verdict` in verdictAppend context but only `findings` is passed; `verdict` doesn't exist yet at call time — update spec or add preliminary computeVerdict
🟡 [product] extensions.mjs:135 — Empty string passes `typeof f.text === "string"` guard; `{ severity: "critical", text: "" }` causes FAIL with blank diagnostic — add `f.text.trim().length > 0`
[product] The three 🟡 items are spec-alignment and defensive-coding refinements, not functional defects. None block merge.
🟡 [tester] test/extension-system.test.mjs:1 — 6 integration tests from the task-2 build ("verdictAppend integration" block including `cmdSynthesize` e2e test) were removed; run.mjs wiring at lines 1284 and 1371 has no test coverage; add integration test exercising extension findings → computeVerdict → handshake verdict
🟡 [tester] bin/lib/extensions.mjs:135 — Guard accepts `{ severity: "critical", text: "" }` (empty text passes `typeof === "string"` check); produces FAIL with blank finding; add `f.text.trim().length > 0` (carry-forward)
🟡 [tester] bin/lib/run.mjs:1252,1370 — eval.md is written BEFORE `mergeVerdictAppend` runs in both paths; extension findings affect the verdict but are invisible in the eval artifact; operators debugging a FAIL find no matching finding in eval.md
🟡 [tester] bin/lib/extensions.mjs:129 — `mergeVerdictAppend` has no per-finding text truncation cap (unlike `mergePromptAppend`'s 4096-char limit); buggy extension can inject unbounded text
🟡 [security] bin/lib/extensions.mjs:135 — `severity` field accepts any string; add allowlist check to prevent ghost findings that bypass `computeVerdict` counters
🟡 [security] bin/lib/extensions.mjs:136 — No length cap on `f.text` in `mergeVerdictAppend`; asymmetric with `mergePromptAppend` which enforces 4096 chars
🟡 [security] bin/lib/run.mjs:1371 — Extension findings merged AFTER eval.md is written; creates audit gap where eval.md doesn't reflect all findings that influenced the verdict
🟡 [security] bin/lib/run.mjs:1285 — `findings` array passed by reference to extensions; a malicious hook can mutate existing finding objects to downgrade severity before `computeVerdict` runs
🟡 [simplicity] bin/lib/run.mjs:1285 — `findings` array passed to verdictAppend context is a live reference; a buggy extension doing `ctx.findings.length = 0` would corrupt the verdict — pass `findings: [...findings]`
🟡 [simplicity] bin/lib/extensions.mjs:135 — `typeof f.text === "string"` guard accepts empty strings; `{ severity: "critical", text: "" }` produces a FAIL with blank diagnostic — add `f.text.trim().length > 0`
🔵 [architect] `run.mjs:1284` — Document the intentional post-compound-gate ordering with a comment
🔵 [architect] `extensions.mjs:129` — No finding count cap (unlike promptAppend's `MAX_APPEND_CHARS`)
🔵 [architect] `run.mjs:1284` — Context lacks `verdict` field from SPEC line 32; correct since verdict isn't computed yet, but SPEC should be updated
🔵 [engineer] bin/lib/extensions.mjs:10 — `VALID_HOOKS` only has 2 of the 4 planned hooks; will need updating for tasks 3-4.
🔵 [engineer] test/extension-system.test.mjs:1 — Stale file header comment (only mentions promptAppend).
🔵 [engineer] bin/lib/run.mjs:1256 — Compound gate runs BEFORE extension findings are merged, deviating from SPEC AC line 23. Document if intentional.
🔵 [product] run.mjs:1287 — Merge pattern duplicated between single/multi review paths; acceptable at 4 lines
🔵 [product] test/extension-system.test.mjs:504 — Context test doesn't assert absence of `verdict` field
🔵 [tester] bin/lib/extensions.mjs:135 — Any string accepted as severity; unknown values like `"error"` pass the guard but silently vanish from `computeVerdict` counts
🔵 [tester] test/extension-system.test.mjs:398 — No async `verdictAppend` hook test (all test hooks synchronous)
🔵 [tester] bin/lib/run.mjs:1284,1371 — No test asserts the ordering constraint (mergeVerdictAppend after compound gate, before computeVerdict)
🔵 [security] bin/lib/extensions.mjs:129 — No per-extension cap on findings count
🔵 [security] bin/lib/extensions.mjs:136 — No `source` field to trace which extension injected a finding
🔵 [simplicity] bin/lib/run.mjs:1284 — 4-line verdictAppend wiring duplicated across single/multi-review paths; too small to extract — leave as-is
🔵 [simplicity] bin/lib/extensions.mjs:76 — `callHook` exported but only consumed internally + tests; API surface could be tighter — not blocking

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**