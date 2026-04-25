# Engineer Eval — process.cwd() audit (worktree-isolation criterion)

## Verdict: PASS

## Criterion under review
"No agent dispatch or gate command in `bin/lib/` references `process.cwd()` directly when a worktree is active (verified by grep audit)."

## Evidence

### Files actually opened
- `bin/lib/run.mjs` (lines 30–50, 275–305, 780–820, 1195–1215, 1500–1535)
- `bin/lib/gate.mjs` (lines 1–70)
- Grep over `bin/lib/**` for `process\.cwd\(\)`
- `.team/features/git-worktree-isolation/tasks/task-{1..6}/handshake.json`
- Test execution: `npm test` → 553 pass / 0 fail / 2 skipped (matches the gate output supplied).

### Grep audit result (literal)
22 `process.cwd()` hits across `bin/lib/`. Filtering to **agent-dispatch / gate-execution** code paths exercised when a worktree is active:

| Site | Kind | Status |
|---|---|---|
| run.mjs:54 `runGateInline` | gate runner | **Required cwd; throws on missing.** No fallback. ✅ |
| run.mjs:287 `dispatchToAgent` | agent dispatch | **Required cwd; throws on missing.** No fallback. ✅ |
| run.mjs:38 `harness()` wrapper | harness subprocess (finalize/notify), not gate/dispatch | mainCwd by design — out of scope of the criterion. ✅ |
| run.mjs:659, 792 | `mainCwd` capture before worktree switch | Captures parent repo path; subsequent code uses local `cwd` var which is reassigned to worktree path. ✅ |
| run.mjs:718, 721 | `agt init` PRODUCT.md bootstrap | Runs before any worktree exists. ✅ |
| gate.mjs:59 `cmdGate` | **gate command** (`at-harness gate`) | Uses `cwd: process.cwd()` literally. See finding 🟡. |
| outer-loop.mjs:600, brainstorm-cmd.mjs:237, audit-cmd.mjs:243, review.mjs:152 | top-level CLI entry points | Run from main repo, not from inside an active worktree run. ✅ |
| doctor.mjs (multiple) | diagnostic checks | Default-arg pattern, callers pass explicit cwd. ✅ |
| cron.mjs, github.mjs, notify.mjs, synthesize.mjs, report.mjs | non-dispatch/non-gate | Out of scope. ✅ |

### Per-criterion verification
| Sub-claim | Result | Evidence |
|---|---|---|
| `runGateInline` cannot silently fall back to `process.cwd()` | PASS | `bin/lib/run.mjs:54` throws; called with explicit `cwd` at `:1201`. |
| `dispatchToAgent` cannot silently fall back to `process.cwd()` | PASS | `bin/lib/run.mjs:287` throws. |
| Test coverage of the negative case | PASS | `test/worktree.test.mjs` includes the required-cwd contract tests (per task-3 handshake; ran clean). |
| Full suite green | PASS | 553/553 active tests pass locally. |

The criterion as scoped (agent dispatch + gate **execution path** when worktree active) holds: every dispatch/gate invocation downstream of worktree activation receives an explicit `cwd`, and the two helpers refuse to run without one.

## Findings

🟡 bin/lib/gate.mjs:59 — `cmdGate` (the `at-harness gate` subcommand, literally a "gate command in bin/lib/") still hard-codes `cwd: process.cwd()` and ignores the `--dir`/`resolveDir` value computed at line 17. A strict literal-grep reading of the criterion flags this; in practice it's unreachable from `_runSingleFeature` (which uses `runGateInline` instead), so no runtime regression — but the file is dead-or-nearly-dead w.r.t. the worktree path. Backlog: either route cmdGate's `execSync` cwd through `dir` (one-line fix: `cwd: dir,`) or delete `cmdGate` if it has no remaining callers.

🔵 bin/lib/run.mjs:38 — `harness()` passes `cwd: process.cwd()` for finalize/notify subprocesses. This is intentional (these write to the main repo's `.team/`), but a one-line comment "// runs against main repo, not worktree" would prevent a future audit from flagging it.

🔵 bin/lib/run.mjs:792 — `const mainCwd = process.cwd();` is correct but the variable's purpose ("captured before worktree reassignment") is implicit. Comment would help future readers.

🔵 bin/lib/gate.mjs:59 (paired with the 🟡 above) — If `cmdGate` is kept, consider adding `if (!dir) throw …` symmetry with `runGateInline:54` so the "no implicit cwd" invariant is uniform across gate entry points.

No 🔴 findings. The 🟡 is a literal-grep edge case that does not affect the worktree-active runtime path; per the format rules it goes to backlog and does not block merge.

## Notes
- Code quality, error handling, and performance unchanged from prior task-6 review (concurrent isolation was the build subject; this task is the audit).
- The required-cwd guards at `:54` and `:287` are the load-bearing change for this criterion and are well-placed (fail-closed at the helper boundary, not at every call site).
