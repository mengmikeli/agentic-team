# agentic-team — Project Config

## What
Framework for running self-managing AI agent teams on software projects. Four layers — product (why/what), project (where), agent (who), sprint (when/how) — with an autonomous execution engine that drives sprints from approved spec to deliverable without human intervention.

## Stack
Markdown + SKILL.md (AgentSkills format)

## Repo
[mengmikeli/agentic-team](https://github.com/mengmikeli/agentic-team) (public)

## Current Version
v2.1.0

## Active Sprint
None

## Tracking
- GitHub Project: [mengmikeli/projects/1](https://github.com/users/mengmikeli/projects/1)
- Issues: [mengmikeli/agentic-team/issues](https://github.com/mengmikeli/agentic-team/issues)
- Status Field ID: PVTSSF_lAHOAEUwvc4BUkmdzhBr2dQ
- Todo Option ID: 0837af90
- In Progress Option ID: 9b7ddf3b
- Done Option ID: a15d7c7c
- Pending Approval Option ID: c5d5b81c
- Ready Option ID: 21e8fbcf

## Skills (11)

| Skill | Layer | Purpose |
|-------|-------|---------|
| product-init | Product | Vision, users, goals, success metrics via wizard |
| product-ops | Product | Prioritize backlog, validate outcomes, maintain PRODUCT.md |
| project-init | Project | Scaffold .team/ + README via interactive wizard |
| project-ops | Project | Maintain PROJECT.md, detect drift |
| agent-init | Agent | Set up team roles via interactive wizard |
| agent-ops | Agent | Adjust roles, efficiency review, retro input |
| sprint-init | Sprint | Start sprint with tracking |
| sprint-ops | Sprint | Close (with metrics), update, pause, status |
| brainstorm | Workflow | Explore idea → approved spec (pre-sprint) |
| orchestrate | Execution | Autonomous loop: plan → dispatch → gate → finish |
| audit | Cross-cutting | Cross-layer health check + cost anomalies |

## Other Deliverables
- CHARTER.md — methodology (compact overview + charter/ detailed reference)
- PLAYBOOK.md — platform recipes (OpenClaw + Discord + GitHub)
- templates/ — reference templates for .team/ files

## Invariants

Rules that `agt run` must always satisfy. Violating any of these is a bug.

### Execution Visibility
1. **Every executing feature has STATE.json** — if the feature directory exists (even from brainstorm), harness init must create STATE.json before any task dispatches.
2. **STATE.json reflects real-time progress** — task status synced after every transition (start, pass, block). The dashboard must never show stale data.
3. **Feature must be trackable before execution** — `agt run` validates STATE.json exists and status is active/executing before dispatching. Hard exit with actionable error if not.

### Termination Guarantees
4. **Tick limits** — every task has a `ticks` counter (lifetime dispatches, survives replan). Blocked at `maxTaskTicks` (default 6). No infinite replan cycles.
5. **Oscillation detection** — K≥2 pattern repeated 3× halts the feature with `oscillation-halted` status and exit code 1. No infinite review loops.
6. **Max retries per task** — 3 attempts before blocked. Combined with tick limits for defense-in-depth.

### Labeling
7. **Phase/item labels** — issues and CLI banner include `[P3/#10]` style labels parsed from PRODUCT.md roadmap headers. Roadmap position must be visible.

### Quality Gates
8. **Gate command is real** — never `echo gate-recorded` or similar stubs. Must execute the actual test/lint command configured for the project.
9. **Separation of executor and evaluator** — the agent implementing a task never evaluates its own output.

### State Integrity
10. **Atomic writes** — STATE.json written via write-then-rename (`atomicWriteSync`). Process crash during write must not corrupt state.
11. **Write nonces** — harness verifies `_written_by` signature. Unauthorized state modifications are detected.
