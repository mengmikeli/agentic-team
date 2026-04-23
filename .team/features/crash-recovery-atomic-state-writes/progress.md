# Progress: crash-recovery-atomic-state-writes

**Started:** 2026-04-23T03:34:20.812Z
**Tier:** functional
**Tasks:** 8

## Plan
1. `agt run` on a feature with `status: "executing"` logs `[crash-recovery]` and resumes rather than resetting all tasks
2. Tasks with status `passed` or `skipped` in the crashed state are not re-executed
3. Tasks with status `in-progress` in the crashed state are reset to `pending` and re-run
4. STATE.json written after recovery includes `_recovered_from` (ISO timestamp) and `_recovery_count` fields
5. Orphaned `STATE.json.tmp.*` files in the feature dir are deleted on harness startup
6. `agt run` on a feature with `status: "paused"` is unchanged (not treated as a crash)
7. `agt run` on a feature with `status: "completed"` is unchanged (not treated as a crash)
8. Existing tests pass; at least one new test covers the crash-recovery path

## Execution Log

### 2026-04-23 03:50:01
**Task 1: `agt run` on a feature with `status: "executing"` logs `[crash-recovery]` and resumes rather than resetting all tasks**
- Verdict: 🟡 Review FAIL (attempt 1)
- Will retry with review feedback

