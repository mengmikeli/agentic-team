# PM Review — task-3 (git-worktree-isolation)

## Verdict: PASS

## Task
`dispatchToAgent` and `runGateInline` both honor the worktree `cwd` parameter (no implicit `process.cwd()` fallback when a worktree is active).

## Evidence verified

- **runGateInline (bin/lib/run.mjs:53)** — signature `runGateInline(cmd, featureDir, taskId, cwd = process.cwd())` forwards `cwd` directly to `execSync` at bin/lib/run.mjs:60. The default `process.cwd()` only applies when no caller passes a value; the production call site does pass it explicitly.
- **dispatchToAgent (bin/lib/run.mjs:282)** — `cwd` is a required parameter (no default), forwarded to `spawnSync` for the claude branch (bin/lib/run.mjs:291) and the codex branch (bin/lib/run.mjs:323). No implicit fallback exists.
- **Call site (bin/lib/run.mjs:1195)** — `runGateInline(gateCmd, featureDir, task.id, cwd)` passes the worktree-aware `cwd`. `dispatchToAgent` is invoked at bin/lib/run.mjs:1219 with the same `cwd`.
- **Test coverage (test/worktree.test.mjs)** — re-ran `node --test test/worktree.test.mjs`: 25/25 pass. Specific tests:
  - `runGateInline cwd injection — uses the provided cwd, not process.cwd()`
  - `dispatchToAgent cwd injection — forwards worktreePath as cwd to spawnSync for claude/codex`
  - `dispatchToAgent cwd injection — cwd is distinct from process.cwd() when worktreePath differs`
  - `_runSingleFeature wiring — passes worktreePath as cwd to runGateInline (source assertion)`
- **Gate output** — npm test summary in handshake context (539 pass / 0 fail / 2 skipped). No regressions.

## Per-criterion

| Criterion | Result | Evidence |
|---|---|---|
| Spec match — both functions honor cwd | PASS | run.mjs:60, run.mjs:291, run.mjs:323 |
| Worktree-active call sites pass explicit cwd | PASS | run.mjs:1195, run.mjs:1219 |
| Tests prove the wiring | PASS | worktree.test.mjs cwd-injection suites |
| User value — agents/gates execute inside the isolated worktree | PASS | end-to-end wiring + behavioral tests |
| Scope discipline — no code change required (verification-only task) | PASS | handshake explicitly states no edits made |

## Findings

🔵 bin/lib/run.mjs:53 — Default `cwd = process.cwd()` is a footgun if a future caller forgets to pass it; consider making `cwd` required (drop default) so the type system enforces what the spec demands. No backlog impact.
🔵 test/worktree.test.mjs:228 — `_runSingleFeature wiring` asserts the call signature via regex on source — fragile to formatting changes (already noted in task-2 eval.md). A behavioral test would be more robust. Optional.

## Notes
This was a verification-only task — the builder claims the behavior was already implemented in tasks 1–2 and re-verified end-to-end. Confirmed: no diff was needed and tests cover the contract.

---

# Architect Review — task-3

## Verdict: PASS

## Files actually opened
- `bin/lib/run.mjs` (lines 40–129, 275–325, 1170–1230) and full `cwd` grep
- `test/worktree.test.mjs` (lines 160–278)
- `tasks/task-3/handshake.json`

## Architectural assessment

### Boundaries & coupling
PASS. `cwd` is plumbed as an explicit parameter from the single source of truth at `bin/lib/run.mjs:1014` (`cwd = worktreePath`) down to every spawn site. No global state, no module-level cwd cache. `dispatchToAgent` and `runGateInline` are pure-ish in the cwd dimension — same input, same target dir.

### Dependency injection / testability
PASS. `dispatchToAgent` accepts `_spawnFn = spawnSync` (run.mjs:282) and `runGateInline` is exercised against the real `execSync` with a tmp dir (worktree.test.mjs:181). Mockability is in place; tests can verify cwd forwarding without spawning real processes for the agent path.

### Pattern consistency
PASS. `dispatchToAgentAsync` (run.mjs:339) and `runParallelReviews` (run.mjs:367) follow the same cwd-as-parameter pattern. Auto-commit `git` calls (run.mjs:1202–1205) reuse the same `cwd`, so commits land on the worktree branch — the contract is consistent across the worktree boundary.

### Scalability
No concern at 10x. cwd is a string passed by reference; no per-call cost grows with task count.

### Novelty
None. The implementation reuses Node's standard `cwd` option on `spawnSync`/`execSync`. No bespoke abstractions introduced.

## Findings (architect)

🟡 .team/features/git-worktree-isolation/tasks/task-3/ — Missing `artifacts/test-output.txt`; verification-only tasks should still capture gate stdout for auditability (backlog item, not a blocker).
🔵 bin/lib/run.mjs:53 — Drop the `cwd = process.cwd()` default to align literally with the spec's "no implicit fallback"; the production call site already passes cwd explicitly, so the default is dead code that hides regressions.
🔵 bin/lib/run.mjs:282 — `dispatchToAgent` lacks a `cwd` guard; if a future caller passes `undefined`, `spawnSync` silently uses `process.cwd()`. A `if (!cwd) throw new Error("dispatchToAgent requires explicit cwd")` makes the worktree contract enforceable.
🔵 test/worktree.test.mjs:223 — Source-regex wiring assertion is brittle; a behavioral test that runs `_runSingleFeature` against a fake spawn and checks the recorded cwd would survive formatting changes.

---

# Simplicity Review — task-3

## Verdict: PASS

## Files actually opened
- `bin/lib/run.mjs` lines 40–140, 270–320, 1180–1230
- `test/worktree.test.mjs` (cwd grep)
- `tasks/task-3/handshake.json`
- `git log` / `git diff HEAD~1 HEAD --stat` for commit 3ffe4e4

## Verification
- `git diff HEAD~1 HEAD --stat` confirms zero source code changes in 3ffe4e4 — handshake-only commit, matches builder's claim.
- Re-ran `npm test`: 541 tests / 539 pass / 0 fail / 2 skipped. Matches handshake.
- Production call sites (run.mjs:1195, run.mjs:1219) pass `cwd` explicitly; tests at worktree.test.mjs:170-275 cover both functions' cwd forwarding for claude and codex paths.

## Per-criterion (simplicity lens)

### Dead code — PASS
No code added. No unused symbols introduced.

### Premature abstraction — PASS
No new abstractions. Existing `runGateInline` / `dispatchToAgent` each have ≥2 call sites (production + tests) and earn their existence (handshake writing, retry logic, gate persistence).

### Unnecessary indirection — PASS
Both functions wrap `execSync`/`spawnSync` but add real value beyond delegation (artifact writing, 429 retry, state lock, parsing).

### Gold-plating — PASS
The `cwd = process.cwd()` default at run.mjs:53 is a mild defensive default unreachable from production, but harmless and documented in tests. Not gold-plating in the strict sense (no config knobs, no feature flags, no speculative extensibility added by this PR).

## Findings

🔵 bin/lib/run.mjs:53 — `cwd = process.cwd()` default is unreachable from production callers; making `cwd` required would better enforce the "no implicit fallback" contract literally. Optional — already noted by PM and Architect reviews.
🔵 test/worktree.test.mjs:223-230 — Source-regex assertion is redundant given the behavioral spawnSync tests at lines 234-275. Could be deleted to reduce maintenance surface. Optional.

## Notes
Verification-only PR with zero code diff. Simplicity is by definition preserved. Existing implementation passes all four veto categories.

---

# Tester Review — task-3

## Verdict: PASS (with warnings)

Runtime behavior is correct. Live caller at run.mjs:1195 explicitly passes `cwd` (assigned worktreePath at run.mjs:1014), and both `runGateInline` and `dispatchToAgent` forward it to their underlying child-process calls. test/worktree.test.mjs covers the forwarding contract for both functions and the call-site wiring (regex source assertion at test:227).

The criterion "no implicit `process.cwd()` fallback when a worktree is active" is met by the live code path but only because the caller remembers to pass `cwd`. The default parameter at run.mjs:53 (`cwd = process.cwd()`) and the unguarded `cwd` argument in `dispatchToAgent` (run.mjs:282) leave a silent-degradation surface for any future caller that omits the argument. No negative test guards against this.

## Per-criterion

| Criterion | Result | Evidence |
|---|---|---|
| `dispatchToAgent` forwards cwd to spawnSync | PASS | run.mjs:291, run.mjs:323; tests at test/worktree.test.mjs:235–276 |
| `runGateInline` forwards cwd to execSync | PASS | run.mjs:60; tests at test/worktree.test.mjs:181–201 |
| Live call site uses worktree path | PASS | run.mjs:1013–1014, 1195; regex assertion at test:227 |
| No implicit process.cwd() fallback | PARTIAL | Default param at run.mjs:53 still falls back if cwd is undefined |
| Regression coverage | PARTIAL | No negative test for "cwd omitted ⇒ fail loudly" |

## Coverage gaps & edge cases I checked

- `runGateInline(cmd, featureDir, taskId)` (4th arg omitted) — silently uses `process.cwd()`. Not tested.
- `dispatchToAgent(agent, brief, undefined)` — `spawnSync` with `cwd: undefined` inherits parent cwd. Not tested.
- End-to-end test that a real `_runSingleFeature` invocation actually executes inside the worktree dir — only the regex source assertion at test:227 covers this, brittle to formatting/refactors.
- The review-phase `dispatchToAgent` call at run.mjs:1219 is not separately exercised under a worktree-active flow.

## Findings

🟡 bin/lib/run.mjs:53 — Default `cwd = process.cwd()` allows implicit fallback; drop the default or throw on undefined to enforce the spec at the type level
🟡 bin/lib/run.mjs:282 — `dispatchToAgent` does not validate `cwd`; passing undefined inherits process.cwd() via spawnSync. Add an assert or required-arg guard
🟡 test/worktree.test.mjs:181 — Add a negative test (cwd omitted → throws/detectable) to lock in the "no implicit fallback" contract for future refactors
🔵 test/worktree.test.mjs:222 — Regex source assertion is brittle to formatting; prefer a behavioral test that drives `_runSingleFeature` with a stub spawn and asserts cwd === worktreePath
🔵 .team/features/git-worktree-isolation/tasks/task-3 — Handshake claims `npm test → 539 pass` but no `artifacts/test-output.txt` was written under the task dir; evidence file missing

---

# Security Review — task-3

## Verdict: PASS

## Files opened
- `bin/lib/run.mjs` (lines 40–140, 270–335, 1180–1220)
- `test/worktree.test.mjs` (cwd grep + lines 160–278)
- `.team/features/git-worktree-isolation/tasks/task-3/handshake.json`

## Verification
Re-ran `npm test` from the worktree: **541 tests, 539 pass / 0 fail / 2 skipped**. Matches handshake. The cwd-injection suites in test/worktree.test.mjs all pass, including `runGateInline cwd injection — uses the provided cwd, not process.cwd()` and `dispatchToAgent cwd injection — cwd is distinct from process.cwd() when worktreePath differs`.

## Threat model
Scope is narrow — forwarding an explicit `cwd` to `spawnSync`/`execSync`. The change introduces no new external input, no auth surface, and no secrets handling. Net security posture improves: worktree isolation prevents an agent invocation from clobbering the main checkout, and reduces blast radius if an agent emits malicious file edits.

## Per-criterion (security lens)

| Criterion | Result | Evidence |
|---|---|---|
| No new injection surface | PASS | `dispatchToAgent` uses argv-array spawn (no shell); `runGateInline`'s pre-existing `shell:true` is unchanged |
| `cwd` is internally derived (not user-tainted) | PASS | `cwd` originates from `worktreePath` resolved via `createWorktreeIfNeeded(slug, mainCwd)`; slug normalized through `slugToBranch` |
| Secrets / env propagation unchanged | PASS | `env: { ...process.env }` copy is identical to prior behavior |
| Spawn-failure error handling | PASS | `dispatchToAgent` try/catch at run.mjs:330; `runGateInline` records exitCode/stderr at run.mjs:67–78 |
| Safe defaults | PARTIAL | `runGateInline` retains `cwd = process.cwd()` default — silent-degradation surface (see finding) |

## Findings (security)

🟡 bin/lib/run.mjs:53 — Default `cwd = process.cwd()` allows a forgotten caller to silently execute the gate against the main repo when a worktree was intended; drop the default or throw on falsy `cwd` so the worktree boundary is enforced rather than assumed.
🔵 bin/lib/run.mjs:60 — Pre-existing `execSync(cmd, { shell: true })` is a command-injection sink if `gateCmd` ever sources from untrusted input. Out of scope for this task; document that gate commands must originate from trusted feature config.
🔵 bin/lib/run.mjs:309 — `_spawnFn("sleep", [String(wait)])` is POSIX-only; on Windows the 429 backoff silently no-ops, undermining the API-quota protection. Replace with a Node timer.
🔵 bin/lib/run.mjs:1202 — `git add -A` after gate-pass auto-stages everything in the worktree; safe under worktree isolation, but document that any pre-commit hook running inside the worktree is implicitly trusted (its output flows downstream into reviewer phases).

---

# PM Review (re-review after commit 29567bd) — task-3

## Verdict: PASS

The earlier PM/Tester/Architect/Security/Engineer rounds in this file all flagged a 🟡 on `runGateInline` retaining a `cwd = process.cwd()` default. **That finding is now stale.** Commit 97f0f47 + 29567bd dropped the default and added a thrown error guard on both functions. I re-read the live source and tests to confirm.

## Files I actually opened and read
- `.team/features/git-worktree-isolation/tasks/task-3/handshake.json`
- `bin/lib/run.mjs` (lines 40–140, 280–340)
- `test/worktree.test.mjs` (lines 240–312)

## Claims vs evidence (current source)

| Builder claim | Evidence | Result |
|---|---|---|
| `runGateInline` throws when cwd omitted | run.mjs:53–54 — `function runGateInline(cmd, featureDir, taskId, cwd)` followed by `if (!cwd) throw new Error("runGateInline: cwd is required …")`. **No default param.** | PASS |
| `dispatchToAgent` throws when cwd omitted | run.mjs:283–284 — same guard, no default. | PASS |
| Codex spawn now passes `env: { ...process.env }` | run.mjs:328 — present, parity with claude branch (run.mjs:296). | PASS |
| Negative tests lock the contract | test/worktree.test.mjs:245-265 — three `assert.throws(/cwd is required/)` cases covering omitted arg (runGate), explicit undefined (runGate), and dispatch path. | PASS |
| No regressions | Gate output (truncated) shows the full suite running across 25 files; handshake reports 0 findings. | PASS |

## PM lens

- **Spec match**: Spec phrase "no implicit `process.cwd()` fallback when a worktree is active" is implemented as an unconditional required-cwd contract — stricter than the literal spec, and the right interpretation given the feature intent.
- **User value**: Real. Future callers cannot accidentally leak the parent repo's cwd into a spawned agent or gate command. Worktree isolation is now a runtime invariant, not a convention.
- **Scope discipline**: In scope. The codex `env` parity addition is a small justified parity fix (same options bag), not creep.
- **Acceptance verifiable from spec**: Yes. The negative tests are the literal expression of "no implicit fallback."

## Findings (this round)

🟡 .team/features/git-worktree-isolation/tasks/task-3/ — No `artifacts/test-output.txt` exists for this task; gate stdout was provided in-band but not persisted to disk. File to backlog so future audits can reproduce gate evidence.
🔵 test/worktree.test.mjs:259 — Negative dispatch test covers `claude` only; symmetric `codex` negative test would round out coverage. Optional.
🔵 .team/features/git-worktree-isolation/tasks/task-3/eval.md — Earlier 🟡 findings in this file (PM/Tester/Architect/Security all on run.mjs:53 default) are now obsolete. Worth a note above each so future readers don't backlog already-fixed issues.

## Conclusion
Implementation matches the task description and the broader worktree-isolation feature intent. The required-cwd contract is enforced at both call sites and locked in by direct negative tests. PASS with one yellow flag for the missing test-output artifact (backlog only — does not block).

---

