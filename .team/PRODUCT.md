# agentic-team — Product Definition

## Vision
A framework that lets AI agent teams self-manage software projects — from idea to shipped deliverable — with the human only present at initialization (approve the spec) and completion (verify the result). Everything in between is autonomous.

## Users
Developers and teams running AI coding agents (via OpenClaw, Claude, Codex, or similar) who want their agents to self-organize rather than require constant human direction. Specifically: people who have agents that can write code but need a system for agents to plan, coordinate, execute, and ship without babysitting.

## Problem
AI agents can write code, but they can't self-organize. Without a framework, every sprint requires constant human coordination: breaking work into tasks, dispatching agents, tracking progress, handling failures, running quality checks. The human becomes a bottleneck — doing project management work that could be autonomous.

Existing approaches (ad-hoc prompting, rigid pipelines) either require too much human involvement or lack the flexibility to handle real project complexity.

## Success Metrics
1. **Idea → deliverable with human only at init + completion.** The full chain (brainstorm → sprint-init → orchestrate → ship) runs without human intervention during execution.
2. **Teams adopt it for >1 sprint without reverting to ad-hoc.** The framework proves more effective than winging it.
3. **Blocked tasks don't block sprints.** The orchestrate loop always terminates — failures are contained, not escalated.
4. **Sprint metrics improve over time.** Tracking enables data-driven decisions about execution models, agent efficiency, and scope sizing.

## Landscape
- **OPC** — Digraph-based execution engine with compound evaluation gates, extensions, runbooks, crash recovery. Technical leader in quality enforcement. No team orchestration.
- **GhostComplex (Superboss/Teamwork)** — Discord-based team orchestration with document-driven development, 7-perspective code review, human approval gates, GitHub Project integration. Team workflow leader.
- **OpenClaw agent framework** — platform for running agents. Provides infrastructure (sessions, tools, channels) but not project methodology. agentic-team adds the process layer.
- **Superpowers / personal agent skills** — individual agent workflows. Single-agent, not team-oriented.

## Roadmap
1. **v1.0 — Foundations** — ✅ Done. 11 skills, CLI, harness, dashboard.
2. **v2.0 — CLI product** — ✅ Done. agt run, agt-harness, GitHub Issues, daemon, notifications, continuous mode.
3. **Flow templates** — ✅ Done. Light review, build-verify, full-stack flow selection.
4. **Parallel reviewers** — ✅ Done. Multi-role dispatch with merged findings.
5. **Backlog enforcement** — ✅ Done. Warning tracking, gate blocking.
6. **Per-command help** — ✅ Done. Add `agt help <command>` with usage, flags, and examples for each command. Currently `agt` only shows a flat list.
7. **PLAYBOOK.md rewrite** — ✅ Done. Update for v2 CLI workflow. Current playbook references old multi-agent Discord coordination, not the agt CLI product.
8. **npm publish** — ✅ Done. Unblock 2FA issue and publish to npm registry via GitHub Actions.
9. **Dashboard React rebuild** — ✅ Done. Vite + React + shadcn/ui + Recharts. TE × Marathon palette (60-30-10 monochrome + orange). Light/dark toggle, time range tabs, responsive.

### Phase 3 — Reliable Autonomous Execution
10. **Crash recovery + atomic state writes** — ✅ Done. Write-then-rename for STATE.json. Detect incomplete state on restart and resume from last good checkpoint. File locking for concurrent safety.
11. **Oscillation detection + tick limits** — ✅ Done. Tick-limit enforcement (default 6, configurable), K≥2 pattern detection with warn/halt, replan tick inheritance, progress.md logging. 376 tests.
12. **Human approval gate** — ✅ Done. Outer loop creates GitHub issue for each feature, waits for human to move to Ready before executing. Agents never self-approve scope.
13. **Compound evaluation gate** — ✅ Done. Multi-layer substance check on reviews (thin content, missing code refs, low uniqueness, fabricated references, aspirational claims). ≥3 layers tripped = hard FAIL.
14. **Iteration escalation** — ✅ Done. Persistent eval warnings across ≥2 iterations auto-escalate to FAIL. No more infinite shallow-fix loops.

### Phase 3.5 — Stabilization
27. **Label threading** — ✅ Done. Outer loop passes `[P#/#N]` labels through to inner loop's `runSingleFeature`. GitHub issues and CLI banner show roadmap position.
28. **Dashboard token breakdown** — ✅ Done. Feature detail view: click a feature to see per-task cost, phase breakdown (brainstorm/build/review), run duration. Cost column on feature timeline.
29. **Dashboard active task indicator** — ✅ Done. Show which specific task is executing with name and attempt number, not just "N/M done".
30. **Finalize auto-close validation** — ✅ Done. Integration test: `agt finalize` marks feature completed and closes all its GitHub issues. Verify end-to-end.

### Phase 4 — Productive Execution
15. **Simplicity reviewer with veto** — Dedicated review pass that checks for dead code, premature abstraction, unnecessary indirection, gold-plating. Simplicity REQUEST_CHANGES = overall REQUEST_CHANGES.
16. **Multi-perspective code review** — ✅ Done. Parallel review dispatch: architect, engineer, product, tester, security, simplicity. Role-specific reference docs. Synthesis with severity ranking.
17. **Document-driven development** — ✅ Done. PRD template (Goal, Requirements, Acceptance Criteria, Technical Approach, Testing Strategy, Out of Scope). No code without approved spec.
18. **Parent issue + subtask lifecycle** — ✅ Done. Feature gets parent GitHub issue (PRD in body), subtasks as child issues with checklist. Full lifecycle sync on project board.
19. **Max review rounds + escalation** — ✅ Done. Cap at 3 review rounds. After round 3, produce summary and escalate to human. Prevents infinite review loops.

### Phase 5 — Advanced
20. **Git worktree isolation** — Each feature runs in its own git worktree + branch. Parallel features never interfere. Feature-slug as namespace for all artifacts.
21. **Runbook system** — Pattern-matched task recipes (regex + keyword scoring). Reusable decompositions eliminate repeated planning. Runbook replay for known sequences.
22. **Extension system** — Capability-routed hooks (promptAppend, verdictAppend, executeRun, artifactEmit). Sandboxed with timeouts + circuit breakers. Dynamic loading from user dirs.
23. **External validator integration** — Pre-commit hooks, test suites, CI pipelines as additional gate evidence sources. Not just exit codes.
24. **Self-simplification pass** — Before creating PR, automated review of every changed file for deletability, inlining, simplification. Counter AI bloat.
25. **Cron-based outer loop** — Optional mode: OpenClaw cron reads GitHub Project board, auto-dispatches Ready items. Keeps pipeline flowing without CLI.
26. **Execution report** — Post-run structured report: what shipped, what passed/failed, time spent, token usage, recommendations.
