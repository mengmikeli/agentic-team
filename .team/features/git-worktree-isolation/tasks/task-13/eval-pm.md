# PM Review — git-worktree-isolation (task-13 / feature close)

**Reviewer:** PM role (independent review session, 2026-04-25)

## Overall Verdict: PASS

---

## Files Opened and Read

- `.team/PRODUCT.md` — full file, confirmed entry #20 at line 58
- `bin/lib/run.mjs` — full file (1602 lines); focused on lines 53–55, 163–182, 286–371, 1013–1024, 1199–1202, 1525–1534
- `bin/lib/gate.mjs` — full file (189 lines); focused on lines 15–25
- `test/worktree.test.mjs` — grep audit section (lines 645–730) and PLAYBOOK contract section (lines 838–847)
- `.team/features/git-worktree-isolation/tasks/task-{1,2,3,4,5,6,11,12,13}/handshake.json` — all 9 read
- `.team/features/git-worktree-isolation/tasks/task-12/test-output.txt` — all 861 lines
- `PLAYBOOK.md` — Git Worktrees section (lines 182–244)

---

## Requirements Verification (PRODUCT.md entry #20)

Spec source: PRODUCT.md line 58 — *no SPEC.md exists for this feature.*

| Requirement | File:Line Evidence | Verdict |
|---|---|---|
| Each feature in its own worktree + branch | `createWorktreeIfNeeded` at run.mjs:163–176 creates `.team/worktrees/<slug>` and branch `feature/<slug>` | PASS |
| Parallel features never interfere | Concurrent tests in test-output.txt:817–832 — two real child processes, zero corruption | PASS |
| Feature-slug as namespace for all artifacts | `slugToBranch` applied at run.mjs:164 before path join; path-traversal guard at run.mjs:166 | PASS |
| `cwd` injected into agent dispatches | run.mjs:287 (`dispatchToAgent` throws), run.mjs:346 (`dispatchToAgentAsync` throws) on missing cwd | PASS |
| `cwd` injected into gate commands | run.mjs:54 (`runGateInline` throws); grep audit in test-output.txt:848–852 all pass | PASS |
| Worktree created before task dispatch | run.mjs:1020–1021 creates worktree and reassigns `cwd = worktreePath` before task loop at line 1096 | PASS |
| Cleaned up on completion | run.mjs:1534 calls `removeWorktree` on success path only; catch block at 1528–1533 preserves on error | PASS |
| PRODUCT.md entry updated to ✅ Done | PRODUCT.md:58 reads "✅ Done" — confirmed by direct file read | PASS |

---

## Test Evidence (direct from test-output.txt, task-12 artifact)

- `ℹ pass 566` / `ℹ fail 0` / `ℹ skipped 2`
- Two skipped tests are pre-existing disabled fabricated-refs tests (marked `# SKIP`) in the compound-gate suite, unrelated to this feature.
- Worktree-specific suites: slugToBranch (6/6), createWorktreeIfNeeded (6/6), removeWorktree (4/4), real-git lifecycle (1/1), runGateInline cwd injection (3/3), required-cwd contract (5/5), dispatchToAgent cwd injection (3/3), concurrent isolation (4/4), slug sanitization (3/3), worktree-preserved-on-error (3/3), PLAYBOOK documentation contract (8/8), grep audit (3/3).
- Gate output from the task brief matches: 566 pass, 0 fail confirmed.

---

## Findings

🟡 `.team/features/git-worktree-isolation` — No SPEC.md exists for this feature. Feature #17 (document-driven development, ✅ Done) requires an approved spec before coding. This feature was built directly from the PRODUCT.md roadmap line item without a brainstorm/spec step. Backlog item: enforce that agt run rejects features with no SPEC.md, or ensure `agt brainstorm` is invoked before sprint-init for roadmap-sourced features.

🔵 `.team/features/git-worktree-isolation/tasks` — Task numbering jumps from task-6 to task-11 with no artifact trail for tasks 7–10. There are no progress.md entries or replan records documenting why those tasks were skipped or abandoned. Optional: surface abandoned/restarted task IDs in the feature's progress.md to preserve the execution audit trail.

---

## Summary

All five requirements from PRODUCT.md entry #20 are implemented and verified with direct code evidence. The cwd-isolation contract is enforced at the guard level (throw if omitted) and validated by a dedicated grep-audit test suite. Worktree lifecycle (create → run → preserve-on-error / remove-on-success) is correct. PLAYBOOK.md documents the feature for operators. PRODUCT.md entry is marked ✅ Done. Test suite passes cleanly.

The one warning (no SPEC.md) is a process gap, not a correctness gap — the feature works as specified. It should go to the backlog.
