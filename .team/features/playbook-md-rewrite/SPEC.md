# Feature: PLAYBOOK.md Rewrite

## Goal
Replace the Discord/OpenClaw-centric playbook with an accurate v2 reference covering the `agt` CLI workflow from project init through shipping.

## Scope
- Remove all Discord-specific content (bot pings, channel management, reactions, BOT_IDs)
- Remove all OpenClaw-specific content (sessions_spawn, sessions_yield, ACP, heartbeats, shell approval friction)
- Document the primary `agt` CLI commands with their purpose and typical usage:
  - `agt init` — interactive project setup
  - `agt run` — dispatch agents and run the execution loop (with `--daemon` option)
  - `agt status` — view current feature/task state
  - `agt stop` — halt a running feature
  - `agt log` — view execution log
  - `agt review` — trigger a review pass
  - `agt audit` — run quality audit
  - `agt brainstorm` — interactive brainstorm to produce a SPEC
  - `agt board` — print the project board summary
  - `agt metrics` — show sprint metrics
  - `agt doctor` — diagnose environment setup issues
  - `agt dashboard` — launch local web dashboard
- Document the standard sprint workflow: brainstorm → spec approval → run → ship
- Document flow selection (light review / build-verify / full-stack)
- Document quality gates and how failures are handled
- Keep the GitHub section (branch protection, releases, PRs) — it remains accurate
- Keep the Deploy section — it remains accurate

## Out of Scope
- Adding new CLI commands or changing existing behavior
- Documenting `agt-harness` internals (internal tooling, not user-facing)
- Documenting `.team/` directory structure or STATE.json schema
- Adding per-command `--help` output (that is a separate roadmap item)
- Any changes to code files

## Done When
- [ ] PLAYBOOK.md contains no references to Discord, OpenClaw, ACP, sessions_spawn, sessions_yield, BOT_ID, or heartbeats
- [ ] PLAYBOOK.md documents every `agt` subcommand listed in `bin/agt.mjs` with at least a one-line description of its purpose
- [ ] PLAYBOOK.md includes a "Standard Sprint Workflow" section showing the end-to-end sequence using `agt` commands
- [ ] PLAYBOOK.md includes a "Flow Selection" section describing the three flow tiers and when to use each
- [ ] PLAYBOOK.md retains (and updates if needed) the GitHub and Deploy sections
- [ ] PLAYBOOK.md is self-contained — an agent starting a new sprint can follow it without referencing external Discord/OpenClaw docs
