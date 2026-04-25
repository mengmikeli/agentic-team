# Security Review — task-2

## Verdict: PASS

## Files Reviewed (actually read)
- `bin/lib/run.mjs` lines 920–946 (the changed hunk and surrounding context)
- `test/cli-commands.test.mjs` lines 262–280 (the new regression test)
- `.team/features/document-driven-development/tasks/task-2/handshake.json`
- Diff at commit `164e702` confirmed: 21 lines removed, 13 added in run.mjs; 13 added in tests.

## Claim Verification
- Handshake claims: replace auto-stub with a hard error naming the missing path and pointing at `agt brainstorm`, plus a regression test.
- `bin/lib/run.mjs:932-935` does exactly this: prints the resolved `specPath`, prints a guidance line, prints `agt brainstorm <featureName>`, then `process.exit(1)`.
- Test at `test/cli-commands.test.mjs:265` invokes `agt run my-feature` in a tmp workspace with no SPEC.md and asserts non-zero exit + presence of `"SPEC.md"` and `"agt brainstorm"` in output.
- Gate output (truncated) shows the suite running cleanly through `cli-commands.test.mjs` including new and existing cases.

## Per-Criterion Results (Security lens)

| Criterion | Result | Evidence |
|---|---|---|
| No new untrusted input sinks | PASS | The change *removes* a `writeFileSync(specPath, specContent)` path. Net: one fewer write site, no new sink. |
| Output safe | PASS | `specPath` and `featureName` are echoed to stdout only via `console.log`. No shell exec, no `eval`, no template injection target. |
| Exit-code semantics correct | PASS | `process.exit(1)` happens before `planTasks`/`outerLoop`, so an absent spec cannot trigger downstream filesystem or LLM calls. Fail-closed. |
| Secrets handling | N/A | No credentials, tokens, or env vars touched. |
| Auth / access control | N/A | Local CLI; no auth surface. |
| Input validation | PASS (unchanged) | `featureName` validation (path traversal, shell metacharacters) is a pre-existing concern outside this diff. The change does not widen that surface — in fact, it narrows it by removing a `mkdirSync(featureDir, { recursive: true })` + `writeFileSync` that would have created attacker-controlled directories under `.team/features/`. |

## Threat Model
- **Adversary**: a malicious CLI argument (`agt run "../../../etc/passwd"` style).
- **Before**: the missing-spec branch called `mkdirSync(featureDir, { recursive: true })` and `writeFileSync(specPath, specContent)`. If `featureName` resolved upward, this could create directories/files outside `.team/features/`.
- **After**: the missing-spec branch only `console.log`s and exits. No filesystem write. The pre-existing `existsSync(specPath)` check remains, but the dangerous write path is gone. **Net security improvement.**
- **Adversary**: prompt-injection via `featureName` echoed in `console.log`. Stdout is not interpreted; ANSI sequences in `featureName` could distort terminal output but this is a pre-existing terminal-escape concern, not introduced here, and not exploitable for code execution.

## Edge Cases Checked
1. `specPath` interpolated into `console.log` — not passed to a shell. Safe.
2. `featureName` interpolated into `console.log` after `${c.bold}` — same. Safe.
3. Race: `existsSync` then `readFileSync` is a benign TOCTOU on the read side; no write follows. Failure mode of a deleted-between-checks file would surface as a normal `ENOENT` throw, which is acceptable for a local CLI.
4. The test runs without a real SPEC.md and asserts exit-non-zero — confirms fail-closed behavior is reachable through the CLI surface, not just the function.
5. Behavior reversal: the prior auto-stub silently swallowed a missing spec. That is *less* secure (silent state mutation under attacker-controlled `featureName`); the new behavior is strictly tighter.

## Findings
No findings.

🔵 bin/lib/run.mjs:932 — Optional: consider routing the error lines through `console.error` (stderr) rather than `console.stdout` so callers piping stdout don't mix the failure message with normal output. Cosmetic, not a security issue.

---

# PM Review — task-2

## Verdict: PASS

## Task
`agt run my-feature` with no `SPEC.md` exits non-zero with a message naming the missing file and pointing at `agt brainstorm`.

