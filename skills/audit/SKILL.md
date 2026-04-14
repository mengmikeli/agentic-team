---
name: audit
description: "Cross-layer health check for agentic team projects. Verifies consistency across project config, agent roles, and sprint tracking. Catches drift, stale docs, untracked work, and cross-layer mismatches. Use when: switching back to a project after a break, before starting a new sprint, after a big merge, when something feels off, or when someone says 'audit', 'health check', 'is everything up to date', 'sanity check'."
---

# Audit

Cross-cutting health check that verifies consistency across all three layers: project, agent, and sprint. Finds problems the individual -ops skills miss because they only see their own layer.

**Announce at start:** "I'm using the audit skill to check project health."

## Process

### Step 1: Gather State

Read in parallel:
- `.team/PROJECT.md` — version, active sprint, stack, deploy
- `.team/AGENTS.md` — roles, sprint workflow rules
- `.team/SPRINTS.md` — sprint table, active/done status
- Active sprint `SPEC.md` — done-when checklist
- `package.json` / `Cargo.toml` / etc — actual version
- `git tag` — latest release tag
- `git log --oneline -20 main` — recent work
- `git branch` — open branches

### Step 2: Check Each Layer

**Project:**
- Does PROJECT.md version match latest git tag or package.json?
- Is the repo URL correct?
- Are deploy targets still accurate?
- Is stack description current?

**Agents:**
- Does AGENTS.md have sprint workflow rules?
- Are listed roles still active (or have agents been removed/added)?
- Any roles with unclear or overlapping responsibilities?

**Sprints:**
- Does SPRINTS.md active sprint match PROJECT.md active sprint?
- Are all "Done when" items in active SPEC.md checked that should be?
- Any completed work on main that isn't attributed to a sprint?
- Any sprints marked active that are actually done?
- Any planned future sprints whose work already shipped?

### Step 3: Cross-Layer Consistency

These checks span multiple layers:

| Check | What it catches |
|-------|----------------|
| SPRINTS.md active ≠ PROJECT.md active | Sprint tracking diverged from project config |
| Git tags ahead of PROJECT.md version | Version bump forgotten |
| Work on main not in any sprint | Untracked feature creep |
| SPEC.md all checked but sprint still "Active" | Forgot to close the sprint |
| Planned sprints with shipped work | The S5/S7 problem — built but not tracked |
| AGENTS.md roles ≠ who actually committed | Team changed without updating docs |
| Sprint cost 3x+ previous sprints | Scope creep, agent spinning, or unclear spec |
| No metrics in closed sprint entries | Missed data for future planning |

### Step 4: Report

Present findings as a checklist:

```
## Audit Report — {project name}
Date: {today}

### ✅ Passing
- {thing that's correct}

### ⚠️ Issues
- {problem} → {fix}

### Actions Taken
- {what was fixed during this audit}
```

### Step 5: Fix

**Fix issues immediately.** Don't just report them.

- Version mismatch → update PROJECT.md
- Sprint tracking stale → update SPRINTS.md
- Missing sprint workflow rules → add to AGENTS.md
- Untracked work → create retroactive sprint entry or attribute to existing sprint
- Commit all fixes: `chore: audit fixes — {summary}`

## Retroactive Sprint Entries

When auditing a project with untracked history:

1. Review `git log` for logical groupings of work
2. Propose sprint entries: "It looks like commits X–Y were a sprint focused on {theme}. Want me to add a retroactive entry?"
3. Create entries in SPRINTS.md with approximate dates from git history
4. Don't create SPEC.md for retroactive sprints — the work is already done

## When to Run

- **Before starting a new sprint** — ensures clean starting state
- **After returning from a break** — catches drift that accumulated
- **After a big merge or release** — ensures tracking caught up
- **Periodically** — can be triggered from heartbeat or cron

## Rules

- **Fix, don't flag.** Every issue should have an action taken.
- **Derive from git, not memory.** Git log is truth.
- **Don't invent history.** Retroactive entries note they're retroactive.
- **Cross-layer checks are the point.** If you only check one layer, use that layer's -ops skill instead.
