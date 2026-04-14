# agentic-team

CLI + harness + dashboard for autonomous AI agent teams. The human defines direction, agents execute, a harness enforces quality, and a dashboard shows everything.

```
npm install -g @mengmikeli/agentic-team
```

## How it works

```
Human: "Build X"
     ↓
  at init → scaffold project
     ↓
  at run → autonomous loop
     │
     ├─ brainstorm → SPEC.md
     ├─ plan tasks
     ├─ dispatch subagents
     ├─ at-harness gate (quality checks)
     ├─ at-harness transition (state management)
     ├─ at-harness notify (progress updates)
     └─ at-harness finalize (validate chain)
     ↓
  Human reviews PR
```

Two binaries:
- **`at`** — CLI for humans: init projects, check status, view boards
- **`at-harness`** — enforcement layer for agents: tamper-detected state, quality gates, validated transitions

## Quick start

```bash
# Set up a new project
at init

# Check project status
at status

# View task board
at board

# See token usage + git stats
at metrics

# Start the web dashboard
at dashboard
```

## CLI Commands

### `at init`
Interactive setup wizard. Creates `.team/` with PRODUCT.md, PROJECT.md, AGENTS.md.

### `at status`
Cross-project dashboard in terminal — features, task counts, gate pass rates.

### `at board [feature]`
Kanban-style task board. Shows tasks grouped by status: pending → in-progress → passed → blocked.

### `at metrics`
Token usage from [pew](https://github.com/mengmikeli/pew) data, git log stats, feature metrics. Includes a contribution-graph style heatmap.

### `at run [description]`
Autonomous execution loop *(phase 2 — currently prints the execution plan)*.

### `at stop [feature]`
Pause active features. Run `at run` to resume.

### `at log [feature]`
Execution history — transitions, gate results, timing.

### `at dashboard [port]`
Serves the web dashboard at `http://localhost:3847` (default port). Shows overview cards, feature timeline, task board, and metrics.

## Harness Commands

The enforcement layer. Agent calls these; output is JSON; state is tamper-detected.

### `at-harness init --feature <name>`
Create feature state in `.team/features/{name}/STATE.json`.

### `at-harness gate --cmd <command> --dir <path> [--task <id>]`
Run a quality gate. Execute the command, capture exit code + output, write verdict.
- Exit 0 → PASS, non-zero → FAIL
- Writes nonce signature — can't be faked by agent editing STATE.json

### `at-harness transition --task <id> --status <status> --dir <path>`
Validated state transition with safety guards:
- Checks allowed transitions (pending → in-progress → passed/failed)
- Enforces cycle limits (max 3 retries per task)
- Detects oscillation (A→B→A→B pattern)
- Idempotency guard (dedup within 5s window)
- File locking for concurrent safety

### `at-harness notify --event <type> --msg <message> [--channel <target>]`
Dispatch progress events. Events: `feature-started`, `task-started`, `task-passed`, `task-failed`, `task-blocked`, `progress`, `anomaly`, `feature-complete`.

### `at-harness finalize --dir <path> [--strict]`
Validate the entire execution chain before marking a feature complete:
- All tasks must be passed or skipped
- No unapproved state edits (nonce check)
- `--strict`: every passed task must have a gate result

### `at-harness metrics --dir <path>`
Compute feature metrics from STATE.json + git log. Returns JSON.

## Web Dashboard

Static HTML/JS — no build step, no framework.

**Pages:**
- **Overview** — project cards, feature list with progress bars
- **Timeline** — chronological feature history with outcomes
- **Board** — kanban task board for active feature
- **Metrics** — completion rates, gate pass rates, activity heatmap

Reads `.team/` data via `/api/` when served, falls back to demo data when opened locally.

## Architecture

```
agentic-team/
├── bin/
│   ├── at.mjs              ← CLI entry point
│   ├── at-harness.mjs      ← harness entry point
│   └── lib/
│       ├── util.mjs         ← nonce, file lock, atomic write, ANSI
│       ├── init.mjs         ← at init (interactive)
│       ├── run.mjs          ← at run (phase 2 stub)
│       ├── status.mjs       ← at status (terminal dashboard)
│       ├── board.mjs        ← at board (task board)
│       ├── metrics.mjs      ← at metrics (pew + git)
│       ├── stop.mjs         ← at stop (pause features)
│       ├── log.mjs          ← at log (history viewer)
│       ├── gate.mjs         ← harness gate (quality checks)
│       ├── transition.mjs   ← harness transitions (state machine)
│       ├── finalize.mjs     ← harness finalize (chain validation)
│       ├── notify.mjs       ← harness notifications
│       ├── harness-init.mjs ← harness init (create STATE.json)
│       └── harness-metrics.mjs ← harness metrics (JSON)
├── dashboard/               ← static web dashboard
│   ├── index.html
│   ├── style.css
│   └── app.js
├── skills/                  ← agent playbook (AgentSkills format)
├── roles/                   ← specialist role templates
├── templates/               ← .team/ file templates
├── test/                    ← harness tests (node --test)
├── CHARTER.md               ← methodology reference
└── PLAYBOOK.md              ← operational recipes
```

## State Machine

Task transitions are enforced by the harness:

```
pending → in-progress → passed
                      → failed → in-progress (retry, max 3)
                               → skipped
                      → blocked → in-progress (retry)
                                → skipped
```

Every transition is:
1. Validated against allowed transitions
2. Checked for cycle limits
3. Checked for oscillation
4. Written with file lock + nonce
5. Recorded in transition history

## Quality Gates

Gates are shell commands executed by the harness. The agent can't fake results:

```bash
# Run tests as a gate
at-harness gate --cmd "npm test" --dir .team/features/auth --task setup-db

# Output (JSON):
# { "ok": true, "verdict": "PASS", "exitCode": 0, ... }
```

The verdict is written directly to STATE.json with a nonce signature. If the agent manually edits STATE.json, the harness detects the tamper and refuses further operations.

## Testing

```bash
npm test
# Runs 17 tests covering init, transition, gate, notify, finalize, metrics, tamper detection
```

## Project Structure (managed by at)

```
.team/
├── PRODUCT.md          ← vision, users, goals
├── PROJECT.md          ← stack, deploy, gate command
├── AGENTS.md           ← team roles
├── HISTORY.md          ← shipped features log
└── features/
    └── {name}/
        ├── SPEC.md     ← what + why
        └── STATE.json  ← harness-managed state
```

## Self-dogfooding

This repo uses its own `.team/` directory. The v2 product spec lives at `.team/features/v2-product/SPEC.md`.

## License

MIT
