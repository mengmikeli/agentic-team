---
name: agent-ops
description: "Maintain agent roles and team health. Detects role drift, adjusts team structure as projects evolve, reviews agent effectiveness. Use when: team structure needs adjustment, an agent isn't performing, roles have shifted, adding or removing agents, or when someone says 'agent status', 'adjust team', 'who's doing what'."
---

> **Requires:** `@mengmikeli/agentic-team` (`npm install -g @mengmikeli/agentic-team`) for mechanical enforcement via agt-harness.

# Agent Ops

Ongoing maintenance for agent roles and team structure.

**Announce at start:** "I'm using the agent-ops skill to review team configuration."

## Operations

### Status

Review current team against reality:

1. **Role coverage** — are all needed roles filled? Any gaps?
2. **AGENTS.md accuracy** — do descriptions match what agents actually do?
3. **Sprint workflow rules** — present in AGENTS.md?
4. **Effectiveness** — any agents consistently struggling with their assigned work?

### Adjust

When team structure needs to change:

- **Adding a role** — what gap does it fill? Update AGENTS.md.
- **Removing a role** — redistribute responsibilities. Update AGENTS.md.
- **Changing specialties** — update role description and limitations.
- **Switching execution model** — e.g., from persistent team to subagent swarm. Update AGENTS.md and note in SPRINTS.md.

### Retrospective Input

After a sprint, review agent performance:

- Did the execution model (swarm vs team) fit the work?
- Were any agents blocked or underutilized?
- Should roles change for the next sprint?
- **Efficiency** — if metrics are available (token usage per PR, sessions per task), compare across agents. Not to punish, but to optimize: wrong model? unclear briefs? scope too large per task?

Feed findings into RETRO.md and adjust AGENTS.md.

## Rules

- **Roles serve the work, not the other way around.** If the work changed, the team should too.
- **Don't accumulate roles.** Remove what's not needed.
- **Document limitations honestly.** Overpromising agent capabilities causes sprint failures.
