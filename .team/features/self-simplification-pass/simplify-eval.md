# Simplicity Review — self-simplification-pass

**Reviewer:** Simplicity
**Verdict:** PASS
**Date:** 2026-04-27

## Files Actually Read

| File | Lines | What I checked |
|---|---|---|
| `bin/lib/simplify-pass.mjs` | 1-167 (all) | Core implementation, all exports |
| `bin/lib/run.mjs` | 1-1632 (all) | Integration point at L1507-1537, import at L26 |
| `bin/lib/outer-loop.mjs` | diff only | `simplify-blocked` guard at L889-898 |
| `bin/agt.mjs` | diff only | `--no-simplify` help text at L93 |
| `test/simplify-pass.test.mjs` | 1-298 (all) | All 17 test cases |
| `test/run-batches.mjs` | 1-65 (all) | Batch runner, test file list |
| `test/outer-loop.test.mjs` | diff only | `simplify-blocked` test at L680-724 |
| `package.json` | diff only | Test script change |
| `bin/lib/audit-cmd.mjs` | diff only | maxBuffer additions |
| `bin/lib/doctor.mjs` | diff only | maxBuffer additions |
| `bin/lib/review.mjs` | diff only | maxBuffer additions |
| `bin/lib/context.mjs` | diff only | maxBuffer additions |
| `bin/lib/gate.mjs` | diff only | maxBuffer additions |
| `bin/lib/github.mjs` | diff only | maxBuffer additions |
| `bin/lib/metrics.mjs` | diff only | maxBuffer additions |
| `bin/lib/notify.mjs` | diff only | maxBuffer additions |
| 9 test files | diff only | maxBuffer additions |
| All 6 handshake.json files | full | Builder claims |
| SPEC.md (main branch) | full | Original scope |
| SPEC.md (feature branch) | full | Updated scope |

## Verification

- `npm test` executed: **all pass** (573+ tests across 3 batches, 0 failures)
- `git diff main...HEAD --stat`: 49 files changed, +3094 / -218

---

## Findings

### Veto Category Scan (blocks merge if 🔴)

#### 1. Dead Code
No dead code found. All exports in `simplify-pass.mjs` are imported and used. All new variables in `run.mjs` (`simplifyBlocked`, `simplifyResult`) are referenced downstream. No commented-out code, no unreachable branches.

#### 2. Premature Abstraction
`getFeatureDiff` and `buildSimplifyBrief` are exported from `simplify-pass.mjs` and used in both production (`runSimplifyPass`) and tests (6 test cases target them directly). The DI parameter `opts._execFn` has exactly 2 call sites: the default path (production) and 12 test calls with mocks. No single-implementation interfaces.

#### 3. Unnecessary Indirection
`runSimplifyPass` is called from `run.mjs:1513` and delegates to real infrastructure (`parseFindings`, `computeVerdict`, `readState`, `writeState`, `appendProgress`). No wrappers that only delegate. The DI for `dispatchFn` is necessary — the alternative is mocking the entire agent subprocess in tests.

#### 4. Gold-plating
`--no-simplify` flag: The **original** SPEC.md (on main) explicitly lists this under "Out of Scope." The feature-branch SPEC was updated mid-development to include it. Implementation is 5 lines across 2 files (run.mjs:1510,1520-1522 + agt.mjs:93). Low complexity, but outer-loop.mjs does not forward the flag (the feature-branch SPEC line 45 requires it), making the flag only partially functional. Not blocking since the added code is minimal, but flagged.

**No 🔴 critical findings.**

---

### Detailed Findings

🟡 bin/lib/outer-loop.mjs — `--no-simplify` flag is NOT forwarded to inner loop invocation. Feature-branch SPEC line 45 requires: "`outer-loop.mjs` — pass `--no-simplify` flag through to inner loop invocation when user supplies it." The flag works in direct `agt run --no-simplify` but silently does nothing through the continuous outer loop. Either add passthrough or remove the flag from the SPEC/help text to avoid confusion.

🟡 bin/lib/audit-cmd.mjs, bin/lib/doctor.mjs, bin/lib/review.mjs, bin/lib/context.mjs, bin/lib/gate.mjs, bin/lib/github.mjs, bin/lib/metrics.mjs, bin/lib/notify.mjs, + 9 test files — `maxBuffer: 10 * 1024 * 1024` added shotgun-style to ~30 call sites. The root cause (ENOBUFS from `npm test` buffering all output) was fixed by `test/run-batches.mjs` which streams output. The maxBuffer additions to calls like `gh --version`, `which claude`, and `pgrep -f agt.mjs run` (which produce <1KB output) are defensive but add diff noise. Not incorrect, but the blast radius is disproportionate to the root cause.

🔵 test/run-batches.mjs:16-42 — Hardcoded test file list with comment "Explicit list — matches main branch's npm test list + new tests." The old explicit list lived in `package.json`; it now lives here. Same maintenance burden, different location. If a new test file is added to `test/` but not to this list, it silently won't run. Consider a glob pattern with explicit excludes (the 2 excluded files are already documented in the comment).

🔵 bin/lib/simplify-pass.mjs:15 — `DIFF_CAP = 12000` is a magic number with no stated rationale for the specific value. A brief comment explaining the cost/context-window tradeoff would help future maintainers understand why 12K and not 8K or 20K.

---

## Complexity Budget Assessment

| Component | Lines Added | Justification |
|---|---|---|
| `simplify-pass.mjs` | 167 | Core feature — single module, no new dependencies |
| `simplify-pass.test.mjs` | 298 | 17 test cases covering happy path, errors, edge cases |
| `run.mjs` integration | ~30 | Guard + call + blocked state + finalize gate |
| `outer-loop.mjs` | 5 | `simplify-blocked` roadmap guard |
| `run-batches.mjs` | 65 | ENOBUFS fix — infrastructure, not feature |
| `maxBuffer` additions | ~30 sites | Defensive, not feature — bulk mechanical change |
| `agt.mjs` help text | 1 | `--no-simplify` documentation |

The feature's complexity budget is well-managed. The core feature (`simplify-pass.mjs` + `run.mjs` integration) is ~200 lines of focused, well-structured code. The remaining ~2800 lines of diff are: tests (appropriate), eval/handshake artifacts (process output), and the ENOBUFS infrastructure fix (necessary but orthogonal).

## Edge Cases Checked

- Empty diff: handled at simplify-pass.mjs:93 (returns PASS, no eval written)
- Dispatch failure: handled at L119-121 (fails open, returns PASS)
- Dispatch ok=false: handled at L114-116 (fails open, returns PASS)
- Missing role file: handled at L101-106 (fails open, returns PASS)
- Mixed severity findings: tested at L180-200 (2 critical + 1 warning + 1 suggestion)
- `blocked > 0` AND `simplifyBlocked`: run.mjs:1619 returns `"blocked"` first (STATE.json says `"simplify-blocked"` — minor state/return mismatch, flagged in prior engineer eval)

## Anti-Rationalization Checkpoint

| Claim | Evidence |
|---|---|
| "All tests pass" | `npm test` executed, 573+ tests pass, 0 fail — output verified |
| "No dead code" | Grepped all new exports; each has 2+ call sites (prod + test) |
| "Reviewed all files" | See "Files Actually Read" table — 20+ files, listed with line ranges |
| "No unnecessary abstraction" | Each exported function has 2+ callers; DI is required for testability |
| "Gold-plating check" | `--no-simplify` is in updated feature-branch spec but was out-of-scope in original spec; flagged as 🟡 |

---

## Verdict

**PASS** — 0 critical, 2 warning, 2 suggestion

The implementation is clean and well-scoped. The core module (`simplify-pass.mjs`) is a single-purpose file with clear step-by-step logic that reuses existing infrastructure. No dead code, no premature abstractions, no unnecessary indirection. The `--no-simplify` flag is borderline gold-plating (explicitly out-of-scope in the original spec, added to feature-branch spec mid-development) but adds only 5 lines. The maxBuffer shotgun is the noisiest part of the diff but isn't incorrect.

Warnings go to backlog:
1. `--no-simplify` not forwarded through outer-loop (partial implementation)
2. maxBuffer additions broader than root cause required