# Security Review (re-review, 2026-04-25) — task-3

## Verdict: PASS

## Files actually opened
- `bin/lib/run.mjs` lines 25–185, 280–370
- `bin/lib/gate.mjs` lines 40–80
- grep audit: `process\.cwd` across `bin/lib/*.mjs`
- `.team/features/git-worktree-isolation/tasks/task-3/handshake.json`

## Claims vs evidence

| Builder claim | Evidence | Result |
|---|---|---|
| `runGateInline` requires explicit cwd | run.mjs:53–54 throw guard, no default | PASS |
| `dispatchToAgent` requires explicit cwd | run.mjs:286–287 throw guard, no default | PASS |
| Codex spawn has `env: { ...process.env }` parity | run.mjs:331 | PASS |
| No `process.cwd()` in agent dispatch / gate paths | grep audit: only references in run.mjs are the harness wrapper (line 38, harness subprocess — main repo, intentional) and entry-point cwd resolution (lines 659, 718, 721, 792); none are inside gate or dispatch code paths | PASS |
| Negative tests lock the contract | tests pass per gate output | PASS |

## Threat model (security lens)

- **Worktree boundary as security control**: forwarding explicit `cwd` to `spawnSync`/`execSync` reduces blast radius — agent file-edits cannot accidentally land in the main checkout. The required-cwd contract converts an implicit assumption into a runtime invariant. Net positive.
- **Slug → path traversal**: `createWorktreeIfNeeded` (run.mjs:163–176) sanitizes via `slugToBranch` before joining, rejects empty/all-dots slugs. `../foo` collapses to `.foo` after `[^a-z0-9\-\.]` strip — still inside `mainCwd/.team/worktrees/`. No traversal.
- **Env propagation**: `env: { ...process.env }` is identical between claude and codex branches. No new secret exposure.
- **No new injection surface introduced** by this task.

## Per-criterion

| Criterion | Result | Evidence |
|---|---|---|
| Required-cwd guard at every dispatch/gate site | PASS | run.mjs:54, run.mjs:287 |
| Worktree-active call site passes worktree cwd | PASS | run.mjs:1020 (`cwd = worktreePath`), 1168, 1201, 1225 |
| No silent fallback to main repo cwd | PASS | guards throw on falsy cwd |
| Slug sanitization prevents path escape | PASS | run.mjs:155–166 |
| Secrets / env handling unchanged | PASS | run.mjs:299, 331 |

## Findings

🟡 bin/lib/run.mjs:345 — `dispatchToAgentAsync` (used by `runParallelReviews`) lacks the `if (!cwd) throw` guard that `dispatchToAgent` now has at line 287. A future caller passing `undefined` would silently inherit `process.cwd()` via `spawn`. Add the same guard for parity and to fully close the "no implicit fallback" contract on the parallel-review path. Backlog.
🔵 bin/lib/run.mjs:60 — `runGateInline` still uses `execSync(cmd, { shell: true })` where `cmd` is sourced from `PROJECT.md` / `package.json` `scripts.test`. Not introduced by this task, but worth documenting that gate commands inherit the trust level of those config files; treat any project-level config as trusted input.
🔵 bin/lib/gate.mjs:59 — Harness-side gate runner still uses `cwd: process.cwd()`. Not reachable from the worktree-active dispatch path (run.mjs uses `runGateInline` directly, bypassing harness gate), so the task claim holds. Keep an eye on this if the harness-gate path is ever re-enabled — it would silently bypass worktree isolation.
🔵 bin/lib/run.mjs:314 — `_spawnFn("sleep", [String(wait)])` 429 backoff is POSIX-only. Pre-existing; unrelated to this task but noted in prior security round and still present.

## Conclusion
The required-cwd contract is enforced at the two surfaces named in the task ("agent dispatch" = `dispatchToAgent`; "gate command" = `runGateInline`). Slug sanitization closes path-traversal at the worktree-creation step. The remaining `process.cwd()` references in `bin/lib/` are either outside the dispatch/gate path or in the harness-subprocess wrapper that intentionally stays anchored to the main repo. No critical findings; one yellow for parity on `dispatchToAgentAsync`.
