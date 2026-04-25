# Engineer review — task-5: preserve worktree on thrown error

## Verdict: PASS

## Evidence

### Files opened
- `bin/lib/run.mjs` (lines 1005–1530, around the run lifecycle)
- `test/worktree.test.mjs` (added "worktree preserved on thrown error" suite)
- `git diff HEAD~2 -- bin/lib/run.mjs test/worktree.test.mjs`

### Verified behavior
- The outer wrapping `try` opens at `bin/lib/run.mjs:1022` and the new `catch (err)` lands at `bin/lib/run.mjs:1524`. The catch logs preservation and rethrows without calling `removeWorktree`.
- The success-path `removeWorktree(worktreePath, mainCwd)` was moved out of the previous `finally` to `bin/lib/run.mjs:1530`, executed only when the try block completes without throwing — confirmed by reading the control flow.
- `createWorktreeIfNeeded` (`bin/lib/run.mjs:164–172`) short-circuits when the directory already exists and does not invoke `git worktree add`, so a re-invocation after a preserved worktree resumes in place.
- Worktree creation failure path (`bin/lib/run.mjs:1015–1020`) throws before `worktreePath` is assigned, so the outer cleanup logic correctly skips removal (worktreePath remains `null`).
- Ran `node --test test/worktree.test.mjs`: 32/32 pass, including the three new assertions covering (a) no `finally`, (b) catch+rethrow shape, (c) reuse-on-existing-dir.

### Edge cases checked
- Worktree dir present but partially populated: `createWorktreeIfNeeded` only checks `existsSync`; reuse is path-based, not state-validated. Acceptable for this task — recovery semantics are out of scope.
- `process.exit` / SIGINT mid-run: bypasses the catch but worktree still remains (no `finally`). Matches the desired "preserve on abnormal exit" behavior.
- Push failure (`bin/lib/run.mjs:1515–1519`) is locally swallowed and does not propagate, so a push failure does not erroneously trigger the preservation path. Pre-existing behavior, unchanged.

## Findings

🔵 bin/lib/run.mjs:1521 — Comment "Remove worktree now that execution completed successfully" sits immediately above the `} catch`, while the actual `removeWorktree` call is below the catch at line 1530. Move the comment next to the call (or split into two comments) for readability.
🔵 test/worktree.test.mjs:362 — Regex `/}\s*finally\s*{[^}]*removeWorktree\s*\(/` will match the substring anywhere in the file; if any unrelated `finally { removeWorktree(...) }` is added later (legitimately, e.g. for a separate cleanup), this test will fail. Consider scoping the assertion to the `_runSingleFeature` body, or asserting behavior via a mocked exec instead.
🔵 test/worktree.test.mjs:371 — Test couples to the exact log substring "preserving worktree". A behavioral test (invoke `_runSingleFeature` with a mock that throws and assert `removeWorktree` was not called) would be more robust than three source-regex assertions.

No critical or warning-level issues — implementation is correct, minimal, and matches the task spec.

---

# Security review — task-5

## Verdict: PASS (with backlog items)

## Files opened
- `bin/lib/run.mjs:153-179` (worktree helpers) and `bin/lib/run.mjs:1009-1530` (run lifecycle).
- `.team/features/git-worktree-isolation/tasks/task-5/handshake.json`.
- Gate output (test runner included `test/worktree.test.mjs`).

## Claim verification
- catch+rethrow at `bin/lib/run.mjs:1524-1528`: log only prints `worktreePath`, then `throw err` rethrows the original error unchanged — no swallowing, no secret exposure.
- success-only `removeWorktree(worktreePath, mainCwd)` at `bin/lib/run.mjs:1530`.
- reuse path at `bin/lib/run.mjs:166-169`: `existsSync(worktreePath)` short-circuits.
- subprocess calls (lines 170, 177) use `execFileSync` with array argv — no shell interpolation, immune to shell metacharacter injection in slug or path.

## Per-criterion (security)
| Criterion | Result | Evidence |
|---|---|---|
| Original error rethrown intact | PASS | `bin/lib/run.mjs:1528` rethrows `err` without wrapping. |
| No secret/credential leaked in preservation log | PASS | Log message only contains the local filesystem path. |
| Subprocess calls use argv form | PASS | `execFileSync("git", [...])` at lines 170, 177. |
| Catch block side effects | PASS | Only logs and rethrows; no state mutation. |
| Reuse-of-existing-dir is safe | WARNING | `existsSync` does not validate the directory is actually a git worktree — a stale or pre-planted directory is silently honoured. |
| Path traversal via slug | WARNING (pre-existing) | `bin/lib/run.mjs:164` uses raw `slug` in `join(...)`, while only the branch name is sanitized via `slugToBranch` at line 165. |

