---
name: project-ops
description: "Maintain and audit project configuration. Detects drift in PROJECT.md (stale version, wrong sprint, outdated deploy info), reconciles against reality. Use when: project docs feel stale, after a deploy or version bump, when switching back to a project after a break, or when someone says 'project status', 'audit project', 'is PROJECT.md current'."
---

# Project Ops

Ongoing maintenance for project configuration. Keeps PROJECT.md and .team/ structure honest.

**Announce at start:** "I'm using the project-ops skill to check project configuration."

## Operations

### Status

Compare `.team/PROJECT.md` against reality:

1. **Version** — does PROJECT.md version match latest git tag or package.json?
2. **Active sprint** — does it match what SPRINTS.md says is active?
3. **Repo URL** — still correct?
4. **Deploy targets** — still accurate?
5. **Stack** — any major dep changes since last update?

Report discrepancies. Fix them (don't just flag).

### Maintain

When something changes that affects project config:

- **Version bump** → update PROJECT.md version
- **Sprint change** → update PROJECT.md active sprint
- **Deploy target change** → update PROJECT.md deploy section
- **Stack change** → update PROJECT.md stack section

These updates should happen as side effects of other work (sprint-ops close, deploy, etc.), not as standalone tasks.

### Audit

Full review of `.team/` structure:

- All expected files present? (PROJECT.md, AGENTS.md, SPRINTS.md)
- Any stale content?
- Any files that don't belong?
- SPRINTS.md matches reality? (→ sprint-ops status)
- AGENTS.md still accurate? (→ agent-ops status)

## Rules

- **Fix, don't flag.** If PROJECT.md says v4.0 but git tag is v4.2, update it.
- **Minimal commits.** Bundle config updates with the work that caused them.
- **Don't overhaul.** This is maintenance, not a rewrite. Touch only what's wrong.
