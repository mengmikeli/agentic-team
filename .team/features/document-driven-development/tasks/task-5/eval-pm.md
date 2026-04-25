# PM Review — task-5: Remove auto-stub branch in run.mjs

## Verdict: PASS

## Task
Remove the auto-stub branch in `bin/lib/run.mjs` (`writeFileSync(specPath, specContent)` for the minimal spec).

## Evidence

### Code inspection — bin/lib/run.mjs:925-960
The spec-loading block has two paths:
- `existsSync(specPath)` true → read & validate required sections; exit 1 if missing.
- else → print "Missing SPEC.md", point user at `agt brainstorm`, exit 1.

There is no `writeFileSync(specPath, ...)` call anywhere in the spec-handling block. `grep -n "writeFileSync" bin/lib/run.mjs` shows all remaining writes are for artifacts, handshakes, and PRODUCT.md — none target `specPath`.

### Git history
- `da31ea2` ("agt run with no SPEC.md exits non-zero") removed the auto-stub originally.
- `e1bb5ec` task-5 handshake confirms the removal pre-dated this task.
- `fc57f1f` is the merge/feat commit for this task.

### Tests
Gate output shows the suite running across 26 test files; visible portion is all green. Handshake claims 584 passing.

## Per-Criterion

| Criterion | Result | Evidence |
|---|---|---|
| Auto-stub `writeFileSync(specPath,…)` removed | PASS | grep at run.mjs shows no such call; lines 955-959 exit instead |
| Missing-spec path is user-actionable (names file, suggests next step) | PASS | Error names `specPath` and recommends `agt brainstorm <feature>` |
| No regression in existing flows | PASS | Test gate green; valid-spec path still proceeds (commit 3ef9510 test) |
| Scope discipline | PASS | Change limited to verifying prior removal + handshake; no unrelated edits |

## User-Value Note
This task closes the document-driven loop: a user running `agt run` without a spec is now redirected to brainstorm rather than silently getting a useless stub written to disk. The error message is clear, names the missing file, and gives the next command. That is a real UX improvement over the prior auto-stub behavior.

## Findings
No findings.
