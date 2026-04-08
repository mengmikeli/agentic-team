# CHARTER.md — Agentic Team Playbook

*An operating system for AI agent teams building software.*

Built for: [OpenClaw](https://openclaw.ai) + Discord + GitHub.
Full reference: `charter/` directory. This file is the compact version — always loaded, always active.

---

## Roles

- **Operator** (human) — owns the product, approves designs, tests on real devices, authorizes deploys
- **Coordinator** (main agent) — drives brainstorming, writes specs/plans, dispatches work, owns the process, maintains `.team/SPRINTS.md`
- **Implementers** (team agents or ephemeral subagents) — write code, own branches
- **QA** (test agent) — headless browser verification, structured pass/fail reports

→ Full definitions + escalation rules: `charter/roles.md`

## Execution Models

Pick the model that matches the work:

| Signal | Model |
|--------|-------|
| Sequential dependencies, clear spec, ship today | **Subagent swarm** |
| Independent tasks, creative/exploratory, multi-day | **Multi-agent team** |
| Critical path + side-quests | **Hybrid** |
| One-line fix during QA | **Direct edit** |

→ Full decision guide: `charter/models.md`

## Workflow Phases

1. **Brainstorm** → approved spec (`SPEC.md`)
2. **Plan** → ordered tasks with success criteria (`PLAN.md`)
3. **Execute** → all tests pass at every commit
4. **QA** → machine gate → agent QA → operator device test
5. **Ship** → merge → staging → production → tag → retro

→ Phase details + exit criteria: `charter/phases.md`

## Quality

- **Machine gates** (hard stop): type check + tests + build. No exceptions.
- **QA gate** (risk-triaged): P0 blocks ship, P1/P2 may not.
- **Human gate**: operator tests on real device, approves ship.
- **Definition of done**: implementation complete, gates pass, operator approves, deploy verified, release documented.

→ Full quality guide + QA report format: `charter/quality.md`

## Failure Handling

- Bad subagent output: tighten brief → reduce task → coordinator direct edit (3 strikes)
- Flaky tests: stop and fix before continuing
- QA blocks release 3×: escalate to operator
- Operator offline: continue mechanical work, pause on decisions

→ Full failure policies: `charter/failure.md`

## Files

```
.team/
├── PROJECT.md          # Stack, deploy, channels
├── AGENTS.md           # Who does what
├── SPRINTS.md          # All sprints — active + done
└── sprints/{name}/
    ├── SPEC.md         # What + why
    ├── PLAN.md         # How, task by task
    └── RETRO.md        # What we learned
```

→ Full conventions: `charter/conventions.md`
→ Handoff templates: `charter/conventions.md#handoff-templates`

## Principles

1. **Spec before code** — no implementation without approved design
2. **Test before refactor** — snapshot behavior, then change it
3. **Ship before polish** — foundation first
4. **Ask before assuming** — one question at a time
5. **Stop means stop** — immediately
6. **Write it down** — files, not chat history
7. **Constrain the surface** — narrow scope per agent/task/branch
8. **Trust but verify** — report → review → confirm
9. **Right model for the work** — swarm for sequential, team for parallel
10. **Operator owns product, coordinator owns process** — unless escalation criteria apply