## Files Read
- `bin/lib/run.mjs` (full file, focused on lines 925–937)
- `test/cli-commands.test.mjs` lines 255–278
- `.team/features/document-driven-development/tasks/task-2/handshake.json`

## Claim Verification (against handshake)
Handshake summary claims: replace auto-stub with hard error naming missing SPEC.md + point at `agt brainstorm`, plus regression test.
- `bin/lib/run.mjs:927-936` implements all three:
  - Names the file: `console.log(`✗ Missing SPEC.md: ${specPath}`)` (line 932)
  - Points at brainstorm: `Run: agt brainstorm ${featureName}` (line 934)
  - Non-zero exit: `process.exit(1)` (line 935)
- `test/cli-commands.test.mjs:266-277` regression test exists and asserts all three.

## Verification Run
Executed `node --test test/cli-commands.test.mjs` in worktree:
- New test "agt run with no SPEC.md exits non-zero and points at agt brainstorm" — PASS
- Suite total: 37/37 pass, 0 fail.

## Per-Criterion Results (PM lens)

| Criterion | Result | Evidence |
|---|---|---|
| Spec is testable & verified | PASS | Test asserts the three observable behaviors required by the spec. |
| User value | PASS | Replaces silent auto-stub (which let users blunder past the document-driven workflow) with a clear, actionable error. Aligns with the feature's intent: "approved spec before code is written." |
| Acceptance criteria met from spec alone | PASS | All three criteria (non-zero exit, names file, points at brainstorm) are independently verifiable. |
| Scope discipline | PASS | Diff is tightly scoped to the missing-spec branch. No unrelated copy/UX changes piggybacked on. |
| Error message quality | PASS | Three lines: what's missing (with path), why it matters, what to do next. Good UX. |

## Edge Cases Considered
1. Feature dir doesn't exist yet — `existsSync(specPath)` correctly returns false; flow still exits cleanly. (The earlier harness `init` step creates the dir but not SPEC.md.)
2. SPEC.md exists but is empty — falls through to read path; not part of this task.
3. Mode 2 (no description, picks from roadmap) — same `specPath` check applies after `featureName` is resolved from roadmap. The error line `agt brainstorm ${featureName}` will use the roadmap-derived slug, which is correct.

## Findings

🔵 bin/lib/run.mjs:932 — (Already noted by security reviewer) Consider `console.error` for the failure lines so stdout/stderr separation is clean. Non-blocking.

No backlog items. No critical issues.

---

# Architect Review — task-2

## Verdict: PASS

## Files Read
- `bin/lib/run.mjs` lines 920–949 (the changed hunk + surrounding context)
- `test/cli-commands.test.mjs` lines 262–280 (new regression test)
- `.team/features/document-driven-development/tasks/task-2/handshake.json`
- Diff at commit `164e702` (run.mjs: -21/+13; cli-commands.test.mjs: +13)

## Verification Run
- `node --test test/cli-commands.test.mjs` → 37/37 PASS, 0 fail. The new
  case "agt run with no SPEC.md exits non-zero and points at agt brainstorm"
  is among the green tests.

## Claim Verification (Architecture lens)
- Handshake claims a localized change in `_runSingleFeature` (run.mjs) plus a
  test. Confirmed: only one branch is rewritten (run.mjs:929–936) and the
  unused `PRD_SECTIONS` import was removed (run.mjs imports diff). No new
  modules, no new dependencies, no new abstractions introduced.
- Grepped `bin/lib/` for other `specPath` / `SPEC.md` consumers
  (brainstorm-cmd, outer-loop, status, replan, context, audit-cmd). None
  depended on `agt run` auto-stubbing SPEC.md. The boundary is clean:
  `brainstorm` writes the spec, `run` reads it.

## Per-Criterion Results

| Criterion | Result | Evidence |
|---|---|---|
| Component boundaries respected | PASS | One responsibility moved out of `run` (spec authoring) so `run` is now read-only against SPEC.md. Tightens separation between brainstorm (writer) and run (reader). |
| No unjustified new dependencies | PASS | None added; one removed (`PRD_SECTIONS` import). |
| Pattern consistency | PASS | `process.exit(1)` after a printed error matches five other exits in `run.mjs`. No novel error-handling shape introduced. |
| Scalability / future-proofing | PASS | Fail-fast is strictly cheaper at scale than the prior auto-stub which created directories and wrote files on the hot path. |
| Cross-cutting concerns | N/A | No auth, caching, or shared infra touched. |
| Modularity at >3 modules | N/A | Change touches 1 source + 1 test. Architect review is borderline applicable; included for completeness. |

## Edge Cases Checked
1. Mode 2 (`agt run` with no args, picks from roadmap) — `featureName` is
   resolved earlier; the same `specPath` check at run.mjs:927 applies and
   the error message will print the roadmap-derived slug. Coherent.
2. Test isolation — the new test sets up a fresh tmpDir with PRODUCT/PROJECT/
   AGENTS.md but no SPEC.md, exercising the gate via the real CLI rather
   than poking the function directly. Good integration coverage at the
   right boundary.
3. Backward compatibility — callers that previously relied on auto-stub now
   fail loudly. This is an intentional behavior change documented in the
   commit message and matches the feature's spec, so it is correct, not
   regressive.

## Findings

🔵 bin/lib/run.mjs:932 — Optional: emit the failure block via `console.error` (stderr) rather than stdout, so machine-piped stdout consumers see a clean stream. Cosmetic, already raised by prior reviewers.
🔵 .team/features/document-driven-development/tasks/task-2 — No `artifacts/test-output.txt` was captured by the builder. Future handshakes should drop the `node --test` log under `artifacts/` for traceability. Process nit, not a code issue.

No critical or warning findings. PASS.
---

# Engineer Review — task-2

## Verdict: PASS

## Files actually opened
- `bin/lib/run.mjs` lines 920–945 (current state on `feature/document-driven-development`)
- `test/cli-commands.test.mjs` lines 260–280 (the new regression test)
- `.team/features/document-driven-development/tasks/task-2/handshake.json`
- Diff at commit `164e702` (`bin/lib/run.mjs`, `test/cli-commands.test.mjs`)

## Verification I ran
```
node --test test/cli-commands.test.mjs
✔ agt run with no SPEC.md exits non-zero and points at agt brainstorm (106.7ms)
tests 37  pass 37  fail 0
```

## Per-criterion (engineer lens)

| Criterion | Result | Evidence |
|---|---|---|
| Non-zero exit | PASS | `process.exit(1)` at run.mjs:935; test asserts `result.ok === false`. |
| Names the missing file | PASS | `console.log(\`✗ Missing SPEC.md: ${specPath}\`)` prints the full resolved path. |
| Points at `agt brainstorm` | PASS | Literal `Run: agt brainstorm ${featureName}` printed; test asserts substring. |
| Removes auto-stub cleanly | PASS | Old `sectionBodies` / `mkdirSync` / `writeFileSync` block deleted; the now-unused `import { PRD_SECTIONS }` is also removed — no dead code. |
| Test isolation | PASS | Test seeds `.team/PRODUCT.md`, `PROJECT.md`, `AGENTS.md` in a tmp dir so the missing-spec branch is the failure being measured, not init. |
| Code quality | PASS | Three short `console.log`s + `process.exit(1)`. Readable, no over-engineering. |

## Edge cases I checked
- `featureName` is resolved earlier in `_runSingleFeature`, so the brainstorm hint always interpolates a concrete slug (also valid for the roadmap-pick path).
- Removing `mkdirSync(featureDir, …)` is safe — no later code in the missing-spec branch depends on it; we exit immediately.
- The `existsSync(specPath)` happy path is untouched; runs that already have SPEC.md are unaffected (covered implicitly by the rest of the green suite).
- Test asserts on `result.stdout + result.stderr`, so the optional stderr suggestion below would not break it.

## Findings

🔵 bin/lib/run.mjs:932 — (Same as security/PM suggestion.) Prefer `console.error` for the three failure lines so stderr/stdout split matches the non-zero exit. Optional, not blocking.

No 🔴 or 🟡 findings. Handshake claims match the code; the regression test passes locally.

---

# Tester Review — task-2

## Verdict: PASS

## Files Reviewed (actually opened)
- `bin/lib/run.mjs:920-946` (changed block + surrounding context)
- `test/cli-commands.test.mjs:255-278` (new regression test in context)
- `.team/features/document-driven-development/tasks/task-2/handshake.json`
- Git diff for commit `164e702`
- Gate output (test runner mid-stream)

