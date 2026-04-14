# s3-hardening — Implementation Plan

> **For agentic workers:** Execute task-by-task. Do not stop between tasks.

**Goal:** Close all competitive gaps and validate on LISSA.

---

## Task 1: Gate runner template

**Files:**
- Create: `templates/gate.sh`
- Modify: `skills/project-init/SKILL.md` — scaffold gate.sh during project init
- Modify: `skills/orchestrate/SKILL.md` — reference gate.sh as the default gate

- [ ] Create `templates/gate.sh` — executable template:
```bash
#!/usr/bin/env bash
set -euo pipefail
# Quality gate — customize per project. Exit 0 = pass, non-zero = fail.
npm test
npm run check 2>/dev/null || true
npm run build
```
- [ ] Update project-init: scaffold `.team/gate.sh` during init, note in PROJECT.md quality gate section
- [ ] Update orchestrate: "Run `.team/gate.sh` (or PROJECT.md quality gate command). Read exit code. Pass = 0, fail = non-zero."
- [ ] Commit: `feat: gate runner template + project-init/orchestrate integration`

---

## Task 2: Durable autonomous loop

**Files:**
- Modify: `skills/orchestrate/SKILL.md`

- [ ] Add **Oscillation Detection** section: track last N task results. If pattern A-fail → B-fail → A-fail detected (same tasks cycling), terminate loop with oscillation report. Default: detect after 2 cycles.
- [ ] Add **Session Resumption** protocol: on startup, check for `.team/sprints/{id}/STATE.json`. If found and status ≠ complete, announce "Resuming sprint {id} — {done}/{total} tasks, last completed: {task}." Resume from next pending task.
- [ ] Add **Tick Budget**: `maxTotalAttempts` (default 30). Sum of all attempts across all tasks. When exceeded, terminate with budget report. Configurable in SPEC.md.
- [ ] Commit: `feat: orchestrate — oscillation detection, session resumption, tick budget`

---

## Task 3: Issue tracking integration

**Files:**
- Create: `skills/track/SKILL.md`
- Modify: `skills/orchestrate/SKILL.md` — invoke track at state transitions

- [ ] Create `track` skill. Operations:
  - **Create issues**: from plan tasks → GitHub Issues (via `gh issue create`). Fallback: append to `.team/sprints/{id}/TRACKER.md`
  - **Move cards**: at each orchestrate state transition (pending → in-progress → done/blocked). Via `gh project item-edit` or update TRACKER.md
  - **Sync**: compare STATE.json against board/tracker, fix drift
  - GitHub Project setup: store project number + field IDs in `.team/PROJECT.md` under `## Tracking`
  - Local fallback: TRACKER.md with same columns (ID, Task, Status, Agent, PR)
- [ ] Update orchestrate: "After every state transition, invoke track to update external tracking."
- [ ] Add TRACKER.md to templates/
- [ ] Commit: `feat: track skill — GitHub Issues + Project board integration`

---

## Task 4: Role separation enforcement

**Files:**
- Modify: `skills/orchestrate/SKILL.md`
- Modify: `CHARTER.md`

- [ ] Add to orchestrate under Quality Gates: "The agent that produced the work MUST NOT evaluate it. Orchestrate dispatches the builder, then runs the gate command (mechanical check) OR dispatches a separate reviewer agent. The dispatcher (orchestrate) only reads exit codes and verdicts — it never judges quality directly."
- [ ] Add structural rule: "If using agent review (not just mechanical gate), the reviewer must be a different session/agent than the builder. Orchestrate enforces this by tracking builder session IDs and excluding them from review dispatch."
- [ ] Add to CHARTER.md principles: "Builder ≠ evaluator — the agent that writes the code never judges its quality."
- [ ] Commit: `feat: enforce role separation — builder ≠ evaluator`

---

## Task 5: Document lifecycle

**Files:**
- Modify: `charter/conventions.md`

- [ ] Add Document Lifecycle section:
  - Active specs live in `.team/sprints/{id}/SPEC.md` — the sprint dir IS the lifecycle container
  - When sprint closes, SPEC.md stays in place. SPRINTS.md links to it for reference.
  - No separate wip/archive dirs needed — sprint status (active/done) IS the lifecycle state
  - Design docs that span multiple sprints go in `.team/refs/` (persistent reference material)
- [ ] Commit: `docs: document lifecycle convention — sprint dirs as lifecycle containers`

---

## Task 6: Role templates

**Files:**
- Create: `roles/pm.md`
- Create: `roles/architect.md`
- Create: `roles/security.md`
- Create: `roles/devil-advocate.md`
- Create: `roles/tester.md`
- Modify: `skills/agent-init/SKILL.md` — offer role templates
- Modify: `skills/orchestrate/SKILL.md` — dispatch specialist reviewers

- [ ] Create role templates. Each has: Identity, Expertise, When to Include, Anti-Patterns. Adapted from OPC's role format but shorter (each ~30 lines).
  - pm.md — requirements clarity, user value, scope control, acceptance criteria
  - architect.md — system design, boundaries, dependencies, scalability
  - security.md — threat modeling, auth, input validation, secrets management
  - devil-advocate.md — challenge assumptions, find edge cases, stress-test decisions
  - tester.md — test strategy, coverage gaps, edge cases, regression risks
