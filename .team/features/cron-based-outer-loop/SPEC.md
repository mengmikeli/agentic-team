# Feature: Cron-Based Outer Loop

## Goal
Add an `agt cron-tick` command that, when scheduled via system cron or OpenClaw scheduler, reads the GitHub Project board for items in "Ready" status and executes them — keeping the pipeline flowing without a human running `agt run`.

## Background
The current outer loop requires either a manual `agt run` invocation or a long-running `--daemon` process. Both tie execution to an active session. Cron mode is a third option: a short-lived command scheduled externally that wakes up, finds approved work, dispatches it, and exits. This enables a board-first workflow where humans manage the GitHub Project board directly and the cron handles the rest.

## Scope

- **`agt cron-tick` command** — reads the GitHub Project board, finds all issues in "Ready" status, picks the first one (oldest by board position), and executes it via the existing `runSingleFeature` flow
- **Execution lock** — a `.team/.cron-lock` file prevents concurrent `cron-tick` invocations from running simultaneously; exits early with code 0 if another tick is already running
- **Board state transitions** — sets the issue to "In Progress" before dispatching and "Done" when `runSingleFeature` completes successfully; on failure, sets status back to "Ready" and logs the error
- **No-op when idle** — exits with code 0 and a clear message when no Ready items exist on the board
- **`agt cron-setup` command** — prints a ready-to-paste `crontab` entry (and optionally an OpenClaw schedule snippet) for the user to install; interval configurable via `--interval <minutes>` (default: 30)
- **`agt help cron-tick`** and **`agt help cron-setup`** — per-command help with usage, flags, and examples (consistent with existing per-command help)
- **Uses existing infrastructure** — delegates all execution to `runSingleFeature`; reuses `getProjectItemStatus`, `setProjectItemStatus`, and `listProjectItems` from `github.mjs`

## Out of Scope

- Replacing the existing outer loop (`agt run`) or daemon mode (`agt run --daemon`)
- Automatically installing the crontab or modifying cron configuration on the user's machine
- Parallel execution of multiple Ready items in a single tick (one item per tick)
- Creating or brainstorming new GitHub issues (cron-tick only consumes items already on the board)
- Webhook-based triggering (push-based alternatives to polling)
- Prioritization logic for choosing among multiple Ready items (uses board order)
- OpenClaw-specific cron registration beyond printing the config snippet

## Done When

- [ ] `agt cron-tick` queries the GitHub Project board and dispatches the first "Ready" issue to `runSingleFeature`
- [ ] `agt cron-tick` transitions the board item from "Ready" → "In Progress" before execution and → "Done" on success
- [ ] `agt cron-tick` transitions the board item back to "Ready" on failure, with a GitHub comment explaining the error
- [ ] `agt cron-tick` exits code 0 with a "no ready items" message when the board has nothing to dispatch
- [ ] `.team/.cron-lock` is acquired before execution and released after; a concurrent invocation exits code 0 immediately with a "tick already running" message
- [ ] `agt cron-setup` prints a valid `crontab` entry invoking `agt cron-tick` (with the correct working directory and PATH)
- [ ] `agt cron-setup --interval <n>` respects the configured interval in the printed crontab entry
- [ ] `agt help cron-tick` and `agt help cron-setup` return usage text consistent with other `agt help <command>` output
- [ ] Unit tests cover: no Ready items, lock already held, successful dispatch, failed dispatch (board rollback)
