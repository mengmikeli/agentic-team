# agentic-team v2 — Product Spec

## Vision

A CLI tool + runtime + dashboard that lets AI agent teams self-manage software projects. The human defines direction, the agents execute autonomously, a harness enforces quality, and a dashboard shows everything.

```
┌─────────────────────────────────────────────────────┐
│  HUMAN                                               │
│  at init → set direction                             │
│  at status / web dashboard → see everything          │
│  review PRs → accept or reject                       │
│                                                      │
├─────────────────────────────────────────────────────┤
│  CLI (at)                                            │
│  at init    — project + product + team setup          │
│  at run     — start autonomous loop                  │
│  at status  — cross-project dashboard                │
│  at board   — task board (GitHub sync)               │
│  at metrics — token usage, cost, efficiency          │
│  at stop    — pause execution                        │
│  at log     — execution history                      │
│                                                      │
├─────────────────────────────────────────────────────┤
│  HARNESS (at-harness)                                │
│  Enforcement layer — the agent calls it, can't fake  │
│  init       — create feature state                   │
│  gate       — run quality checks, write verdict      │
│  transition — validate state change + nonce          │
│  notify     — dispatch progress event                │
│  finalize   — validate chain before completion       │
│  All output JSON. Tamper-detected. File-locked.      │
│                                                      │
├─────────────────────────────────────────────────────┤
│  SKILLS (markdown)                                   │
│  Agent playbook — what to do and when                │
│  product-init/ops, agent-init/ops, brainstorm,       │
│  orchestrate (calls harness), track, audit           │
│  Role templates for specialist review                │
│                                                      │
├─────────────────────────────────────────────────────┤
│  WEB DASHBOARD                                       │
│  Static site from .team/ data                        │
│  Cross-project overview                              │
│  Feature timeline + task board                       │
│  Token usage graphs (contribution-graph style)       │
│  Agent efficiency metrics                            │
│  Real-time via polling STATE.json                    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Stack

- **CLI + Harness**: Node.js (ESM), single package, `bin/at.mjs` + `bin/at-harness.mjs`
- **Dashboard**: Static HTML/JS (no framework), reads .team/ JSON files
- **Skills**: Markdown (AgentSkills format), reference the harness commands
- **Distribution**: npm (`@mengmikeli/agentic-team`), ClawHub (skills only)

## CLI Commands

### `at init`
Interactive setup. Combines product-init + project-init + agent-init into one flow.
- Asks about the product (vision, users, goals)
- Scaffolds .team/ (PROJECT.md, PRODUCT.md, AGENTS.md)
- Configures quality gate command
- Sets up GitHub Project board (optional)
- Sets notification channel (optional)

### `at run [feature-description]`
Starts the autonomous loop.
- If feature description given: brainstorm → spec → execute that feature
- If no description: product-ops picks next priority from PRODUCT.md roadmap
- Orchestrate loop runs: plan → dispatch → gate (via harness) → transition → notify
- Continues to next feature after completion
- Writes STATE.json at every transition (harness-enforced)

### `at status`
Cross-project dashboard in terminal.
- Reads PROJECTS.md for all projects
- Shows: project name, active feature, tasks done/pending/blocked, token usage
- Colored output, refreshable

### `at board`
Task board view.
- Reads STATE.json for active feature
- Shows: task list with status (pending/in-progress/done/blocked)
- Syncs with GitHub Project board if configured

### `at metrics`
Token usage and cost.
- Reads pew data or session logs
- Shows: per-project, per-feature, per-agent token usage
- Trends over time (last 7 days, 30 days)
- Contribution-graph style heatmap in terminal

### `at stop`
Pause execution.
- Writes pause signal to STATE.json
- Orchestrate reads it on next tick and stops gracefully
- `at run` resumes from where it stopped

### `at log`
Execution history.
- Reads STATE.json history
- Shows: what was executed, verdicts, timing, errors

## Harness Commands

The enforcement layer. Agent calls these; output is JSON; state is tamper-detected.

### `at-harness init --feature <name>`
Create feature state in `.team/features/{name}/STATE.json`.

### `at-harness gate --dir <path> --cmd <gate-command>`
Run quality gate. Execute the command, capture exit code + output, write verdict to STATE.json.
- Exit 0 → PASS
- Exit non-zero → FAIL (with captured stderr)
- Writes nonce signature — can't be faked

### `at-harness transition --task <id> --status <status> --dir <path>`
State transition with validation.
- Validates current state allows this transition
- Checks cycle limits (max retries per task, max total attempts)
- Detects oscillation (A→B→A pattern)
- Writes with nonce + file lock
- Returns JSON: `{ allowed: true/false, reason, next }`

### `at-harness notify --event <type> --msg <message> --channel <target>`
Dispatch notification.
- Events: feature-started, task-started, task-passed, task-blocked, progress, anomaly, feature-complete
- Channels: discord (via OpenClaw message tool), stdout, file

### `at-harness finalize --dir <path>`
Validate entire execution chain before marking feature complete.
- All tasks have verdicts
- No unapproved state edits
- Gate results present for every task
- Returns JSON: `{ finalized: true/false, errors }`

### `at-harness metrics --dir <path>`
Compute feature metrics from STATE.json + git log + pew data.
- Commits, duration, token usage, tasks completed/blocked
- Returns JSON

## Web Dashboard

Static HTML + JS. No build step. Reads .team/ data via fetch or file:// protocol.

### Pages
- **Overview**: all projects from PROJECTS.md, status cards
- **Feature timeline**: history of shipped features with metrics
- **Task board**: current feature tasks with live status
- **Metrics**: token usage heatmap, cost trends, agent efficiency
- **Log**: execution history with expandable details

### Hosting
- `at dashboard` serves locally on port 3847
- Deploy to Cloudflare Pages for remote access
- Or just open index.html locally

## Feature Lifecycle (replaces sprints)

```
PRODUCT.md roadmap
     ↓
