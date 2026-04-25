## Parallel Review Findings

[engineer] No 🔴 critical, no 🟡 warnings. Full evaluation written to `tasks/task-1/eval-engineer.md`.
[engineer] - **Correctness**: PASS — three failure layers (sync throw, reject, ok:false) all fail-closed with 🔴 sentinel; covered by tests at lines 145–192.
[engineer] - **Error handling**: PASS — all paths converge to a 🔴 finding consumed by `computeVerdict`.
[security] No 🔴 critical or 🟡 warning findings. The parallel dispatch reuses the same `spawn(..., { shell: false })` argv path as the existing single-review code, so no new injection surface is introduced. Fail-closed semantics (synthetic 🔴 for crashed/rejected/thrown dispatches) are correctly implemented and tested.
[simplicity veto] Evidence: 581/581 tests pass (test-output.txt). Sentinel `[reviewer-crash:<role>]` verified at parallel-reviews.mjs:21 and exempted in compound-gate.mjs:33,43. Sync-throw + Promise.reject fail-closed paths covered by tests at lines 166–192. Simplicity-veto tag conditional verified at flows.mjs:188 with both 🔴 (tag) and 🟡 (no tag) test coverage.
🟡 [architect] bin/lib/parallel-reviews.mjs:21 — Sentinel `[reviewer-crash:<role>]` is duplicated as a regex literal at `compound-gate.mjs:33`; extract a shared constant so the contract cannot drift.
🟡 [product] .team/features/multi-perspective-code-review/tasks/task-1/handshake.json:1 — Builder claims 559/559 tests pass but artifact shows 581/581; reconcile handshake to source artifact.
🟡 [tester] test/build-verify-parallel-review.test.mjs:27 — Source-text regex assertions on `runSource` will false-fail on benign refactors; pair each regex check with a behavioral test driving the review phase via its public entry point.
[simplicity] **Verdict: PASS** (with 🟡 backlog items)
🟡 [simplicity] bin/lib/run.mjs:357 — `runParallelReviews` is a 5-line delegate-only wrapper with a single call site (1191) that only binds `dispatchToAgentAsync`. Inline at the call site or use `.bind(null, dispatchToAgentAsync)`.
🟡 [simplicity] bin/lib/flows.mjs:34 — Phase names `"review"` and `"multi-review"` now drive identical parallel-review behavior via the unified guard at `run.mjs:1188`. Consolidate to one name or document the back-compat intent in code.
🔵 [architect] bin/lib/flows.mjs:170 — `PARALLEL_REVIEW_ROLES` is hard-coded; consider per-flow configurability in a follow-up.
🔵 [architect] bin/lib/run.mjs:1196 — Findings are parsed from raw role outputs, losing the `[role]` prefix that `merged` carries; consider parsing from merged text instead.
🔵 [architect] bin/lib/parallel-reviews.mjs:43 — `Promise.all` has no concurrency cap; flag for future scale-out.
🔵 [engineer] bin/lib/parallel-reviews.mjs:35 — `{ok:true, output:""}` treated as "no findings"; consider strict fail-closed on empty successful outputs
🔵 [engineer] bin/lib/run.mjs:1196 — `parseFindings(allText)` uses raw outputs while `eval.md` uses merged; consider single source of truth
🔵 [engineer] bin/lib/run.mjs:1185 — review-phase block is ~80 lines; extraction candidate
🔵 [product] bin/lib/flows.mjs:188 — Add a one-line comment naming the "simplicity veto" product policy so it isn't simplified away.
🔵 [product] bin/lib/flows.mjs:170 — No test asserts the role *names*, only the count; add a set-equality assertion to prevent silent label drift.
🔵 [product] .team/features/multi-perspective-code-review/tasks/task-5/eval.md:1 — Per-role eval files (`eval-<role>.md`) should be the default to avoid clobbering across reviewers.
🔵 [tester] test/build-verify-parallel-review.test.mjs:194 — Add symmetric case for simplicity 🔵 (suggestion) to lock the contract that `[simplicity veto]` attaches only to critical.
🔵 [tester] test/build-verify-parallel-review.test.mjs:60 — Add `empty roles` defensive test for `runParallelReviewsWithDispatch(…, [], …)`.
🔵 [tester] test/build-verify-parallel-review.test.mjs:62 — Pin the dedupe-or-not contract for duplicate `file:line` findings across roles.
🔵 [tester] bin/lib/run.mjs:1198 — No test asserts `runCompoundGate` receives raw `allText` vs. role-prefixed `merged`; divergence is load-bearing but untested.
🔵 [security] bin/lib/run.mjs:329 — Async dispatch has no per-call timeout (sync variant has 600s); a hung claude subprocess could hang the run. Add `child.kill()` after N ms for parity.
🔵 [security] bin/lib/parallel-reviews.mjs:18 — Consider stripping ANSI/control chars from `reason` in addition to the 200-char truncation.
🔵 [security] bin/lib/run.mjs:1227 — Raw gate stdout is committed to `eval.md`; document in PROJECT.md that gate commands must not emit secrets.
🔵 [simplicity] bin/lib/parallel-reviews.mjs:18 — `(reason || "...").toString().slice(0, 200)` is idiomatic but `String(reason ?? "reviewer dispatch failed").slice(0, 200)` is slightly clearer.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**