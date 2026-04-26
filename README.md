# agentic-team

CLI + harness + dashboard for autonomous AI agent teams. The human defines direction, agents execute, a harness enforces quality, and a dashboard shows everything.

**v2.1.0** — [npm](https://www.npmjs.com/package/@mengmikeli/agentic-team) · [GitHub Project Board](https://github.com/users/mengmikeli/projects/2)

```
npx @mengmikeli/agentic-team init
```

## Prerequisites

- **Node.js ≥18** (required)
- **gh CLI** — for GitHub integration (`brew install gh`)
- **claude** or **codex** — coding agent CLI (at least one required)
- **pew** — optional, for token usage tracking

## How it works

```
Human: "Build X"
     ↓
  agt init → scaffold project
     ↓
  agt run → autonomous outer loop
     │
     ├─ prioritize (reads PRODUCT.md roadmap)
     ├─ brainstorm → SPEC.md
     ├─ create GitHub issues + project board sync
     ├─ wait for human approval (Ready on board)
     ├─ execute (inner loop):
     │   ├─ plan tasks (or match runbook)
     │   ├─ dispatch coding agent per task
     │   ├─ quality gate (npm test, etc.)
     │   ├─ multi-perspective review (6 roles)
     │   ├─ compound evaluation gate
     │   └─ iterate or advance
     ├─ finalize (merge, close issues, sync board)
     └─ review outcome → next cycle
     ↓
  Human verifies deliverable
```

Two binaries:
- **`agt`** — CLI for humans: init projects, run autonomous execution, check status, view boards, generate reports
- **`agt-harness`** — enforcement layer for agents: tamper-detected state, quality gates, validated transitions

## Quick start

```bash
# Set up a new project
agt init

# Start autonomous execution
agt run

# Check project status
agt status

# View task board
agt board

# Launch web dashboard
agt dashboard

# Health check
agt doctor

# Generate execution report
agt report <feature>
```

## CLI Commands

### `agt init`
Interactive setup wizard. Creates `.team/` with PRODUCT.md, PROJECT.md, AGENTS.md. Sets up GitHub Project board.

### `agt run [description]`
Autonomous execution loop. Reads PRODUCT.md roadmap, picks the highest-priority incomplete item, brainstorms a spec, creates GitHub issues, waits for human approval, executes with quality gates and multi-perspective review, finalizes and syncs project board. Repeats until roadmap is complete.

### `agt status`
Cross-project dashboard in terminal — features, task counts, gate pass rates.

### `agt board [feature]`
Kanban-style task board. Shows tasks grouped by status: pending → in-progress → passed → blocked.

### `agt metrics`
Token usage from [pew](https://github.com/nicepkg/pew) data, git log stats, feature metrics.

### `agt report <feature> [--output md]`
Structured post-run report: what shipped, task summary with titles, cost breakdown (total + per-phase), blocked/failed analysis, actionable recommendations. `--output md` writes REPORT.md.

### `agt stop [feature]`
Pause active features. Run `agt run` to resume.

### `agt log [feature]`
Execution history — transitions, gate results, timing.

### `agt dashboard [port]`
Web dashboard at `http://localhost:3847`. React + shadcn/ui + Recharts. Feature timeline, task board, token breakdown, analytics. Light/dark toggle.

### `agt doctor [--phase] [--fix]`
Health check. Verifies Node.js, tools (gh, claude/codex, pew), `.team/` structure, quality gates, GitHub Project board. `--phase` checks roadmap integrity, stale features, zero-passed completions, orphaned issues.

## Harness Commands

The enforcement layer. Agents call these; output is JSON; state is tamper-detected.

### `agt-harness init --feature <name>`
Create feature state in `.team/features/{name}/STATE.json`.

### `agt-harness gate --cmd <command> --dir <path> [--task <id>]`
Run a quality gate. Exit 0 → PASS, non-zero → FAIL. Writes nonce signature — can't be faked.

### `agt-harness transition --task <id> --status <status> --dir <path>`
Validated state transitions with cycle limits, oscillation detection, file locking.

### `agt-harness notify --event <type> --msg <message>`
Progress events: `feature-started`, `task-passed`, `task-blocked`, `feature-complete`, etc.

### `agt-harness finalize --dir <path> [--strict]`
Validate execution chain, close issues, sync project board to Done. `--strict`: every passed task must have a gate result.

## Architecture

```
agentic-team/
├── bin/
│   ├── agt.mjs              ← CLI entry point
│   ├── agt-harness.mjs      ← harness entry point
│   └── lib/                 ← 27 modules
│       ├── outer-loop.mjs   ← autonomous prioritize → execute → review cycle
│       ├── run.mjs          ← inner loop: plan → dispatch → gate → review
│       ├── review.mjs       ← multi-perspective code review (6 roles)
│       ├── compound-gate.mjs ← substance check on reviews
│       ├── doctor.mjs       ← health checks + phase checks
│       ├── report.mjs       ← execution reports
│       ├── github.mjs       ← GitHub issues + project board sync
│       ├── gate.mjs         ← quality gate execution
│       ├── transition.mjs   ← state machine enforcement
│       └── ...
├── dashboard-ui/            ← React + Vite + shadcn/ui dashboard
├── roles/                   ← review role templates (architect, engineer, security, ...)
├── templates/               ← .team/ file templates
├── test/                    ← 579+ tests (node --test)
├── CHARTER.md               ← methodology reference
└── PLAYBOOK.md              ← operational recipes
```

## Review System

Every task gets reviewed by 6 specialist roles in parallel:
- **Architect** — structure, patterns, scalability
- **Engineer** — correctness, edge cases, performance
- **Product** — spec compliance, user impact
- **Tester** — coverage, test quality
- **Security** — vulnerabilities, input validation
- **Simplicity** — dead code, over-engineering (veto power)

Reviews go through a compound evaluation gate that checks for thin content, missing code references, fabricated references, and aspirational claims.

## Testing

```bash
npm test
# 579 tests, 114 suites, 0 failures
```

## License

MIT
