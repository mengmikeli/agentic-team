## Parallel Review Findings

🟡 [architect] `bin/lib/run.mjs:256` — `dispatchToAgent` has a split return contract: claude returns `{ ok, output, error, usage, cost }`, codex returns `{ ok, output, error }`; callers cannot be written agent-agnostically; add a normalising adapter so all callers see a uniform shape (pre-existing; carry to backlog)
🟡 [architect] `bin/lib/run.mjs:281` — codex path never calls `trackUsage()`; features built via codex produce `tokenUsage: null`; limitation is documented in code but UI shows generic "No token data available" with no explanation; add a label or tooltip so users understand it is expected, not a bug (pre-existing; carry to backlog)
🟡 [engineer] `bin/lib/run.mjs:1392` — `catch { /* best-effort */ }` silently discards `tokenUsage` write failures with no log message; add `console.warn` for observability when STATE.json write fails
🟡 [engineer] `bin/lib/run.mjs:1388` — `if (_runUsage.dispatches > 0)` means codex-built features never persist `tokenUsage`; the UI shows "No token data available" with no user-facing explanation; update the UI fallback or write a `tokenUsage: null` sentinel with a reason field
[engineer] All prior-eval 🟡/🔵 issues are verified fixed in the current code:
[engineer] Gate is clean: 566/566 tests, exit 0. Two 🟡 items filed to backlog.
🟡 [product] `dashboard-ui/src/components/feature-detail.tsx:1` — Zero UI component tests; the acceptance criterion "click a feature to see per-task cost, phase breakdown, run duration" cannot be verified by `npm test` since no test renders `FeatureDetail` or simulates a click interaction; add Vitest/RTL tests for empty state, populated state, close button, and null tokenUsage path
🟡 [product] `bin/lib/run.mjs:282` — Codex agent path silently produces `tokenUsage: null`; source comment was added but the UI shows generic "No token data available" with no hint it is agent-specific; change fallback text in `feature-detail.tsx:56` to distinguish codex limitation from a data error
🟡 [product] `.team/features/dashboard-token-breakdown-feature-detail-view-clic/SPEC.md:7` — "Done when" criteria are verbatim copies of the goal, not independently testable; PM cannot verify "done" from the spec alone; future specs must list discrete, binary acceptance criteria
🟡 [product] `.team/features/dashboard-token-breakdown-feature-detail-view-clic/tasks/task-1/eval.md:1` — Existing eval.mds contain stale warnings (null guard, `Number.isFinite`, hours branch, duplicate handlers) that are already fixed in the shipped code; evals do not match disk state and cannot be used for audit
🟡 [tester] No test file for `FeatureDetail` component — the core user-facing behavior (click feature → render token breakdown) has zero component tests; happy path, null-tokenUsage path, and close-button path are all untested; add component unit tests or an integration test for the click-to-detail flow
🟡 [tester] `dashboard-ui/src/App.tsx:128` — `features.find(f => f.name === selectedFeature)` returns undefined when SSE removes a feature mid-session; `FeatureDetail` receives `feature={null}` and renders "Select a feature" while `selectedFeature` is still set; add a `useEffect` that resets `selectedFeature` when the named feature is no longer in `features`
🟡 [security] bin/agt.mjs:449 — `/api/state?path=` + all-interface binding (`server.listen` line 586) exposes STATE.json (now including cost/token data) to local-network clients via unvalidated path parameter; validate `path` against registered project roots before reading *(pre-existing; impact marginally elevated by new `tokenUsage` field)*
[security] - `feature-detail.tsx:126` (prior 🔵/🟡): `total?.costUsd ?? 0` and optional chaining on lines 140–142 — confirmed fixed, no TypeError risk on partial STATE.json.
[security] - `bin/lib/run.mjs:282` (prior 🟡 codex path silent): explicit `// NOTE:` comment added documenting the limitation — confirmed present.
🟡 [simplicity] `dashboard-ui/src/App.tsx.bak` — dead backup file committed to source tree; it contains the pre-refactor two-handler code (`handleFeatureSelect` + `handleFeatureChange`) and **directly caused** the Architect and Engineer reviewers to fabricate findings about "identical one-liners" that don't exist in the current `App.tsx`; delete it
[architect] All prior 🔵 suggestions from previous iterations have been applied in the current code. Gate confirms 566/566 tests pass.
🔵 [architect] `dashboard-ui/src/types.ts:55` — `FeatureTokenUsage.total` typed as non-optional (`total: PhaseTokenUsage`) but `feature-detail.tsx:140` accesses it with `total?.costUsd ?? 0`; change type to `total?: PhaseTokenUsage` to match defensive runtime access, or document the invariant
🔵 [engineer] `dashboard-ui/src/App.tsx:134` — `selectedFeature` is always `null` when `TaskBoard` renders (it renders only in the `!selectedFeature` branch at line 126); pass `null` directly or remove the prop to make the invariant explicit
🔵 [tester] `dashboard-ui/src/components/feature-detail.tsx:11` — `fmtCost`, `fmtMs`, `fmtK` are pure functions with no unit tests; the recently-added hours branch at line 14 has no coverage; add unit tests for boundary values (0, 999, 1000, 60000, 3600000)
🔵 [tester] `dashboard-ui/src/components/feature-detail.tsx:72` — when both `byTask` and `byPhase` are empty (codex agent, no trackUsage called) but `tokenUsage` is non-null, only the Total row renders with `$0.0000 0 tokens 0ms`; no test covers this and the UX is silent about why there are no rows
🔵 [tester] `.team/features/dashboard-token-breakdown-feature-detail-view-clic/tasks/task-1/handshake.json:6` — handshake records `"verdict": "FAIL"` with 12 criticals, but the final eval.md concludes PASS with 0 criticals; the artifacts are inconsistent and undermine the audit trail; the handshake should be regenerated to reflect the final review state
[security] - `feature-detail.tsx:11–20` (prior 🔵): `fmtCost`, `fmtMs`, `fmtK` all open with `Number.isFinite(v)` guards — confirmed fixed, non-finite inputs now return `"—"`.
[security] - `feature-detail.tsx:12` (prior 🔵 hours branch): hours branch (`v >= 3_600_000`) now present at line 14 — confirmed fixed.
🔵 [simplicity] `dashboard-ui/src/components/feature-timeline.tsx:9` — `onFeatureSelect: (name: string)` vs `task-board.tsx:11` `onFeatureChange: (name: string | null)` — sibling components diverge in prop name and nullability for the same callback; a reader must trace both to confirm they're equivalent; align to one interface
🔵 [simplicity] `dashboard-ui/src/App.tsx:52` — `handleFeatureChange` is a one-line pass-through for `setSelectedFeature`; acceptable if future intercepts are planned, but currently just indirection

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs
🔴 iteration-escalation — Persistent eval warning: fabricated-refs recurred in iterations 1, 2

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs