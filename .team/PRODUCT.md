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
- **Superpowers / personal agent skills** — individual agent workflows (brainstorming, coding). Single-agent, not team-oriented. agentic-team extends this to multi-agent coordination.
- **OpenClaw agent framework** — platform for running agents. Provides infrastructure (sessions, tools, channels) but not project methodology. agentic-team adds the process layer.
- **Custom CI/CD pipelines** — rigid, code-specific. Don't handle the creative/planning phases. Don't adapt to failures.
- **Human project management** — Jira, Linear, etc. Designed for human teams. Agents need something that speaks their language (markdown specs, mechanical gates, self-contained briefs).

## Roadmap
1. **v1.0 — Foundations** — ✅ Done. 11 skills, CLI, harness, dashboard.
2. **v2.0 — CLI product** — ✅ Done. agt run, agt-harness, GitHub Issues, daemon, notifications, continuous mode.
3. **Flow templates** — ✅ Done. Light review, build-verify, full-stack flow selection.
4. **Parallel reviewers** — ✅ Done. Multi-role dispatch with merged findings.
5. **Backlog enforcement** — ✅ Done. Warning tracking, gate blocking.
6. **Per-command help** — Add `agt help <command>` with usage, flags, and examples for each command. Currently `agt` only shows a flat list.
7. **PLAYBOOK.md rewrite** — ✅ Done. Update for v2 CLI workflow. Current playbook references old multi-agent Discord coordination, not the agt CLI product.
8. **npm publish** — ✅ Done. Unblock 2FA issue and publish to npm registry via GitHub Actions.
