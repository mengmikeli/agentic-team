---
name: track
description: "Manage issue tracking for sprint tasks — create GitHub Issues, move project board cards, and sync state. Bridges orchestrate's STATE.json to external tracking (GitHub Issues + Projects) with a local fallback (TRACKER.md). Use when: orchestrate needs to create/update tracking, someone says 'sync tracking', 'create issues from plan', or drift is suspected between STATE.json and the board."
---

> **Requires:** `@mengmikeli/agentic-team` (`npm install -g @mengmikeli/agentic-team`) for mechanical enforcement via agt-harness.

# Track

Issue tracking bridge. Creates issues from plan tasks, moves cards at state transitions, and syncs when things drift.

**Announce at start:** "I'm using the track skill to update issue tracking."

## Operations

### Create Issues

Convert plan tasks into trackable items:

1. Read `.team/sprints/{id}/PLAN.md` for task list
2. For each task, create a GitHub Issue (or TRACKER.md row):
   ```bash
   gh issue create --title "Task {N}: {title}" --body "{description}" --label "sprint:{id}"
   ```
3. Store issue numbers in STATE.json alongside each task
4. If using GitHub Projects, add issues to the project board:
   ```bash
   gh project item-add {projectNumber} --owner {owner} --url {issueUrl}
   ```

**Fallback:** If `gh` is unavailable or GitHub Projects aren't configured, append to `.team/sprints/{id}/TRACKER.md` instead.

### Move Cards

At each orchestrate state transition, update tracking:

| Transition | GitHub Action | TRACKER.md Action |
|------------|--------------|-------------------|
| pending → in-progress | Move card to "In Progress" column | Update Status column |
| in-progress → done | Move card to "Done" column, link PR | Update Status + PR columns |
| in-progress → blocked | Move card to "Blocked" column, add reason | Update Status + Notes columns |

GitHub Projects card movement:
```bash
# Get item ID and status field ID from project config
gh project item-edit --id {itemId} --project-id {projectId} --field-id {statusFieldId} --single-select-option-id {optionId}
```

### Sync

Compare STATE.json against the board/tracker and fix drift:

1. Read STATE.json task statuses
2. Read board/tracker statuses
3. For each mismatch: update the board/tracker to match STATE.json (STATE.json is the source of truth)
4. Report what was fixed: `"Sync: moved Task 3 from 'In Progress' to 'Done' on board."`

Run sync when:
- Orchestrate resumes a session (after session resumption)
- Someone requests a status check
- Sprint-ops runs a status audit

## GitHub Project Setup

Store project configuration in `.team/PROJECT.md` under `## Tracking`:

```markdown
## Tracking
- GitHub Project: {projectNumber}
- Owner: {org-or-user}
- Status Field ID: {fieldId}
- Option IDs:
  - Ready: {optionId}
  - In Progress: {optionId}
  - Done: {optionId}
  - Blocked: {optionId}
```

If this section doesn't exist, fall back to TRACKER.md.

To discover field/option IDs:
```bash
gh project field-list {projectNumber} --owner {owner} --format json
```

## Local Fallback: TRACKER.md

When GitHub Projects aren't configured, track in `.team/sprints/{id}/TRACKER.md`:

```markdown
# Sprint Tracker: {id}

| ID | Task | Status | Agent | PR | Notes |
|----|------|--------|-------|----|-------|
| 1 | Auth module | ✓ Done | subagent | #45 | |
| 2 | API routes | ✗ Blocked | subagent | — | Type errors in shared schema |
| 3 | Frontend views | ▶ In Progress | subagent | — | |
| 4 | Tests | Pending | — | — | |
```

Status values: `Pending`, `▶ In Progress`, `✓ Done`, `✗ Blocked`

## Integration

**Invoked by:** orchestrate (at every state transition), sprint-ops (sync/audit)
**Reads:** STATE.json, PLAN.md, PROJECT.md (tracking config)
**Writes:** GitHub Issues, GitHub Project board, TRACKER.md (fallback)

## Rules

- **STATE.json is truth.** When syncing, STATE.json wins over board/tracker.
- **Create issues once.** Don't duplicate — check STATE.json for existing issue numbers before creating.
- **Fail gracefully.** If `gh` fails, fall back to TRACKER.md. Never block orchestrate on tracking failures.
- **Link PRs to issues.** Use `Closes #{N}` in PR descriptions to auto-close issues on merge.
