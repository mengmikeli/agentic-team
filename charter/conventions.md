# Conventions

## Files and workspace structure

```
~/workspace/                        # Agent home
├── CHARTER.md                      # Compact playbook (always loaded)
├── charter/                        # Full reference (loaded on demand)
├── PLAYBOOK.md                     # Platform recipes
├── SOUL.md                         # Agent identity (private)
├── USER.md                         # Operator profile (private)
├── MEMORY.md                       # Long-term memory (private)
├── TOOLS.md                        # Local config (private)
│
├── projects/
│   └── {project}/                  # Project repo
│       ├── .team/
│       │   ├── PROJECT.md          # Project config
│       │   ├── AGENTS.md           # Agent roles for this project
│       │   ├── SPRINTS.md          # Sprint history — active + done
│       │   └── sprints/
│       │       └── {sprint}/
│       │           ├── SPEC.md     # Sprint spec
│       │           ├── PLAN.md     # Implementation plan
│       │           └── RETRO.md    # Retrospective
│       └── src/                    # Project source
```

## File purposes

| File | Layer | Committed? | Purpose |
|------|-------|------------|---------|
| CHARTER.md | Agent | No (workspace) | Methodology — how any project is run |
| charter/*.md | Agent | No (workspace) | Full reference — loaded on demand |
| PLAYBOOK.md | Agent | No (workspace) | Platform recipes |
| SOUL.md, USER.md, MEMORY.md | Agent | No | Identity and memory (private) |
| .team/PROJECT.md | Project | Yes | Stack, deploy, channels |
| .team/AGENTS.md | Project | Yes | Who does what |
| .team/SPRINTS.md | Project | Yes | Sprint history — active + done |
| .team/sprints/*/SPEC.md | Sprint | Yes | What + why |
| .team/sprints/*/PLAN.md | Sprint | Yes | How, task by task |
| .team/sprints/*/RETRO.md | Sprint | Yes | What we learned |

## Git conventions

- Feature branches: `feat/{name}`
- One branch per owner — no shared branches
- Squash merge to main
- No direct commits to main (except hotfixes with operator present)
- Tag releases: `v{X.Y}`

## Channel conventions

- One Discord channel per sprint: `{sprint-id}`
- Channel topic: brief description + branch + spec link
- Close channel when sprint ships

## Handoff templates

### Coordinator → Subagent

```
You are implementing Task {N}: {name}

## Task Description
{exact what to build}

## Files
- Create: {paths}
- Modify: {paths}
- Test: {paths}

## Context
{what exists, what to read first, where this fits}

## Success Criteria
{how to know it's done}

## Boundaries
{what NOT to do}

## Report Format
Status: DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT
{what you implemented, test results, files changed, concerns}
```

### Implementer → QA

```
Ready for QA.
PR: {link}
Preview: {URL}
Branch: {name}
Changes: {summary}
Test focus: {what's most likely to break}
Known issues: {anything not yet fixed}
```

### Coordinator → Operator

```
Ready for your review.
Preview: {URL}
What changed: {bullet list}
QA status: {PASS/FAIL + link to report}
Needs from you: {what to test}
Known issues: {anything deferred}
```

## Briefing agents

### Subagents get:
- Task description — what to build, in detail
- File paths — exact files to create or modify
- Context — what exists, what depends on this
- Success criteria — usually "all tests pass"
- Boundaries — what NOT to do

### Subagents don't get:
- Session history (clean context)
- Broad codebase context (only relevant files)
- Ambiguous instructions

### Team agents get:
- Sprint spec — the full design
- Their scope — which part they own
- Branch and worktree
- Channel for updates
- Handoff expectations
