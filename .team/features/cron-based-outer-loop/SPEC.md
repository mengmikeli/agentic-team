# Feature: Cron-based Outer Loop

## Goal
Enable the agentic pipeline to run continuously without a persistent CLI process by having `agt cron-tick` poll the GitHub Project board on a system cron schedule and dispatch each "Ready" item as a complete autonomous feature run.

## Requirements
- `agt cron-tick` reads the GitHub Project board, finds the first item with status "Ready", transitions it to "In Progress", and runs it via `runSingleFeature`
- `agt cron-setup` prints a ready-to-paste crontab entry (default interval: 30 minutes, configurable via `--interval N`)
- An advisory lock at `.team/.cron-lock` prevents concurrent tick invocations from stepping on each other
- All tick output is appended to `.team/cron.log` (stdout + stderr)
- On successful feature run the board item is transitioned to "Done"
- On failed or interrupted feature run the board item is reverted to "Ready" and a comment is posted to the issue explaining the failure
- If no items are in "Ready" status the tick exits cleanly (exit 0) with a brief log line
- The feature respects the human-approval gate: brainstorm + spec + issue creation still happen; cron-tick only picks up items the human has already approved (i.e., moved to "Ready")

## Acceptance Criteria
- [ ] `agt cron-tick` with a board item in "Ready" transitions it to "In Progress", runs the feature, and transitions to "Done" on success
- [ ] `agt cron-tick` with no "Ready" items exits 0 and logs "no ready items"
- [ ] `agt cron-tick` invoked concurrently (two simultaneous processes) — the second process exits immediately without running a feature
- [ ] `agt cron-tick` when feature run fails reverts the board item to "Ready" and comments on the GitHub issue
- [ ] `agt cron-setup` prints a crontab line that cd's to the project root and invokes `agt cron-tick >> .team/cron.log 2>&1`
- [ ] `agt cron-setup --interval 15` prints a crontab line with `*/15 * * * *`
- [ ] All cron-tick activity is appended (not overwritten) to `.team/cron.log` with ISO timestamps

## Technical Approach

### Files that change
- `bin/lib/cron.mjs` — primary implementation (`cmdCronTick`, `cmdCronSetup`); already has skeleton, needs full wiring
- `bin/agt.mjs` — `cron-tick` and `cron-setup` commands already routed; verify flags are passed through
- No new files needed

### `cmdCronTick` algorithm
```
1. Acquire advisory lock (.team/.cron-lock, timeout 0 — fail fast)
   → if lock fails: log "cron-tick already running, skipping" and exit 0
2. Read tracking config from .team/PROJECT.md (Status Field ID, Option IDs)
3. listProjectItems(projectNumber) → filter status === "ready" → take first item
   → if none: log "no ready items" and exit 0
4. Transition item status to "in-progress" on project board
5. await runSingleFeature([], item.title)
6a. On success: transition to "done"
6b. On failure: transition back to "ready", comment on issue with error summary
7. Release lock (delete .cron-lock)
```

### `cmdCronSetup` algorithm
```
1. Parse --interval N (default 30)
2. Resolve absolute path to agt binary and cwd
3. Print: */{N} * * * * cd '{cwd}' && PATH='{PATH}' '{agtBin}' cron-tick >> '{cwd}/.team/cron.log' 2>&1
4. Print usage hint: "Add the above line with: crontab -e"
```

### Lock implementation
- Use `lockFile()` from `bin/lib/util.mjs` with `{ timeout: 0 }` for non-blocking try
- Delete lock in `finally` block to guarantee release on crash

### Logging
- Prefix each log line with ISO timestamp: `[2026-04-26T12:00:00.000Z] cron-tick: ...`
- Write to process.stdout (crontab redirects stdout+stderr to cron.log)

### GitHub board transitions
- Reuse `setProjectItemStatus()` from `bin/lib/github.mjs` (or equivalent)
- Status option IDs come from `.team/PROJECT.md` tracking config

## Testing Strategy
- **Unit tests** (`test/cron.test.mjs`):
  - `cmdCronTick` with mocked `listProjectItems` returning a Ready item → verifies transition sequence (ready → in-progress → done)
  - `cmdCronTick` with no Ready items → exits cleanly
  - `cmdCronTick` when `runSingleFeature` throws → reverts to "ready", posts comment
  - Concurrent lock: hold lock, call tick again → second call exits without running
  - `cmdCronSetup` default interval → `*/30 * * * *`
  - `cmdCronSetup --interval 15` → `*/15 * * * *`
- **Manual smoke test**: run `agt cron-setup`, paste crontab line, wait for tick, verify `.team/cron.log` has entries and a Ready item advances

## Out of Scope
- Parallel dispatch of multiple Ready items in a single tick (one at a time only)
- OpenClaw-specific cron integration (generic system cron is sufficient)
- Dashboard UI for cron status or schedule configuration
- Auto-creation of GitHub issues or specs from cron (human approval gate is unchanged)
- Windows Task Scheduler support
- Retry logic within a single tick (failures revert to Ready; next tick will retry)

## Done When
- [ ] `agt cron-tick` end-to-end: picks up a Ready board item, runs it, marks it Done
- [ ] `agt cron-tick` failure path: reverts item to Ready with a comment on the issue
- [ ] Concurrent lock prevents double-dispatch
- [ ] `agt cron-setup` prints a valid crontab line with correct paths and configurable interval
- [ ] Unit tests for all branches above pass (`npm test`)
- [ ] `.team/cron.log` accumulates timestamped output across multiple tick invocations
