
## Doctor Auto-Fix Mode

**Problem:** `agt doctor --phase` catches blocking issues but can't fix them. Every phase boundary requires manual intervention for known, repeating patterns.

**Known auto-fixable patterns:**
1. Fake-done roadmap items (0 tasks passed but marked ✅) → auto-revert
2. Stale feature dirs (0 passed, completed/failed) → auto-clean
3. Orphaned worktrees → auto-prune
4. Stale executing features with no process → auto-pause
5. Orphaned GitHub issues for completed features → auto-close

**Implementation:** `agt doctor --fix` runs all checks and applies known fixes. Returns exit 0 only when all blocking issues are resolved.

**Integration:** Dogfood mode runs `agt doctor --fix` at phase boundaries instead of `--phase`. Auto-fixes what it can, blocks only on genuinely unknown issues.

**Priority:** High — directly reduces manual intervention between phases.
