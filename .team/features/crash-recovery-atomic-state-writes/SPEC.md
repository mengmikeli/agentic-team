# Feature: Crash Recovery + Atomic State Writes

## Goal
STATE.json is always written atomically and any run interrupted mid-execution resumes from the last consistent checkpoint rather than losing progress or starting over.

## Scope
- **Atomic writes via write-then-rename**: All STATE.json writes go to a temp file (`STATE.json.tmp.<pid>.<ts>`) then `rename()` to the final path. STATE.json is never partially written.
- **Crash detection**: When `agt run` reads STATE.json with `status: "executing"`, treat it as a crashed run. The harness sets status to `executing` before dispatching — finding it set on startup means the previous process never cleaned up.
- **Checkpoint resume**: Reset tasks stuck at `in-progress` back to `pending` (safe to retry). Preserve `passed`, `failed`, `blocked`, and `skipped` tasks unchanged.
- **Recovery metadata**: Write `_recovered_from` (ISO timestamp from `_last_modified` at crash time) and `_recovery_count` (incrementing int) to STATE.json on each recovery.
- **Orphaned tmp cleanup**: On `harness init`, scan the feature dir for `STATE.json.tmp.*` files left by a crashed atomic write and delete them.
- **Advisory file locking**: Before concurrent STATE.json writes (`agt-harness gate`, `transition`, `finalize`), acquire a `.lock` file. Evict stale locks from dead PIDs. Timeout after 5s returning `{ acquired: false }`.

## Out of Scope
- STATE.json backup or version history (no `.bak` file)
- Recovering from corrupted/unparseable STATE.json (returns `null`; caller starts fresh)
- Automatic orphaned tmp cleanup on `agt run` (only on `init`)
- Cross-machine or distributed locking (advisory, filesystem-local only)
- Lock acquisition inside `writeState()` itself (callers that need concurrency safety acquire the lock externally)

## Done When
- [ ] `writeState()` uses `atomicWriteSync()` for every STATE.json write
- [ ] `applyCrashRecovery()` detects `status: "executing"` and resets `in-progress` tasks to `pending`, preserving all other task statuses
- [ ] `applyCrashRecovery()` writes `_recovered_from` (crash timestamp) and `_recovery_count` (incrementing) to state after recovery
- [ ] `applyCrashRecovery()` does not trigger for `status: "paused"` or `status: "completed"`
- [ ] `harness init` removes any `STATE.json.tmp.*` orphans from the feature dir before writing initial state
- [ ] `lockFile()` acquires an exclusive `.lock` file with `{ flag: "wx" }`, evicts stale locks from dead PIDs, and returns `{ acquired: false }` after 5s timeout
- [ ] All 7 tests in `test/crash-recovery.test.mjs` pass
