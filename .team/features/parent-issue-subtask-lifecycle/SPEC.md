# Feature: Parent Issue + Subtask Lifecycle

## Goal
The feature's GitHub approval issue becomes a living parent tracker: it holds the PRD in its body and a checklist of task subtasks that stays in sync with task state throughout execution.

## Scope

**Parent issue body**
- When tasks are planned, append a checklist block to the approval issue body:
  ```
  ## Tasks
  - [ ] Task title (#83)
  - [ ] Task title (#84)
  - [ ] Task title (#85)
  ```
- Checklist is appended after the existing SPEC/PRD content — no replacement of existing body

**Checklist lifecycle sync**
- When a task gate passes: check its item (`- [x] Task title (#N)`)
- When a task is blocked/escalated: prefix its item with a blocked marker (`- [ ] ~~Task title~~ (#N) ⚠️ blocked`)
- When a task is skipped: prefix with `- [x] Task title (#N) *(skipped)*`
- Updates are made via `gh issue edit --body` on the parent issue

**Task-to-parent back-link**
- Task issue bodies include a line: `Part of #N` (parent approval issue number) so GitHub renders the relationship natively

**Parent issue close**
- Parent approval issue closes when `agt finalize` runs (already implemented — verify this covers the parent/approval issue, not just task issues)

**Project board**
- Parent issue already added to project board by the approval gate — no new board columns or fields needed

## Out of Scope

- GitHub's native sub-issues API (`parent_id` field) — too new, inconsistent availability across repos
- Creating a separate "parent" issue type beyond the existing approval issue — the approval issue IS the parent
- Real-time polling to update the checklist during execution (updates happen at task state transitions only)
- Checklist items for sub-steps within a task
- Changing the approval gate flow or wait-for-approval polling
- Any new project board columns, status fields, or option IDs
- Updating the checklist for replan/retry attempts (only terminal states: passed, blocked, skipped)

## Done When

- [ ] After `agt run` creates task issues, the parent (approval) issue body gains a `## Tasks` checklist with each task title and `(#N)` issue reference
- [ ] When a task gate passes, its checklist line updates from `- [ ]` to `- [x]`
- [ ] When a task hits max review rounds (escalated), its checklist line shows the `⚠️ blocked` marker
- [ ] Each task issue body contains `Part of #N` linking back to the parent approval issue
- [ ] `agt finalize` closes the parent approval issue (confirm this already works or fix it)
- [ ] No extra project board columns or config changes are required — existing status flow is sufficient
- [ ] All existing tests still pass after changes to `run.mjs` and `finalize.mjs`
