# Engineer Review — dashboard-token-breakdown-feature-detail-view-clic

**Reviewer role:** Software Engineer (implementation correctness, code quality, error handling, performance)
**Date:** 2026-04-25
**Overall Verdict:** PASS

---

## Files Actually Read

- `dashboard-ui/src/components/feature-detail.tsx` (full, 167 lines)
- `dashboard-ui/src/components/feature-timeline.tsx` (full, 95 lines)
- `dashboard-ui/src/App.tsx` (full, 153 lines)
- `dashboard-ui/src/hooks/use-features.ts` (full, 91 lines)
- `dashboard-ui/src/types.ts` (full, 109 lines)
- `tasks/task-1/handshake.json`
- `tasks/task-1-p1/handshake.json`
- `tasks/task-2/handshake.json`
- `tasks/task-2/eval.md`
- `tasks/task-1/eval.md`
- `tasks/task-1-p1/artifacts/test-output.txt`
- `bin/lib/run.mjs` (grep: resetRunUsage, trackUsage, buildTokenUsage, tokenUsage — lines 192, 239, 246, 298, 308–309, 347, 761, 1468)
- `dashboard-ui/src/components/task-board.tsx` (lines 1–12)

**Not read:** `dashboard-ui/**/*.test.*` — confirmed none exist via glob.

---

## Builder Claims vs Evidence

Builder (task-1) claimed 6 fixes. Each verified against current code:

| Claim | File:Line | Verified |
|---|---|---|
| Deleted `App.tsx.bak` | — (glob returned no match) | ✓ PASS |
| Passed `setSelectedFeature` directly to `FeatureTimeline` | `App.tsx:126` | ✓ PASS |
| Adaptive cost precision (`toFixed(4)` sub-cent) | `feature-detail.tsx:13` | ✓ PASS |
| `Number.isFinite` guard on timeline cost | `feature-timeline.tsx:83` | ✓ PASS |
| `useEffect` reset guard for SSE-removed feature | `App.tsx:49–53` | ✓ PASS |
| SSE ref prevents polling while connected | `use-features.ts:74` | ✓ PASS |

**Note:** task-1-p1 eval.md (architect section, lines 50–73) contains findings that describe code BEFORE the task-1 fix run. Those findings (`fmtCost toFixed(2)` only, no `useEffect` guard) do not match the current committed code and should not be carried to backlog.

---

## Per-Criterion Results

### 1. Click a feature to see per-task cost — PASS

`App.tsx:132–136`: `selectedFeature` truthy → renders `FeatureDetail` with `features.find(f => f.name === selectedFeature) || null`. `feature-detail.tsx:87–121`: `Object.keys(tokenUsage.byTask).length > 0` guards per-task table. Wire-up is correct; click handler (`setSelectedFeature`) flows through `feature-timeline.tsx:56`.

### 2. Phase breakdown (brainstorm/build/review) — PASS

`feature-detail.tsx:127–153`: phase table rendered when `byPhase` non-empty. Each row renders `phase`, `dispatches`, aggregate tokens, `costUsd`, `durationMs`.

### 3. Run duration in header — PASS

`feature-detail.tsx:45–47`: `startTs = _runStartedAt || createdAt`, `endTs = completedAt || _last_modified`. `wallClockMs` computed only when both are non-null. Rendered at line 62 only when `> 0`. Invalid timestamps produce `NaN`; `NaN > 0` is `false`, so the section suppresses silently — correct.

**Caveat:** For in-progress features, `endTs` falls back to `_last_modified` (last state write), not current time. "Run duration" shows time-to-last-state-write, not current elapsed. This is stale for long-running active features. Not a bug but a UX limitation; flagged below.

### 4. Cost column in feature timeline — PASS

`feature-timeline.tsx:81–87`: `costUsd != null` renders `$N.NN`; otherwise renders `<div className="flex-shrink-0 w-14" />` as a placeholder. `Number.isFinite` guard at line 83.

**Precision inconsistency:** Timeline uses inline `toFixed(2)` — sub-cent costs show `$0.00`. `feature-detail.tsx` uses adaptive `toFixed(4)`. The same cost amount looks free in the timeline but non-zero in the panel. Flagged below.

### 5. Error handling — PASS

