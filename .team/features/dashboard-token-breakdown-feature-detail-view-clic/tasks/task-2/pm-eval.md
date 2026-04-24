# PM Review — dashboard-token-breakdown-feature-detail-view-clic

## Overall Verdict: PASS

Core user value is delivered. All five user-facing requirements are implemented and directly traceable to code. Four 🟡 items must go to backlog before this is considered fully shippable quality; none block merge.

---

## Files Read

- `.team/features/dashboard-token-breakdown-feature-detail-view-clic/SPEC.md`
- `tasks/task-1/handshake.json`
- `tasks/task-1-p1/handshake.json`
- `tasks/task-2/handshake.json`
- `tasks/task-1-p1/artifacts/test-output.txt`
- `tasks/task-1/eval.md` (parallel review output, full)
- `tasks/task-2/eval.md` (parallel review output, full)
- `dashboard-ui/src/components/feature-detail.tsx` (full, 163 lines)
- `dashboard-ui/src/components/feature-timeline.tsx` (full, 95 lines)
- `dashboard-ui/src/App.tsx` (full, 150 lines)
- `dashboard-ui/src/types.ts` (full, 109 lines)
- Glob: `dashboard-ui/**/*.test.*` — 0 files found

---

## Per-Criterion Results

### 1. Click a feature to see the detail panel — PASS

**Evidence:** `feature-timeline.tsx:56` calls `onFeatureSelect(feature.name)` on click. `App.tsx:129-133` conditionally renders `<FeatureDetail>` when `selectedFeature` is truthy, swapping out `TaskBoard`. Wire-up is correct and complete.

### 2. Per-task cost — PASS

**Evidence:** `feature-detail.tsx:87-120` renders a per-task table with columns: Task, Phase, In, Cached, Out, Cost, Dur. Cost column uses `fmtCost(tu.costUsd)` at line 113. Table only renders when `Object.keys(tokenUsage.byTask).length > 0`, correctly handling the empty case.

### 3. Phase breakdown (brainstorm/build/review) — PASS

**Evidence:** `feature-detail.tsx:123-151` renders a by-phase table with columns: Phase, Dispatches, Tokens, Cost, Dur. Table renders when `Object.keys(tokenUsage.byPhase).length > 0`. Phase labels come from STATE.json data — no hardcoded brainstorm/build/review strings, which is correct since labels are data-driven.

### 4. Run duration — PASS

**Evidence:** `feature-detail.tsx:42-44` computes `wallClockMs` from `(feature._runStartedAt || feature.createdAt)` → `(feature.completedAt || feature._last_modified)`. `feature-detail.tsx:61` displays "Run duration: {fmtMs(wallClockMs)}". `_runStartedAt` is typed in `types.ts:28` as `_runStartedAt?: string`. Duration display is conditional on `wallClockMs != null && wallClockMs > 0`.

### 5. Cost column on feature timeline — PASS

**Evidence:** `feature-timeline.tsx:81-87` renders a fixed-width `w-14` cost cell on each row. When `feature.tokenUsage?.total?.costUsd != null`, displays `$X.XX`; otherwise renders an empty `w-14` placeholder div so row layout does not shift when cost data is absent.

### 6. SPEC.md acceptance criteria — FAIL (spec quality gap)

**Evidence:** `SPEC.md:6-8` — the "Done when" block is a verbatim copy of the goal string. Neither criterion is independently testable: "Dashboard token breakdown — Feature detail view: click a feature to see per-task cost, phase breakdown (brainstorm/build/review), run duration. Cost column on feature timeline." This is not a binary, verifiable condition; it is the goal restated. A PM cannot sign off on "done" from this spec alone without reading code. Future specs must list discrete, binary acceptance criteria.

### 7. UI test coverage — FAIL (coverage gap)

**Evidence:** `Glob dashboard-ui/**/*.test.*` returned 0 files. The entire 566-test suite covers backend harness code only. The primary user-facing interaction — clicking a feature to see token breakdown — has zero automated tests. Regressions to `FeatureDetail`, `TokenBreakdown`, `fmtCost`/`fmtMs`/`fmtK`, or the click-to-detail wiring in `App.tsx` would be undetected by `npm test`.

### 8. Stale selectedFeature edge case — WARN

**Evidence:** `App.tsx:131` — `features.find(f => f.name === selectedFeature) || null`. If an SSE update removes the selected feature from `features`, `FeatureDetail` receives `feature={null}` and renders "Select a feature" (`feature-detail.tsx:34`), while `selectedFeature` is still non-null. The user sees a blank detail panel with no way to understand why the feature they clicked is gone. No `useEffect` resets `selectedFeature` when the named feature is absent.

### 9. Codex agent token fallback — WARN

**Evidence:** `feature-detail.tsx:70-71` — when `!tokenUsage`, renders "No token data available" with no context. For codex-built features this is expected behavior (confirmed by `run.mjs:282-284` comment), but the user sees an identical message whether the feature was built by codex (by design) or whether data collection failed (error). No user-visible distinction.

---

## Findings

🟡 `dashboard-ui/src/components/feature-detail.tsx:1` — Zero UI tests for this component; click-to-detail, null-tokenUsage, and close-button paths are untested; add component tests so regressions are caught by `npm test`
🟡 `dashboard-ui/src/App.tsx:131` — Stale `selectedFeature` after SSE removes a feature: `FeatureDetail` receives `feature={null}` and shows "Select a feature" while `selectedFeature` is still set; add `useEffect` to reset `selectedFeature` when `features.find(...)` returns undefined
🟡 `dashboard-ui/src/components/feature-detail.tsx:71` — "No token data available" gives no hint whether it is a codex limitation or a data error; change fallback text to distinguish the two cases (e.g., "Token data not available for this agent" vs "Token data unavailable")
🟡 `dashboard-ui/src/App.tsx.bak` — Dead backup file committed to source tree; caused fabricated findings in prior review iterations; delete it
🟡 `.team/features/dashboard-token-breakdown-feature-detail-view-clic/SPEC.md:6` — "Done when" criteria are a verbatim copy of the goal, not independently testable; future specs must list discrete binary acceptance criteria so PM can verify done from the spec alone
🔵 `dashboard-ui/src/types.ts:57` — `FeatureTokenUsage.total` typed as non-optional (`total: PhaseTokenUsage`) but `feature-detail.tsx:157-159` uses `total?.costUsd ?? 0`; align type to `total?: PhaseTokenUsage` to match runtime defensive access
