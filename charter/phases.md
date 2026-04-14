# Workflow Phases

The full workflow from idea to shipped deliverable. Orchestrate absorbs the middle phases into an autonomous loop.

## Phase 1: Brainstorm → Approved Spec

The coordinator and operator design the solution together using the **brainstorm** skill.

**Rules:**
- One question at a time — don't overwhelm
- Load product context (PRODUCT.md) before exploring approaches
- Propose 2-3 approaches with trade-offs, recommend one
- Get approval per section, not one giant reveal
- Scope check: if too big for one sprint, decompose first

**Exit criteria:**
- Design approved by operator
- SPEC.md written with goal, scope, out-of-scope, done-when criteria

**Output:** `.team/sprints/{id}/SPEC.md`

## Phase 2: Sprint Init → Tracking

**sprint-init** creates the sprint infrastructure from the approved spec.

**Actions:**
- Create sprint directory
- Write SPEC.md (or use existing from brainstorm)
- Update SPRINTS.md — add active sprint row
- Update PROJECT.md — set active sprint

**Output:** Sprint directory + tracking updated

## Phase 3: Orchestrate → Autonomous Execution

**orchestrate** takes over. The human is outside the loop from here until completion.

The orchestrate loop:

```
PLAN   → Break spec into ordered tasks, create issues
           ↓
EXECUTE → For each task:
           ├─ Dispatch subagent with self-contained brief
           ├─ Wait for completion
           ├─ Run mechanical quality gate
           └─ Route: pass → next | fail → retry (max 3) | exhausted → block + skip
           ↓
VERIFY  → Integration check on combined work
           ↓
FINISH  → PR + sprint-ops close + completion report
```

**No separate QA phase.** Quality gates run mechanically after each task. The operator verifies the final deliverable.

**No mid-loop escalation.** Failed tasks get retried with tighter briefs, then blocked and skipped. The loop always terminates.

**Proactive communication throughout:**
- Task started/completed/blocked → real-time notification
- Phase transitions → summary
- Anomalies → alert
- Sprint complete → full completion report

## Phase 4: Human Review

The operator reviews the completed deliverable:
- PR review
- Real device testing (if applicable)
- Accept → merge, tag, ship
- Not complete → new sprint for remaining work

## Exit Criteria Summary

| Phase | Gate | Who |
|-------|------|-----|
| Brainstorm | Spec approved | Operator |
| Sprint Init | Tracking set up | Coordinator (automatic) |
| Orchestrate | All tasks attempted, gates run | Coordinator (autonomous) |
| Human Review | Deliverable accepted | Operator |
