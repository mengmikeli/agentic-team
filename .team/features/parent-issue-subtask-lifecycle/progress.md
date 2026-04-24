# Progress: parent-issue-subtask-lifecycle

**Started:** 2026-04-24T05:56:40.929Z
**Tier:** functional
**Tasks:** 7

## Plan
1. After `agt run` creates task issues, the parent (approval) issue body gains a `## Tasks` checklist with each task title and `(#N)` issue reference
2. When a task gate passes, its checklist line updates from `- [ ]` to `- [x]`
3. When a task hits max review rounds (escalated), its checklist line shows the `⚠️ blocked` marker
4. Each task issue body contains `Part of #N` linking back to the parent approval issue
5. `agt finalize` closes the parent approval issue (confirm this already works or fix it)
6. No extra project board columns or config changes are required — existing status flow is sufficient
7. All existing tests still pass after changes to `run.mjs` and `finalize.mjs`

## Execution Log

