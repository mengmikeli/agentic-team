# Engineer Review — task-3 (git-worktree-isolation)

## Verdict: PASS

## Task
`dispatchToAgent` and `runGateInline` both honor the worktree `cwd` parameter (no implicit `process.cwd()` fallback when a worktree is active).

## Files actually opened
- `bin/lib/run.mjs` (lines 40–151, 275–335, 1075–1095)
- `bin/lib/review.mjs` (cwd grep)
- `bin/lib/outer-loop.mjs` (cwd grep)
- `bin/lib/brainstorm-cmd.mjs` (cwd grep)
- `test/worktree.test.mjs` (diff + grep)
- `git diff HEAD~3 HEAD -- bin/lib/run.mjs test/worktree.test.mjs`
- `.team/features/git-worktree-isolation/tasks/task-3/handshake.json`

## Implementation correctness

- **`runGateInline` (run.mjs:53–54)** — default `cwd = process.cwd()` was removed; explicit `if (!cwd) throw` guards entry. The `cwd` is forwarded directly to `execSync` at line 60–61. Correct.
- **`dispatchToAgent` (run.mjs:283–284)** — same guard pattern. `cwd` is forwarded to both the `claude` (line 293) and `codex` (line 325) `spawnSync` invocations. Both branches now also pass `env: { ...process.env }` (claude:296, codex:328), achieving the parity claimed in the handshake.
- **All call sites pass an explicit `cwd`** — verified via grep:
  - `run.mjs:1085, 1165, 1198, 1222, 1410, 1460` — uses local `cwd` var (worktreePath when active, `process.cwd()` otherwise).
  - `review.mjs:202, 214` — uses `cwd = process.cwd()` from `cmdReview` scope.
  - `outer-loop.mjs:676, 750, 876` — `cwd = process.cwd()` at line 600.
  - `brainstorm-cmd.mjs:254` — `cwd = process.cwd()` at line 237.
- No call site relies on the removed default. The contract is testable and tested.

## Tests / evidence
- `npm test` → 544 tests, 542 pass, 0 fail, 2 skipped (32.5s). Re-ran during this review.
- New negative-path tests (`test/worktree.test.mjs:235–266`) cover:
  - `runGateInline` throws when `cwd` omitted (positional null arg)
  - `runGateInline` throws when `cwd` is explicitly `undefined`
  - `dispatchToAgent` throws when `cwd` is `undefined`
- All three pass.

## Code quality / error handling

- The `if (!cwd) throw` form is concise and correctly rejects `undefined`, `null`, and `""`. An empty string is also a sensible reject (callers should never legitimately pass it).
- Error messages are explicit and grep-able.
- `env: { ...process.env }` shallow-copies the parent env into both spawns — consistent with `harness()` at run.mjs:40.
- Outer `try/catch` (run.mjs:333) still wraps both branches, but the contract `throw` happens *before* the `try`, so it propagates synchronously to the caller — intended fail-fast behavior.

## Per-criterion

| Criterion | Result | Evidence |
|---|---|---|
| `runGateInline` honors `cwd`, no implicit fallback | PASS | run.mjs:53–61, test:247–256 |
| `dispatchToAgent` honors `cwd`, no implicit fallback | PASS | run.mjs:283–328, test:260–266 |
| All call sites pass an explicit `cwd` | PASS | grep across run/review/outer-loop/brainstorm-cmd |
| Negative tests prove the contract | PASS | worktree.test.mjs:235–266 (3 new tests, all pass) |
| Full test suite still green | PASS | 542 pass / 0 fail / 2 skipped |
| Codex/claude env parity | PASS | run.mjs:296 and 328 |
| No obvious inefficiencies | PASS | guards are O(1) |

## Findings

🔵 bin/lib/run.mjs:284 — Consider tightening to `if (typeof cwd !== "string" || !cwd)` so a numeric/object accidentally passed is rejected with the same error rather than silently accepted by `spawnSync`. Optional.
🔵 test/worktree.test.mjs:262 — `dispatchToAgent` negative test only covers the `claude` agent path; symmetric `codex` coverage would harden the contract, though the guard runs before the agent branch so behavior is identical. Optional.

## Notes
Small, surgical change with strong test coverage. The contract is enforced at the function boundary, all production call sites comply, and the full suite is green. No blocking issues.