## Claim Verification
Handshake claims a hard non-zero exit on missing SPEC.md plus a regression test. Verified at `bin/lib/run.mjs:929-936` (prints path, points at `agt brainstorm`, `process.exit(1)`) and `test/cli-commands.test.mjs:266-277` (asserts `result.ok === false` and presence of `"SPEC.md"` / `"agt brainstorm"` substrings).

## Per-Criterion Results (Test lens)

### 1. Failure path covered — PASS
New test invokes `agt run my-feature` against a tmp workspace with no SPEC.md and verifies non-zero exit + message contents. The new contract is mechanically checked.

### 2. Happy path not regressed — PASS (indirect)
Sibling tests in the same `describe` block exercise `agt run` paths with a SPEC.md present. Other reviewers' verification shows 37/37 in `cli-commands.test.mjs` green; the broader gate output also shows the suite running cleanly.

### 3. Acceptance criteria verifiable — PASS
"Exits non-zero" → asserted. "Names the missing file" → asserts `"SPEC.md"` substring. "Points at agt brainstorm" → asserts `"agt brainstorm"` substring. All three independently checkable from the test alone.

### 4. Test isolation — PASS
Fresh `tmpDir` with required `.team/PRODUCT.md` / `PROJECT.md` / `AGENTS.md` so the run gets past pre-flight and fails specifically on SPEC.md. Correctly targeted.

## Edge Cases Checked
- **ANSI color codes vs substring assertions** — `c.red`/`c.bold` wrap parts of the line; the asserted substrings sit between escape sequences, not split by them. Safe.
- **Missing parent feature dir** — `mkdirSync(featureDir,…)` was removed; `existsSync(specPath)` returns false harmlessly when the parent dir is also absent. Confirmed in `run.mjs:927-929`.
- **Feature-name interpolation** — Test passes the already slug-shaped `my-feature`, so the assertion can't distinguish `agt brainstorm my-feature` from `agt brainstorm undefined`. Coverage gap (see findings).
- **Exit code value** — Asserted via `result.ok === false`, not pinned to `1`. A future refactor that throws or exits with a different non-zero code would still satisfy the assertion while breaking shell-script callers that key off `$?`.
- **No side-effect assertion** — The previous behavior wrote a stub file. The new test verifies the message but never asserts that no stub file was created. A regression that re-introduces auto-stubbing alongside the error message would not be caught.

## Coverage Gaps

🟡 test/cli-commands.test.mjs:273 — Pin the exit code: `assert.equal(result.code, 1)` (or whatever field `runAgt` exposes) instead of only `result.ok === false`, so a thrown exception or a different non-zero code can't silently satisfy the test.
🟡 test/cli-commands.test.mjs:276 — Tighten to `output.includes("agt brainstorm my-feature")` so a regression where `featureName` resolves to `undefined` or the wrong slug is caught.
🔵 test/cli-commands.test.mjs:277 — Defense-in-depth: assert `existsSync(join(tmpDir, ".team/features/my-feature/SPEC.md")) === false` to lock in "no auto-stub" as a contract — currently only the message is checked, not the absence of side effects.

No 🔴 findings. The change is small, focused, and the regression test exercises the new failure-path contract through the real CLI surface.

---

# Simplicity Review — task-2

## Verdict: PASS

## Scope
Replace silent auto-stub of `SPEC.md` in `agt run <feature>` with a hard non-zero exit naming the missing path and pointing at `agt brainstorm <feature>`; add regression test.

## Files Reviewed (actually opened)
- `bin/lib/run.mjs` — current state at L920-940; grep for `PRD_SECTIONS` (zero hits) confirmed import cleanup
- `test/cli-commands.test.mjs` — new test at L262
- `.team/features/document-driven-development/tasks/task-2/handshake.json`
- `git show 164e702` (the actual code commit; HEAD `6f25c4c` carries only review artifacts)

## Verification
Ran `node --test test/cli-commands.test.mjs` → **37 pass / 0 fail / 22s**. New case "agt run with no SPEC.md exits non-zero and points at agt brainstorm" green.

## Simplicity Assessment

This is a **net deletion**: ~18 lines of generator scaffolding (sectionBodies dict, `PRD_SECTIONS.map`, `mkdirSync`, `writeFileSync`, success log) collapse to four lines of error output + `process.exit(1)`. The previously-required `import { PRD_SECTIONS } from "./spec.mjs"` was correctly removed in the same commit — grep confirms zero residual references in `run.mjs`.

### Veto categories (all clear)

| Category | Status | Evidence |
|---|---|---|
| Dead code | ✅ clear | Unused `PRD_SECTIONS` import deleted alongside its only call site. No commented-out code, no unreachable branches. |
| Premature abstraction | ✅ clear | No new helper, no new module. Inline four-line `console.log` block is the right shape for a one-shot error path. |
| Unnecessary indirection | ✅ clear | Direct `process.exit(1)` at the call site. No wrapper, no re-export. |
| Gold-plating | ✅ clear | Fixed exit code, fixed message, no env var or flag to bypass or vary the behavior. |

## Cognitive-Load & Deletability Notes
- Reading the new branch top-to-bottom requires holding zero context: three `console.log`s and an exit. The deleted branch required understanding `PRD_SECTIONS`, `sectionBodies` keying, `.map(...).join`, and the implicit invariant that generated content satisfy `validateSpecFile`.
- Could this be smaller? Marginally — three `console.log`s could be one template-literal — but the current shape preserves color isolation (`c.red` only on the headline) and is easier to grep. Not worth changing.

## Edge Cases Checked
- `existsSync(specPath)` short-circuits before any FS write — no orphaned `featureDir` on failure (the prior `mkdirSync(featureDir, { recursive: true })` is gone).
- Test seeds only `.team/PRODUCT.md`/`PROJECT.md`/`AGENTS.md` (no feature dir) — exercises the missing-spec path through the real CLI surface.
- Color codes are unconditionally embedded; harmless because every other error site in `run.mjs` does the same.

## Findings
🔵 bin/lib/run.mjs:932 — Optional, already noted by other reviewers: `console.error` would conventionally pair with a non-zero exit, but the test asserts on `stdout + stderr`, so behavior is unaffected. Cosmetic.

## Summary
Tight, correct, minimal. Implementation is smaller than what it replaces, the dead import was cleaned up, and the test pins the contract. No simplicity-veto findings, no backlog items from this lens.

---

# Engineer Review — task-2 (run_2 follow-up)

## Verdict: PASS

## Files actually opened (this iteration)
- `bin/lib/run.mjs:920-940` (the tightened error block)
- `test/cli-commands.test.mjs:266-286` (tightened regression test)
- `.team/features/document-driven-development/tasks/task-2/handshake.json` (run_2)
- `.team/features/document-driven-development/tasks/task-2/artifacts/test-output.txt`

## Claim verification (run_2)
Handshake claims: (a) test pins exit code to 1, (b) asserts the full `agt brainstorm my-feature` hint, (c) asserts no auto-stub side effect, (d) error lines routed through `console.error`, (e) full suite 581/581 green. All five verified:
- run.mjs:932-934 use `console.error` (was `console.log` previously per prior review notes).
- run.mjs:935 still `process.exit(1)`.
- cli-commands.test.mjs:274 pins `result.exitCode === 1` (was `result.ok === false`).
- cli-commands.test.mjs:277-280 asserts the full `"agt brainstorm my-feature"` substring.
- cli-commands.test.mjs:281-285 asserts `existsSync(.../SPEC.md) === false`.
- test-output.txt tail: `tests 581 / pass 581 / fail 0`.

This iteration directly resolves the three 🟡/🔵 findings the Tester left in the prior round (273, 276, 277) and the cosmetic stderr suggestion all four prior reviewers raised. Nothing was rationalized away; the actual code now matches their guidance.

## Per-criterion (engineer lens)

| Criterion | Result | Evidence |
|---|---|---|
| Correctness — non-zero exit + named file + brainstorm hint | PASS | run.mjs:932-935; assertions at cli-commands.test.mjs:274,276-280 |
| Stream discipline (errors on stderr) | PASS | All three failure lines now `console.error` |
| No side effects on the failure path | PASS | No `mkdirSync`/`writeFileSync` in the missing-spec branch; test asserts SPEC.md absence |
| Code quality | PASS | Three short `console.error` calls + `process.exit(1)`. No new abstractions. |
| Test rigor | PASS | Exit code pinned, full hint string pinned, side-effect absence pinned |

## Edge cases I checked
- `featureName` slug interpolation: still goes through the same slugify earlier in `_runSingleFeature`; the test's `my-feature` round-trips unchanged so the literal substring assertion is sound.
- Mode 2 (no description, picks from roadmap): the brainstorm hint now correctly names the roadmap-derived slug — same code path.
- ANSI color escapes: assertions are on `stdout + stderr` concatenation; substrings sit between escape sequences, not split by them.
- `existsSync(specPath)` short-circuits before any I/O — happy path unaffected.

## Findings

No findings.

---

# Architect Review — task-2 (run_2 follow-up)

## Verdict: PASS

## What Changed in run_2
- `bin/lib/run.mjs:932-934` — three failure lines moved to `console.error` (stderr), addressing the cosmetic 🔵 raised by every prior reviewer.
- `test/cli-commands.test.mjs:266-286` — regression tightened: pins `exitCode === 1`, asserts the full literal `"agt brainstorm my-feature"`, and asserts `existsSync(.../SPEC.md) === false`.

## Evidence Verified (architecture lens)
- `bin/lib/run.mjs:927-936` — single `existsSync(specPath)` guard. On miss: three `console.error` lines → `process.exit(1)`. No FS writes. The brainstorm/run boundary is now strict: brainstorm writes the spec, run only reads it.
- `tasks/task-2/artifacts/test-output.txt` tail: `tests 581 / pass 581 / fail 0`.
- `handshake.json` artifacts (`bin/lib/run.mjs`, `test/cli-commands.test.mjs`, `artifacts/test-output.txt`) — all present and consistent with claims.

## Per-Criterion (Architecture)

| Criterion | Result | Evidence |
|---|---|---|
| Component boundaries respected | PASS | `run` no longer authors specs; that responsibility lives only in `brainstorm`. |
| No unjustified new dependencies | PASS | None added; `PRD_SECTIONS` import already removed in run_1. |
| Pattern consistency | PASS | `console.error` + `process.exit(1)` is the canonical CLI failure shape. The older `.team/` missing branch at run.mjs:783-786 still uses `console.log` for an error — out of scope here. |
| Scalability / future-proofing | PASS | Fail-fast with no FS side effect is strictly cheaper and safer than the prior auto-stub. |
| Test pins observable contract | PASS | Exit code, full message substring, AND the absence of the side-effect file are all asserted. A regression that re-introduces auto-stubbing or shifts the exit code now breaks a test, not just a docstring. |

## Edge Cases Checked
1. Stdout/stderr split — pipelines that consume stdout no longer get the failure block mixed in. Test asserts on `stdout + stderr` so the move is stable.
2. Tightened literal `"agt brainstorm my-feature"` — guards against regressions where `featureName` resolves to `undefined` or a wrong slug.
3. `existsSync(...) === false` — locks in "no auto-stub" as a permanent contract.
4. Mode 2 (roadmap-pick) path — same guard; the stderr lines print the roadmap-derived slug. Coherent.

## Findings

No findings.

---

# Simplicity Review — task-2 (run_2 follow-up)

## Verdict: PASS

## Scope of run_2
Surgical follow-up addressing prior backlog: `console.log` → `console.error` for the three missing-SPEC.md lines (`bin/lib/run.mjs:932-934`) and three new test assertions (`exitCode === 1`, full `"agt brainstorm my-feature"` substring, `existsSync(.../SPEC.md) === false`).

## Files actually opened
- `bin/lib/run.mjs` (full, 1562 lines) — change localized to L932-934
- `test/cli-commands.test.mjs` L271-287
- `.team/features/document-driven-development/tasks/task-2/handshake.json` (run_2)
- `.team/features/document-driven-development/tasks/task-2/artifacts/test-output.txt` — **581/581 pass, 0 fail, 32.3s**
- `git diff 164e702 HEAD -- bin/lib/run.mjs test/cli-commands.test.mjs`: -3/+3 in run.mjs, +9/-1 in test

## Veto categories (all clear)

| Category | Status | Evidence |
|---|---|---|
| Dead code | ✅ clear | Diff is purely substitutive in run.mjs. Test gains assertions, no orphan vars or imports. |
| Premature abstraction | ✅ clear | Three sequential `console.error` calls — no `errorAndExit()` helper invented. With one call site, abstraction would itself be premature. |
| Unnecessary indirection | ✅ clear | Direct stderr routing. No wrapper, no re-export. |
| Gold-plating | ✅ clear | No flag, no env var, no configurable severity. The hint hardcodes `agt brainstorm ${featureName}` because that is the one and only correct next step. |

## Cognitive-load & deletability
- run_2 increases cognitive footprint by ~zero: `console.log` → `console.error` is a one-token swap that any reader correctly intuits without context.
- The three new test assertions each lock down a specific regression vector: a thrown exception that incidentally exits with a different non-zero code (caught by `exitCode === 1`); a regression where `featureName` resolves to `undefined` (caught by full-substring); a re-introduction of auto-stubbing alongside the error message (caught by `existsSync === false`). None overlap; none are redundant.

## Edge cases checked
- Stdout/stderr split: shell consumers piping stdout (`agt run … | grep`) no longer mix the failure block in; non-zero exit code remains the canonical signal. Net correctness improvement.
- ANSI sequences: `c.red`/`c.bold` continue to wrap the error lines on stderr — terminals interpret escape codes on stderr identically, so no display regression.
- The new `existsSync` assertion piggybacks on imports already present in the test file — no new test dependency.

## Findings
No findings.

## Summary
Exemplary follow-up: smallest possible diff that resolves three concrete backlog items from prior reviewers, no new abstractions, gate strictly tightened (581/581 green). Nothing to flag from a simplicity lens.

---

# PM Review — task-2 (run_2)

## Verdict: PASS

## Task
> `agt run my-feature` with no `SPEC.md` exits non-zero with a message naming the missing file and pointing at `agt brainstorm`.

## Files Read
- `bin/lib/run.mjs` (full file; focused on lines 925–936)
- `test/cli-commands.test.mjs` (focused on lines 266–286)
- `.team/features/document-driven-development/tasks/task-2/handshake.json`
- `.team/features/document-driven-development/tasks/task-2/artifacts/test-output.txt`

## Claim Verification (handshake → code)
Handshake (run_2) claims: pin exit code to 1, assert the full `agt brainstorm my-feature` hint, verify no auto-stub side effect, and route failure messages through `console.error`. All four verified:
- `bin/lib/run.mjs:932-934` — three `console.error` calls naming SPEC.md and `agt brainstorm <featureName>`.
- `bin/lib/run.mjs:935` — `process.exit(1)`.
- `test/cli-commands.test.mjs:274` — `assert.equal(result.exitCode, 1, ...)`.
- `test/cli-commands.test.mjs:278` — asserts the full literal `agt brainstorm my-feature`.
- `test/cli-commands.test.mjs:281-285` — asserts SPEC.md does NOT exist after the run.
- `artifacts/test-output.txt` — `tests 581 / pass 581 / fail 0`.

## Per-Criterion Results (PM lens)

| Criterion | Result | Evidence |
|---|---|---|
| Spec testable & verified | PASS | All three observable behaviors are pinned by assertions. |
| User value | PASS | Replaces silent auto-stub with a clear, actionable error naming the file and the next command. Aligns with the document-driven goal: "approved spec before code is written." |
| Acceptance criteria met from spec alone | PASS | Non-zero exit (pinned to 1), names the file (`SPEC.md`), points at brainstorm (full literal hint). All independently checkable from the test alone. |
| Scope discipline | PASS | Diff confined to test tightening + stderr routing. No drive-by edits. |
| No regressions | PASS | 581/581 tests green. |
| Side-effect contract | PASS | The "no auto-stub" contract — previously only implied by the message — is now explicitly asserted. |
| Stream discipline | PASS | Failure messages on stderr now match the non-zero exit convention. |

## Edge Cases Considered
1. ANSI color codes around `SPEC.md` and `agt brainstorm my-feature` — substrings sit between escape sequences, not split by them; merging stdout+stderr in the test means the stderr move doesn't break assertions.
2. `featureName` slug derivation — `my-feature` → `my-feature` (already lowercase, no special chars), so the literal substring assertion is correct for this CLI input.
3. Mode 2 (no description, picks from roadmap) — same `specPath` guard; error message uses the roadmap-derived slug. Coherent.

