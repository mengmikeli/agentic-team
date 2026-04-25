# Security Review — task-6 (happy-path SPEC gate)

## Verdict: PASS

## Scope of Change
This task is **test-only**. Verified via `git diff f8a4f8f~1..5f9754d -- bin/` (empty)
and `git show f8a4f8f --stat` / `git show 5f9754d --stat`. The only code change is
the addition of a regression test in `test/run-spec-gate.test.mjs` (~57 lines)
that asserts `agt run my-feature --dry-run` with a fully populated SPEC.md
proceeds past the gate, plans tasks, and persists ≥1 task to STATE.json.

No production code paths (auth, input handling, secrets, persistence,
external calls) were modified.

## Threat Model for This Change
- **Adversary surface introduced:** none — no new endpoint, no new input
  parser, no new auth check, no new file/network read of untrusted data.
- **Test fixture content** (the hard-coded SPEC.md string at
  `test/run-spec-gate.test.mjs:76-99`) is static and written into a
  per-test `tmpDir`. Not attacker-controlled.
- **`runAgt(["run", "my-feature", "--dry-run"], tmpDir)`** uses a fixed
  argv array, no shell interpolation of user input.

## Per-Criterion Results

### Input validation — N/A
No new input parsing introduced. The SPEC parser already exercised by this
test was not modified in this task.

### Authentication / authorization — N/A
No auth code touched.

### Secrets management — PASS
No tokens, keys, or credentials in the diff. The static SPEC fixture
contains only structural markdown headers and placeholder text.

### Error handling / safe defaults — PASS (with one minor note)
- `JSON.parse(readFileSync(statePath, "utf8"))` at
  `test/run-spec-gate.test.mjs:124` is unguarded, but this is acceptable
  in a test: a malformed STATE.json *should* fail the test loudly. No
  swallowed exceptions, no silent fallbacks that would hide regressions.
- The `if (existsSync(statePath))` guard means the state-based assertion
  is skipped silently if STATE.json is absent. This is a *test-quality*
  concern, not a security one — flagged as a 🔵 suggestion below.

### Common vulnerabilities (XSS / injection / deserialization) — PASS
- No HTML rendering, no SQL, no shell.
- `JSON.parse` runs against a file the harness itself wrote inside
  `tmpDir`; deserialization risk is bounded to test-local state.

## Edge Cases Checked
- Read `test/run-spec-gate.test.mjs` lines 75–131 (the new `it` block).
- Confirmed `runAgt` argv is a fixed array, not string-interpolated.
- Confirmed `tmpDir` is the test harness's per-suite scratch dir
  (consistent with the other tests in the same file).
- Confirmed no new `child_process`, `eval`, `Function`, or `vm` calls.
- Confirmed no env-var or filesystem path is taken from process input.

## Findings

🔵 test/run-spec-gate.test.mjs:122 — `existsSync` guard silently skips the state-based assertion if STATE.json is missing; consider asserting existence so a future regression that stops persisting state is caught loudly.

## Evidence Cited
- `git show 5f9754d --stat` → only test files + handshake/eval artifacts changed
- `git diff f8a4f8f~1 5f9754d -- bin/` → empty (no production code touched)
- Test source read directly: `test/run-spec-gate.test.mjs:75-131`
- Gate output supplied: `npm test` → 546/546 passing
