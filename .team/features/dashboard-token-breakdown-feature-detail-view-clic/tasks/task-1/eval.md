## Parallel Review Findings

🔴 [architect] `bin/lib/run.mjs:1358` — `buildTokenUsage()` reads module-level globals never reset between outer-loop features; all features after the first accumulate prior features' token usage in their STATE.json; fix by calling `resetRunUsage()` at start of `_runSingleFeature`
[architect] The 🔴 is a silent data-corruption bug in the primary outer-loop use case. `_runUsage`, `_phaseUsage`, and `_taskUsage` are module-level singletons. `resetRunUsage()` is exported but has **zero callers** (confirmed with grep). When `agt run` processes Feature 2, 3, ... N, each feature's `STATE.json` gets `tokenUsage` that includes all prior features' dispatches summed in. Feature 1 is the only one with accurate data.
🟡 [engineer] `bin/lib/run.mjs:214` — `resetRunUsage()` exported but has zero callers; in continuous mode (`agt run` no-args), each subsequent feature's `tokenUsage` accumulates all prior features' tokens, inflating costs from feature 2 onward; fix by calling `resetRunUsage()` at the start of `_runSingleFeature` *(also flagged 🔴 by Architect — treat as high priority)*
[engineer] 1. The `resetRunUsage()` accumulation bug (silent, only affects outer-loop continuous mode — the Architect flagged this 🔴)
🔴 [product] `bin/lib/run.mjs:1358` — `buildTokenUsage()` reads module-level globals (`_runUsage`, `_phaseUsage`, `_taskUsage`) that are never reset between features in the outer loop. In a multi-feature `agt run` session, every feature after the first will display inflated costs — cumulative of all prior features. A cost-visibility feature that shows wrong costs has no user value. Fix: call `resetRunUsage()` at the start of `_runSingleFeature`.
🔴 [tester] `bin/lib/run.mjs:165` — `trackUsage()`, `setUsageContext()`, `buildTokenUsage()` have zero tests; the gate PASS is from 532 pre-existing harness tests that don't touch the new code; add unit tests for phase/task accumulation, `buildTokenUsage()` output shape, and `resetRunUsage()` clearing all state
🔴 [tester] `bin/lib/run.mjs:278` — codex agent path never calls `trackUsage()`; all codex-built features silently show "No token data available" with no warning; add test or explicit log line documenting this limitation
[security] The architect review already flagged a 🔴 bug (`resetRunUsage()` never called between outer-loop features causing token accumulation across features). That is a correctness/data-integrity issue, not a security vulnerability, and is already captured in the eval.
🟡 [architect] `bin/lib/run.mjs:197` — `_taskUsage[id].phase` set once at bucket creation; in multi-review flow `setUsageContext("review", task.id)` at line 1186 shifts the phase context but this task's `.phase` label stays "build"; displayed incorrectly in feature-detail per-task Phase column
🟡 [engineer] `bin/lib/run.mjs:217` — Zero unit tests for `buildTokenUsage()`, `trackUsage()`, or the `/api/features` token field despite explicit SPEC requirements (`dashboard-token-breakdown/SPEC.md:76-79`); add tests covering accumulation math and STATE.json write path
🟡 [product] `.team/features/dashboard-token-breakdown-feature-detail-view-clic/SPEC.md:7` — "Done when" criteria are verbatim copies of the goal with no independently testable acceptance criteria. I verified requirements by reading source code, not from the spec. Future specs must include checkable ACs so any reviewer can verify done without source access.
🟡 [product] `tasks/task-1/handshake.json` — No builder handshake written; only a gate handshake exists. Cannot confirm from the harness record which files the builder claimed to modify.
🟡 [product] `dashboard-ui/src/components/feature-detail.tsx:1` — Zero UI component tests for this feature. FeatureDetail rendering, empty states, and click wiring are entirely untested.
🟡 [tester] `bin/lib/run.mjs:194` — task retry accumulates tokens on top of the failed-attempt bucket without reset; per-task cost in the UI is inflated across all attempts with no indication; test or document the "all-attempts" semantic
🟡 [tester] `dashboard-ui/src/components/feature-timeline.tsx:69` — no distinction between `tokenUsage === null` (never tracked) and `costUsd === 0.0000` (ran but free); both render a blank cost column; test that the two cases are distinguishable
🟡 [security] `bin/agt.mjs:438` — `?path=` query param accepts any filesystem path; validate against registered project paths to prevent STATE.json (including new `tokenUsage` data) from being read at arbitrary directories
🟡 [simplicity] `dashboard-ui/src/App.tsx:52-58` — `handleFeatureSelect` and `handleFeatureChange` are identical functions (both call `setSelectedFeature`); consolidate to one to remove confusion about why two exist
🔵 [architect] `dashboard-ui/src/App.tsx:52-58` — `handleFeatureSelect` and `handleFeatureChange` are identical; consolidate to one handler
🔵 [engineer] `bin/lib/run.mjs:197` — Task phase label frozen at first dispatch; multi-review dispatches accumulate into the task bucket but always display as "build" in the detail panel; consider labeling the column "primary phase"
🔵 [engineer] `dashboard-ui/src/components/feature-timeline.tsx:71` — `costUsd.toFixed(4)` renders `$0.0000` for zero-cost features with `tokenUsage`; consider rendering `—` when `costUsd === 0`
🔵 [product] `dashboard-ui/src/components/feature-detail.tsx:67` — "Phase" column in the per-task table shows the phase the task was tagged with at creation (a static label, not a breakdown). Consider labeling it "Role" or "Node" to distinguish it from the aggregate "By Phase" table below.
🔵 [tester] `dashboard-ui/src/components/feature-detail.tsx:12` — `fmtMs()` has no hours case; a 2-hour run displays as `120.0m`; add `if (v >= 3600000) return \`${(v/3600000).toFixed(1)}h\``
🔵 [security] `dashboard-ui/src/components/feature-detail.tsx:126` — `tokenUsage.total` accessed without null guard; if STATE.json has tokenUsage without `total`, throws TypeError; add `tokenUsage.total &&` guard before lines 126–128
🔵 [security] `dashboard-ui/src/components/feature-detail.tsx:11` — `fmtCost`/`fmtMs`/`fmtK` call `.toFixed()` without `Number.isFinite(v)` guard; non-numeric values from corrupted STATE.json will throw or render "NaN"; return `"—"` for non-finite inputs
🔵 [simplicity] `dashboard-ui/src/components/feature-detail.tsx:37-38` — `taskMap` computed unconditionally but only used inside the `tokenUsage` truthy block; move it inside to avoid unnecessary work when data is absent
🔵 [simplicity] `bin/lib/run.mjs:197` — `phase` captured only at first dispatch; if `setUsageContext` changes the phase mid-task, the per-task label sticks to the initial value — add a comment marking this as intentional (phase = phase at task start) so future readers don't chase a phantom bug

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs