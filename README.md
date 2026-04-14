# agentic-team

CLI + harness + dashboard for autonomous AI agent teams. The human defines direction, agents execute, a harness enforces quality, and a dashboard shows everything.

```
npm install -g @mengmikeli/agentic-team
```

## How it works

```
Human: "Build X"
     ↓
  agt init → scaffold project
     ↓
  agt run → autonomous loop
     │
     ├─ brainstorm → SPEC.md
     ├─ plan tasks
     ├─ dispatch subagents
     ├─ agt-harness gate (quality checks)
     ├─ agt-harness transition (state management)
     ├─ agt-harness notify (progress updates)
     └─ agt-harness finalize (validate chain)
     ↓
  Human reviews PR
```

Two binaries:
- **`at`** — CLI for humans: init projects, check status, view boards
- **`agt-harness`** — enforcement layer for agents: tamper-detected state, quality gates, validated transitions

## Quick start

```bash
# Set up a new project
agt init

# Check project status
agt status

# View task board
agt board

# See token usage + git stats
agt metrics

# Start the web dashboard
agt dashboard
```

## CLI Commands

### `agt init`
Interactive setup wizard. Creates `.team/` with PRODUCT.md, PROJECT.md, AGENTS.md.

### `agt status`
Cross-project dashboard in terminal — features, task counts, gate pass rates.

### `agt board [feature]`
Kanban-style task board. Shows tasks grouped by status: pending → in-progress → passed → blocked.

### `agt metrics`
Token usage from [pew](https://github.com/mengmikeli/pew) data, git log stats, feature metrics. Includes a contribution-graph style heatmap.

### `agt run [description]`
Autonomous execution loop *(phase 2 — currently prints the execution plan)*.

### `agt stop [feature]`
Pause active features. Run `agt run` to resume.

### `agt log [feature]`
Execution history — transitions, gate results, timing.

### `agt dashboard [port]`
Serves the web dashboard at `http://localhost:3847` (default port). Shows overview cards, feature timeline, task board, and metrics.

## Harness Commands

The enforcement layer. Agent calls these; output is JSON; state is tamper-detected.

### `agt-harness init --feature <name>`
Create feature state in `.team/features/{name}/STATE.json`.

### `agt-harness gate --cmd <command> --dir <path> [--task <id>]`
Run a quality gate. Execute the command, capture exit code + output, write verdict.
- Exit 0 → PASS, non-zero → FAIL
- Writes nonce signature — can't be faked by agent editing STATE.json

### `agt-harness transition --task <id> --status <status> --dir <path>`
Validated state transition with safety guards:
- Checks allowed transitions (pending → in-progress → passed/failed)
- Enforces cycle limits (max 3 retries per task)
- Detects oscillation (A→B→A→B pattern)
- Idempotency guard (dedup within 5s window)
- File locking for concurrent safety

### `agt-harness notify --event <type> --msg <message> [--channel <target>]`
Dispatch progress events. Events: `feature-started`, `task-started`, `task-passed`, `task-failed`, `task-blocked`, `progress`, `anomaly`, `feature-complete`.

### `agt-harness finalize --dir <path> [--strict]`
Validate the entire execution chain before marking a feature complete:
- All tasks must be passed or skipped
- No unapproved state edits (nonce check)
- `--strict`: every passed task must have a gate result

### `agt-harness metrics --dir <path>`
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
│   ├── agt-harness.mjs      ← harness entry point
│   └── lib/
│       ├── util.mjs         ← nonce, file lock, atomic write, ANSI
│       ├── init.mjs         ← agt init (interactive)
│       ├── run.mjs          ← agt run (phase 2 stub)
│       ├── status.mjs       ← agt status (terminal dashboard)
│       ├── board.mjs        ← agt board (task board)
│       ├── metrics.mjs      ← agt metrics (pew + git)
│       ├── stop.mjs         ← agt stop (pause features)
│       ├── log.mjs          ← agt log (history viewer)
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
agt-harness gate --cmd "npm test" --dir .team/features/auth --task setup-db

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
