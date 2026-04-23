# Feature: Crash Recovery + Atomic State Writes

## Goal
When `agt run` restarts a feature that crashed mid-execution, it resumes from the last good checkpoint instead of starting over.

## Background
Atomic writes (write-then-rename) and file locking are already implemented in `bin/lib/util.mjs`. The gap is crash *detection* and *recovery*: `agt run` currently overwrites the task list on restart (`run.mjs:697-702`), discarding all progress.

## Scope
- **Crash detection**: When `agt run` reads STATE.json and finds `status: "executing"`, treat it as a crashed run rather than a clean start. Log a warning: `[crash-recovery] Resuming from crashed state at <_last_modified>`.
- **Checkpoint resume**: Preserve task statuses from the crashed run. Skip tasks already in `passed` or `skipped`; reset tasks stuck at `in-progress` back to `pending` so they re-run.
- **Orphaned tmp cleanup**: On harness startup, scan the feature dir for `STATE.json.tmp.*` files (created by `atomicWriteSync` on crash between write and rename) and delete them.
- **Recovery metadata**: Add `_recovered_from` (ISO timestamp of crashed state) and `_recovery_count` (int) to STATE.json when a recovery occurs.

## Out of Scope
- Atomic writes — already done (`atomicWriteSync` in `util.mjs:55-59`)
- File locking — already done (`lockFile` in `util.mjs:84-152`)
- Oscillation detection / tick limits — separate roadmap item (#11)
- Recovering from corrupted JSON (current behavior of returning `null` is sufficient)
- Multi-process crash recovery across concurrent `agt run` invocations
- Backups or STATE.json version history

## Done When
- [ ] `agt run` on a feature with `status: "executing"` logs `[crash-recovery]` and resumes rather than resetting all tasks
- [ ] Tasks with status `passed` or `skipped` in the crashed state are not re-executed
- [ ] Tasks with status `in-progress` in the crashed state are reset to `pending` and re-run
- [ ] STATE.json written after recovery includes `_recovered_from` (ISO timestamp) and `_recovery_count` fields
- [ ] Orphaned `STATE.json.tmp.*` files in the feature dir are deleted on harness startup
- [ ] `agt run` on a feature with `status: "paused"` is unchanged (not treated as a crash)
- [ ] `agt run` on a feature with `status: "completed"` is unchanged (not treated as a crash)
- [ ] Existing tests pass; at least one new test covers the crash-recovery path
