# Workflow Phases

Every nontrivial piece of work goes through these phases. Small fixes skip to Phase 4.

## Phase 1: Brainstorm

The coordinator and operator design the solution together.

**Rules:**
- One question at a time — don't overwhelm
- Multiple choice when possible
- Explore 2-3 approaches before committing
- Present design in sections, get approval per section
- Write the approved design as a spec

**Exit criteria:**
- All design decisions resolved (no open questions)
- Operator has approved the approach
- Spec document written and saved

**Output:** `.team/sprints/{name}/SPEC.md`

## Phase 2: Plan

The coordinator turns the spec into an implementation plan.

**Rules:**
- Bite-sized tasks (2-10 minutes each)
- Exact file paths, code examples, commands
- TDD: test first, then implement
- Clear success criteria per task
- Sequential ordering respects dependencies

**Exit criteria:**
- Every task has file paths, success criteria, and test approach
- Tasks are ordered (dependencies respected)
- Execution model chosen and noted
- Operator has reviewed the plan if it involves scope risk or architecture changes (otherwise coordinator owns it)

**Output:** `.team/sprints/{name}/PLAN.md`

## Phase 3: Execute

Work gets done according to the chosen execution model.

**Rules:**
- Snapshot current behavior (tests) before refactoring
- All tests pass at every commit
- Build succeeds at every commit
- Progress posted to team channel
- Blockers raised immediately, not at the end

**Exit criteria:**
- All tasks in the plan are complete
- Machine gates pass (type check, tests, build)
- Intended scope is fully implemented
- No known regressions

## Phase 4: QA

Verification before shipping.

**Machine gate (automated, required):**
- Type check passes
- Tests pass
- Build succeeds
- No new console errors

**QA gate (agent, required):**
- Headless browser verification against preview deploy
- Structured report using standard QA format (see `charter/roles.md`)
- PASS / FAIL per checklist item with evidence

**Human gate (operator, required for ship):**
- Real device testing
- Design/UX approval
- Audio, touch, platform-specific behavior
- Final ship decision

**Exit criteria:**
- Machine gate: all green
- QA gate: PASS verdict with structured report
- Human gate: operator explicitly approves

## Phase 5: Ship

Merge, deploy, release.

**Steps:**
1. Merge to main (squash)
2. Deploy to staging → verify
3. Deploy to production → verify
4. Tag release with notes
5. Close sprint channel
6. Write retro

**Exit criteria:**
- Production URL verified
- Release tagged on GitHub
- Sprint channel closed
- SPRINTS.md updated (sprint marked ✅ Done, active sprint cleared or set to next)
- Retro written (`.team/sprints/{name}/RETRO.md`)
