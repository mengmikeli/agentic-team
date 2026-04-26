# Feature: cron-based-outer-loop

## Overview

`agt cron-tick` polls the GitHub Project board on a scheduled interval and dispatches the first "Ready" issue to `runSingleFeature`. It is designed to run from cron (via `agt cron-setup`) and provides safe concurrent execution via an advisory lock.

## Acceptance Criteria

### AC1: Dispatch

- When the board has at least one item in "Ready" status, `cron-tick` picks the first one, transitions it to "In Progress", and calls `runSingleFeature` with the issue title.
- `runSingleFeature` is called with an empty args array (`[]`). CLI flags passed to `cron-tick` are not forwarded.

### AC2: Success path

- On successful completion, the board item transitions to "Done".
- `cron-tick` exits 0.

### AC3: Failure path

- When `runSingleFeature` throws, the board item is reverted to "Ready".
- A failure comment is posted to the GitHub issue with the error message.
- `cron-tick` exits 0 (the failure is visible in the comment; cron does not retry immediately).

### AC4: Stale in-progress recovery

- On startup, after acquiring the lock, any board items found in "In Progress" status are reverted to "Ready" before processing.
- These are items left stranded by a previous `cron-tick` run that was killed (SIGKILL, OOM).
- Recovered items enter the ready pool and may be dispatched in the same tick.

### AC5: Concurrent execution guard

- Only one `cron-tick` can run at a time. A second concurrent invocation detects the advisory lock and exits 0 with "already running".

### AC6: Pre-flight validation

- Exits 1 if `PROJECT.md` has no `## Tracking` section with required field IDs.
- Exits 1 if the "Ready Option ID" is not configured (needed for failure revert).
- Exits 1 if the project number cannot be parsed from `PROJECT.md`.

### AC7: Title sanitization

- Issue titles are sanitized before being passed to `runSingleFeature` to prevent prompt injection.
- Stripped characters: ASCII control chars (U+0000–U+001F), DEL (U+007F), and Unicode line separators (U+0085, U+2028, U+2029).
- Titles are truncated to 200 characters.

## Commands

- `agt cron-tick` — run one tick (query board, dispatch first ready item)
- `agt cron-setup [--interval <n>]` — print a crontab entry (default: every 30 minutes)

## Configuration

Required in `.team/PROJECT.md`:

```
## Tracking
- Project URL: https://github.com/users/<owner>/projects/<number>
- Status Field ID: <ID>
- Todo Option ID: <ID>
- In Progress Option ID: <ID>
- Done Option ID: <ID>
- Ready Option ID: <ID>
```
