---
name: orchestrate
description: "Autonomous execution engine for agent teams. Drives a sprint from approved spec to deliverable without human intervention. Plans tasks, dispatches agents, runs mechanical quality gates, handles failures, updates external tracking (GitHub board), and proactively reports progress. Human involvement is only at initialization (approve spec) and completion (verify deliverable). Use when: a spec is approved and ready for implementation, someone says 'go build it', 'start the sprint', 'execute the plan', or sprint-init has completed."
---

> **Requires:** `@mengmikeli/agentic-team` (`npm install -g @mengmikeli/agentic-team`) for mechanical enforcement via agt-harness.

# Orchestrate

The autonomous execution loop. Takes an approved spec and drives it to completion — planning, dispatching, gating, and reporting — without human intervention.

**Announce at start:** "I'm using the orchestrate skill to execute this sprint autonomously."

## Design Principles

1. **Human is outside the loop.** No mid-loop escalation. No asking for approval on subtasks. The loop runs to completion or exhaustion, then presents results.
2. **External tracking for human visibility.** Every transition reflected on GitHub board / tracker in real-time. The human can check progress anytime without interrupting.
3. **Proactive communication.** Push status — never wait to be asked. If the human has to ask "how's it going?", the process failed.
4. **Mechanical quality gates.** Tests pass, types check, build succeeds — computed by tools, not judged by LLMs.
5. **Failures are contained.** Retry with tighter brief → mark blocked → skip → continue. Never stall the whole sprint on one task.
6. **State persists across sessions.** The loop survives context compaction, session restarts, and agent recycling.

## The Loop

```
approved spec (SPEC.md)
     ↓
  ┌─ PLAN ──────────────────────────────────┐
  │  Break spec into ordered tasks           │
  │  Assign agent/subagent per task          │
  │  Create GitHub Issues + board items      │
  │  Write STATE.json to sprint dir          │
  │  → Notify: "Plan: N tasks, starting"    │
  └──────────────────────────────────────────┘
     ↓
  ┌─ EXECUTE (for each task) ───────────────┐
  │                                          │
  │  1. Dispatch agent/subagent              │
  │     - Full task brief (self-contained)   │
  │     - Branch name, files, acceptance     │
  │     → Board: move to In Progress         │
  │     → Notify: "Starting: {task}"         │
  │                                          │
  │  2. Wait for completion                  │
  │     - Agent reports done                 │
  │     - Or timeout (configurable)          │
  │                                          │
  │  3. Mechanical gate                      │
  │     - Tests pass?                        │
  │     - Types check?                       │
  │     - Build succeeds?                    │
  │     - Lint clean?                        │
  │     (All computed, not LLM-judged)       │
  │                                          │
  │  4. Route                                │
  │     ├─ ALL PASS → Done                   │
  │     │  → Board: move to Done             │
  │     │  → Notify: "✓ {task}"             │
  │     │  → Next task                       │
  │     │                                    │
  │     ├─ FAIL → Retry                      │
  │     │  Tighten brief with failure info   │
  │     │  Max 3 retries per task            │
  │     │  → Notify on retry 2+             │
  │     │                                    │
  │     └─ MAX RETRIES → Blocked            │
  │        → Board: mark Blocked             │
  │        → Notify: "✗ {task}: {reason}"   │
  │        → Skip, continue with next        │
  │                                          │
  └──────────────────────────────────────────┘
     ↓
  ┌─ INTEGRATION VERIFY ────────────────────┐
  │  Full test suite on combined work        │
  │  Build the complete project              │
  │  Check for regressions across tasks      │
  └──────────────────────────────────────────┘
     ↓
  ┌─ FINISH ────────────────────────────────┐
  │  Create PR (or merge if configured)      │
  │  Tag version                             │
  │  sprint-ops close (metrics)              │
  │  Completion report (see below)           │
  └──────────────────────────────────────────┘
     ↓
  → Notify human: "Sprint complete. Review."
```

## Oscillation Detection

Track the last N task results. If a pattern of the same tasks cycling through failures is detected (e.g., Task A fails → Task B fails → Task A fails again — same tasks re-entering the retry queue), terminate the loop with an oscillation report.

**Detection threshold:** 2 cycles of the same fail pattern (configurable in SPEC.md via `oscillationThreshold`).

**On detection:**
1. Stop the execution loop immediately
2. Write oscillation details to STATE.json: `"terminatedBy": "oscillation"`, `"oscillationPattern": [taskIds...]`
3. Notify: `"⚠ Oscillation detected: tasks {ids} cycling. Terminating. Review spec for dependency conflicts."`
4. Produce a completion report with the oscillation as the termination reason

## Session Resumption

On startup, check for an existing sprint in progress:

