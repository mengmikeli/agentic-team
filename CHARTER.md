# CHARTER.md — Agentic Team Framework

*Self-managing AI agent teams that ship software autonomously.*

Built for: [OpenClaw](https://openclaw.ai) + Discord + GitHub.
Full reference: `charter/` directory. This file is the compact version — always loaded, always active.

---

## Four-Layer Model

| Layer | Question | Key File | Init Skill | Ops Skill |
|-------|----------|----------|------------|-----------|
| **Product** | Why? For whom? | PRODUCT.md | product-init | product-ops |
| **Project** | Where? What stack? | PROJECT.md | project-init | project-ops |
| **Agent** | Who does the work? | AGENTS.md | agent-init | agent-ops |
| **Sprint** | What now? How? | SPEC.md + PLAN.md | sprint-init | sprint-ops |

Each layer has an **init** skill (one-time setup) and an **ops** skill (ongoing maintenance). Together they form the skeleton. Two additional skills complete the workflow:

- **brainstorm** — explores ideas, produces approved specs (pre-sprint)
- **orchestrate** — autonomous execution engine (drives sprints to completion)

## Roles

- **Operator** (human) — owns the product, approves specs, verifies deliverables. Present at initialization and completion. Outside the loop during execution.
- **Coordinator** (main agent) — drives brainstorming, invokes orchestrate, maintains tracking, pushes status proactively. Owns the process.
- **Implementers** (subagents) — ephemeral workers dispatched per task. Receive self-contained briefs, execute, report, disappear.

No separate QA role. Quality is enforced by **mechanical gates** — computed by tools, not judged by agents.

→ Full role definitions: `charter/roles.md`

## Workflow

```
Human: "Build X"
     ↓
  brainstorm → approved SPEC.md
     ↓
  sprint-init → sprint directory + tracking
     ↓
  orchestrate → autonomous execution loop
     │
     ├─ Plan tasks from spec
     ├─ Dispatch subagents per task
     ├─ Run mechanical quality gates
     ├─ Handle failures (retry → block → skip)
     ├─ Push progress to channel
     └─ Finish: PR + metrics + completion report
     ↓
  Human: reviews deliverable
```

**Human is outside the loop.** The operator defines direction (brainstorm) and verifies results (review). Everything between is autonomous. No mid-loop escalation. No asking for approval on subtasks.

## Execution Models

Pick the model that matches the work:

| Signal | Model |
|--------|-------|
| Sequential deps, clear spec, ship today | **Subagent swarm** |
| Independent tasks, creative, multi-day | **Multi-agent team** |
| Critical path + side-quests | **Hybrid** |
| One-line fix | **Direct edit** |

→ Full decision guide: `charter/models.md`

## Quality

Quality gates are **mechanical** — exit codes, not opinions:

```bash
# Gate checklist (all must pass)
npm test && npm run check && npm run build
```

For non-code projects (markdown, skills): valid structure, consistent formatting, no broken references.

- **Machine gates** (hard stop): computed checks pass. No exceptions.
- **Human gate**: operator verifies deliverable at sprint end.
- No separate QA phase. Gates run automatically after each task in the orchestrate loop.

→ Full quality guide: `charter/quality.md`

## Failure Handling

Failures are **contained**, not escalated:

| Attempt | Action |
|---------|--------|
| 1 | Dispatch with original brief |
| 2 | Tighten brief with failure output |
| 3 | Reduce task to minimum viable change |
| 4+ | Mark **blocked**, skip, continue with next task |

A blocked task doesn't block the sprint. The completion report lists what's blocked and why. The operator decides whether to accept or fix.

→ Full failure policies: `charter/failure.md`

## Communication

**Proactive push** — never wait to be asked:
- Task started/completed/blocked → real-time notification
- Phase transitions → summary notification
- Anomalies (consecutive failures, budget warning) → alert
- Sprint complete → full completion report

If the operator has to ask "how's it going?", the process failed.

## Metrics

Captured at sprint close via sprint-ops:

| Metric | Source |
|--------|--------|
| Commits | `git log --oneline` |
| PRs merged | `gh pr list --state merged` |
| Duration | Start → close dates |
| Execution model | SPEC.md |

Metrics are descriptive, not punitive. Track to learn, not to blame.

## Files

```
.team/
├── PRODUCT.md          # Product vision, users, metrics
├── PROJECT.md          # Stack, deploy, channels
├── AGENTS.md           # Who does what
├── SPRINTS.md          # All sprints — active + done
└── sprints/{name}/
    ├── SPEC.md         # What + why
    ├── PLAN.md         # How, task by task
    ├── STATE.json      # Orchestrate execution state
    └── RETRO.md        # What we learned
```

→ Full conventions: `charter/conventions.md`

## Principles

1. **Spec before code** — no implementation without approved design
2. **Human outside the loop** — present at init and completion, autonomous in between
3. **Mechanical gates over judgment** — exit codes, not opinions
4. **Ship before polish** — foundation first, refinement in follow-up sprints
5. **Failures are contained** — retry, block, skip, continue. Never stall.
6. **Proactive communication** — push status, never wait to be asked
7. **Write it down** — files, not chat history. STATE.json, not memory.
8. **Right model for the work** — swarm for sequential, team for parallel
9. **Scope is sacred** — define in/out at brainstorm, enforce during execution
10. **Operator owns product, coordinator owns process** — clear boundary, no overlap
