# Feature: Sprint Analytics

## Goal
Aggregate and display per-sprint execution metrics (task cycle time, failure rate, flow template usage, gate outcomes) so teams can evaluate sprint performance from existing STATE.json data.

## Scope

### Metrics computed per sprint
- **Task cycle time** — median and p90 time (minutes) from first `in-progress` transition to `passed` or `failed`, computed from `transitionHistory` timestamps in each feature's STATE.json
- **Task failure rate** — `failed / (passed + failed)` across all features in the sprint (excludes skipped/pending)
- **Gate pass rate** — `gate_passes / total_gates` across all features in the sprint
- **Top failing gate commands** — ranked list of commands with highest failure counts
- **Flow template usage** — which template (light / build-verify / full-stack) was used per feature, counted in aggregate
- **Re-plan rate** — tasks with `replanSource` set / total tasks (measures how often autonomous re-planning was triggered)

### Storage
- Sprint metrics written to `.team/sprints/{sprint}/analytics.json` when `agt-harness finalize` runs for the last feature in the sprint, and on-demand via `agt metrics --sprint`
- Schema mirrors the existing harness-metrics pattern: flat JSON with typed numeric fields and an ISO `computedAt` timestamp

### Display
- `agt metrics` gains a **Sprint** section below the existing Feature Summary, showing the active (or most recently completed) sprint's metrics in the same table/box style as current output
- `agt metrics --sprint <name>` shows metrics for a named sprint

### Data source
- All metrics derived exclusively from existing STATE.json files and PROJECT.json / `.team/PROJECT.md` for flow template info — no new data collection or schema changes required

## Out of Scope

- Charts, graphs, or visualizations (those belong in `agt dashboard`)
- Cross-sprint trend analysis or comparisons (future feature)
- Token cost or model usage breakdown per sprint (already shown at project level)
- Real-time metrics during task execution (already served by `agt board` and `agt log`)
- Exporting metrics to external systems (CSV, analytics services)
- Historical backfill for sprints completed before this feature shipped
- Changes to STATE.json schema or how the harness writes state

## Done When

- [ ] `agt metrics` output includes a Sprint section displaying cycle time (median + p90), failure rate, gate pass rate, flow template usage, and re-plan rate for the active or most recently completed sprint
- [ ] `agt metrics --sprint <name>` accepts a sprint name and displays analytics for that sprint
- [ ] Analytics are computed on-demand by reading existing STATE.json files under the sprint's features — no pre-aggregation daemon required
- [ ] Sprint analytics are persisted to `.team/sprints/{sprint}/analytics.json` with a `computedAt` timestamp after each computation
- [ ] Cycle time computation correctly uses `transitionHistory` timestamps: first `in-progress` entry → last terminal transition (`passed` or `failed`)
- [ ] All metrics degrade gracefully when data is sparse (e.g., sprint with zero failed tasks shows `0%` failure rate, not a divide-by-zero error)
- [ ] `agt help metrics` is updated to document the `--sprint` flag
