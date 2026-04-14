# agentic-team

A framework for self-managing AI agent teams. Takes a project from "build X" to shipped deliverable — with the human only present to approve the spec and verify the result. Everything in between is autonomous.

Built for [OpenClaw](https://openclaw.ai) + Discord + GitHub. Framework-agnostic for the code being built.

## How it works

```
Human: "Build X"
     ↓
  brainstorm → approved SPEC.md
     ↓
  sprint-init → sprint directory + tracking
     ↓
  orchestrate → autonomous execution
     │
     ├─ Plan tasks from spec
     ├─ Dispatch subagents per task
     ├─ Run mechanical quality gates
     ├─ Handle failures (retry → block → skip)
     └─ Finish: PR + metrics + completion report
     ↓
  Human: reviews deliverable
```

The human defines direction and verifies results. The agents handle everything between — planning, implementation, quality checks, failure recovery, progress reporting.

## Four-layer model

| Layer | Question | Key File | Init | Ops |
|-------|----------|----------|------|-----|
| **Product** | Why? For whom? | PRODUCT.md | product-init | product-ops |
| **Project** | Where? What stack? | PROJECT.md | project-init | project-ops |
| **Agent** | Who does the work? | AGENTS.md | agent-init | agent-ops |
| **Sprint** | What now? How? | SPEC.md | sprint-init | sprint-ops |

Each layer has an **init** skill (one-time setup wizard) and an **ops** skill (ongoing maintenance). Two additional skills complete the workflow:

- **brainstorm** — explores ideas, asks clarifying questions, produces an approved spec
- **orchestrate** — autonomous execution engine that drives sprints to completion

## Skills

11 skills covering the full lifecycle:

| Skill | Layer | What it does |
|-------|-------|-------------|
| **product-init** | Product | Define vision, users, success metrics → PRODUCT.md |
| **product-ops** | Product | Prioritize backlog, validate outcomes, maintain vision |
| **project-init** | Project | Scaffold `.team/` directory via interactive wizard |
| **project-ops** | Project | Detect config drift, reconcile against reality |
| **agent-init** | Agent | Set up team roles and structure |
| **agent-ops** | Agent | Adjust roles, review effectiveness |
| **sprint-init** | Sprint | Start sprint with spec, tracking, execution model |
| **sprint-ops** | Sprint | Close with metrics, update tracking, reconcile |
| **brainstorm** | Workflow | Idea → clarifying questions → approaches → approved spec |
| **orchestrate** | Execution | Autonomous loop: plan → dispatch → gate → finish |
| **audit** | Cross-cutting | Cross-layer health check, cost anomalies |

## Key concepts

**Human outside the loop.** During execution, the orchestrate loop runs autonomously. No mid-loop escalation. No asking for subtask approval. Failures are contained: retry → block → skip → continue.

**Mechanical quality gates.** Quality is enforced by exit codes, not LLM judgment. `npm test && npm run check && npm run build` — pass or fail, no interpretation.

**Proactive communication.** The coordinator pushes status — task started, completed, blocked, anomalies detected. If you have to ask "how's it going?", the process failed.

**Spec before code.** Every piece of work starts with brainstorming and an approved spec. No implementation without design approval.

## Project structure

```
.team/                      — project tracking (committed)
├── PRODUCT.md              — product vision, users, metrics
├── PROJECT.md              — stack, deploy, channels
├── AGENTS.md               — who does what
├── SPRINTS.md              — sprint history
└── sprints/{name}/
    ├── SPEC.md             — what + why
    ├── PLAN.md             — how, task by task
    ├── STATE.json          — orchestrate execution state
    └── RETRO.md            — what we learned

charter/                    — detailed methodology reference
skills/                     — workflow skills (AgentSkills format)
templates/                  — reference templates for .team/ files
CHARTER.md                  — compact charter (always loaded)
PLAYBOOK.md                 — platform operational recipes
```

## Getting started

1. **Install skills** — copy the `skills/` directory into your agent's skill path
2. **`product-init`** — define your product (vision, users, success metrics)
3. **`project-init`** — scaffold `.team/` with project config
4. **`agent-init`** — set up team roles
5. **`brainstorm`** — explore your first piece of work, produce a spec
6. **`sprint-init`** — create a sprint from the approved spec
7. **`orchestrate`** — let the autonomous loop execute

After the first cycle, use the **ops** skills (product-ops, project-ops, agent-ops, sprint-ops) to maintain tracking and evolve the product.

## Self-dogfooding

This repo uses its own framework. The `.team/` directory is managed by these skills. The CHARTER.md was written following the brainstorm → spec → execute workflow. Even this README was produced by running the full chain: brainstorm → sprint-init → orchestrate.

## Charter

The full methodology lives in `CHARTER.md` (compact, always loaded) and `charter/` (detailed reference). Key documents:

- `charter/roles.md` — operator, coordinator, implementers
- `charter/phases.md` — brainstorm → sprint-init → orchestrate → review
- `charter/quality.md` — mechanical gates, metrics, definition of done
- `charter/failure.md` — retry → block → skip, no escalation
- `charter/models.md` — subagent swarm, multi-agent team, hybrid, direct edit
- `charter/conventions.md` — file structure, git conventions, handoff templates