- `fmtCost`/`fmtMs`/`fmtK` all open with `Number.isFinite(v)` guard (`feature-detail.tsx:11–26`). Non-finite inputs return `'—'`.
- `total` in `TokenBreakdown` accessed via `total?.costUsd ?? 0` throughout lines 160–162.
- `feature.tasks.map(...)` safe: `Feature.tasks` is typed as `Task[]` (non-optional, non-nullable); no null guard needed.
- `JSON.parse` values from STATE.json cannot be `Infinity`/`NaN` (not valid JSON), so `Number.isFinite` guards are a correctness improvement but not strictly required for server-provided data.

### 6. Code quality — PASS with minor caveats

- `feature-detail.tsx` split into `FeatureDetail` (null gate) + `TokenBreakdown` (renders only when `tokenUsage` is non-null). Clean separation.
- `taskMap` allocated inside `TokenBreakdown` — only created when `tokenUsage` is truthy. No wasted allocation.
- `use-features.ts:74`: `sseActiveRef.current` ref correctly prevents polling when SSE is live. Ref approach avoids stale closure issues.
- `handleFeatureChange` wrapper removed; `setSelectedFeature` passed directly. One handler, one name.

**Type/runtime disagreement:** `types.ts:57` declares `total: PhaseTokenUsage` (non-optional). Runtime accesses via `total?.costUsd ?? 0` (optional-chaining). One of them is wrong; flagged below.

**Dead prop:** `App.tsx:140` passes `selectedFeature` to `TaskBoard`, which renders only in the `!selectedFeature` branch (line 131). `selectedFeature` is always `null` at that call site. Dead prop.

### 7. Performance — PASS

`Object.entries(byTask).map(...)` and `Object.entries(byPhase).map(...)` are O(n) over task/phase buckets. No n+1, no blocking I/O in the UI components. `use-features.ts` SSE + fallback polling pattern is correct.

### 8. Gate — PASS (with infrastructure caveat)

task-1-p1 gate: `spawnSync /bin/sh ETIMEDOUT` — runner infrastructure timeout, not a test failure. Current gate output (prompt): 566/566 tests, exit 0. Gate is clean.

### 9. Zero UI component tests — WARN

`dashboard-ui/**/*.test.*` → 0 files. All 566 tests cover backend harness code. The core acceptance criterion — "click a feature to see per-task cost, phase breakdown, run duration" — has no component test. If `App.tsx` stops passing `feature` to `FeatureDetail`, or `feature-detail.tsx` stops rendering `byTask` when non-empty, no test will catch it.

---

## Findings

🟡 dashboard-ui/src/components/feature-detail.tsx:1 — Zero component tests for `FeatureDetail`; the entire click-to-detail acceptance criterion is untested at the component level; add Vitest/RTL tests for: populated state, null tokenUsage, close button, and `fmtMs`/`fmtCost`/`fmtK` boundary values (carry to backlog)

🟡 dashboard-ui/src/components/feature-detail.tsx:74 — `!tokenUsage` renders generic "No token data available" with no agent-specific hint; codex-built features silently show this message and users cannot distinguish it from a data error; update fallback text to distinguish codex limitation (carry to backlog)

🔵 dashboard-ui/src/types.ts:57 — `FeatureTokenUsage.total` is non-optional in type but accessed as `total?.costUsd ?? 0` in `feature-detail.tsx:160`; change type to `total?: PhaseTokenUsage` to align with the defensive runtime access, or document the invariant and remove optional chaining