## Findings

🟡 bin/lib/run.mjs:166 — Reuse path treats any existing directory at `.team/worktrees/<slug>` as a recoverable worktree. Validate it is actually a worktree (e.g. check `existsSync(join(worktreePath, ".git"))` or parse `git worktree list --porcelain`) before reusing.
🔵 bin/lib/run.mjs:164 — Pre-existing: slug is interpolated directly into a filesystem path while the branch name uses `slugToBranch`. A slug containing `..` or path separators would escape `.team/worktrees/`. Apply the same sanitizer to the directory path. The new reuse-on-retry semantics make this more impactful.
🔵 bin/lib/run.mjs:1526 — Preservation log omits `err.message`. Including a one-line summary of the failure (no stack) would make it easier to correlate which failure left a worktree behind without re-running with verbose logging.

## Calibration note
Threats are local-filesystem only; this is a developer tool invoked on the user's own checkout. Slug values come from feature/task config rather than untrusted network input, so the path-traversal warning is realistic only for a repo where an attacker can already control feature config — but it remains a cheap-to-fix defence-in-depth gap and now interacts with the persistent worktree behaviour.

---

# Architect review — task-5

## Verdict: PASS

## Files opened
- `bin/lib/run.mjs:163-180` (worktree helpers) and `bin/lib/run.mjs:1009-1540` (run lifecycle).
- `test/worktree.test.mjs:349-394` (new "worktree preserved on thrown error" suite).
- `git diff cac8f22~1 5601a21 -- bin/lib/run.mjs test/worktree.test.mjs`.
- Full `npm test` run: 546 pass / 0 fail.

## Per-criterion (architecture)
| Criterion | Result | Evidence |
|---|---|---|
| Symmetric lifecycle (create ↔ teardown) | PASS | Create at L1016, teardown at L1530 — both gated on `worktreePath`. |
| Failure mode is a single, explicit branch | PASS | Sole `catch` at L1524-1528 rethrows; no hidden cleanup paths. |
| No new module boundaries / dependencies | PASS | Pure refactor of existing control flow inside `_runSingleFeature`. |
| Reuse semantics are explicit at the boundary | WEAK | `createWorktreeIfNeeded` (L163-172) does presence-only reuse; nothing distinguishes "preserved-from-failure" from "stale leftover from an unrelated abort". Acceptable for v1, flagged. |
| Pattern reuse over novelty | PASS | catch+rethrow is idiomatic; matches the existing pattern at L1018-1020. |

## Architectural observations
The shape `try { … } catch (err) { log; throw err; } cleanup();` correctly inverts the previous `finally`-coupled lifecycle. It is structurally simple — one entry, one exit, one error branch — and the success-vs-failure semantics are now explicit. The reuse path piggy-backs on `createWorktreeIfNeeded` which already had the `existsSync` short-circuit, so no new abstraction was introduced. This is good: the change earns its keep without adding surface area.

The main long-term smell is that "preserved worktree" is an *implicit* state inferred from "directory still on disk." There is no marker, no provenance, no TTL. At 10x usage (multiple parallel features, CI runners reusing checkouts) this collapses to a directory that nobody can confidently delete. Not blocking now — flag for backlog.

## Findings

🟡 bin/lib/run.mjs:163-172 — Reuse is presence-only. After this change, a leftover worktree dir is now a load-bearing piece of recovery state. Consider writing a small marker (e.g. `.team/worktrees/<slug>/.run-aborted` containing runId + timestamp) on the catch path, and only honouring the reuse short-circuit when the marker exists. Also unblocks a future `agt cleanup` command.
🟡 bin/lib/run.mjs:1487-1492 — Oscillation `break` exits the loop normally and falls through to `removeWorktree`, so the 3-block "systemic issue" path destroys exactly the state an operator would want to inspect. Either treat this as an error (throw, so preservation fires) or skip teardown explicitly when `blocked >= 3`.
🔵 bin/lib/run.mjs:1022 — The body try block now spans ~500 lines and has no `return` statements, but a future contributor adding an early `return` would silently leak the worktree (since cleanup is post-catch, not in `finally`). A one-line comment at the try opener documenting "do not early-return — cleanup runs after the catch" would prevent the regression cheaply.
🔵 bin/lib/run.mjs:1521-1523 — Comment "Remove worktree now that execution completed successfully" sits above the `} catch` rather than next to the actual `removeWorktree(...)` call at L1530. Already noted by the engineer reviewer; agreeing for clarity.
🔵 test/worktree.test.mjs:355-371 — Two of the three new tests are source-regex tripwires. They are useful as a guard against the specific regression, but a behavioural test that injects a throwing dispatch into `_runSingleFeature` and asserts `removeWorktree` is not called would survive future refactors. Backlog only.
