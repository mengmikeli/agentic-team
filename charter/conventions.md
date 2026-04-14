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
│       │   ├── PRODUCT.md          # Product vision, users, metrics
│       │   ├── PROJECT.md          # Project config
│       │   ├── AGENTS.md           # Agent roles for this project
│       │   ├── SPRINTS.md          # Sprint history — active + done
│       │   └── sprints/
│       │       └── {sprint}/
│       │           ├── SPEC.md     # Sprint spec
│       │           ├── PLAN.md     # Implementation plan
│       │           ├── STATE.json  # Orchestrate execution state
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
| .team/PRODUCT.md | Product | Yes | Vision, users, success metrics |
| .team/PROJECT.md | Project | Yes | Stack, deploy, channels |
| .team/AGENTS.md | Project | Yes | Who does what |
| .team/SPRINTS.md | Project | Yes | Sprint history — active + done |
| .team/sprints/*/SPEC.md | Sprint | Yes | What + why |
| .team/sprints/*/PLAN.md | Sprint | Yes | How, task by task |
| .team/sprints/*/STATE.json | Sprint | Yes | Orchestrate execution state |
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

## Document Lifecycle

Documents follow a simple lifecycle tied to sprint directories — no separate wip/archive folders needed.

### Sprint documents (SPEC.md, PLAN.md, STATE.json, RETRO.md)

- **Active:** Live in `.team/sprints/{id}/` while the sprint is active
- **Done:** Stay in place when the sprint closes. The sprint dir IS the lifecycle container. SPRINTS.md links to the sprint dir for reference.
- **No archival step.** Sprint status (active/done in SPRINTS.md) IS the lifecycle state. Don't move files to an archive directory.

### Persistent reference documents

- Design docs, RFCs, or references that span multiple sprints go in `.team/refs/`
- These are not tied to a sprint lifecycle — they persist as long as they're relevant
- Example: architecture decisions, API contracts, integration guides

### Project-level documents (PRODUCT.md, PROJECT.md, AGENTS.md, SPRINTS.md)

- Always live at `.team/` root
- Updated incrementally by ops skills (project-ops, sprint-ops, agent-ops)
- Never archived — they evolve in place

### Summary

```
.team/
├── PRODUCT.md              # Persistent, evolves in place
├── PROJECT.md              # Persistent, evolves in place
├── AGENTS.md               # Persistent, evolves in place
├── SPRINTS.md              # Persistent, links to sprint dirs
├── refs/                   # Persistent references (multi-sprint)
│   └── architecture.md
└── sprints/
    ├── s1-mvp/             # Done sprint — files stay in place
    │   ├── SPEC.md
    │   └── RETRO.md
    └── s2-polish/          # Active sprint
        ├── SPEC.md
        ├── PLAN.md
        └── STATE.json
```
