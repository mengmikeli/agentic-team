# Simplicity Review — task-2: verdictAppend merge into computeVerdict

**Overall verdict: PASS**

---

## Files Opened and Read

- `bin/lib/synthesize.mjs` — full file
- `bin/lib/extension-registry.mjs` — full file
- `bin/lib/extension-loader.mjs` — full file (task-1 artifact, context)
- `bin/lib/extension-runner.mjs` — full file (task-1 artifact, context)
- `test/extension-system.test.mjs` — full file

---

## Per-Criterion Results

### 1. Dead code — PASS
No unused imports, variables, or functions. No unreachable branches. No commented-out code.

Evidence: `fireExtension` is imported and called at synthesize.mjs:121. The `extResults` loop body is reachable. All five new test cases in `verdictAppend integration` exercise distinct code paths.

### 2. Premature abstraction — PASS
No new abstractions introduced. `verdictAppend` is a new capability string passed to the existing `fireExtension` dispatcher — no new type, class, or interface. The JSDoc update in extension-registry.mjs documents the new payload shape inline.

### 3. Unnecessary indirection — PASS
The merge block in synthesize.mjs:118–131 is a direct inline implementation. No wrapper function added. `fireExtension` was pre-existing.

### 4. Gold-plating — PASS
`phase: "review"` at synthesize.mjs:121 is the only value ever passed. However, `promptAppend` established this pattern for consistency and for extension authors who need context. The field carries real information (which lifecycle phase triggered the hook), not speculative config. No feature flags or config options with single values.

---

## Complexity Concerns (non-blocking)

### 🟡 Spread-in-loop rebuilds array on every finding
`synthesize.mjs:126` — `findings = [...findings, f]` is inside the inner `for (const f of r.findings)` loop. Each iteration allocates a new array. Since `findings` is already declared `let` and mutable, a simple `findings.push(f)` or collecting into a scratch array and doing one concat after the loop would be clearer and avoid O(n²) allocations.

### 🔵 Test duplicates merge logic instead of exercising cmdSynthesize
`test/extension-system.test.mjs:337` — The "merging extension findings affects computeVerdict" test manually inlines the merge loop (identical to synthesize.mjs:122–129) rather than calling `cmdSynthesize`. If the merge validation logic changes, both the production code and this test must be updated. An end-to-end call through `cmdSynthesize` would be more resilient.

---

## Checklist

| Category | Result | Evidence |
|---|---|---|
| Dead code | PASS | No unused symbols, no unreachable branches |
| Premature abstraction | PASS | No new abstractions; capability string reuses existing dispatcher |
| Unnecessary indirection | PASS | Merge is inline in cmdSynthesize; no wrapper added |
| Gold-plating | PASS | phase field mirrors established promptAppend pattern |
| Correctness of merge | PASS | Per-finding validation (typeof severity + typeof text) matches spec; catch block prevents synthesis breakage |
| Tests cover stated claims | PASS | 5 tests: happy path, verdict impact, non-array guard, per-finding validation, payload forwarding — all claims verified |

---

## Findings

🟡 bin/lib/synthesize.mjs:126 — `findings = [...findings, f]` inside inner loop rebuilds array on every finding; use `findings.push(f)` or collect then concat once

🔵 test/extension-system.test.mjs:337 — merge loop duplicated inline; consider calling `cmdSynthesize` end-to-end to avoid logic drift between test and production code

---

# Engineer Review — task-2: verdictAppend merge into computeVerdict

**Overall verdict: PASS** (1 warning → backlog)

---

## Files Read

- `bin/lib/synthesize.mjs` (full)
- `bin/lib/extension-registry.mjs` (full)
- `bin/lib/extension-runner.mjs` (full)
- `bin/lib/extension-loader.mjs` (full)
- `test/extension-system.test.mjs` (full)
- `test/synthesize.test.mjs` (full)

---

## Per-Criterion Results

### 1. Hook fires at the correct position

**PASS.**
`synthesize.mjs:116–155` ordering: `parseFindings` (116) → `fireExtension("verdictAppend")` + merge (120–131) → `runCompoundGate` (134) → `computeVerdict` (155). Both gate and verdict receive the merged findings set. ✓

### 2. Per-finding validation before merge

**PASS with caveat.**
`synthesize.mjs:123–129` correctly guards on `Array.isArray(r.findings)`, `typeof f.severity === "string"`, and `typeof f.text === "string"`. Gap: no allowlist check on the severity value (see warning finding below).

### 3. Extensions cannot break synthesis

**PASS.**
The entire block is wrapped in `try { } catch { }` (lines 120–131). Any hook error or malformed return is silently absorbed without affecting synthesis output. ✓

### 4. Test coverage (5 claimed)

**PASS.**
`test/extension-system.test.mjs:296–433` — exactly 5 tests in `verdictAppend integration` covering all claimed scenarios: happy path, verdict impact, non-array guard, per-finding validation, and payload forwarding. All assertions are substantive. ✓

### 5. JSDoc updated

**PASS.**
`extension-registry.mjs:27–33` documents the `verdictAppend` payload and return contract inline. ✓

---

## Edge Cases Checked

- Extension returns `null` → filtered by `result != null` in `fireExtension` before reaching merge loop ✓
- Extension throws → caught inside `runHook`, returns `null`, filtered in `fireExtension` ✓
- Extension returns `{ findings: "string" }` → `Array.isArray` guard rejects it ✓
- Extension returns finding with missing `severity` or `text` → per-field `typeof` guard rejects it ✓
- Extension returns finding with `severity: "crit"` (typo) → passes `typeof` check, enters array, silently contributes 0 to counts ✗ (see warning)
- Extension mutates `payload.findings` directly → possible because array is passed by reference; no validation prevents bypass (see suggestion)

---

## Findings

🟡 bin/lib/synthesize.mjs:125 — Severity not validated against allowlist; an extension returning `{ severity: "crit", text: "..." }` passes the `typeof` guard, enters the merged `findings` array, appears in JSON output, but contributes 0 to all verdict counts — silent data loss; add `["critical","warning","suggestion"].includes(f.severity)` to the guard

🔵 bin/lib/synthesize.mjs:128 — `findings = [...findings, f]` spreads the whole array for each finding in the inner loop (O(n²) allocations); collect into a scratch array and spread once: `findings = [...findings, ...extra]`

🔵 bin/lib/synthesize.mjs:121 — `findings` array is passed by reference to extensions; a hook could mutate `payload.findings` directly and bypass per-finding validation; pass `[...findings]` as the payload value

---

# Architect Review — task-2: verdictAppend findings merged into computeVerdict

**Reviewer role**: Architect
**Date**: 2026-04-26
**Overall verdict**: PASS

---

## Files Read

- `bin/lib/synthesize.mjs` (full)
- `bin/lib/extension-registry.mjs` (full)
- `bin/lib/extension-runner.mjs` (full)
- `bin/lib/extension-loader.mjs` (full)
- `test/extension-system.test.mjs` (full)
- `test/synthesize.test.mjs` (full)
- `test/synthesize-compound.test.mjs` (full)

---

## Per-Criterion Results

### 1. Sequencing correctness — PASS

**Direct code trace** (`synthesize.mjs:116-155`):
1. `parseFindings(text)` → base findings (line 116)
2. `fireExtension("verdictAppend", { findings, phase: "review" }, repoRoot)` (line 121)
3. Validated merge: `typeof f.severity === "string" && typeof f.text === "string"` (lines 123–129)
4. `runCompoundGate(findings, repoRoot)` — receives enriched array (line 134)
5. `computeVerdict(findings)` — receives same enriched array (line 155)

Both compound gate and verdict computation see the full post-extension findings set. Claimed sequencing verified.

### 2. Error isolation — PASS

Three isolation layers confirmed:
- `runHook` (extension-runner.mjs:35-38): per-hook try/catch returns `null` on error
- `fireExtension` (extension-registry.mjs:43): filters `null` results
- `cmdSynthesize` (synthesize.mjs:120/131): outer try/catch swallows any remaining error with documented intent

A crashing extension cannot surface through synthesis.

### 3. Boundary design (mutability) — WARNING

`synthesize.mjs:121` passes `findings` by reference as the payload. An extension invoking `payload.findings.push(...)` would mutate the array before the validation loop runs, injecting findings that bypass the `typeof severity/text` guard. This is a real side-channel, already identified by both prior reviewers.

### 4. Test coverage — PASS with gap

Unit tests (`test/extension-system.test.mjs:296-433`) cover all 5 claimed scenarios via direct `fireExtension` calls. CLI integration tests (`test/synthesize.test.mjs:183-261`) exercise `cmdSynthesize` end-to-end but with zero extensions loaded (temp dirs have no `.team/extensions/`).

**Gap**: `synthesize.mjs:120-131` is the only production code path not covered by an end-to-end test with a live extension. A logic regression in that specific block would not be caught. Risk is low given the simplicity of the block, but the gap is confirmed.

### 5. System boundaries — PASS

`synthesize.mjs` introduces no new imports or modules — it reuses the existing `fireExtension` entrypoint. The extension system remains cleanly bounded: the merge contract (`{ findings: Finding[] }`) is defined and documented solely in `extension-registry.mjs:27-33`. No coupling leakage.

---

## Findings

🟡 bin/lib/synthesize.mjs:121 — `findings` array is passed by reference to extensions; an extension calling `payload.findings.push(...)` bypasses per-element validation; pass `[...findings]` (shallow copy) to close the side-channel

🟡 test/extension-system.test.mjs:294 — No end-to-end test calls `cmdSynthesize` with an active `verdictAppend` extension via `setExtensions`; add one CLI integration test covering synthesize.mjs:120-131 directly

🟡 bin/lib/synthesize.mjs:126 — `findings = [...findings, f]` inside inner loop rebuilds the array on every finding (O(n²)); the prior Engineer review also flagged this; `findings.push(f)` is sufficient since `findings` is `let`

---

# Tester Eval — task-2: verdictAppend merge into computeVerdict

**Reviewer role:** Tester
**Date:** 2026-04-26
**Overall Verdict:** PASS (2 warnings → backlog)

---

## Files Read

- `bin/lib/synthesize.mjs`
- `bin/lib/extension-registry.mjs`
- `bin/lib/extension-runner.mjs`
- `bin/lib/extension-loader.mjs`
- `test/extension-system.test.mjs`
- `test/synthesize.test.mjs`
- `test/synthesize-compound.test.mjs`

---

## Per-Criterion Results

### 1. Hook fires at correct location

**PASS** — `synthesize.mjs:120-131` fires after `parseFindings` and before `runCompoundGate`/`computeVerdict`. Order confirmed by direct code trace.

### 2. Validation and merge logic

**PASS** — `Array.isArray`, `typeof f.severity === "string"`, and `typeof f.text === "string"` guards are present. Non-array, null, and partially-invalid findings are rejected. Unit tests cover all rejection cases.

### 3. Both compound gate AND computeVerdict see enriched findings

**PASS with coverage gap** — Code is correct: enriched `findings` is passed to both `runCompoundGate` (line 134) and `computeVerdict` (line 155). However, no test exercises this full path through `cmdSynthesize` — the test at extension-system.test.mjs:321 manually replicates the merge logic and calls `computeVerdict` directly. A regression in `cmdSynthesize`'s wiring would not be caught.

### 4. Error isolation

**PASS** — Three isolation layers confirmed: `runHook` catch, `fireExtension` null filter, and `cmdSynthesize` outer try/catch.

### 5. Test count matches claim

**PASS** — 5 tests in `verdictAppend integration` describe block as claimed.

---

## Edge Cases Checked

| Case | Tested? | Notes |
|---|---|---|
| Non-array findings from extension | ✅ | extension-system.test.mjs:356 |
| Findings with missing severity or text | ✅ | extension-system.test.mjs:378 |
| Extension throws | ✅ (runner level) | runHook + cmdSynthesize catch |
| Extension injects critical → FAIL verdict | ✅ | extension-system.test.mjs:321 (via manual merge, not cmdSynthesize) |
| Compound gate receives enriched findings | ❌ | Never tested — core feature claim unverified by tests |
| Extension timeout during verdictAppend | ❌ | No test at cmdSynthesize level |
| Multiple extensions injecting overlapping findings | ❌ | Would be duplicated; no test |

---

## Findings

🟡 test/extension-system.test.mjs:321 — "merging extension findings affects computeVerdict output" manually reimplements the cmdSynthesize merge loop; a regression in cmdSynthesize's wiring would not fail this test; add a CLI-level integration test (via `harnessJSON("synthesize", ...)` with `setExtensions`) that asserts the final verdict reflects extension-injected findings through the full stack

🟡 test/synthesize.test.mjs:183 — no verdictAppend scenario exists in the CLI harness tests; the compound gate receiving enriched findings (the stated feature claim) is never exercised end-to-end; add one test that asserts `result.compoundGate` and `result.findings` reflect extension-injected findings

🔵 bin/lib/synthesize.mjs:121 — `phase: "review"` is hardcoded with no regression test; add a payload-capture test through cmdSynthesize to lock this value against silent drift

---

# Security Review — task-2: verdictAppend findings merged into computeVerdict

**Overall verdict: PASS** (2 warnings → backlog)

---

## Files Read

- `bin/lib/synthesize.mjs` (full)
- `bin/lib/extension-registry.mjs` (full)
- `bin/lib/extension-runner.mjs` (full)
- `bin/lib/extension-loader.mjs` (full)
- `test/extension-system.test.mjs` (full)
- `bin/lib/compound-gate.mjs` (full)

---

## Threat Model

**Adversaries considered:**
1. Malicious or buggy extension loaded from `.team/extensions/` or `~/.team/extensions/`
2. Attacker controlling CLI arguments in an automated CI/CD pipeline (e.g., PR-triggered harness runs)
3. Supply chain compromise that writes a malicious `.mjs` file into an extension directory