1. Read `.team/sprints/{id}/STATE.json` for the active sprint (identified from SPRINTS.md)
2. If found and `status` ≠ `"complete"`:
   - Announce: `"Resuming sprint {id} — {done}/{total} tasks, last completed: {lastDoneTask}."`
   - Resume from the next pending task (first task where status is neither `"done"` nor `"blocked"`)
   - Do NOT re-run completed tasks
3. If not found or status is `"complete"`, start fresh from SPEC.md

This makes orchestrate durable across context compaction, session crashes, and agent recycling.

## Tick Budget

`maxTotalAttempts` limits the total number of task attempts across the entire sprint (default: **30**). This is the sum of all attempts across all tasks — not per-task.

**Tracking:** `metrics.totalAttempts` in STATE.json is incremented on every dispatch.

**On budget exceeded:**
1. Stop the execution loop
2. Write to STATE.json: `"terminatedBy": "tickBudget"`, `"maxTotalAttempts": N`
3. Notify: `"⚠ Tick budget exhausted ({N}/{max} attempts). {done}/{total} tasks completed. Terminating."`
4. Produce a completion report with budget exhaustion as the termination reason

**Configuration:** Override in SPEC.md:
```markdown
## Limits
- Max total attempts: 50
- Oscillation threshold: 3
```

## State Management

Sprint execution state persists in `.team/sprints/{id}/STATE.json`:

```json
{
  "status": "executing",
  "tasks": [
    {
      "id": 1,
      "title": "Auth module",
      "status": "done",
      "agent": "subagent",
      "attempts": 1,
      "issue": "#42",
      "pr": "#45"
    },
    {
      "id": 2,
      "title": "API routes",
      "status": "blocked",
      "agent": "subagent",
      "attempts": 3,
      "issue": "#43",
      "reason": "Type errors in shared schema"
    },
    {
      "id": 3,
      "title": "Frontend views",
      "status": "pending",
      "agent": null,
      "attempts": 0,
      "issue": "#44"
    }
  ],
  "currentTask": 3,
  "metrics": {
    "startedAt": "2026-04-14T10:00:00Z",
    "tasksCompleted": 1,
    "tasksBlocked": 1,
    "tasksPending": 1,
    "totalAttempts": 4
  }
}
```

On session restart: read STATE.json, resume from `currentTask`.

## Proactive Communication

### Real-time (every transition)
- Task started: `"▶ Starting task 3/8: Frontend views"`
- Task passed: `"✓ Task 3/8 done: Frontend views"`
- Task blocked: `"✗ Task 4/8 blocked after 3 attempts: API routes — type errors in shared schema"`
- Board updated in sync

### Phase summaries (natural boundaries)
- Plan complete: `"Plan ready: 8 tasks across 3 modules. Starting execution."`
- Midpoint: `"Progress: 4/8 tasks done, 0 blocked. On track."`
- All attempted: `"Execution complete: 7/8 done, 1 blocked. Integration verify next."`

### Anomaly alerts (only when unexpected)
- Consecutive failures: `"3 consecutive failures on auth module — possible spec gap."`
- Budget warning: `"Token usage at 80% with 40% tasks remaining."`
- Stall: `"No progress on task 5 for 30 min — retrying with different approach."`

### Completion report
```markdown
## Sprint Complete: {id}

### Results
- ✓ 7/8 tasks completed
- ✗ 1 task blocked: API routes (type errors in shared schema, 3 attempts)

### Deliverable
- PR: #{N}
- Branch: feat/{name}
- Tests: {N} passing, {N} added

### Metrics
- Duration: {N} hours
- Commits: {N}
- Agent sessions: {N}

### For human review
- [ ] Verify on real device
- [ ] Approve deploy
- [ ] If blocked tasks need fixing → kick off new sprint
```

## External Tracking

### With GitHub Issues + Project Board
- sprint-init creates issues for each task
- orchestrate moves cards: Ready → In Progress → Done / Blocked
- Human sees live progress on the board anytime
- Link issues to PRs (`Closes #N`)

### Without GitHub (local tracker)
- `.team/sprints/{id}/TRACKER.md` — markdown table
- Same status flow, updated at every transition
- Less convenient for human monitoring but still works

## Quality Gates

Gates are **mechanical** — computed by tools, not judged by LLMs.

Run `.team/gate.sh` (scaffolded by project-init from `templates/gate.sh`). Read the exit code. Pass = 0, fail = non-zero.

```bash
# Default gate.sh runs:
npm test
npm run check 2>/dev/null || true
npm run build
```

If `.team/gate.sh` doesn't exist, fall back to the `## Quality Gate` command in `.team/PROJECT.md`. If neither exists, fall back to: tests pass + build succeeds.

**The orchestrator never evaluates quality itself.** It runs the gate script and reads the exit code. Pass = 0, fail = non-zero. No interpretation, no "close enough."

### Role Separation: Builder ≠ Evaluator

