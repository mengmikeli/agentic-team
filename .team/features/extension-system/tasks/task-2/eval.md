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