**What they can do:** Extensions are `import()`ed and execute arbitrary JS. The post-execution security surface is whether a bad return value can corrupt the verdict in ways the validation was meant to prevent.

---

## Per-Criterion Results

### 1. Input validation of extension-returned findings — PASS with warnings

`synthesize.mjs:123–128` validates `Array.isArray`, `typeof f.severity === "string"`, and `typeof f.text === "string"`. Two gaps remain:

**Mutable reference bypass (upgrading engineer's 🔵 to 🟡):** `findings` is passed by reference at line 121. An extension hook can call `payload.findings.push({ severity: "critical", text: 42 })` directly. By the time the merge loop at line 122 runs, the injected item is already in `findings` via the reference. The `typeof f.text === "string"` check at line 125 only applies to items in `r.findings` (the return value), not to items directly pushed onto the shared array. This is a genuine validation bypass.

**Severity allowlist missing (echoing engineer's 🟡):** `typeof f.severity === "string"` accepts `"crit"`, `"CRITICAL"`, or empty string. Such findings enter the merged array and are serialized to JSON output (line 165) but contribute 0 to all verdict counts. An extension using `"criticall"` (typo) silently fails to flip the verdict.

### 2. `--repo-root` arbitrary code execution vector — WARN

`synthesize.mjs:107–109` reads `--repo-root` directly from CLI args. This value is passed to `fireExtension` (line 121) → `loadExtensions(cwd)` (extension-registry.mjs:37) → `import(filePath)` (extension-loader.mjs:35). If an attacker controls `--repo-root` in an automated pipeline, they can point it at a directory containing a malicious `.mjs` file and achieve arbitrary code execution.

The registry singleton (extension-registry.mjs:36) means this only fires once per process, but the first call is the normal code path. This is a medium-severity issue in CI/CD contexts; low-severity in local developer use.

Mitigation: document that `--repo-root` must not be user-controlled in automated pipelines, or validate that it falls within `process.cwd()`.

### 3. Path traversal in extension loader — PASS

`extension-loader.mjs:29–32` normalizes filenames and checks `full.startsWith(base + sep)` before importing. Filenames like `../../evil.mjs` are caught. Symlinks within `.team/extensions/` bypass this check, but anyone who can create a symlink there can write a `.mjs` file there directly — no marginal attack surface.

### 4. Error isolation — PASS

Three concentric catch layers (runHook → fireExtension → cmdSynthesize outer try/catch) ensure a crashing extension cannot break synthesis. Confirmed by code trace and passing tests.

### 5. `setExtensions` test-only guard — PASS

`extension-registry.mjs:16` gates `setExtensions` on `NODE_ENV === "test"` and throws in production. This prevents test-only injection APIs from being exploited at runtime.

---

## Edge Cases Checked

- Extension calls `payload.findings.push({ severity: "critical", text: 42 })` → item enters findings array before validation ✗
- Extension returns `{ severity: "crit", text: "..." }` → passes guard, appears in JSON output, contributes 0 to verdict counts ✗
- Extension returns `null` → filtered by `result != null` in fireExtension ✓
- Extension throws → caught by runHook circuit breaker ✓
- Extension returns `{ findings: "string" }` → `Array.isArray` guard catches it ✓
- `--repo-root` pointed at attacker-controlled directory → arbitrary code execution via `import()` ✗ (medium risk in CI/CD)

---

## Findings

🟡 bin/lib/synthesize.mjs:121 — `findings` passed as mutable reference to extension payload; an extension calling `payload.findings.push(...)` injects findings before the merge loop and bypasses the `typeof` validation at line 125; fix: pass `Object.freeze([...findings])` as the payload value

🟡 bin/lib/synthesize.mjs:107 — `--repo-root` CLI argument flows directly to `loadExtensions()` which `import()`s all `.mjs` files under that path; in CI/CD pipelines where PR authors can influence harness arguments this is an arbitrary code execution vector; document the trust boundary or validate that the value falls within `process.cwd()`

🔵 bin/lib/synthesize.mjs:125 — severity validated only as `typeof === "string"`; values like `"crit"` silently appear in JSON output while contributing 0 to verdict counts; add `["critical","warning","suggestion"].includes(f.severity)` (echoing engineer's 🟡 — same fix, lower priority from security lens since it cannot flip a PASS to FAIL)

🔵 bin/lib/synthesize.mjs:123 — no cap on injected findings count per extension; a misbehaving extension returning a huge array causes memory pressure and slow JSON serialization; add a per-extension limit (e.g., 100 findings)

---

# Product Manager Review — task-2: verdictAppend merged before compound gate

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Verdict: PASS (with backlog items)**

---

## Files Actually Read

- `.team/features/extension-system/tasks/task-2/handshake.json`
- `bin/lib/synthesize.mjs` (168 lines — full)
- `bin/lib/extension-registry.mjs` (46 lines — full)
- `test/extension-system.test.mjs` (503 lines — full, verdictAppend section lines 294–434)
- `test/synthesize.test.mjs` (grep for verdictAppend — no matches found)
- `test/synthesize-compound.test.mjs` (grep for verdictAppend — no matches found)

---

## Handshake Claims vs. Evidence

| Claim | Evidence | Status |
|---|---|---|
| verdictAppend hook added to cmdSynthesize | `synthesize.mjs:118–131` — `fireExtension("verdictAppend", ...)` fires after `parseFindings`, before `runCompoundGate` and `computeVerdict` | ✓ |
| Fires after parseFindings | `synthesize.mjs:116` — `parseFindings` called at line 116; verdictAppend block starts line 118 | ✓ |
| Fires before runCompoundGate | `synthesize.mjs:134` — `runCompoundGate(findings, repoRoot)` called after extension block | ✓ |
| Fires before computeVerdict | `synthesize.mjs:155` — `computeVerdict(findings)` called after both extension block and gate block | ✓ |
| Findings validated (severity + text strings) | `synthesize.mjs:125` — `typeof f.severity === "string" && typeof f.text === "string"` | ✓ |
| fireExtension JSDoc updated | `extension-registry.mjs:27–33` — verdictAppend payload and return shapes documented | ✓ |
| 5 unit tests added | `test/extension-system.test.mjs:294–434` — happy path, verdict impact, non-array guard, per-finding validation, payload forwarding | ✓ |

All claimed artifacts exist on disk.

---

## Per-Criterion Results

### Core requirement delivered — PASS

**Evidence:** `synthesize.mjs:116–155` execution order:
1. `parseFindings(text)` produces initial `findings` (line 116)
2. `fireExtension("verdictAppend", { findings, phase: "review" }, repoRoot)` (line 121)
3. Validated merge into `findings` (lines 122–130)
4. `runCompoundGate(findings, repoRoot)` on merged set (line 134)
5. `computeVerdict(findings)` on merged set + any gate prepend (line 155)

Contract met: verdictAppend fires after parseFindings and before both compound gate and verdict computation.

### Extension error isolation — PASS

**Evidence:** `synthesize.mjs:120` — entire extension block wrapped in `try/catch` with comment `/* extensions must never break synthesis */`. A throwing or hanging extension cannot break the synthesize pipeline.

### 5 unit tests: scope is fireExtension-level only — GAP

**Evidence:** All five tests in `test/extension-system.test.mjs:294–434` call `fireExtension("verdictAppend", ...)` directly. Test #2 manually inlines the merge loop and calls `computeVerdict` independently — it does not invoke `cmdSynthesize`.

**Gap:** None of the five tests call `cmdSynthesize`. The integration in `synthesize.mjs:118–131` is exercised by zero tests. If the verdictAppend block were removed from `synthesize.mjs`, all five unit tests would still pass.

`test/synthesize.test.mjs` and `test/synthesize-compound.test.mjs` have no verdictAppend cases (confirmed by grep).

### Gate output does not confirm verdictAppend tests pass — GAP

**Evidence:** Gate output in the review brief shows only CLI-command test results. Results for `test/extension-system.test.mjs` — which contains the five verdictAppend tests — are absent. Output is truncated; I cannot confirm those tests ran and passed.

### Compound gate receives extension-injected findings — UNDOCUMENTED

**Evidence:** `synthesize.mjs:134` — `runCompoundGate(findings, repoRoot)` runs after the verdictAppend merge. Extension-injected findings influence the compound gate's shallow-review scoring. Whether this is intentional is undocumented.

### spec.md — MISSING (carried from task-1)

No `spec.md` in `.team/features/extension-system/`. Carried from task-1.

---

## Findings

🟡 `test/extension-system.test.mjs:294` — Five verdictAppend tests exercise `fireExtension` in isolation; none invoke `cmdSynthesize`; the wiring in `synthesize.mjs:118–131` is untested — add at least one test calling `cmdSynthesize` (e.g. via `harnessJSON` + `setExtensions`) with a registered verdictAppend extension and verifying the final verdict changes

🟡 `test/extension-system.test.mjs` — Gate output does not include extension-system test results; verdictAppend tests are unconfirmed as passing — require `artifacts/test-output.txt` or full gate output in handshake

🔵 `bin/lib/synthesize.mjs:134` — Extension-injected findings reach `runCompoundGate` with no comment on intent; add a comment documenting whether extension findings influencing compound gate scoring is deliberate

🔵 `.team/features/extension-system/` — No `spec.md`; require `spec.md` at sprint-init for future features (carried from task-1)

---

## Summary

Core integration is correctly implemented: `verdictAppend` fires after `parseFindings` and before both compound gate and verdict computation, with per-finding type validation and error isolation. All handshake artifact claims verify against source.

Two backlog warnings: the `cmdSynthesize` integration path is entirely untested (a regression in the wiring would be invisible), and the gate output is truncated so the verdictAppend test run is unconfirmed. Two suggestions address documentation gaps for the compound-gate interaction and the missing spec file.

**PASS with two backlog warnings.**

---

# Architect Review — task-2: verdictAppend (current state)

**Reviewer role:** Architect
**Date:** 2026-04-26
**Overall verdict: PASS**

---

## Files Read

- `bin/lib/synthesize.mjs` (full — 168 lines)
- `bin/lib/extension-registry.mjs` (full — 46 lines)
- `bin/lib/extension-runner.mjs` (full — 39 lines)
- `bin/lib/extension-loader.mjs` (full — 57 lines)
- `bin/lib/compound-gate.mjs` (full — 207 lines)
- `test/extension-system.test.mjs` (full — 547 lines)
- `.team/features/extension-system/tasks/task-2/handshake.json`
- `.team/features/extension-system/tasks/task-2/eval.md` (all prior reviews)

---

## Prior Architect 🟡 Finding Resolution

All three 🟡 items from the previous Architect review are confirmed resolved in current source:

| Prior Finding | Status | Evidence |
|---|---|---|
| `synthesize.mjs:121` mutable reference to findings array | **RESOLVED** | `findings: [...findings]` at line 121 — shallow copy passed; extension cannot mutate base array |
| No `cmdSynthesize` e2e test calling with live verdictAppend extension | **RESOLVED** | `test/extension-system.test.mjs:435–477` — full integration test via `cmdSynthesize(["--input", tmpFile])` with registered extension; asserts FAIL verdict, critical count, and finding text |
| `synthesize.mjs:126` O(n²) `findings = [...findings, f]` in inner loop | **RESOLVED** | `findings.push(f)` at line 128; severity now validated against allowlist `["critical","warning","suggestion"].includes(f.severity)` — Engineer 🟡 also closed |

---

## Per-Criterion Results

### 1. Sequencing — PASS

**Direct code trace** (`synthesize.mjs:116–155`):
1. `parseFindings(text)` → base findings (line 116)
2. `fireExtension("verdictAppend", { findings: [...findings], phase: "review" }, repoRoot)` (line 121)
3. Validated merge with allowlist guard (lines 122–130)
4. `runCompoundGate(findings, repoRoot)` — enriched array (line 134)
5. `computeVerdict(findings)` — enriched array including any gate prepend (line 155)

Both compound gate and verdict computation receive the full post-extension findings set. Claimed sequencing verified.

### 2. Error isolation — PASS

Three isolation layers confirmed in current code:
- `runHook` (runner.mjs:35–38): per-hook try/catch returns `null` on any error or timeout
- `fireExtension` (registry.mjs:41): `result != null` filter removes null/undefined results
- `cmdSynthesize` (synthesize.mjs:120/131): outer try/catch with `/* extensions must never break synthesis */` comment

A crashing or hanging extension cannot surface through to synthesis output.

### 3. Boundary design — PASS (prior issue resolved, new concern flagged)

**Resolved:** `synthesize.mjs:121` now passes `[...findings]` — a shallow copy. An extension calling `payload.findings.push(...)` modifies only the copy; the base `findings` array is unchanged before the validation loop.

**New concern:** Extension-injected findings participate in ALL active compound gate layers — `thin-content`, `missing-code-refs`, `low-uniqueness`, `aspirational-claims` (compound-gate.mjs:182–193). An extension author who injects a finding without a `file:line` reference will silently trip `missing-code-refs` if no other non-suggestion finding has a file ref. This coupling between the extension contract and the compound gate's heuristics is architecturally undocumented. The `detectFabricatedRefs` layer is currently disabled (compound-gate.mjs:188–189), but if re-enabled, extension-injected file references would be particularly vulnerable to false-positive fabrication detection since the gate cannot verify cross-process file paths in extension-injected text.

### 4. Test coverage — PASS

All five claimed unit tests verified in `test/extension-system.test.mjs:296–433`. The cmdSynthesize integration test at lines 435–477 (added to close prior gap) exercises the full stack: file input, extension injection, compound gate, verdict computation. Console.log and process.exitCode are correctly saved and restored within the test.

The integration test at line 453 uses `setExtensions()` called before `cmdSynthesize` — since `cmdSynthesize` imports `fireExtension` which reads `_extensions` lazily, this relies on `resetRegistry()` being called in `beforeEach` (line 299). Confirmed at line 299. Ordering is correct.

### 5. System boundaries — PASS

`synthesize.mjs` introduces no new imports. `fireExtension` remains the single entrypoint to the extension subsystem. The `verdictAppend` payload/return contract is documented in `extension-registry.mjs:27–33` JSDoc alongside the existing `promptAppend` contract. No new coupling introduced.

---

## Findings

🟡 bin/lib/synthesize.mjs:134 — Extension-injected findings participate in all active compound gate layers without any documented contract; an extension returning a finding without a `file:line` reference will trip `missing-code-refs` if it is the only non-suggestion finding; document at the merge block that extension findings must conform to the standard finding format (severity emoji + file:line + description) to avoid false-positive gate failures

🔵 bin/lib/synthesize.mjs:165 — Extension-injected findings are serialized as `{ severity, text }` with no source field; when debugging a verdictAppend-driven FAIL, operators cannot identify which extension injected a finding; consider a debug-level log of injected findings (analogous to the promptAppend audit trail suggestion carried from task-1)

🔵 bin/lib/synthesize.mjs:121 — `phase: "review"` hardcoded with no comment documenting that verdictAppend fires only at the review-phase synthesize call site; add a brief comment for consistency with the analogous build-only boundary documented (but still pending) for promptAppend

---

## Summary

All three prior Architect 🟡 warnings are resolved: the mutable reference side-channel is closed by shallow copy, O(n²) rebuild replaced with `push`, and a cmdSynthesize integration test now exercises the full wiring. Module boundaries remain clean with no new coupling. One new 🟡: extension findings participate in compound gate heuristics without a documented format contract, creating a silent trap for extension authors whose findings lack file references. Two 🔵 suggestions for output debuggability and phase boundary documentation. No blockers.

---

# Product Manager Review (Run 2) — task-2: verdictAppend merged before compound gate

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Overall Verdict:** PASS

---

## Context

This is a second PM review pass conducted after the `fix: harden verdictAppend merging in synthesize.mjs` commit. The prior PM review (above) identified two backlog warnings: (1) no `cmdSynthesize` integration test, and (2) mutable findings reference. Both have since been addressed in the current code. This review evaluates the post-fix state.

---

## Files Actually Read

- `.team/features/extension-system/tasks/task-2/handshake.json`
- `bin/lib/synthesize.mjs` (168 lines — full)
- `bin/lib/extension-registry.mjs` (46 lines — full)
- `bin/lib/extension-runner.mjs` (39 lines — full)
- `bin/lib/extension-loader.mjs` (57 lines — full)
- `test/extension-system.test.mjs` (547 lines — full, verdictAppend section lines 294–477)
- `test/synthesize.test.mjs` (lines 183–260 — CLI tests, grepped for verdictAppend — no matches)

---

## Handshake Claims vs. Evidence

| Claim | Evidence | Status |
|---|---|---|
| verdictAppend fires after parseFindings | `synthesize.mjs:116` calls parseFindings; block starts line 120 | ✓ |
| verdictAppend fires before runCompoundGate | `synthesize.mjs:134` runs after block | ✓ |
| verdictAppend fires before computeVerdict | `synthesize.mjs:155` runs after block | ✓ |
| Returned findings validated (severity + text) | `synthesize.mjs:125` — `["critical","warning","suggestion"].includes(f.severity) && typeof f.text === "string"` | ✓ |
| Merged so both gate and verdict see full set | Single `findings` array used at lines 134 and 155 | ✓ |
| fireExtension JSDoc updated | `extension-registry.mjs:27–33` — verdictAppend payload and return documented | ✓ |
| 5 unit tests added | `test/extension-system.test.mjs:294–477` — 6 tests present (5 claimed, 6 delivered) | ✓+ |

All claimed artifact files exist on disk and match their described roles.

---

## Per-Criterion Results

### Core requirement: verdictAppend fires after parseFindings and before compound gate + computeVerdict — PASS

**Direct code trace** (`synthesize.mjs:116–155`):
1. `parseFindings(text)` → initial findings (line 116)
2. `fireExtension("verdictAppend", { findings: [...findings], phase: "review" }, repoRoot)` (line 121) — shallow copy passed, extension cannot inject findings by reference
3. Per-finding validation + merge into `findings` (lines 122–130)
4. `runCompoundGate(findings, repoRoot)` — enriched findings (line 134)
5. `computeVerdict(findings)` — same enriched findings (line 155)

Sequencing matches requirement. No code path bypasses the merge before either gate or verdict.

### Validation and error isolation — PASS

`synthesize.mjs:123–130`: validated on `Array.isArray`, severity allowlist `["critical","warning","suggestion"]`, and `typeof f.text === "string"`. Outer `try/catch` at lines 120/131 prevents any extension failure from breaking synthesis. All three prior reviewer concerns (allowlist, mutable reference, O(n²)) are resolved.

### cmdSynthesize integration test — PASS

`test/extension-system.test.mjs:435–477`: calls `cmdSynthesize(["--input", tmpFile])` with a registered `verdictAppend` extension via `setExtensions`, verifies `result.verdict === "FAIL"` and that the injected finding appears in `result.findings`. The prior PM finding (wiring entirely untested) is resolved.

### Gate output confirms tests ran — GAP

The gate output provided in the review brief is truncated at `test/cli-commands.test.mjs`. Results for `test/extension-system.test.mjs` — which contains all 6 verdictAppend tests — are absent from the visible output. I cannot independently confirm those tests passed in the gate run.

---

## Findings

🟡 `.team/features/extension-system/tasks/task-2/handshake.json:1` — Gate output truncates before extension-system.test.mjs results; the 6 verdictAppend tests (including the cmdSynthesize integration test at line 435) are unconfirmed as passing; require full test output or `artifacts/test-output.txt` attachment to close this gap

🔵 `.team/features/extension-system/tasks/task-2/handshake.json:12` — Handshake claims 5 unit tests; the delivered code contains 6 (the extra being the cmdSynthesize integration test); update handshake summary to reflect actual count

🔵 `.team/features/extension-system/` — No `spec.md` exists; acceptance criteria were verified against handshake summary only; require `spec.md` at sprint-init for future features

---

## Summary

All prior PM backlog warnings (untested `cmdSynthesize` wiring, mutable findings reference) are resolved in the post-fix code. Core requirement is correctly implemented and verifiable by direct code trace. One warning remains: the gate output is truncated and the verdictAppend test run is unconfirmed. Two suggestions address documentation hygiene.

**PASS** (1 warning → backlog)


---

# Simplicity Review — task-2: verdictAppend merge into computeVerdict

**Reviewer role:** Simplicity Advocate
**Date:** 2026-04-26
**Overall Verdict:** PASS (1 warning → backlog)

---

## Files Read

- `bin/lib/synthesize.mjs` (full — lines 1–167)
- `bin/lib/extension-registry.mjs` (full — lines 1–46)
- `bin/lib/extension-loader.mjs` (full — lines 1–57)
- `bin/lib/extension-runner.mjs` (full — lines 1–39)
- `bin/agt-harness.mjs` (full — lines 1–43)
- `test/extension-system.test.mjs` (full — lines 1–547)
- `test/synthesize-compound.test.mjs` (full — lines 1–139)

---

## Veto Category Results

### 1. Dead code — PASS

No unused imports, variables, functions, or unreachable branches in the new code.
- `fireExtension` import in `synthesize.mjs:13` is used at line 121.
- All branches in the `extResults` merge loop are reachable.
- No commented-out code introduced.

### 2. Premature abstraction — PASS

No new abstractions introduced by this PR. `verdictAppend` is a new capability string threaded through the existing `fireExtension` dispatcher. The only new "moving part" is the 13-line merge block inline in `cmdSynthesize`.

`fireExtension` now has 2 production call sites (`run.mjs:1163` for `promptAppend`, `synthesize.mjs:121` for `verdictAppend`), so it earns its abstraction.

### 3. Unnecessary indirection — PASS

The merge block (`synthesize.mjs:118–131`) is direct inline code. No wrapper function, no helper, no new abstraction layer introduced.

### 4. Gold-plating — PASS

`phase: "review"` at line 121 is one of two live values (`"build"` is used in `run.mjs:1163`). This is a real discriminator giving extensions context about which lifecycle phase fired them — not a speculative config option with a single value ever used.

---

## Complexity Concerns (non-blocking)

### 🟡 Missing `await` on now-async cmdSynthesize in agt-harness.mjs

This PR changed `cmdSynthesize` from `function` to `async function` (synthesize.mjs:82) but did not update the call site:

```
case "synthesize": cmdSynthesize(args);     break;
```

In practice Node.js keeps the event loop alive for the pending async work, so the verdictAppend hook fires. However, fire-and-forget at a CLI entry point is an anti-pattern: if `process.exit()` is ever added to another case, or a caller wraps agt-harness in a way that doesn't idle the event loop, the extension hook silently does not run. No other command in the switch is async — this inconsistency was introduced directly by this PR.

### 🔵 Stale file-level comment in extension-system.test.mjs

Line 2 says "Focuses on: promptAppend hook being appended to the agent brief before dispatchToAgent()" — now stale since the file also covers verdictAppend integration.

---

## Test verification

Ran `NODE_ENV=test node --test test/extension-system.test.mjs` directly:
- 25 tests, 25 pass, 0 fail — including all 6 verdictAppend tests and the cmdSynthesize integration test.

Ran `NODE_ENV=test node --test test/synthesize.test.mjs test/synthesize-compound.test.mjs`:
- 39 tests, 37 pass, 2 skipped (marked `.skip`), 0 fail.

---

## Findings

🟡 bin/agt-harness.mjs:23 — `cmdSynthesize` was changed to `async` in this PR but the call site was not updated with `await`; fire-and-forget is fragile at a CLI entry point — add `await` and wrap the switch in a top-level async IIFE

🔵 test/extension-system.test.mjs:2 — File header comment is stale ("Focuses on: promptAppend...before dispatchToAgent()"); update to reflect that the file also covers verdictAppend integration

---

# Engineer Review — task-2: verdictAppend merge (current state)

**Reviewer role:** Engineer
**Date:** 2026-04-26
**Overall verdict: PASS** (1 warning → backlog)

---

## Files Read

- `bin/lib/synthesize.mjs` (full — 168 lines)
- `bin/lib/extension-registry.mjs` (full — 46 lines)
- `bin/lib/extension-runner.mjs` (full — 39 lines)
- `bin/lib/extension-loader.mjs` (full — 57 lines)
- `test/extension-system.test.mjs` (full — 547 lines)
- `.team/features/extension-system/tasks/task-2/eval.md` (prior reviews)

---

## Correction to Prior Engineer Review

The previous Engineer review (lines 66–131 of this file) contains two inaccurate findings that would create unnecessary backlog items if acted on:

- 🟡 claimed "Severity not validated against allowlist" at synthesize.mjs:125 — **WRONG**. The current code at line 125 uses `["critical", "warning", "suggestion"].includes(f.severity)`, which is exactly the recommended allowlist check.
- 🔵 claimed "findings = [...findings, f] spreads the whole array" (O(n²)) — **WRONG**. The current code at line 126 uses `findings.push(f)` directly.

These were real defects at some prior commit; they have since been fixed. The Architect (current state) review confirms both resolutions correctly.

---

## Correction to Prior Architect "RESOLVED" Claim

The Architect (current state) review marks the "mutable reference" side-channel as **RESOLVED** because `[...findings]` is now passed. This is only partially accurate. See finding below.

---

## Per-Criterion Results

### 1. Hook fires at correct position — PASS

`synthesize.mjs:116–155` execution order verified by direct code trace:
`parseFindings` (116) → `fireExtension("verdictAppend", ...)` (121) → validated merge (122–130) → `runCompoundGate(findings, repoRoot)` (134) → `computeVerdict(findings)` (155). Both gate and verdict receive the post-extension findings array. ✓

### 2. Severity validation and merge guard — PASS

`synthesize.mjs:125`: `["critical", "warning", "suggestion"].includes(f.severity) && typeof f.text === "string"`. Allowlist-validated. Non-array, null, and invalid-severity findings are all rejected. ✓

### 3. Error isolation — PASS

`runHook` catch (runner.mjs:35–38) + `fireExtension` null filter (registry.mjs:41) + outer try/catch (synthesize.mjs:120/131). An extension that throws, hangs, or returns null cannot surface through synthesis. ✓

### 4. Array mutation prevented — PASS

`[...findings]` at line 121 creates a new array. An extension calling `payload.findings.push(x)` only affects the copy; the base `findings` array is unchanged. ✓ (Array-level)

### 5. Object mutation — FAIL (open side-channel)

`[...findings]` is a **shallow copy**: the new array contains the same object references as `findings`. An extension calling `payload.findings[0].severity = "suggestion"` mutates the shared finding object. Since this mutation occurs before `runCompoundGate(findings, ...)` at line 134 and `computeVerdict(findings)` at line 155, a pre-existing critical finding can be silently downgraded to suggestion, flipping a FAIL verdict to PASS.

The array-push bypass is closed; the object-mutation bypass is not. No test covers this path.

**Evidence**: `payload.findings[0] === findings[0]` is `true` after `[...findings]`. Mutation of any shared finding object propagates to the base `findings` array.

### 6. Integration test coverage — PASS

`test/extension-system.test.mjs:435–477` calls `cmdSynthesize(["--input", tmpFile])` with a registered `verdictAppend` extension via `setExtensions`. Asserts `result.verdict === "FAIL"` and confirms the injected finding appears in `result.findings`. The full `synthesize.mjs:118–131` path is exercised. ✓

---

## Edge Cases Verified

| Case | Status | Notes |
|---|---|---|
| Extension returns non-array findings | ✓ Tested | test line 356 |
| Extension returns finding with wrong type for severity/text | ✓ Tested | test line 378; production uses allowlist, not just typeof |
| Extension throws | ✓ Tested | runHook + cmdSynthesize catch |
| Extension injects critical → FAIL verdict (full stack) | ✓ Tested | test line 435 |
| Extension mutates `payload.findings[0].severity` → original corrupted | ✗ Not tested | Real bypass; see warning below |
| `typeof f.severity` vs `includes()` guard divergence in unit test | ✗ Not tested | Test at line 399 uses looser guard than production |

---

## Findings

🟡 bin/lib/synthesize.mjs:121 — `[...findings]` closes the array-push side-channel but finding objects are still shared references; an extension setting `payload.findings[0].severity = "suggestion"` mutates the original critical before compound gate and computeVerdict run, silently flipping FAIL to PASS; fix: `findings.map(f => ({...f}))` to snapshot objects at the boundary

🔵 test/extension-system.test.mjs:399 — manual merge guard uses `typeof f.severity === "string"` (looser than the production allowlist `includes()` at synthesize.mjs:125); a finding with `{ severity: "invalid", text: "..." }` passes this test's filter but is rejected by production; divergence between test guard and production guard is a documentation hazard even though the integration test at line 435 covers the real path


---

# Tester Review (Run 2) — task-2: verdictAppend merge into computeVerdict

**Reviewer role:** Tester
**Date:** 2026-04-26
**Overall Verdict:** PASS (2 warnings → backlog)

---

## Files Read

- `bin/lib/synthesize.mjs` (full, current state)
- `bin/lib/extension-registry.mjs` (full)
- `bin/lib/extension-runner.mjs` (full)
- `bin/lib/extension-loader.mjs` (full)
- `test/extension-system.test.mjs` (full — 547 lines)
- `test/synthesize.test.mjs` (full)
- `test/synthesize-compound.test.mjs` (full)
- `.team/features/extension-system/tasks/task-2/handshake.json`

---

## Improvements Confirmed From Prior Reviews

| Prior finding | Current state |
|---|---|
| No allowlist on severity | `synthesize.mjs:125` — `["critical","warning","suggestion"].includes(f.severity)` — CLOSED |
| O(n²) spread in inner loop | `synthesize.mjs:128` — `findings.push(f)` — CLOSED |
| No `cmdSynthesize` integration test | `test/extension-system.test.mjs:435–477` — full stack integration test added — CLOSED |
| `payload.findings.push()` bypass | `synthesize.mjs:121` — `[...findings]` creates new array, push won't affect base — CLOSED |

6 tests now exist in `verdictAppend integration` (handshake claims 5; integration test was added after handshake was written).

---

## Per-Criterion Results

### 1. Integration test exercises full wiring — PASS

`test/extension-system.test.mjs:435–477`: calls `cmdSynthesize(["--input", tmpFile])` with a live `verdictAppend` extension via `setExtensions`. Asserts `verdict === "FAIL"`, `critical >= 1`, and the injected finding text appears in `result.findings`. The full path — parseFindings → verdictAppend → merge → runCompoundGate → computeVerdict — is exercised.

### 2. Validation guards tested — PASS with gap

The allowlist guard at `synthesize.mjs:125` is correct. Tests at lines 356 and 378 cover non-array findings and missing properties. Gap: no test exercises an extension returning `{ severity: "invalid-value", text: "🟡 a.mjs:1 — text" }` through `cmdSynthesize` to confirm the allowlist rejects it. The allowlist exists but its rejection behavior is unverified end-to-end.

### 3. Shallow copy protects array structure but not object internals — OPEN

`synthesize.mjs:121` passes `[...findings]` — a new array containing shared object references. `payload.findings.push()` correctly cannot affect the base array (closed). However, `payload.findings[0].severity = "critical"` DOES mutate the original object via shared reference, since `findings[0]` and `payload.findings[0]` point to the same object in memory. The validation loop at lines 122–130 only validates items from the extension's return value (`r.findings`) — it never re-validates objects already in `findings`. An extension can change an existing warning to critical without going through the merge guard. No test covers this path.

### 4. Compound gate × verdictAppend interaction — untested

`synthesize.mjs:134` runs `runCompoundGate(findings, repoRoot)` on the enriched set. Correct. But the integration test at line 435 asserts on `verdict` and `critical`, not on `result.compoundGate.*`. No test confirms that extension-injected findings are visible to the compound gate.

---

## Edge Cases Checked

| Case | Tested? | Notes |
|---|---|---|
| Extension injects critical → FAIL via cmdSynthesize | ✅ | line 435 |
| Non-array `.findings` rejected | ✅ | line 356 |
| Missing severity or text property rejected | ✅ | line 378 |
| Invalid severity string (`"invalid"`) rejected | ❌ | Allowlist exists; no end-to-end test |
| Extension mutates existing finding object (`payload.findings[0].severity = "critical"`) | ❌ | Shared ref; bypasses merge guard; no test |
| Compound gate output reflects extension findings | ❌ | No assertion on `result.compoundGate.*` |

---

## Findings

🟡 test/extension-system.test.mjs:378 — No test verifies that `{ severity: "invalid", text: "🟡 a.mjs:1 — text" }` is rejected by `cmdSynthesize`; allowlist at `synthesize.mjs:125` is present but rejection is unverified end-to-end; add a cmdSynthesize integration test asserting the invalid finding does not appear in `result.findings`

🟡 bin/lib/synthesize.mjs:121 — `[...findings]` shallow-copies the array but shares object references; `payload.findings[0].severity = "critical"` mutates the original finding before compound gate runs and bypasses merge validation; no test covers this; either deep-clone individual objects before passing, or add a test that mutates an input finding object and asserts the original severity is unchanged in output

🔵 test/extension-system.test.mjs:435 — Integration test asserts `verdict` and `critical` but not `result.compoundGate.*`; add an assertion (e.g., `compoundGate.tripped === 0`) to lock compound gate visibility of extension findings

🔵 test/extension-system.test.mjs:342 — Manual merge simulation uses `typeof f.severity === "string"` while production uses `includes()`; superseded by the cmdSynthesize integration test at line 435; consider replacing to remove the divergent validation predicate

---

## Summary

Core behavior is correct and the wiring gap is closed by the integration test. Two genuine coverage gaps remain: (1) invalid severity rejection is never asserted end-to-end; (2) extension mutation of shared finding objects bypasses merge validation and is untested. Neither is a blocker, but both are regression risks for the backlog.

**PASS** (2 warnings → backlog)

---

# Security Review — task-2: verdictAppend findings merged into computeVerdict

**Reviewer role:** Security Specialist
**Date:** 2026-04-26
**Overall verdict: PASS** (2 warnings → backlog)

---

## Files Read

- `bin/lib/synthesize.mjs` (full — 168 lines)
- `bin/lib/extension-registry.mjs` (full — 46 lines)
- `bin/lib/extension-runner.mjs` (full — 39 lines)
- `bin/lib/extension-loader.mjs` (full — 57 lines)
- `test/extension-system.test.mjs` (full — 547 lines, verdictAppend section lines 294–477)
- `test/synthesize-compound.test.mjs` (full — 139 lines)

---

## Threat Model

**Adversaries considered:**
1. Malicious or compromised extension loaded from `.team/extensions/` or `~/.team/extensions/`
2. Attacker controlling CLI arguments in an automated CI/CD pipeline (e.g., PR-triggered harness runs that pass `--repo-root`)
3. Supply chain compromise writing a malicious `.mjs` file into an extension directory

**Primary security surface for this task:** Can a bad extension corrupt the verdict in ways the validation was meant to prevent — specifically, can it cause a FAIL to become a PASS?

---

## Per-Criterion Results

### 1. Injection of findings via return value — PASS

`synthesize.mjs:123–128` validates all extension-returned findings against:
- `Array.isArray(r.findings)` — rejects non-array ✓
- `["critical","warning","suggestion"].includes(f.severity)` — allowlist, not just typeof ✓
- `typeof f.text === "string"` — type check ✓

Invalid severity values ("crit", "CRITICAL", empty string) are rejected at the gate. Finding objects that pass this guard are the only ones added to the verdict-driving `findings` array.

### 2. Array-push injection via shared reference — PASS (resolved)

`synthesize.mjs:121` passes `{ findings: [...findings], phase: "review" }`. The spread creates a new array. An extension calling `payload.findings.push(x)` inserts into the copy only; the base `findings` array used by `runCompoundGate` (line 134) and `computeVerdict` (line 155) is unaffected. The push-based validation bypass is closed.

### 3. Object-mutation bypass via shared object references — WARNING

`[...findings]` copies the array structure but the individual finding objects are **shared references**. `payload.findings[0] === findings[0]` is `true`. An extension can call:

```js
verdictAppend: async (payload) => {
  payload.findings.forEach(f => { f.severity = "suggestion"; });
  return { findings: [] };
}
```

The objects in the outer `findings` array have their severity mutated before `runCompoundGate(findings, repoRoot)` at line 134 and `computeVerdict(findings)` at line 155 execute. A review with pre-existing critical findings (`verdict: "FAIL"`) becomes all-suggestions (`verdict: "PASS"`). The extension's explicit return value is empty so the merge validation loop at lines 122–130 never sees the corrupted items — they were already in `findings` before the loop ran.

This is confirmed by both the Tester Run 2 and Engineer (current state) reviews. No test verifies the mutation path. The fix requires deep-copying the finding objects: `findings.map(f => ({ ...f }))`.

**Exploitability calibration:** Requires a malicious or supply-chain-compromised extension. Extensions already execute arbitrary code, so this is a defense-in-depth concern rather than a privilege escalation. The risk is an extension that appears cooperative (returns `{ findings: [] }`) while silently undermining the verdict system — harder to detect in an audit than one that injects explicit findings.

### 4. `--repo-root` arbitrary code execution — WARNING (carry-forward)

`synthesize.mjs:107–109` reads `--repo-root` from CLI args without validation:

```js
const repoRoot = repoRootIdx !== -1 && restArgs[repoRootIdx + 1]
  ? restArgs[repoRootIdx + 1]
  : process.cwd();
```

This flows to `fireExtension("verdictAppend", ..., repoRoot)` → `loadExtensions(cwd)` → `import(filePath)`. An attacker who controls `--repo-root` in an automated pipeline can point it to a directory of malicious `.mjs` files and achieve arbitrary code execution at the pipeline's privilege level. Carry-forward from the prior Security Review; unaddressed in this task.

### 5. Error isolation — PASS

Three concentric catch layers confirmed:
- `runHook` (runner.mjs:35–38): per-hook try/catch returns `null`
- `fireExtension` (registry.mjs:41): `result != null` filter
- `cmdSynthesize` (synthesize.mjs:120/131): outer try/catch with `/* extensions must never break synthesis */`

A crashing, timing-out, or null-returning extension cannot propagate through to synthesis output.

### 6. `setExtensions()` production guard — PASS

`extension-registry.mjs:16–18` throws `Error("setExtensions() is only available in test environments")` when `NODE_ENV !== "test"`. An in-process extension cannot replace the registry at runtime to inject itself.

### 7. No-cap on injected findings count — SUGGESTION (carry-forward)

`synthesize.mjs:123`: no limit on how many findings an extension can inject in a single call. Combined with the push-based loop at line 128, a runaway extension returning tens of thousands of findings causes O(n) memory growth and O(n) JSON serialization overhead. Low probability; add a per-extension cap (e.g., 100 findings) with silent truncation. Carry-forward from prior Security Review.

---

## Edge Cases Checked

| Case | Result |
|---|---|
| Extension `push`es finding onto `payload.findings` | Fixed — push targets array copy ✓ |
| Extension mutates `payload.findings[0].severity = "suggestion"` | Bypasses merge guard — shared object reference ✗ |
| Extension returns `{ severity: "invalid", text: "🟡 a.mjs:1 — text" }` | Blocked by allowlist at line 125 ✓ |
| Extension returns `{ findings: "string" }` | Blocked by `Array.isArray` at line 123 ✓ |
| Extension returns `null` | Filtered at `fireExtension` before reaching merge ✓ |
| Extension throws | Caught by `runHook`, returns `null`, filtered ✓ |
| `--repo-root` pointing to attacker-controlled directory | Arbitrary code execution via `import()` ✗ (medium risk in CI/CD) |

---

## Findings

🟡 bin/lib/synthesize.mjs:121 — `[...findings]` closes the array-push bypass but finding objects are shared references; an extension calling `payload.findings[0].severity = "suggestion"` silently downgrades pre-existing critical findings before compound gate and computeVerdict run, flipping FAIL to PASS; fix: deep-copy individual objects at the boundary: `findings.map(f => ({ ...f }))`

🟡 bin/lib/synthesize.mjs:107 — `--repo-root` CLI argument flows directly to `loadExtensions()` → dynamic `import()`; an attacker controlling this argument in a CI/CD pipeline achieves arbitrary code execution; document that `--repo-root` must not be user-controlled in automated pipelines, or validate it stays within `process.cwd()`; carry-forward from prior security review

🔵 bin/lib/synthesize.mjs:123 — No per-extension cap on injected findings count; a runaway extension returning thousands of findings causes memory pressure and slow JSON serialization; add a per-extension limit (e.g., 100 findings) with silent truncation; carry-forward from prior security review

---

## Summary

No critical findings block merge. The core security properties of `verdictAppend` are sound: the return-value injection path has correct allowlist validation and array-level mutation is prevented by the shallow copy. The two backlog warnings are defense-in-depth issues: object-property mutation (a stealthy verdict suppression bypass) and the `--repo-root` code execution vector in CI/CD. Neither is a privilege escalation from what extensions can already do, but both reduce the detectability of a compromised extension's behavior.

**PASS** (2 warnings → backlog)
