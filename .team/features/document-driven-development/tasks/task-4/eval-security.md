# Security Review — task-4

## Verdict: PASS

## Summary
This task adds a single regression test (`test/cli-commands.test.mjs:351-381`) that asserts `agt run my-feature` with a fully valid `SPEC.md` proceeds through planning and dispatch unchanged. No production code was modified — this is a pure test addition that locks in existing behavior.

## Claims vs Evidence
- Handshake claims: regression test added, no production changes, all gates pass.
- Verified via `git show abdbd66` — only `test/cli-commands.test.mjs` (+33 lines) and `handshake.json` were added.
- Verified via `npm test`: 584/584 tests pass, including the new "agt run with fully valid SPEC.md proceeds through planning and dispatch" test (~155ms).

## Files Read
- `.team/features/document-driven-development/tasks/task-4/handshake.json`
- `git show abdbd66 -- test/cli-commands.test.mjs` (the diff)
- `npm test` output (full run)

## Security Lens
- **Input validation**: Test uses controlled fixtures in a tmpDir; no untrusted input is processed by production code in this task.
- **Secrets**: No credentials, tokens, or env vars introduced.
- **Filesystem**: Test writes only inside `tmpDir` and asserts `SPEC.md` is **not** mutated by `agt run` — this is itself a useful safety invariant (read-only gate).
- **Command injection**: Test invokes `runAgt` (existing helper) with a fixed argv array — no shell interpolation of user input.
- **Threat model**: A regression test cannot introduce vulnerabilities into the shipped CLI. The only failure mode would be a flaky/incorrect assertion, which is a quality concern, not a security one.

## Edge Cases Considered
- Could the test leak into other tests? No — uses isolated `tmpDir` per `beforeEach`.
- Could the assertion `after === fullSpec` mask a bug if `runAgt` silently fails? No — `result.ok` (exit 0) and the planning/Flow/dry-run assertions guard against that.
- Could `--dry-run` skip the gate path under test? Checked existing test at line 348 ("smart entry flow") — same pattern is used and passes; the gate runs before dry-run short-circuit.

## Findings

No findings.
