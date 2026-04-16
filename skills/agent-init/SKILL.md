---
name: agent-init
description: "Set up agent roles and team structure for a project. Interactive wizard that asks about work style, specialties, and platform needs, then generates AGENTS.md and optionally OpenClaw agent configs. Use when: setting up a new team, adding agents to a project, or when someone says 'set up agents', 'init team', 'who should work on this'."
---

> **Requires:** `@mengmikeli/agentic-team` (`npm install -g @mengmikeli/agentic-team`) for mechanical enforcement via agt-harness.

# Agent Init

One-time interactive setup for agent roles. Determines team structure based on the project's needs, not a fixed template.

**Announce at start:** "I'm using the agent-init skill to set up your team."

## Process

### Step 1: Understand the Work

Ask **one at a time**:

1. **What kind of work is this?** — new feature development, maintenance, creative/exploratory, or mixed?
2. **How big is the scope?** — solo weekend project, multi-sprint product, ongoing service?
3. **What's the execution style?** — do you want persistent agents with Discord presence, or ephemeral subagents dispatched per task, or both?

### Step 2: Recommend Roles

Based on answers, recommend a team structure. Common patterns:

**Solo + subagents** (most projects):
- Operator (human) — decisions, testing, approval
- Coordinator (main agent) — plans, dispatches, maintains process
- Subagents — ephemeral, spun up per task

**Persistent team** (larger products):
- Operator
- Coordinator
- Named implementers with specialties (e.g., audio, viz, backend)
- QA agent

**Minimal** (small/personal projects):
- Operator
- One agent handling everything

Present the recommendation with reasoning. Let the user adjust.

### Step 3: Define Roles

For each role, capture:
- **Name** — who fills this role
- **Responsibilities** — what they own
- **Limitations** — what they can't do (important for QA especially)
- **Platform** — Discord bot? subagent only? main session?

### Step 4: Generate AGENTS.md

Write `.team/AGENTS.md` with the agreed roles. Include the sprint workflow rules:

> When starting work, invoke sprint-init. When merging PRs that complete sprint phases, update SPEC.md and SPRINTS.md. When all sprint work ships, invoke sprint-ops close.

### Step 5: Platform Setup (if needed)

If persistent agents with Discord presence:
- Note bot token requirements
- Note OpenClaw agent config needs
- Don't create configs automatically — document what's needed

### Step 6: Offer Next Steps

- **"Ready to start your first sprint?"** → sprint-init
- **"Want to review the charter?"** → CHARTER.md

## Rules

- **Match the team to the work.** Don't create 5 roles for a weekend project.
- **Recommend, don't prescribe.** Present options with trade-offs.
- **Include limitations.** "QA can test headless Chrome but not iOS Safari" prevents false confidence.
- **Sprint workflow rules are mandatory.** Every AGENTS.md gets them.

## Role Templates

For teams that want specialist review during the orchestrate review phase, offer role templates from `roles/`:

| Template | Focus | File |
|----------|-------|------|
| PM | Requirements, user value, scope | `roles/pm.md` |
| Architect | System design, boundaries, deps | `roles/architect.md` |
| Security | Threats, auth, input validation | `roles/security.md` |
| Devil's Advocate | Challenge assumptions, edge cases | `roles/devil-advocate.md` |
| Tester | Coverage gaps, regression risks | `roles/tester.md` |

These are dispatched by orchestrate during the review phase — the role template is included in the reviewer agent's brief to focus its evaluation. Not every project needs specialist review; mechanical gates are sufficient for most tasks.