The agent that produced the work **MUST NOT** evaluate it. This is a structural constraint, not a suggestion.

**Mechanical gates (default):** Orchestrate dispatches the builder agent, waits for completion, then runs `.team/gate.sh`. The gate is a script — no agent judgment involved. This is the simplest and most reliable form of role separation.

**Agent review (optional, for design/architecture review):** If the project uses agent-based review in addition to mechanical gates:
- The reviewer **must be a different session/agent** than the builder
- Orchestrate tracks builder session IDs in STATE.json (`task.builderSessionId`)
- When dispatching a reviewer, orchestrate excludes the builder's session ID
- Optionally load a role template from `roles/{role}.md` to focus the review (e.g., security review, architecture review)

**Orchestrate's role:** The dispatcher only reads exit codes (from gates) and verdicts (from reviewers). It never judges quality directly. It routes: pass → done, fail → retry/block.

### Specialist Review Dispatch

When dispatching agent-based review (beyond mechanical gates), optionally include a role template to focus the reviewer:

1. Select a role template from `roles/{role}.md` based on the task type (e.g., `security` for auth changes, `architect` for new modules)
2. Load the template content and include it in the reviewer's brief
3. The reviewer evaluates the work through that role's lens and returns a verdict
4. Orchestrate reads the verdict — it does not interpret or override it

Role templates are optional. Most tasks only need mechanical gates. Use specialist review for high-risk or design-critical work.

## Failure Handling

| Attempt | Action |
|---------|--------|
| 1 | Dispatch with original brief |
| 2 | Tighten brief: include failure output, narrow scope, add hints |
| 3 | Tighten further: reduce task to minimum viable change |
| 4+ | Mark blocked, record reason, skip to next task |

**Never stall.** A blocked task doesn't block the sprint. Other tasks continue. The completion report lists what's blocked and why. The human decides whether to accept or fix.

## Resumption

See **Session Resumption** section above for the full protocol. In short: on startup, check STATE.json for the active sprint. If found and not complete, resume from the next pending task. Announce what's being resumed.

STATE.json is written after every task transition. It's the durable contract.

## Limits

| Limit | Default | Purpose |
|-------|---------|---------|
| Max retries per task | 3 | Prevent infinite loops on a single task |
| Max total attempts | 30 | Prevent runaway sprints (sum across all tasks) |
| Oscillation threshold | 2 cycles | Detect tasks cycling through failures |
| Max tasks per sprint | 20 | Scope control |
| Task timeout | 30 min | Detect stalls |
| Token budget | None (configurable) | Cost control |

Override in SPEC.md:
```markdown
## Limits
- Max retries: 5
- Task timeout: 60 min
- Token budget: 500K
```

## Notification Protocol

Concrete events, triggers, and message formats for proactive communication.

### Events

| Event | Trigger | Message Format |
|-------|---------|----------------|
| Sprint started | orchestrate begins execution | `"▶ Sprint {id}: {N} tasks planned. Starting execution."` |
| Task started | dispatch to agent | `"▶ Task {n}/{total}: {title}"` |
| Task passed | gate returns exit 0 | `"✓ Task {n}/{total}: {title}"` |
| Task blocked | max retries exhausted | `"✗ Task {n}/{total}: {title} — {reason}"` |
| Midpoint | 50% of tasks attempted | `"Progress: {done}/{total} done, {blocked} blocked."` |
| Anomaly | 3 consecutive failures OR tick budget at 80% | `"⚠ {description}"` |
| Sprint complete | all tasks attempted | Full completion report (see Completion Report section) |

### Delivery Mechanism

Use the channel's message tool (Discord, Telegram, etc.) if available. The notification target is configured in `.team/PROJECT.md` under `## Notifications`:

```markdown
## Notifications
- Channel: discord
- Target: #{channel-id-or-name}
```

If no notification config exists, write to stdout/log. Never block execution on notification delivery failures — log the failure and continue.

### Notification Rules

- **Every state transition gets a notification.** No silent transitions.
- **Anomaly alerts are immediate.** Don't batch them with phase summaries.
- **Don't spam.** Retries 1 are silent (only the initial dispatch is announced). Notify on retry 2+.
- **Completion report is always delivered** regardless of success/failure ratio.

## Integration

**Invoked by:** sprint-init (after spec approved) or human ("go build it")
**Invokes:** plan (internal), verify gates (mechanical), track (at every state transition), finish, sprint-ops close
**Updates:** STATE.json, GitHub board (via track), SPRINTS.md (via sprint-ops)
**Notifies:** Channel (Discord/chat) with real-time + phase + anomaly updates

### Track Integration

After every state transition (pending → in-progress, in-progress → done/blocked), invoke the **track** skill to update external tracking (GitHub Issues + Project board, or TRACKER.md fallback). This keeps the human's view of progress in sync with execution reality.