- [ ] Update agent-init: "For teams that want specialist review, offer role templates from `roles/`. These are dispatched by orchestrate during the review phase."
- [ ] Update orchestrate: "When dispatching review, optionally include a role template to focus the reviewer (e.g., security review, architecture review). Load from `roles/{role}.md` and include in the reviewer's brief."
- [ ] Commit: `feat: role templates — PM, architect, security, devil's advocate, tester`

---

## Task 7: pew integration

**Files:**
- Modify: `skills/sprint-ops/SKILL.md`

- [ ] Add concrete integration path to Metrics section:
  ```
  If ~/.config/pew/cursors.json exists:
    Run: pew status --json (or parse ~/.config/pew/queue.jsonl)
    Extract: total tokens (input + output + cache + reasoning) for sprint date range
    Include in sprint close metrics: "Token usage: {N} (via pew)"
  If pew not installed:
    Note: "Token usage: not tracked (install pew for token metrics)"
  ```
- [ ] Commit: `feat: sprint-ops — concrete pew integration for token tracking`

---

## Task 8: Proactive notification protocol

**Files:**
- Modify: `skills/orchestrate/SKILL.md`

- [ ] Add Notification Protocol section with concrete events:
  | Event | Trigger | Message format |
  |-------|---------|---------------|
  | Sprint started | orchestrate begins | "▶ Sprint {id}: {N} tasks planned. Starting execution." |
  | Task started | dispatch | "▶ Task {n}/{total}: {title}" |
  | Task passed | gate pass | "✓ Task {n}/{total}: {title}" |
  | Task blocked | max retries | "✗ Task {n}/{total}: {title} — {reason}" |
  | Midpoint | 50% tasks attempted | "Progress: {done}/{total} done, {blocked} blocked." |
  | Anomaly | 3 consecutive failures OR budget at 80% | "⚠ {description}" |
  | Sprint complete | all tasks attempted | Full completion report (done/blocked/metrics) |
- [ ] Add delivery mechanism: "Use the channel's message tool (Discord, Telegram, etc.) if available. Otherwise write to stdout/log. The notification target is configured in `.team/PROJECT.md` under `## Notifications`."
- [ ] Add to project-init: scaffold `## Notifications` section in PROJECT.md with channel config
- [ ] Commit: `feat: orchestrate — notification protocol with concrete events + delivery`

---

## Task 9: Validate on LISSA

This is the real test. Run the full hardened chain on LISSA's sub-modes backlog item.

**Files:** Work happens in `~/Projects/ear-trainer/`

- [ ] **Run product-ops** on LISSA — review backlog against PRODUCT.md goals, confirm sub-modes is the right next priority
- [ ] **Run brainstorm** on sub-modes — explore ascending/descending scales + modes over chord. Load PRODUCT.md, AGENTS.md, SPRINTS.md for context. Produce SPEC.md.
- [ ] **Run sprint-init** — create sprint s8-sub-modes (or appropriate ID), update SPRINTS.md + PROJECT.md
- [ ] **Run orchestrate** — autonomous execution:
  - Plan tasks from SPEC.md
  - Create GitHub Issues for each task (track skill)
  - Dispatch subagents for implementation
  - Run quality gate: `npm test && npx svelte-check && npm run build`
  - Handle failures: retry → block → skip
  - Push progress notifications
  - Write STATE.json
  - Produce PR when all tasks attempted
- [ ] **Human review** — Mike reviews PR on device
- [ ] **Run sprint-ops close** — capture metrics (commits, PRs, duration, tokens via pew if available)
- [ ] **Capture learnings** — what worked, what broke, what needs fixing in which skill

---

## Summary

| Task | What | Est. |
|------|------|------|
| 1 — Gate runner | Template + integration | 10 min |
| 2 — Durable loop | Oscillation, resumption, tick budget | 15 min |
| 3 — Issue tracking | Track skill + TRACKER.md | 15 min |
| 4 — Role separation | Enforcement in orchestrate + charter | 10 min |
| 5 — Doc lifecycle | Convention in conventions.md | 5 min |
| 6 — Role templates | 5 specialist roles + agent-init/orchestrate | 20 min |
| 7 — pew integration | Concrete path in sprint-ops | 5 min |
| 8 — Notifications | Protocol + delivery + project-init | 10 min |
| 9 — **LISSA validation** | Full chain on real project | 60+ min |
| **Total** | | **~150+ min** |

## Done When
- [ ] All 8 gaps closed with concrete implementations
- [ ] Gate runner tested on a real project
- [ ] Orchestrate handles oscillation + resumption + tick budget
- [ ] Issue tracking works (GitHub or local)
- [ ] Role separation structurally enforced
- [ ] Role templates available and dispatchable
- [ ] Token tracking works via pew integration
- [ ] Notifications push to channel during execution
- [ ] **LISSA sprint completed end-to-end: idea → autonomous execution → PR → human review**