product-ops picks next priority
     ↓
brainstorm → .team/features/{name}/SPEC.md
     ↓
at-harness init --feature {name}
     ↓
orchestrate loop:
  plan tasks → create issues
  for each task:
    dispatch agent
    at-harness gate (quality check)
    at-harness transition (state update)
    at-harness notify (progress push)
  at-harness finalize (validate chain)
     ↓
PR → notify human
     ↓
human reviews
  ├─ accept → at-harness finalize → capture metrics → next feature
  └─ reject → new fix feature (smaller inner loop)
```

Features replace sprints. Each feature is self-contained: spec'd, tracked, gated, measured. No batching, no ceremony. Continuous flow.

## Directory Structure

```
.team/
├── PRODUCT.md          — vision, users, goals, roadmap
├── PROJECT.md          — stack, deploy, gate command, notifications
├── AGENTS.md           — team roles
├── HISTORY.md          — shipped features log (replaces SPRINTS.md)
└── features/
    ├── {name}/
    │   ├── SPEC.md     — what + why
    │   └── STATE.json  — harness-managed execution state
    └── {name}/
        ├── SPEC.md
        └── STATE.json
```

## Package Structure

```
agentic-team/
├── bin/
│   ├── at.mjs              — CLI entry point
│   ├── at-harness.mjs      — harness entry point
│   └── lib/
│       ├── init.mjs         — at init logic
│       ├── run.mjs          — at run (outer loop)
│       ├── status.mjs       — at status rendering
│       ├── board.mjs        — at board rendering
│       ├── metrics.mjs      — at metrics computation
│       ├── gate.mjs         — harness gate logic
│       ├── transition.mjs   — harness state management
│       ├── notify.mjs       — harness notifications
│       ├── finalize.mjs     — harness chain validation
│       └── util.mjs         — nonce, file lock, atomic write
├── skills/                  — agent playbook (markdown)
├── roles/                   — specialist role templates
├── dashboard/               — static HTML/JS
├── templates/               — .team/ templates
├── package.json
└── README.md
```

## Done When

- [ ] `at init` scaffolds a project interactively
- [ ] `at run` starts the autonomous outer loop (product-ops → brainstorm → orchestrate)
- [ ] `at-harness gate` runs quality checks with tamper-detected verdicts
- [ ] `at-harness transition` validates state changes with cycle limits + oscillation detection
- [ ] `at-harness notify` pushes progress to configured channel
- [ ] `at status` shows cross-project dashboard in terminal
- [ ] `at metrics` shows token usage from pew/session data
- [ ] Web dashboard renders project overview + feature timeline + task board
- [ ] Full chain validated: at init → at run → autonomous feature delivery → human review
- [ ] Published to npm as @mengmikeli/agentic-team
