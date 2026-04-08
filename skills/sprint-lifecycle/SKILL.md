---
name: sprint-lifecycle
description: "Manage sprint lifecycle for project tracking. Use when: (1) starting a new sprint or body of work — creates sprint directory, SPEC.md, updates SPRINTS.md and PROJECT.md, (2) closing a sprint — marks done, writes shipped summary, bumps version, (3) checking sprint status — compares SPRINTS.md against reality (merged PRs, shipped features). Triggers: 'start sprint', 'init sprint', 'close sprint', 'sprint status', 'what sprint are we on', or when brainstorming/finishing-a-development-branch produces work that constitutes a sprint."
---

# Sprint Lifecycle

Keeps sprint tracking in sync with reality by making updates part of the workflow, not an afterthought.

**Announce at start:** "I'm using the sprint-lifecycle skill to [init/close/check] sprint tracking."

## When This Skill Fires

| Trigger | Action |
|---------|--------|
| New body of work starts (brainstorming produces spec, or explicit `/sprint init`) | **Init** |
| Work merges to main and completes a sprint (finishing-a-development-branch, or explicit `/sprint close`) | **Close** |
| Checking if tracking matches reality (`/sprint status`) | **Status** |
| PR merges that completes a sprint phase | **Update** (lightweight — just update phase checklist) |

## Project Structure

```
.team/
├── SPRINTS.md          # Sprint history table + summaries
├── PROJECT.md          # Active sprint + current version
└── sprints/
    ├── s1-name/
    │   └── SPEC.md
    ├── s2-name/
    │   └── SPEC.md
    └── backlog/
        └── *.md
```

## Init

When starting a new sprint:

1. **Determine sprint ID** — next sequential number + kebab-case name (e.g. `s8-ios-app-store`)
2. **Create directory** — `.team/sprints/{id}/SPEC.md` from template below
3. **Update SPRINTS.md** — add row with `🔄 Active` status
4. **Update PROJECT.md** — set `Active Sprint` to new sprint
5. **Commit** — `chore: init sprint {id}`

If work was planned in backlog, move/reference the backlog doc in the new sprint dir.

### SPEC.md Template

```markdown
# Sprint: {ID} — {Title}

## Goal
{One sentence: what does success look like?}

## Scope
{What's in, what's out}

## Done when
- [ ] {Concrete, verifiable criteria}

## Execution model
{Subagent swarm / hybrid / single agent}
```

## Close

When a sprint's work has shipped:

1. **Verify** — all "Done when" criteria in SPEC.md are met
2. **Update SPRINTS.md** — mark `✅ Done`, set version + dates, write shipped summary
3. **Update PROJECT.md** — bump `Current Version`, clear or update `Active Sprint`
4. **Commit** — `chore: close sprint {id} → v{version}`

### Writing the Shipped Summary

Derive from reality, not from the spec's wishlist:
- `git log --oneline --since="{start}" main` — what actually merged
- PRs merged during the sprint period
- Compare against SPEC.md "Done when" checklist

If work from a *different* planned sprint shipped inside this one (like S6/S7 shipping inside S5), note it: "S6 (content paths) and S7 (visual identity) were implemented alongside S5."

## Update (Phase Complete)

When a PR merges that completes a sprint phase:

1. **Update SPEC.md** — check off the completed item in "Done when"
2. **Update SPRINTS.md** — update phase status if tracked there
3. **Include in merge commit or follow-up** — not a separate PR

This is lightweight — just checkbox updates. No ceremony needed.

## Status

Compare tracking docs against reality:

1. Read SPRINTS.md active sprint
2. Read SPEC.md "Done when" checklist
3. Check git log / merged PRs for work that matches spec items
4. Report:
   - What SPRINTS.md says vs what's actually shipped
   - Any planned future sprints whose work already landed
   - Any untracked work on main that should be attributed to a sprint

## Integration

**Pairs with:**
- `brainstorming` — after spec is written and approved, invoke sprint-lifecycle init
- `finishing-a-development-branch` — after merge, invoke sprint-lifecycle close/update
- `writing-plans` — plan references the active sprint ID

**Rule for agents (add to .team/AGENTS.md):**
> When starting a new body of work, invoke sprint-lifecycle to init the sprint before writing plans. When merging a PR that completes sprint phases, update SPEC.md and SPRINTS.md in the same commit. When all sprint work ships, invoke sprint-lifecycle to close.

## Anti-Patterns

- ❌ Updating SPRINTS.md weeks after the fact from memory
- ❌ Planning sprint S6/S7 as "future" while building it inside S5
- ❌ Merging PRs without checking off SPEC.md items
- ❌ Leaving SPRINTS.md showing "Active" for a completed sprint

## Drift Detection

If you notice SPRINTS.md is stale during any task (heartbeat, PR review, status check):
1. Don't just flag it — fix it
2. Run the Status flow to reconcile
3. Commit the fix immediately
