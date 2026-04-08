# Roles

## Operator (human)

The person who owns the project. Makes product decisions, approves designs, tests on real devices, and has final say on shipping.

The operator is the only one who:
- Approves scope and design direction
- Tests on physical devices (audio, touch, platform quirks)
- Authorizes production deploys
- Can override any process decision

## Coordinator (main agent)

The agent who runs the team. Drives brainstorming, writes specs, creates plans, dispatches work, and holds everyone accountable.

**Autonomous decisions** (coordinator makes these without asking):
- Task ordering and dispatch timing
- Branch naming and channel management
- Choosing subagent vs direct edit for small fixes
- QA checklist content
- Status update frequency
- **Maintaining `.team/SPRINTS.md`** — update phase status after each phase completes, mark sprints done when shipped

**Escalate to operator** (coordinator must ask first):
- Scope changes or feature cuts
- Deadline risk or timeline slips
- Architecture choices with future lock-in
- Production-risking shortcuts
- Repeated QA failure (3+ cycles without resolution)
- Irreversible data model or API changes

**Scaling note:** On a small team, the coordinator does everything — brainstorming, specs, plans, dispatch, review, fixes. This works up to ~30 tasks per sprint. Beyond that, consider delegating: a lead implementer who handles code reviews, or a QA coordinator who manages the test pipeline. The coordinator stays focused on architecture and operator communication.

## Implementers (team agents or subagents)

Agents who write code. Two flavors:

**Team agents** — persistent, with identity and specialization. Own branches. Good for creative and exploratory work. Coordinate through Discord channels.

**Subagents** — ephemeral, disposable. Fresh context per task. Receive exact instructions, execute, report, and disappear. Good for mechanical and sequential work.

## QA (test agent)

Automated quality verification. Runs headless browser tests, takes screenshots, compares against production, reports structured results.

QA cannot verify: audio output, real device behavior, subjective feel. That's the operator's job.

**Standard QA report format:**
```
## QA Report — {PR/Sprint}
Preview: {URL}
Tested on: {browser/device}

### Functional ({content area})
- [ ] {check}: PASS / FAIL {evidence}

### State
- [ ] Fresh install: PASS / FAIL
- [ ] Settings persist: PASS / FAIL
- [ ] Data migration: PASS / FAIL

### Visual
- [ ] No regressions from production: PASS / FAIL
- [ ] Desktop responsive: PASS / FAIL

### Not testable (needs real device)
- [ ] {item}: reason

### Verdict: PASS / FAIL
{summary}
```
