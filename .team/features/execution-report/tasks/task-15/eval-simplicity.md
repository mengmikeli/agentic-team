# Simplicity Review — execution-report (task-15)

**Reviewer role:** Simplicity Advocate
**Verdict: PASS**
**Date:** 2026-04-26
**Reviewed commit:** b0d29f9 (HEAD of feature/execution-report)

---

## Files Actually Read

- `bin/lib/report.mjs` (209 lines, full) — production implementation
- `test/report.test.mjs` (800 lines, full) — test suite
- `bin/agt.mjs` — CLI wiring (grep for `report`)
- `bin/lib/state-sync.mjs` (118 lines, full) — verified `closeFeatureIssues` removal
- `bin/lib/util.mjs` — verified `readState` dependency
- `git diff main --name-only` — full file list
- `git diff main` — diffs for `agt.mjs`, `run.mjs`, `outer-loop.mjs`, `doctor.mjs`, `state-sync.mjs`, `dashboard-ui/`
- `.team/features/execution-report/tasks/task-15/handshake.json` — builder claims
- `.team/features/execution-report/tasks/task-14/handshake.json` — prior task
- `.team/features/execution-report/tasks/task-13/handshake.json` — prior task
- `.team/features/execution-report/tasks/task-19/eval.md` — prior tester review
- `.team/features/execution-report/tasks/task-18/eval.md` — prior PM review

---

## Tests Independently Run

```
$ node --test test/report.test.mjs
tests 61  |  suites 2  |  pass 61  |  fail 0  |  duration_ms 279
```

---

## Veto Category Audit

### 1. Dead Code — CLEAR

No dead code found. Specifically verified:
- All 4 functions in `report.mjs` are called: `escapeCell` (line 69), `stripAnsi` (line 167), `buildReport` (line 193, plus tests), `cmdReport` (line 75 in agt.mjs, plus tests)
- All imports used: `existsSync` (line 180), `writeFileSync` (line 198), `basename` (line 172), `join` (line 178), `readState` (line 186)
- Removed code (`closeFeatureIssues`, `runAutoFix`) fully cleaned up — zero dangling references in any `.mjs` file (verified with grep)
- No commented-out code, no unreachable branches

### 2. Premature Abstraction — CLEAR

| Abstraction | Call sites | Justified? |
|------------|-----------|------------|
| `buildReport(state)` | 2+ (production line 193, 42 unit tests) | Yes — separates pure logic from CLI IO, enabling unit testing without mocks |
| `cmdReport(args, deps)` | 2+ (CLI wiring line 75, 19 unit tests) | Yes — entry point |
| `escapeCell(text)` | 1 (line 69) | Borderline — but it's a 2-expression security helper, not an abstraction layer. Inlining would hurt readability of the table-building loop. Not blocking. |
| `stripAnsi(str)` | 1 (line 167) | Borderline — 1-line regex with a defensive-security purpose. The name documents intent better than an inline regex. Not blocking. |

No interfaces with single implementations. No abstract base classes. No factory patterns.

### 3. Unnecessary Indirection — CLEAR

- The `deps` parameter in `cmdReport` (7 fields) is the only indirection. Each field is used at least once:
  - `readState` → line 186
  - `existsSync` → line 180
  - `writeFileSync` → line 198
  - `stdout` → lines 204, 206
  - `stderr` → lines 161, 167, 173, 181, 189, 200
  - `exit` → lines 162, 169, 175, 183, 191, 201
  - `cwd` → line 178
- No wrapper-only functions. No re-exports. No delegation without transformation.

### 4. Gold-plating — CLEAR

| Suspect | Verdict | Reasoning |
|---------|---------|-----------|
| `--output md` flag | Not gold-plating | Core feature per task description; tested e2e |
| Recommendations section (4 rules) | Not gold-plating | Each rule triggers on real STATE.json data (attempts, gateWarningHistory, status). No speculative rules. |
| `"N/A (see \`agt metrics\`)"` fallback | Not gold-plating | Helpful guidance when cost data is absent |
| Per-phase cost split | Not gold-plating | Natural extension of cost breakdown using existing `tokenUsage.byPhase` data |
| Path traversal validation | Not gold-plating | Security requirement — prevents directory escape via `../../etc` |

No config options with only one value. No feature flags. No speculative extensibility.

---

## Complexity Metrics

| Metric | Value | Assessment |
|--------|-------|------------|
| Production lines | 209 | Lean |
| Functions | 4 (2 exported, 2 internal) | Right-sized |
| Report sections | 6 (header, shipped, summary, cost, blocked, recs) | Each earns its keep |
| Max nesting depth | 3 (for loop → if → string template) | Low cognitive load |
| Dependencies | 3 (`fs`, `path`, `./util.mjs`) | Minimal |
| Test lines | 800 | 3.8:1 ratio — thorough without bloat |
| Test count | 61 (42 buildReport + 19 cmdReport) | Good coverage |

---

## Scope Observation (non-blocking)

This PR includes changes beyond the report feature:
- Removed `closeFeatureIssues` from `state-sync.mjs`, `run.mjs`, `outer-loop.mjs`
- Removed `runAutoFix` from `doctor.mjs` and its call from `outer-loop.mjs`
- Removed `--model` flag from claude spawn in `run.mjs` (2 call sites)
- Removed stale loop-status clearing in `agt.mjs`
- Dashboard tweaks (favicon path, title, loop-status styling)

All of these are simplifications (net -97 lines of production code removed). From a simplicity lens, these are positive. But they're out-of-scope for "add `agt report`" — noting for process awareness, not blocking.

---

## Findings

🔵 bin/lib/report.mjs:148 — The `featureName` extraction uses a complex `args.find()` predicate: `args.find((a, i) => !a.startsWith("-") && !(outputIdx !== -1 && i === outputIdx + 1))`. Consider a 3-line loop for readability.

🔵 bin/lib/report.mjs:42-45 — The status label mapping has three identity branches (`"completed" → "completed"`, etc.). Could simplify to `const statusLabel = ["completed", "failed", "blocked"].includes(status) ? status : "run in progress"`. Current form is fine for readability — just more verbose.

---

## Summary

The `report.mjs` implementation is clean, minimal, and appropriately scoped. 209 lines of production code with 4 functions, no dead code, no premature abstractions, no unnecessary indirection, and no gold-plating. The `buildReport`/`cmdReport` split correctly separates pure logic from IO. The dependency injection pattern in `cmdReport` uses exactly 7 injectables, all of which are exercised. The test suite (61 tests, 800 lines) is thorough without being bloated — each test covers a distinct behavior path.

No 🔴 critical findings. Two 🔵 suggestions for minor readability improvements. Both are optional.

**Overall verdict: PASS**
