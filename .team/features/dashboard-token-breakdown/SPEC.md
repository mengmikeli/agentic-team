# Feature: Dashboard Token Breakdown

## Goal
Persist per-task and per-phase token/cost data from feature runs into STATE.json, and surface it in the dashboard as a cost column on the feature timeline and a detail view showing per-task cost, phase breakdown, and run duration.

## Requirements
- `run.mjs` writes token/cost data to STATE.json at the end of each task and at feature completion — covering input tokens, cached input tokens, output tokens, cost in USD, and duration in ms
- Token data is grouped by phase (brainstorm, build, review, gate) and by task ID
- The `/api/features` endpoint returns token data as part of the Feature response — no new endpoint needed
- The feature timeline shows a cost column (formatted as `$X.XXXX`) for each completed feature
- Clicking a feature opens a detail panel (replaces or augments the existing task board) with:
  - Per-task row: task title, phase, tokens (in/cached/out), cost USD, duration
  - Phase summary rows: aggregated tokens and cost per phase
  - Total run duration
- The detail panel gracefully handles features with no token data (runs before this feature shipped)

## Acceptance Criteria
- [ ] After `agt run` completes a feature, `STATE.json` contains a `tokenUsage` object with `byTask` (keyed by task ID) and `byPhase` (keyed by phase name) and `total` fields
- [ ] Each task entry in `tokenUsage.byTask` has `{ input, cachedInput, output, costUsd, durationMs, phase }`
- [ ] Each phase entry in `tokenUsage.byPhase` has `{ input, cachedInput, output, costUsd, durationMs }`
- [ ] `tokenUsage.total` has `{ input, cachedInput, output, costUsd, durationMs }`
- [ ] `/api/features` response includes `tokenUsage` field (null if absent from STATE.json)
- [ ] Feature timeline renders a "Cost" column showing `$X.XXXX` or `—` when no data
- [ ] Clicking a feature row opens a detail panel showing per-task cost breakdown table
- [ ] Detail panel shows phase summary section (brainstorm / build / review / gate rows)
- [ ] Detail panel shows total run duration
- [ ] Features with no `tokenUsage` in STATE.json display `—` in cost column and "No token data" in detail panel — no crash
- [ ] TypeScript types in `types.ts` fully cover the new fields (no `any`)
- [ ] Existing tests continue to pass

## Technical Approach

### Backend — `bin/lib/run.mjs`
- The in-memory `_taskUsage` map already tracks `{ input_tokens, cache_read_input_tokens, cache_creation_input_tokens, output_tokens, total_cost_usd, duration_ms }` per task ID
- `_phaseUsage` map tracks the same fields per phase name
- `_runUsage` tracks totals
- `setUsageContext(phase, taskId)` is already called to tag each dispatch
- After each task completes, accumulate into `_taskUsage[taskId]` with the current `_currentPhase`
- When writing STATE.json (via `writeState()`), include `tokenUsage: { byTask, byPhase, total }` computed from the in-memory maps
- Field mapping: `cache_read_input_tokens + cache_creation_input_tokens → cachedInput`

### Backend — `bin/agt.mjs`
- The `/api/features` handler already reads STATE.json and returns it; add `tokenUsage: state.tokenUsage ?? null` to the Feature response shape — minimal change

### Frontend — `dashboard-ui/src/types.ts`
Add:
```typescript
interface TokenPhaseBreakdown {
  input: number; cachedInput: number; output: number; costUsd: number; durationMs: number;
}
interface TaskTokenUsage extends TokenPhaseBreakdown { phase: string; }
interface FeatureTokenUsage {
  byTask: Record<string, TaskTokenUsage>;
  byPhase: Record<string, TokenPhaseBreakdown>;
  total: TokenPhaseBreakdown;
}
// Add to Feature: tokenUsage?: FeatureTokenUsage | null
```

### Frontend — `dashboard-ui/src/components/feature-timeline.tsx`
- Add a "Cost" column (right-aligned, monospace) using `tokenUsage?.total.costUsd`
- Format helper: `$${cost.toFixed(4)}` or `—`
- Clicking a row calls existing `onFeatureSelect` — no change to click behavior

### Frontend — new component `dashboard-ui/src/components/feature-detail.tsx`
- Rendered when a feature is selected (replaces or tabs alongside task-board)
- Sections:
  1. **Per-task table** — columns: Task, Phase, Input, Cached, Output, Cost, Duration
  2. **Phase summary table** — rows for each phase with aggregated values
  3. **Total row** — overall cost and duration
- If `tokenUsage` is null/undefined, render a single "No token data available" message

### No new API endpoints needed — all data flows through existing `/api/features`

## Testing Strategy
- **Unit test (run.mjs):** Mock agent responses with known `usage` fields; assert `tokenUsage` in the written STATE.json matches expected values for a 2-task feature with 2 phases
- **Unit test (api):** Mock STATE.json with `tokenUsage`; assert `/api/features` response includes it
- **Component test (feature-detail.tsx):** Render with fixture data; assert per-task rows and phase summary render correctly; render with null tokenUsage and assert fallback message
- **Component test (feature-timeline.tsx):** Assert cost column renders `$0.0042` for a feature with data and `—` for one without
- **Manual check:** Run `agt run` on a small feature; open dashboard; verify cost column and detail panel show matching values

## Out of Scope
- Integrating with the external `pew` token tracking tool or the `/api/tokens` endpoint
- Real-time token updates during task execution (shown only after completion)
- Token breakdown for the brainstorm phase that precedes task dispatch (if not already tracked via `setUsageContext`)
- Historical comparison between multiple runs of the same feature
- Export or download of token data as CSV/JSON
- Cost forecasting or budget alerts
- Per-subtask breakdown within a single task (task-level granularity is sufficient)
- Modifying the existing global token-view component

## Done When
- [ ] `STATE.json` written by `run.mjs` contains `tokenUsage` with `byTask`, `byPhase`, and `total`
- [ ] Feature timeline has a visible cost column with per-feature cost in USD
- [ ] Clicking a feature shows a detail panel with per-task and per-phase cost rows
- [ ] Features lacking token data show graceful fallback in both timeline and detail panel
- [ ] All TypeScript types are explicit (no `any`) and compile without errors
- [ ] Unit tests covering state write and API response pass
- [ ] No regressions in the existing test suite
