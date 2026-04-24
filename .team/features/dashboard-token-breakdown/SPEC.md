# Feature: Dashboard Token Breakdown

## Goal
Surface per-task cost, phase cost breakdown, and run duration in the dashboard so users can understand what a feature execution actually cost and where that cost came from.

## Requirements
- Clicking a feature row in the Timeline panel opens a detail panel in place of the Task Board.
- The detail panel shows a **per-task table**: task name, phase, input tokens, cached tokens, output tokens, cost (USD), and duration.
- The detail panel shows a **per-phase table**: phase name (brainstorm / build / review / gate), dispatch count, total tokens, cost (USD), and duration.
- The detail panel shows a **total row**: aggregate cost, total tokens, and total duration for the feature.
- The Timeline panel shows a **cost column** on every feature row that has token data (`$X.XX` right-aligned).
- When no token data is available for a feature, the detail panel shows a "No token data available" placeholder rather than an empty or broken view.
- The detail panel can be dismissed, restoring the Task Board in the right-hand slot.
- Token data is read from `STATE.json → tokenUsage` (populated by `bin/lib/run.mjs` during execution); no separate data fetch is required.

## Acceptance Criteria
- [ ] Clicking a feature in the Timeline opens `FeatureDetail` in the right column; clicking the close button restores `TaskBoard`.
- [ ] `FeatureDetail` renders the per-task table with columns: Task, Phase, In, Cached, Out, Cost, Dur.
- [ ] `FeatureDetail` renders the per-phase table with columns: Phase, Dispatches, Tokens, Cost, Dur.
- [ ] `FeatureDetail` renders a summary total row showing aggregate cost, total tokens, and total duration.
- [ ] Features with `tokenUsage` populated show `$X.XX` in the Timeline cost column.
- [ ] Features without `tokenUsage` show `—` or nothing in the cost column and a placeholder in the detail panel.
- [ ] Token values are formatted: costs as `$X.XX`, token counts with K/M suffixes, durations as `Xs`, `Xm`, or `Xh`.
- [ ] `buildTokenUsage()` in `run.mjs` correctly populates `byTask` (keyed by task ID with `phase` label) and `byPhase` (keyed by phase name) in STATE.json.
- [ ] The `/api/features` endpoint passes `tokenUsage` from STATE.json through to the dashboard client.

## Technical Approach

**Data layer (`bin/lib/run.mjs`):**
- `setUsageContext(phase, taskId)` sets the current accumulation bucket before each dispatch.
- `trackUsage(jsonResult)` accumulates input/output/cached tokens, cost, and duration into run-level, phase-level, and task-level buckets.
- `buildTokenUsage()` transforms these buckets into `{ byTask, byPhase, total }` and is called at feature completion to write into STATE.json.

**API layer (`bin/agt.mjs`):**
- `/api/features?path=<projectPath>` reads each `STATE.json` and includes `tokenUsage: state?.tokenUsage ?? null` in the feature object returned to the client.

**Types (`dashboard-ui/src/types.ts`):**
- `FeatureTokenUsage` — `{ byTask, byPhase, total }`
- `TaskTokenUsage` — `{ phase, dispatches, inputTokens, cachedInput, outputTokens, costUsd, durationMs }`
- `PhaseTokenUsage` — `{ dispatches, inputTokens, cachedInput, outputTokens, costUsd, durationMs }`

**UI components:**
- `dashboard-ui/src/components/feature-timeline.tsx` — renders `$X.XX` cost badge from `feature.tokenUsage?.total?.costUsd` on each row; rows are clickable and call `onFeatureSelect(feature.name)`.
- `dashboard-ui/src/components/feature-detail.tsx` — `FeatureDetail` wrapper with close button; `TokenBreakdown` sub-component renders the per-task and per-phase tables plus total row.
- `dashboard-ui/src/App.tsx` — `selectedFeature` state; when set, renders `FeatureDetail` in the right-column slot; when null, renders `TaskBoard`.

## Testing Strategy

**Unit tests (existing — `test/token-usage.test.mjs`):**
- Covers `trackUsage`, `setUsageContext`, `resetRunUsage`, `buildTokenUsage` with 16+ cases: accumulation, phase separation, task bucketing, phase label recording, graceful handling of missing fields.

**Integration / manual verification:**
- Run `agt run` on a project, then open the dashboard (`agt dashboard`).
- Confirm features with completed runs show a cost badge in the Timeline.
- Click a feature; confirm the detail panel opens with per-task and per-phase tables populated.
- Click close; confirm the Task Board is restored.
- Click a feature with no token data; confirm the placeholder message is shown.

**No UI component tests are required** — the dashboard has no existing component test suite and the logic is straightforward display of already-validated data.

## Out of Scope
- Real-time token updates while a feature is executing (detail panel shows data from completed STATE.json writes only).
- Editing or exporting the token breakdown data.
- Aggregated cross-feature cost analytics (that lives in the Tokens tab, not the project view).
- Sorting or filtering the per-task or per-phase tables.
- Cost breakdown for individual gate commands (only task-level granularity is tracked).

## Done When
- [ ] Clicking any feature in the Timeline opens `FeatureDetail` and shows the `TokenBreakdown` tables when data is present.
- [ ] The Timeline shows a cost column on features that have `tokenUsage` data.
- [ ] Features without token data display a graceful placeholder rather than an error or empty tables.
- [ ] All existing token-usage unit tests pass (`node --test test/token-usage.test.mjs`).
- [ ] The dashboard builds without TypeScript errors (`npm run build` in `dashboard-ui/`).
