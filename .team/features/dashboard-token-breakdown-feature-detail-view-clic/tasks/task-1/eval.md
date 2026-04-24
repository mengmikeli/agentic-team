## Parallel Review Findings

[architect] - Prior 🔴 issues confirmed fixed in commit `48f59b9`
[architect] - The two prior 🔴 findings (`resetRunUsage()` never called, zero tracking tests) were both fixed in commit `48f59b9` — `resetRunUsage()` is now called at run.mjs:713, and 24 new tests in `test/token-usage.test.mjs` cover the full tracking surface
[engineer] - `bin/lib/run.mjs:715` — `resetRunUsage()` called at start of `_runSingleFeature` (refutes prior eval's 🔴)
[engineer] - `test/token-usage.test.mjs` — 20+ tests for `trackUsage`/`buildTokenUsage`/`resetRunUsage` (refutes prior eval's second 🔴)
[engineer] **Key corrections to prior eval.md:** The three 🔴 findings about `resetRunUsage()` having zero callers and `trackUsage` having no tests are **false**. The compound gate's `fabricated-refs` WARN was the correct signal. No remediation needed for those claims.
🔴 [product] `bin/lib/run.mjs:279` — Codex agent path never calls `trackUsage()` and returns no `usage`/`cost` fields. Any feature built via codex silently shows "No token data available" in the detail panel — the primary UX of this feature — with no explanation. For codex users, this feature delivers zero value. Fix: display an explicit "Token tracking unavailable (codex agent)" label when `tokenUsage` is null.
[product] **Note:** The prior parallel-review eval.md contained four 🔴 claims (`resetRunUsage()` has zero callers; no tests for `trackUsage`/`buildTokenUsage`) that are demonstrably false — `resetRunUsage()` is called at `run.mjs:715` and 20 tests cover these functions (test-output.txt lines 1388–1415). Those stale findings have been superseded by the current eval record.
🔴 [tester] `tasks/task-1/eval.md:3` — Prior eval contains two fabricated 🔴 critical findings: (1) "resetRunUsage has zero callers" — refuted by `bin/lib/run.mjs:715` which explicitly calls it with a comment; (2) "trackUsage/buildTokenUsage have zero tests" — refuted by `test/token-usage.test.mjs` (20 tests passing in test-output.txt lines 1388–1415); compound gate correctly flagged `fabricated-refs` but verdicted WARN, not FAIL
[tester] **Summary:** Gate passed legitimately (566/566 tests green). The implementation is correct — `resetRunUsage()` IS called at feature start (line 715), and token tracking IS covered by `test/token-usage.test.mjs`. The prior eval.md's 🔴 critical findings were false; the compound gate's `fabricated-refs` WARN was the right signal. Key backlog items: codex agent path silent gap, task phase label stale after review phase, and missing UI component tests.
[security] - **`resetRunUsage()` bug is fixed** — `bin/lib/run.mjs:715` calls it at the start of `_runSingleFeature`. The prior eval.md's 🔴 findings claiming "zero callers" are factually wrong. Test suite (`resetRunUsage — isolation between simulated features`, lines 1413–1415) confirms multi-feature isolation works.
[simplicity] **Note on prior eval.md 🔴 findings:** Three critical findings in the earlier parallel review claimed `resetRunUsage()` has zero callers. This is factually wrong — `resetRunUsage()` is called at `bin/lib/run.mjs:715` as the first line of `_runSingleFeature`, with an explanatory comment. The compound gate correctly flagged `fabricated-refs` (the cited line 1358 for `buildTokenUsage()` is a closing brace; the function is actually at line 218). Those critical findings should not be actioned.
🟡 [architect] bin/lib/run.mjs:279 — codex agent path has no `trackUsage()` call and no comment; features built with codex silently show "No token data available" with no indication this is by design; add a comment marking it as a known inherent limitation (codex has no structured JSON usage output)
🟡 [architect] dashboard-ui/src/App.tsx:52 — `handleFeatureSelect(featureName: string)` and `handleFeatureChange(featureName: string | null)` are functionally identical (both call `setSelectedFeature`); two names imply a semantic distinction that does not exist; consolidate to one handler
🟡 [engineer] `bin/lib/run.mjs:279` — codex path returns without calling `trackUsage()`; features built via codex silently produce no token data; add a console warn or documented stub
🟡 [engineer] `dashboard-ui/src/components/feature-detail.tsx:11` — `fmtCost`/`fmtMs`/`fmtK` lack `Number.isFinite(v)` guard; non-finite values from corrupted STATE.json throw or render "NaN"
🟡 [engineer] `dashboard-ui/src/App.tsx:52` — `handleFeatureSelect` and `handleFeatureChange` are identical one-liners; consolidate to remove confusion
🟡 [product] `.team/features/dashboard-token-breakdown-feature-detail-view-clic/SPEC.md:7` — "Done when" criteria are verbatim copies of the goal title; not independently testable by a reviewer without reading source code. Add discrete checkable acceptance criteria in future specs.
🟡 [product] `tasks/task-1/handshake.json` — No builder handshake exists; only a gate handshake. The artifact trail cannot confirm which files were built without cross-referencing git log.
🟡 [product] `dashboard-ui/src/components/feature-detail.tsx:126` — `tokenUsage.total.costUsd` accessed without null guard on `.total`; partially-written STATE.json would throw TypeError and blank the panel. Add `tokenUsage.total?.costUsd ?? 0` guard. *(Also flagged by Security and Architect reviewers.)*
🟡 [tester] `bin/lib/run.mjs:279` — codex agent path never calls `trackUsage()`; features built with codex silently produce `tokenUsage: null` with no user warning; no test or comment documents this as intentional
🟡 [tester] `bin/lib/run.mjs:198` — task `.phase` label captured at first dispatch only; `setUsageContext("review", task.id)` at line 1197 shifts phase context mid-task but the bucket stays labeled "build"; Phase column in detail panel is misleading for review-phase tasks; no test covers this multi-phase scenario
🟡 [tester] `dashboard-ui/src/components/feature-detail.tsx:1` — zero UI component tests; per-task table, phase breakdown, empty state, and close button are entirely unverified
🟡 [security] `bin/agt.mjs:449` — `/api/state?path=` accepts any filesystem path; server binds to all interfaces (line 586, no hostname); new `tokenUsage` cost data in STATE.json is now readable from arbitrary directories by local-network clients; validate `path` against registered project roots before reading
[security] - **No critical new security surface** — the one 🟡 (`?path=` path traversal) is pre-existing and already in backlog; it now exposes slightly more sensitive data (cost figures) via the new `tokenUsage` field.
🟡 [simplicity] `dashboard-ui/src/App.tsx:52` — `handleFeatureSelect` and `handleFeatureChange` are functionally identical (both call `setSelectedFeature`); consolidate to one handler `(name: string | null) => setSelectedFeature(name)` to remove reader confusion about why two exist
🔵 [architect] dashboard-ui/src/components/feature-detail.tsx:126 — `tokenUsage.total.costUsd` accessed without null guard on `.total`; if STATE.json has `tokenUsage` without `total` (partial write on crash), the component throws TypeError; add `tokenUsage.total &&` guard before lines 126–128
🔵 [architect] bin/lib/run.mjs:197 — task `.phase` frozen at bucket creation; `setUsageContext` changes mid-task do not update this label; undocumented; add comment marking this as intentional
🔵 [engineer] `dashboard-ui/src/components/feature-detail.tsx:126` — `tokenUsage.total.costUsd` accessed without null guard on `.total`; partial STATE.json write causes TypeError; use `?.costUsd ?? 0`
🔵 [engineer] `dashboard-ui/src/components/feature-detail.tsx:12` — `fmtMs` has no hours branch; 2-hour runs display as `120.0m`
🔵 [engineer] `dashboard-ui/src/components/feature-detail.tsx:38` — `taskMap` computed unconditionally but only used inside `tokenUsage` truthy block; move inside to avoid unnecessary allocation
🔵 [engineer] `feature-detail.tsx:80` — "Phase" column label is misleading (it's the phase at task creation, not a dynamic breakdown); rename to "Role" or add tooltip
🔵 [product] `dashboard-ui/src/App.tsx:52-58` — `handleFeatureSelect` and `handleFeatureChange` are identical; consolidate to one handler.
🔵 [product] `dashboard-ui/src/components/feature-detail.tsx:12` — `fmtMs()` has no hours case; 2-hour runs render as "120.0m".
🔵 [tester] `dashboard-ui/src/components/feature-detail.tsx:126` — `tokenUsage.total.costUsd` accessed without null guard on `.total`; partial STATE.json write would throw TypeError; add `tokenUsage.total &&` guard
🔵 [tester] `dashboard-ui/src/components/feature-detail.tsx:12` — `fmtMs()` has no hours branch; a 2-hour run displays as `120.0m`; add `if (v >= 3600000) return \`${(v/3600000).toFixed(1)}h\``
🔵 [tester] `dashboard-ui/src/App.tsx:52` — `handleFeatureSelect` and `handleFeatureChange` are identical; consolidate to one handler
🔵 [security] `dashboard-ui/src/components/feature-detail.tsx:126` — `tokenUsage.total.costUsd` accessed without null guard on `.total`; partial/corrupt STATE.json write throws TypeError crashing FeatureDetail; add `tokenUsage.total &&` guard before lines 126–128
🔵 [security] `dashboard-ui/src/components/feature-detail.tsx:11` — `fmtCost`/`fmtMs`/`fmtK` call `.toFixed()` with no `Number.isFinite(v)` guard; `(null).toFixed()` throws TypeError on corrupted STATE.json values; return `"—"` for non-finite inputs
[security] - **Two 🔵 null guard gaps** in `feature-detail.tsx` cause component crashes on corrupt STATE.json, but are not exploit paths.
🔵 [simplicity] `dashboard-ui/src/components/feature-detail.tsx:38` — `taskMap` built unconditionally before the `tokenUsage` null check; move inside the truthy block to eliminate unnecessary allocation on the "No token data" path
🔵 [simplicity] `dashboard-ui/src/components/feature-detail.tsx:12` — `fmtMs` has no hours case; a 2-hour run renders as `120.0m`; add `if (v >= 3_600_000) return \`${(v/3_600_000).toFixed(1)}h\`` before the minutes branch

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs
🔴 iteration-escalation — Persistent eval warning: fabricated-refs recurred in iterations 1, 2

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs