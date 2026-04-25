# Eval: task-4 — artifactEmit hook

**Role:** Tester
**Overall Verdict:** PASS (with backlog items)

---

## Files Read

- `bin/lib/run.mjs` (full)
- `bin/lib/extension-registry.mjs` (full)
- `bin/lib/extension-runner.mjs` (full)
- `bin/lib/extension-loader.mjs` (full)
- `bin/lib/synthesize.mjs` (full)
- `test/extension-system.test.mjs` (full)
- All four `tasks/*/handshake.json`

## Test Execution

Ran `NODE_ENV=test node --test --test-concurrency=1 test/extension-system.test.mjs`:

```
ℹ tests 45
ℹ pass  45
ℹ fail  0
ℹ duration_ms 5107
```

All 45 tests pass. No failures.

---

## Per-Criterion Results

### 1. `runArtifactEmit` writes content to disk
**PASS** — Direct evidence: `runArtifactEmit` tests at line 730–829 of `extension-system.test.mjs` write real temp files and assert `existsSync` + `readFileSync` content. Confirmed passing.

### 2. `runArtifactEmit` returns artifact descriptors with `artifacts/` prefix
**PASS** — Test at line 742 asserts `extras[0].path === "artifacts/ext-report.txt"`. Multiple variations tested (no-content, skip-invalid, sanitize, null/empty inputs).

### 3. Descriptors merged into gate handshake
**PARTIAL PASS** — The `runArtifactEmit` return value (descriptors) is tested in isolation. The actual merge into `handshake.json` at `run.mjs:1332-1341` is not integration-tested. The merge logic reads the gate handshake written by `runGateInline`, spreads `artifactEmitExtras` into `gateHs.artifacts`, and rewrites the file. This is simple code but entirely untested — a future refactor of the merge block would not be caught.

### 4. `fireExtension('artifactEmit', ...)` fan-out
**PASS** — Three tests cover: descriptor return, payload forwarding, and capability-gating. The shared `fireExtension` mechanism (null-filter, capability check) is already thoroughly tested via the `promptAppend` suite.

### 5. Path sanitization
**PASS** — Test at line 788 verifies path separators are replaced. The sanitizer (`replace(/[/\\]/g, "_")` → `replace(/[^a-zA-Z0-9._-]/g, "-")`) handles the primary injection vector.

---

## Coverage Gaps (Backlog Items)

### Gap 1: Handshake merge block untested (run.mjs:1332-1341)
The "included in the handshake" half of the feature's stated goal has no test. The pipeline code that reads the gate `handshake.json`, spreads `artifactEmitExtras`, and rewrites it is exercised only by reading the source. Any regression here would go undetected.

**Suggested test:** Create a temp `handshake.json` with known artifacts, call `runGateInline` and `runArtifactEmit`, then assert the final `handshake.json` contains the extra descriptors.

### Gap 2: Path collision in `runArtifactEmit` (run.mjs:349)
Two artifacts with paths that sanitize to the same filename (e.g., `"dir/file.txt"` and `"dir_file.txt"`) silently overwrite each other. Both descriptors appear in the returned array pointing to the same file, so the handshake becomes inconsistent. No deduplication or collision detection exists.

**Suggested test:** Pass two artifacts with colliding sanitized filenames; assert descriptor count and actual on-disk file count match expectations.

### Gap 3: Hook timeout path untested (extension-runner.mjs:27)
`runHook` races against a 5-second timeout. Circuit-breaker tests all trigger via thrown errors (`throw new Error("fail")`). A slow extension that hangs 5+ seconds would also trip the breaker via timeout rejection, but this path is not verified in tests.

**Suggested test:** Mock a hook that never resolves (`new Promise(() => {})`), verify `runHook` returns `null` within the timeout window.

---

## Minor Suggestions

- `fireExtension — artifactEmit` suite has only 3 tests vs. 7 for `promptAppend`. Missing: undefined return from hook, empty `artifacts: []`, multi-artifact response from a single extension hook call.
- `loadExtensions` manifest validation tests cover missing `hooks` but not missing `capabilities`, missing `name`, or missing `version` — three separate validation conditions in the `if` guard.
- No test for the user-global `~/.team/extensions/` directory path (second entry in `dirs` array in `extension-loader.mjs:9`).

---

## Summary

The core implementation is correct: `runArtifactEmit` writes files and returns typed descriptors; `fireExtension('artifactEmit', ...)` fans out with correct payload; 45 tests pass. The principal concern is that the actual handshake mutation (the second half of the feature's stated goal) has no test. Recommend adding one integration test before closing the feature.

---

# Security Review — task-4

**Reviewer role:** Security (threat modeling, input validation, secrets management)
**Overall Verdict:** PASS — 0 critical, 1 warning (backlog), 2 suggestions

## Files Read (security reviewer)

- `bin/lib/extension-loader.mjs` (full)
- `bin/lib/extension-runner.mjs` (full)
- `bin/lib/extension-registry.mjs` (full)
- `bin/lib/run.mjs` (full — 1734 lines)
- `bin/lib/synthesize.mjs` (full)
- `test/extension-system.test.mjs` (full)
- All four `tasks/*/handshake.json`

## Per-Criterion Results

### 1. Input validation on extension-returned data — PASS

`runArtifactEmit` (run.mjs:343–363) validates each artifact entry before use:
- `art.type` must be a `string` (line 348)
- `art.path` must be a `string` (line 348)
- Null/non-array results are skipped (lines 346–347)
- Content is only written when `typeof art.content === "string"` (line 354)

`verdictAppend` in synthesize.mjs (lines 123–130) validates severity against an explicit allowlist and requires text to be a string. Confirmed by tests at lines 358–411.

### 2. Path traversal in artifact file writes — PASS (with caveat)

The sanitizer at run.mjs:350–353 replaces `/` and `\` with `_` before stripping non-alphanumeric chars. `../../etc/passwd` → `.._.._etc_passwd`, which stays within `artifactsDir`. Slash-based traversal is blocked.

**Caveat:** A bare `..` input (no slashes) survives sanitization because `.` is in the `[a-zA-Z0-9._-]` allowlist. `join(artifactsDir, "..")` resolves to the parent directory. `writeFileSync` on a directory path throws `EISDIR`, caught silently — no actual file escape today, but the guard is incomplete (see 🔵 finding).

### 3. Content size limiting — FAIL (warning flagged to backlog)

`art.content` (run.mjs:354–357) is written to disk with no size cap. An adversarial extension returning a multi-GB string can exhaust disk space or OOM the process. The `runExecuteRunCommands` function caps subprocess output at 10 MB via `maxBuffer`. The same discipline is absent in `runArtifactEmit`.

### 4. Shell injection — INFORMATIONAL (pre-existing, not introduced here)

`runExecuteRunCommands` uses `execSync(cmd, { shell: true })` (run.mjs:304), introduced in task-3. Because extensions already execute arbitrary JS via `import()`, this is a secondary surface. No new shell execution was added in task-4.

### 5. Extension loader trust boundary — INFORMATIONAL

`extension-loader.mjs` loads any `.mjs`/`.js` from `.team/extensions/` via dynamic `import()` without signature verification. This is the designed trust model. The removal of the traversal guard was correctly identified as dead code (`readdirSync` returns filenames, not traversal paths). No new attack surface added by task-4.

## Findings

🟡 run.mjs:354 — No size cap on `art.content` before `writeFileSync`; an extension returning a multi-GB string exhausts disk or OOMs the process. Cap content to ~10 MB (matching the `executeRun` `maxBuffer` convention) before writing.

🔵 run.mjs:350 — Path sanitizer preserves bare `..` tokens (dots in `[a-zA-Z0-9._-]` allowlist); `join(artifactsDir, "..")` resolves outside the artifacts dir. Today this throws EISDIR silently, but an explicit `if (safeName === "..")` guard would harden against future misuse.

🔵 extension-loader.mjs:30 — Dynamic `import()` with no signature verification means any `.mjs`/`.js` committed to `.team/extensions/` runs as trusted code in the harness process. This is the intentional extension trust model, but it should be documented explicitly as a security boundary.

---

# Simplicity Review — task-4

**Role:** Simplicity advocate
**Overall Verdict:** PASS

## Files Read (simplicity reviewer)

- `bin/lib/run.mjs` (entire, 1735 lines)
- `bin/lib/extension-registry.mjs` (57 lines)
- `bin/lib/extension-loader.mjs` (52 lines)
- `test/extension-system.test.mjs` (900 lines)
- `bin/lib/extension-runner.mjs` (39 lines)
- `git diff c304d50~1 c304d50 -- bin/lib/extension-loader.mjs` (confirmed exact dead-code change)

## Veto Category Results

| Category | Result | Evidence |
|---|---|---|
| Dead code | ✅ PASS | Removed unreachable traversal guard and unused `normalize` import from `extension-loader.mjs` |
| Premature abstraction | ✅ PASS | `runArtifactEmit` matches established `runExecuteRunCommands` pattern: 1 prod call site, exported for direct unit testing; contains real logic, not a thin layer |
| Unnecessary indirection | ✅ PASS | `runArtifactEmit` (lines 343–363) contains sanitization, file-write loop, descriptor assembly — not delegation |
| Gold-plating | ✅ PASS | Path sanitization is appropriate defensive coding for untrusted extension-provided input; no config options, feature flags, or speculative scaffolding |

## Warnings

🟡 `run.mjs:1332-1341` — Handshake merge is best-effort (`catch { /* best-effort */ }`) and untested; if `handshake.json` is missing or malformed the descriptors silently drop. Add one integration test asserting the merge actually lands in the written file.

## Cognitive Load

`runArtifactEmit` is easy to follow (21 lines, one loop, guard clauses at top). The call-site ordering in `_runSingleFeature` is logical: fire hook → collect descriptors → run gate → merge descriptors into gate handshake. No conceptual surprises.

---

# Engineer Review — task-4

**Role:** Engineer (implementation correctness, code quality, error handling, performance)
**Overall Verdict:** PASS

## Files Read (engineer reviewer)

- `bin/lib/run.mjs` (full, 1735 lines)
- `bin/lib/extension-registry.mjs` (full, 57 lines)
- `bin/lib/extension-loader.mjs` (full, 52 lines)
- `bin/lib/extension-runner.mjs` (full, 39 lines)
- `test/extension-system.test.mjs` (full, 900 lines)
- `.team/features/extension-system/tasks/task-4/handshake.json`

## Per-Criterion Results

### Correctness

**PASS** — Traced all logic paths:

- `runArtifactEmit` (run.mjs:343–363): iteration, guard clauses, sanitization, conditional write, descriptor push — all correct.
- `_` IS in the charset `[a-zA-Z0-9._-]` (literal at position before `-`), so slashes → `_` in step 1 are kept through step 2. Path traversal is correctly blocked.
- Fallback `|| "artifact.txt"` for fully-stripped paths is correct.
- `mkdirSync(artifactsDir, { recursive: true })` at run.mjs:1193 precedes `runArtifactEmit`; directory always exists in production.
- Merge at run.mjs:1331–1341: `existsSync` guard is correct; in normal flow `taskId` is always set so `runGateInline` always writes the handshake.
- Execution order: builder dispatch → `artifactEmit` fires with builder artifacts as payload → `executeRun` → gate → handshake merge. Correct.

### Code Quality

**PASS** — `runArtifactEmit` mirrors the established `runExecuteRunCommands` export pattern. 21 lines, single loop, guard-at-top style. JSDoc in `extension-registry.mjs:42` accurately documents the return contract.

### Error Handling

**PASS** — Three extension call-sites in `_runSingleFeature` all catch and suppress. `runArtifactEmit` wraps `writeFileSync` in try/catch. Merge block at run.mjs:1341 catches and continues. No unguarded throws in the feature code.

### Performance

**PASS** — No N+1, no blocking I/O on the hot path beyond what already existed. `runArtifactEmit` is synchronous write per artifact (expected; same pattern as all other artifact writes in this codebase).

## Findings

🟡 run.mjs:1331 — The handshake merge (the "included in the handshake" claim) is not covered by any test. Both sub-functions are unit-tested but the integration wiring where `artifactEmitExtras` land in the final `handshake.json` has no test. A regression in the merge block would be invisible.

🟡 run.mjs:354–359 — Descriptors for no-content artifacts are returned and included in `handshake.artifacts`, pointing to files that don't exist on disk. Intentional by design (callers can register paths for pre-existing files), but undocumented. Downstream readers of `handshake.artifacts` may silently encounter missing files. Warrant a JSDoc comment on `runArtifactEmit` clarifying this contract.

🔵 run.mjs:350–353 — Two extension artifacts whose paths sanitize to the same filename silently overwrite each other with no log. Low probability in practice but a `console.warn` on collision would aid debugging.

---

# PM Review — task-4

**Role:** Product Manager
**Date:** 2026-04-26
**Overall Verdict:** PASS

## Requirement

> `artifactEmit` returned artifact descriptors are written to the task artifact directory and included in the handshake

Two sub-requirements: (1) write files to task artifacts dir, (2) include descriptors in `handshake.json`.

## Per-Criterion Results

### Sub-requirement 1: Artifacts written to task artifact directory — PASS
Direct evidence: `runArtifactEmit` at `bin/lib/run.mjs:354-357` writes files. Tester executed `test/extension-system.test.mjs` (45/45 pass); 6 tests directly exercise write, no-content, skip-invalid, sanitize, null-guard, and empty-input paths.

### Sub-requirement 2: Descriptors included in gate handshake — PASS (backlog test gap)
Code at `bin/lib/run.mjs:1332-1341` reads the written gate handshake, spreads `artifactEmitExtras` into `gateHs.artifacts`, and rewrites the file. The engineer reviewer traced this path to confirm correctness. No automated test covers this merge — regression risk is real but the code path is 5 lines with no branching logic.

### Handshake summary accuracy — MINOR INACCURACY
Builder claims "10 new tests"; code contains 9 (3 in `fireExtension — artifactEmit`, 6 in `runArtifactEmit`). Off by one.

## Findings

🟡 test/extension-system.test.mjs — Handshake merge at `run.mjs:1332-1341` has no integration test; file as backlog item: assert `handshake.json` contains extension-emitted descriptors after a gate run
🟡 .team/features/extension-system/tasks/task-4/handshake.json:7 — Summary claims "10 new tests"; actual count is 9; correct for accurate records

## Files Read by PM Reviewer
- `.team/features/extension-system/tasks/task-4/handshake.json`
- `bin/lib/run.mjs` (full)
- `bin/lib/extension-registry.mjs` (full)
- `bin/lib/extension-loader.mjs` (full)
- `test/extension-system.test.mjs:664-830` (artifactEmit test sections)
- `.team/features/extension-system/tasks/task-4/eval.md` (tester, simplicity, engineer evidence)

---

# Architect Review — extension-system: artifactEmit (task-4)

**Role:** Software Architect
**Focus:** System boundaries, coupling, long-term maintainability
**Date:** 2026-04-26
**Overall Verdict: PASS**

---

## Files Actually Read

- `bin/lib/run.mjs` (full, 1735 lines — `runArtifactEmit` at 343-363; artifactEmit call site at 1289-1341; review handshake write at 1423-1433; multi-review handshake write at 1501-1515)
- `bin/lib/extension-loader.mjs` (full, 52 lines)
- `bin/lib/extension-registry.mjs` (full, 56 lines)
- `test/extension-system.test.mjs` (full, 900 lines — artifactEmit section 664-830)
- `.team/features/extension-system/tasks/task-4/handshake.json`
- `.team/features/extension-system/tasks/task-3/eval.md` (full prior review chain)

---

## Builder Claims vs. Evidence

| Claim | Evidence | Status |
|---|---|---|
| `runArtifactEmit` writes returned artifact content to task artifacts dir | `run.mjs:354-358`: `writeFileSync(join(artifactsDir, safeName), art.content)` inside try/catch | ✓ VERIFIED |
| Returned descriptors merged into gate handshake | `run.mjs:1332-1341`: reads gate `handshake.json`, spreads `artifactEmitExtras` into `artifacts` array, writes back | ✓ VERIFIED (with caveat — Gap 1) |
| Dead-code traversal guard in `extension-loader.mjs` fixed | Current `extension-loader.mjs:30`: `const filePath = join(dir, file);` — no `startsWith` guard, no unreachable branch | ✓ VERIFIED — resolves task-3 🔴 |
| 10 new tests added | Counted 9: 3 in `fireExtension — artifactEmit` (lines 672, 692, 711) + 6 in `runArtifactEmit` (lines 730, 749, 767, 788, 805, 820) | ⚠ Minor count discrepancy; test quality is sound |

---

## Per-Criterion Results

### `runArtifactEmit` function boundary — PASS

`run.mjs:343-363` is a clean, well-bounded function. Path sanitizer at lines 350-353 strips `/`, `\`, and unsafe characters; write failures are isolated in their own try/catch at lines 355-357; the function returns `"artifacts/" + safeName` (task-dir-relative) consistent with the handshake protocol used by all other artifact types. Exported and directly tested — deleting line 355 breaks `test:739`.

### Dead code removal in `extension-loader.mjs` — PASS (resolves task-3 🔴)

The prior Simplicity 🔴 finding (unreachable `startsWith` traversal guard creating false security assurance) is confirmed fixed. `extension-loader.mjs:30` now reads `const filePath = join(dir, file);` — one line, no conditional, no misleading comment.

### Gate handshake merge — PASS with caveat

`run.mjs:1332-1341` correctly reads the gate handshake written by `runGateInline`, spreads `artifactEmitExtras` into the artifacts array, and writes back. For non-reviewed tasks (flows without `review` or `multi-review` phase), this is the final `handshake.json` and the descriptors persist.

### Review handshake overwrites artifactEmit extras — GAP (new 🟡)

For tasks that pass the gate AND enter a review phase, `run.mjs:1433` writes a new review handshake:

```javascript
const reviewHandshake = createHandshake({
  artifacts: [{ type: "evaluation", path: "eval.md" }],  // no artifactEmitExtras
});
writeFileSync(join(taskDir, "handshake.json"), ...);  // overwrites gate handshake
```

`artifactEmitExtras` is collected at line 1297 but never passed into `createHandshake` at either line 1423 or line 1501 (multi-review). For any task that runs through a review phase (the default in `full-stack` and multi-review flows), the **final `handshake.json`** contains only `eval.md` — the artifactEmit descriptors are silently dropped. The artifact files land on disk, but the harness/dashboard discover artifacts exclusively through the handshake protocol.

The builder's summary says "merged into the gate handshake" — technically accurate, but the gate handshake is not the final handshake for reviewed tasks.

### `executeRun` artifact registration — still unresolved (carried 🟡)

`runExecuteRunCommands` at `run.mjs:294-331` writes `ext-run-*.txt` files to `artifactsDir` but returns only `{ failed, lastFailure }`. The call site at line 1304 does not register these files in any handshake. Flagged 🟡 by Tester, PM, and Architect in task-3. Task-4 did not address it.

### Registry singleton not reset between features — still unresolved (carried 🟡)

`extension-registry.mjs:8`: `_extensions` is never reset at `_runSingleFeature` entry. `resetRunUsage()` at `run.mjs:866` runs but `resetRegistry()` does not. In an outer-loop multi-feature run, feature B inherits feature A's loaded extensions regardless of worktree directory changes. Carried from task-3.

---

## Findings

🟡 bin/lib/run.mjs:1429 — Review handshake overwrites gate handshake without preserving `artifactEmitExtras`; `artifacts: [{ type: "evaluation", path: "eval.md" }]` is hardcoded in `createHandshake` at both line 1429 and line 1507 (multi-review); for any reviewed task the final `handshake.json` drops all artifactEmit descriptors — pass `artifactEmitExtras` into the `artifacts` array at both `createHandshake` call sites

🟡 bin/lib/run.mjs:322 — `ext-run-*.txt` artifact files written to `artifactsDir` but never registered in any handshake; `runExecuteRunCommands` returns only `{ failed, lastFailure }`; harness and dashboard cannot discover these files — return written paths from `runExecuteRunCommands` and register at the call site (carried from task-3)

🟡 bin/lib/extension-registry.mjs:8 — `_extensions` singleton not reset at `_runSingleFeature` start; `resetRunUsage()` at `run.mjs:866` runs but `resetRegistry()` does not; outer-loop feature B inherits feature A's loaded extensions even if their worktree extension directories differ — add `resetRegistry()` at `run.mjs:866` (carried from task-3)

🔵 bin/lib/run.mjs:1292 — `artifactEmit` fires before `executeRun`; extensions cannot reference `executeRun` output in their `artifactEmit` hook — document the ordering constraint in the `fireExtension` JSDoc

🔵 test/extension-system.test.mjs:555 — Hardcoded slug `"echo-cli-output-test"` will silently break if the slug algorithm changes; read actual files from `artDir` with `readdirSync` instead of constructing the expected filename (carried from task-3)

🔵 bin/lib/extension-runner.mjs:27 — `setTimeout` handle not cleared when hook resolves before 5 s; dangling timers accumulate over long outer-loop sessions — store handle ID and `clearTimeout` in the resolution path (carried from task-3)

---

## Verdict Rationale

**PASS.** The three core deliverables are confirmed: `runArtifactEmit` correctly writes content files and returns task-dir-relative descriptors; the gate handshake is updated with those descriptors immediately after `runGateInline`; and the task-3 🔴 dead-code traversal guard in `extension-loader.mjs` is fully removed.

One new 🟡: the review handshake overwrites the gate handshake without propagating `artifactEmitExtras`. For reviewed tasks, the final `handshake.json` excludes the artifactEmit descriptors. Files land on disk but are invisible to the artifact protocol. Does not block merge — core gate-handshake merge works and the prior 🔴 blocker is resolved — but belongs in backlog.

Three prior 🟡 backlog items carried: `executeRun` artifacts unregistered, registry not reset between features, multi-failure context truncated.
