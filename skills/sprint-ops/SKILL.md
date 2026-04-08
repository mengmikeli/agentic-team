---
name: sprint-ops
description: "Manage active sprints — close completed sprints, update phase progress, check tracking accuracy. Use when: a sprint finishes, a PR merges that completes sprint work, tracking feels stale, or when someone says 'close sprint', 'sprint status', 'update sprint', 'are we on track'. Pairs with finishing-a-development-branch."
---

# Sprint Ops

Ongoing sprint management. Keeps SPRINTS.md and SPEC.md in sync with reality.

**Announce at start:** "I'm using the sprint-ops skill to [close/update/check] sprint tracking."

## Operations

### Close

When a sprint's work has shipped:

1. **Verify** — all "Done when" items in SPEC.md are checked off
2. **Write shipped summary** — derive from git log and merged PRs, not from memory:
   ```bash
   git log --oneline --since="{start}" main
   ```
3. **Update SPRINTS.md** — mark `✅ Done`, set version + dates
4. **Update PROJECT.md** — bump version, clear active sprint
5. **Commit** — `chore: close sprint {id} → v{version}`

If work from other planned sprints shipped inside this one, note it explicitly. (Anti-pattern: S6/S7 shipping inside S5 without tracking.)

### Update

When a PR merges that completes a sprint phase:

1. **Check off** the item in SPEC.md "Done when"
2. **Update SPRINTS.md** phase status if tracked there
3. **Include in merge commit** — not a separate PR

Lightweight. Just checkbox updates.

### Status

Compare tracking against reality:

1. Read SPRINTS.md active sprint
2. Read SPEC.md "Done when" checklist
3. Check git log / merged PRs for work matching spec items
4. Report:
   - Items SPRINTS.md says pending but actually shipped
   - Planned future sprints whose work already landed
   - Untracked work on main that should be attributed

**Fix drift immediately.** Don't report and move on.

### Pause

When switching to different work mid-sprint:

1. Note current state in SPEC.md (what's done, what's left)
2. Update SPRINTS.md — mark `⏸ Paused`
3. Update PROJECT.md active sprint

## Rules

- **Fix, don't flag.** If tracking is wrong, correct it now.
- **Derive from reality.** Shipped summary comes from git log, not from what the spec hoped for.
- **One active sprint.** Close or pause before starting another.
- **Attribute correctly.** If S6 work ships inside S5, say so.
