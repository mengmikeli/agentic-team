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