🔵 dashboard-ui/src/App.tsx:140 — `selectedFeature` is always `null` when `TaskBoard` renders (it's in the `!selectedFeature` branch at line 131); pass `null` directly or remove the prop to make the invariant explicit

🔵 dashboard-ui/src/components/feature-timeline.tsx:83 — inline `toFixed(2)` instead of reusing `fmtCost` from `feature-detail.tsx`; sub-cent costs show `$0.00` in the timeline but `$0.0001` in the detail panel — same cost reads as free in one view and non-zero in the other; extract `fmtCost` to a shared utils module and use it in both

🔵 dashboard-ui/src/components/feature-detail.tsx:47 — for in-progress features `endTs = feature._last_modified` (last state write), not current time; "Run duration" shows stale elapsed time that does not advance until the next SSE state push; consider suppressing the run duration display for active features, or document the limitation with a tooltip

---

# Simplicity Review — dashboard-token-breakdown-feature-detail-view-clic

**Reviewer role:** Simplicity advocate (dead code, premature abstraction, unnecessary indirection, gold-plating)
**Date:** 2026-04-25
**Overall Verdict:** PASS

---

## Files Actually Read

- `dashboard-ui/src/App.tsx` (full, 154 lines)
- `dashboard-ui/src/components/feature-detail.tsx` (full, 167 lines)
- `dashboard-ui/src/components/feature-timeline.tsx` (full, 95 lines)
- `dashboard-ui/src/hooks/use-features.ts` (full, 92 lines)
- `dashboard-ui/src/types.ts` (full, 109 lines)
- `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`, `tasks/task-1-p1/handshake.json`
- `tasks/task-2/eval.md`, `tasks/task-1/eval.md`, `tasks/task-1-p1/eval.md`

---

## Veto-Category Audit (🔴)

### 1. Dead code
`App.tsx.bak` — confirmed deleted (glob returns no match). No other dead variables, unreachable branches, or unused imports found. `_featuresLoading` at `App.tsx:25` uses the underscore prefix to intentionally ignore the value — not dead code.

**Result: PASS — no dead code.**

### 2. Premature abstraction
`TokenBreakdown` (`feature-detail.tsx:83`) is a file-private sub-component with one call site (`feature-detail.tsx:76`). Technically single-callsite. However, the split is a null-narrowing pattern, not a reuse abstraction: the parent `FeatureDetail` gates on `!tokenUsage`, and `TokenBreakdown` receives `tokenUsage: NonNullable<Feature['tokenUsage']>`, eliminating all null checks across 80+ lines of table rendering. Inlining it would require nesting 80 lines inside a ternary or scattering `!` assertions throughout. The split reduces cognitive load; it does not add it.

`fmtCost`, `fmtMs`, `fmtK` — each used at 3+ call sites within the same file. Not premature.

**Result: PASS — abstractions earn their keep.**

### 3. Unnecessary indirection
`handleProjectChange` (`App.tsx:55–58`) is a two-statement wrapper: sets project AND clears selected feature. Not a no-op delegation. The prior single-line `handleFeatureChange` wrapper (flagged 🔵 in task-2 review) has been removed; `setSelectedFeature` is now passed directly at lines 126 and 141.

**Result: PASS — no wrapper-only delegation.**

### 4. Gold-plating
`tokenDays` / `setTokenDays` — used at `App.tsx:103` as `onDaysChange={setTokenDays}`. Real variation is exercised.
`sseConnected` — used at `App.tsx:94` to show the connection indicator in `Navigation`.
No config options with only one value, no speculative extensibility.

**Result: PASS — no gold-plating.**

---

## Per-Criterion Results

### Feature code size
`feature-detail.tsx` is 167 lines: 3 formatters (14 lines), 1 exported component (52 lines), 1 private sub-component (83 lines, 2 tables + totals). The only indirection is the null-gate split described above. No hooks, no context, no abstraction layers. Size is proportional to the feature.

### Builder claims verified
All 6 task-1 fix claims verified against current code (see Engineer section above). The critical prior issue (`App.tsx.bak`) is gone. The previously flagged one-line `handleFeatureChange` wrapper is gone — `setSelectedFeature` passed directly.

### Unfixed prior 🔵 items (carry to backlog)
Two 🔵 items from previous reviews remain unaddressed in the current code:
- `App.tsx:141` — `selectedFeature` always null when `TaskBoard` renders; dead prop value
- `feature-timeline.tsx:3-4` — two separate import lines from the same `@/lib/utils` module (new finding; not previously called out)

---

## Findings

🔵 dashboard-ui/src/components/feature-timeline.tsx:3 — two separate `import { … } from '@/lib/utils'` statements (lines 3 and 4); merge into one: `import { humanizeName, relativeTime, getActiveTask, truncate, cn } from '@/lib/utils'`

🔵 dashboard-ui/src/App.tsx:141 — `selectedFeature={selectedFeature}` passed to `TaskBoard` is always `null` at that call site (code is in the `!selectedFeature` branch at line 131); pass `null` directly or remove the prop to make the invariant explicit (unfixed 🔵 from prior review)
