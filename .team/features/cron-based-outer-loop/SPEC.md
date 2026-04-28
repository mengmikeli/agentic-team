# Feature: Cron-based Outer Loop

## Goal
Enable the agentic pipeline to run continuously without a persistent CLI process by having `agt cron-tick` poll the GitHub Project board on a system cron schedule and dispatch each human-approved "Ready" item as a complete autonomous feature run.

## Requirements
- `agt cron-tick` reads the GitHub Project board via `gh` CLI, finds the first item with status "Ready", transitions it to "In Progress", and dispatches it through `runSingleFeature`
- `agt cron-setup` prints a ready-to-paste crontab entry (default interval: 30 minutes, configurable via `--interval N`)
- An advisory file lock at `.team/.cron-lock` prevents concurrent tick invocations; second process exits cleanly (exit 0)
- On successful feature run, the board item transitions to "Done"
- On failed or interrupted feature run, the board item reverts to "Ready" and a comment is posted to the GitHub issue with the failure reason
- If no items are in "Ready" status, the tick exits cleanly (exit 0) with a log line
- The human approval gate is unchanged: cron-tick only dispatches items the human has already moved to "Ready"
- All tick output flows to stdout/stderr; the crontab entry redirects both to `.team/cron.log`
- Each log line is prefixed with an ISO 8601 timestamp for traceability
- Pre-flight validation: exits 1 if PROJECT.md tracking config, project number, or "Ready" option ID is missing
- Title sanitization: strip control characters and cap at 200 chars before passing to `runSingleFeature`

## Acceptance Criteria
- [ ] `agt cron-tick` with a board item in "Ready" transitions it to "In Progress", runs the feature, and transitions to "Done" on success
- [ ] `agt cron-tick` with no "Ready" items exits 0 and logs "no ready items"
- [ ] `agt cron-tick` invoked concurrently (lock held) — second process exits 0 without dispatching
- [ ] `agt cron-tick` when `runSingleFeature` throws reverts the board item to "Ready" and comments on the GitHub issue with the error message
- [ ] `agt cron-tick` when `runSingleFeature` calls `process.exit()` still reverts the board item (exit handler or process isolation)
- [ ] `agt cron-tick` exits 1 with descriptive message when PROJECT.md tracking config is missing
- [ ] `agt cron-tick` exits 1 when project number cannot be parsed from PROJECT.md
- [ ] `agt cron-tick` exits 1 when "Ready" option ID is not configured in tracking section
- [ ] `agt cron-setup` prints a crontab line with `*/30 * * * *` by default
- [ ] `agt cron-setup --interval 15` prints a crontab line with `*/15 * * * *`
- [ ] `agt cron-setup` single-quotes all paths for shell safety (handles spaces and special characters)
- [ ] Invalid `--interval` values (0, negative, non-numeric) fall back to 30
- [ ] Log lines include ISO timestamp prefix: `[2026-04-26T12:00:00.000Z] cron-tick: ...`

## Technical Approach

### Files that change
- `bin/lib/cron.mjs` — primary implementation (`cmdCronTick`, `cmdCronSetup`, `readProjectNumber`); currently 145 lines with core logic complete
- `bin/agt.mjs` — `cron-tick` and `cron-setup` commands already routed (lines 72-73); verify help text accuracy
- `test/cron-tick.test.mjs` — expand existing test suite (currently 323 lines, 11 tests) to cover timestamp logging and process.exit safety

### `cmdCronTick` algorithm
```
1. Pre-flight checks (exit 1 on any failure):
   a. readTrackingConfig(.team/PROJECT.md) → must return config with statusOptions
   b. tracking.statusOptions["ready"] must exist (needed for failure revert)
   c. readProjectNumber(cwd) → must return a number
2. Acquire advisory lock (.team/.cron-lock, timeout 0)
   → if lock fails: log "already running" and exit 0
3. listProjectItems(projectNumber) → filter status === "ready" (case-insensitive) → take first
   → if none: log "no ready items" and return (lock released by finally)
4. Sanitize item title (strip control chars, cap at 200 chars)
5. Transition item to "in-progress" on project board
6. try: await runSingleFeature(args, title)
   → on success: transition to "done"
   catch: transition back to "ready", commentIssue with error message
7. finally: release lock
```