## Findings

No findings.

## Notes
This iteration closes every open item from the prior round (the tester's three pin-the-contract suggestions plus the stderr suggestion all four reviewers raised). Implementation, test, and handshake are aligned; nothing was rationalized away. Clean PASS.

---

# Tester Review — task-2 (run_2)

## Verdict: PASS

## Files actually opened
- `bin/lib/run.mjs:925-936` — current missing-SPEC branch (uses `console.error`)
- `test/cli-commands.test.mjs:266-286` — tightened regression test
- `.team/features/document-driven-development/tasks/task-2/handshake.json` (run_2)
- `.team/features/document-driven-development/tasks/task-2/artifacts/test-output.txt` — `tests 581 / pass 581 / fail 0`

## Iteration delta verified
The earlier Tester review left three coverage gaps. All three are resolved here:
- 🟡 → ✅ Exit code pinned: `assert.equal(result.exitCode, 1, ...)` at cli-commands.test.mjs:274.
- 🟡 → ✅ Brainstorm hint tightened to the exact `"agt brainstorm my-feature"` literal at L277-280; wrong-slug or `undefined` interpolations now fail.
- 🔵 → ✅ No-side-effect contract: `assert.equal(existsSync(.../SPEC.md), false)` at L281-285 locks "no auto-stub" as a contract.

Bonus: the cosmetic `console.error` suggestion every prior reviewer raised is also addressed at run.mjs:932-934. The test reads `result.stdout + result.stderr`, so the channel switch is observed without breaking assertions.

## Per-Criterion Results (Test lens)

| Criterion | Result | Evidence |
|---|---|---|
| Failure path covered via real CLI | PASS | `runAgt(["run", "my-feature"], tmpDir, …)` at L272 — exercises the binary, not a function call. |
| Contract pinned (exit code + message + hint) | PASS | Three independent asserts at L274, L276, L277-280 with diagnostic messages. |
| No-side-effect contract | PASS | L281-285 — re-introducing auto-stub trips this assertion. |
| Happy path not regressed | PASS (indirect) | Full gate 581/581 green; sibling `agt run --dry-run` test remains green in the same describe block. |
| Test isolation | PASS | Fresh tmpDir seeded with PRODUCT/PROJECT/AGENTS only — failure is the missing SPEC.md, not pre-flight. |

## Edge cases I checked
1. **stderr/stdout concat** — assertion concatenates both streams, so `console.error` is observed. ✅
2. **ANSI color escapes** — `c.red`/`c.bold` wrap parts of the headline but the asserted substrings sit between escape sequences, not split by them. ✅
3. **Pre-existing STATE.json from a prior failed run** — run.mjs:887 `if (!existsSync(statePath))` skips re-init; the SPEC.md check at L929 still fires, so leftover state cannot bypass the gate.
4. **Roadmap-pick mode (`agt run` with no args)** — same `existsSync(specPath)` check fires after `featureName` is resolved from the roadmap (run.mjs:864 → 927-936). Not directly tested. Coverage gap noted below.
5. **Empty/whitespace-only SPEC.md** — `existsSync` returns true and `readFileSync` returns `""`; `planTasks` falls back to a single task from the description. Out of scope for this task but worth flagging if "approved spec" should imply non-empty.
6. **Featurename interpolation** — the test passes the slug `"my-feature"`, and the assertion now requires that exact slug in the hint, so an `undefined`/wrong-slug regression is caught.

## Coverage Gaps (non-blocking)

🟡 test/cli-commands.test.mjs:266 — No regression test exercises the **roadmap-pick** path (`agt run` with no args, picks the first uncompleted roadmap item with no SPEC.md). Same gate fires but only the explicit-name branch is covered.
🔵 bin/lib/run.mjs:929 — Consider also rejecting a SPEC.md that exists but is empty/whitespace-only — currently the file is read as-is and `planTasks` falls back to the description-only path, silently re-introducing the "no real spec" failure mode this feature is meant to prevent. Out of this task's scope; flag for backlog.

## Findings

No 🔴 findings. Two non-blocking items above are documented for backlog. The contract for *this* task is fully and correctly tested.