### `cmdCronSetup` algorithm
```
1. Parse --interval N from args (default 30, clamp to ≥1)
2. Resolve absolute paths: agt binary (process.argv[1]) and cwd
3. Print crontab line with single-quoted paths:
   */{N} * * * * cd '{cwd}' && PATH='{PATH}' '{agtBin}' cron-tick >> '{cwd}/.team/cron.log' 2>&1
4. Print usage hint: "Add the above line with: crontab -e"
```

### Lock implementation
- Reuse `lockFile()` from `bin/lib/util.mjs` with `{ timeout: 0 }` for non-blocking try
- Release in `finally` block to guarantee cleanup on normal exit and thrown errors
- Lock file: `.team/.cron-lock`

### Logging
- Prefix each log line with ISO timestamp: `[2026-04-26T12:00:00.000Z] cron-tick: ...`
- Write to stdout/stderr (crontab entry redirects both to `.team/cron.log`)

### GitHub board transitions
- Reuse `setProjectItemStatus()` and `commentIssue()` from `bin/lib/github.mjs`
- Status option IDs read from `.team/PROJECT.md` tracking config section
- All GitHub calls are fire-and-forget with error logging (failures do not crash the tick)

### Dependency injection
- All external dependencies (`listProjectItems`, `runSingleFeature`, `setProjectItemStatus`, `commentIssue`, `readTrackingConfig`, `lockFile`, `readProjectNumber`) are injectable via a `deps` parameter for testability

## Testing Strategy
- **Unit tests** (`test/cron-tick.test.mjs`, extending existing suite):
  - No ready items → exits cleanly with "no ready items" log
  - Lock held → exits 0 with "already running" message
  - Successful dispatch → transitions ready → in-progress → done in order
  - Failed dispatch → transitions to in-progress, then reverts to ready, comments on issue
  - Missing tracking config → exits 1
  - Missing project number → exits 1
  - Missing Ready option ID → exits 1
  - `cmdCronSetup` default interval → `*/30 * * * *`
  - `cmdCronSetup --interval 15` → `*/15 * * * *`
  - `cmdCronSetup --interval 0` and `--interval -5` → fall back to `*/30`
  - Paths are single-quoted in crontab output
  - Title sanitization strips control characters
- **Manual smoke test**: Run `agt cron-setup`, paste crontab line, create a "Ready" item on the project board, wait for tick, verify `.team/cron.log` has timestamped entries and the item advances through board columns

## Out of Scope
- Parallel dispatch of multiple Ready items in a single tick (one at a time only)
- OpenClaw-specific cron integration (generic system cron is sufficient)
- Dashboard UI for cron status or schedule configuration
- Auto-creation of GitHub issues or specs from cron (human approval gate is unchanged)
- Windows Task Scheduler support
- Retry logic within a single tick (failures revert to Ready; next tick retries)
- Configurable dispatch ordering (e.g., priority-based selection of Ready items)
- Cron-triggered brainstorm/spec generation (cron only dispatches pre-approved items)

## Done When
- [ ] `agt cron-tick` end-to-end: picks up a Ready board item, runs it, marks it Done
- [ ] `agt cron-tick` failure path: reverts item to Ready with a comment on the issue
- [ ] Concurrent lock prevents double-dispatch (second process exits 0)
- [ ] Pre-flight validation exits 1 with clear message for each missing config
- [ ] `agt cron-setup` prints a valid crontab line with correct paths and configurable interval
- [ ] All unit tests pass (`npm test`) — covering happy path, failure path, lock, config validation, and setup
- [ ] Log lines include ISO timestamps for traceability across tick invocations
