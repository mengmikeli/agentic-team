# Simplicity Review — finalize-auto-close-validation

**Role:** Simplicity reviewer
**Task:** Test: each closed task issue receives the correct comment (`"Task completed — gate passed."` for passed, status-specific for skipped)
**Verdict:** PASS (with backlog items)

---

## Files Opened and Read

- `.team/features/finalize-auto-close-validation/tasks/task-1/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-2/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-2/artifacts/test-output.txt`
- `bin/lib/finalize.mjs` (full file, 142 lines)
- `test/harness.test.mjs` (lines 1–30, 260–415)

---

## Per-Criterion Results

### 1. Does the test actually verify what was claimed?

**PASS — direct evidence.**

Test output (lines 390–392 of test-output.txt):
```
✔ posts correct comment to passed task issue ('Task completed — gate passed.') (496.240167ms)
✔ posts status-specific comment to skipped task issue ('Feature finalized. Task status: skipped.') (285.841291ms)
✔ returns issuesClosed: 2 when feature has 2 tasks with issueNumber (215.078ms)
```

Tests read `gh-calls.log` (the captured stub output) and assert the exact comment strings appear. This is behavioural proof, not structural assertion.

### 2. Test structure — cognitive load

**WARN — three tests share ~90% boilerplate with no helper.**

Each of the three new tests (lines 277–325, 327–375, 377–415) independently:
1. Creates a `mkdtempSync` `fakeBinDir`
2. Writes a `gh` stub shell script to it
3. Creates a feature dir and writes `STATE.json`
4. Calls `execFileSync` with `PATH` override
5. Parses JSON from the last non-empty line of stdout
6. Cleans up in `finally`

Total: ~130 lines for three cases that differ in task status, issue number, feature dir name, and expected comment string. A shared `runFinalizeWithFakeGh(featureDir, tasks)` helper would collapse this to ~60 lines and make the per-case intent immediately legible.

The two comment-checking tests also re-implement the JSON-extraction logic that `harnessJSON` (test lines 23–30) already provides — they can't reuse it because they need a custom `PATH`. Extending `harnessJSON` to accept `{ env }` options would eliminate both the duplication and the raw `execFileSync` calls at test lines 306 and 356.

### 3. Import order — `mkdtempSync` / `tmpdir`

**WARN — imports appear after first use.**

`mkdtempSync` is first used at line 278; `tmpdir` at line 278. Both are imported at lines 464–465, over 180 lines later. JavaScript hoists `import` declarations so this is not a runtime error, but the test file becomes confusing to read: you reach a symbol at line 278 without a nearby declaration. This was already flagged in the prior eval.md (`🔵 [simplicity] test/harness.test.mjs:278`); this review escalates it to 🟡 because it compounds with the other structural issues.

### 4. Dead code in `finalize.mjs:124–127`

**WARN — no-op block earns full I/O cost and adds misleading indirection.**

```js
if (tracking) {
  const projMatch = String(tracking.statusFieldId || "").match(/\d+/);
  // Best-effort: move to done on project board
}
```

`projMatch` is computed and thrown away. `readTrackingConfig()` is called unconditionally on line 116 (filesystem read on every finalize). The comment implies a project-board update happens — it does not. This is not new code introduced by this task, but it is code the tests now exercise (or fail to), and it increases the cognitive surface of `finalize.mjs` for every future reader. Pre-existing finding; already in backlog via multiple prior reviewers.

### 5. `issuesClosed` over-counts on `closeIssue` failure

**WARN — counter increments regardless of `closeIssue` return value.**

```js
closeIssue(task.issueNumber, comment);   // return value discarded
// ...
issuesClosed++;                           // always increments
```

The new tests assert `issuesClosed === 1` / `=== 2` using a stub that always succeeds, so they pass. But the counter will over-report in production when `gh` exits non-zero. The new tests do not cover this failure path. Pre-existing finding; already in backlog via multiple prior reviewers.

---

## Findings

🟡 test/harness.test.mjs:277 — Three new tests repeat identical boilerplate (fake-gh setup, STATE.json write, execFileSync, JSON parse, cleanup); extract a shared `runFinalizeWithFakeGh(dir, tasks)` helper to halve the line count and surface intent
🟡 test/harness.test.mjs:278 — `mkdtempSync` and `tmpdir` are used here but imported at lines 464–465; move imports to the top-of-file block to match the rest of the file
🟡 test/harness.test.mjs:306 — Inline JSON extraction (`lines.split...filter(Boolean)...JSON.parse`) duplicates the logic in `harnessJSON`; extend `harnessJSON` to accept an optional `env` object so these tests can use it instead of raw `execFileSync`
🟡 bin/lib/finalize.mjs:124 — Dead no-op block: `projMatch` is computed but never used; `readTrackingConfig()` pays filesystem I/O on every finalize while delivering nothing; remove until project-board integration is implemented (pre-existing — backlog)
🔵 test/harness.test.mjs:277 — Neither comment-checking test asserts the issue number passed to `gh`; a capturing stub already logs `$@`, so adding `assert.ok(ghCalls.includes("301"))` would guard against argument-order regressions at no cost

---

## Overall Verdict

**PASS**

The new tests are correct, they pass, and they verify the exact strings claimed by the task. The complexity problems are real but not blocking: they are maintenance debt, not correctness issues. All 🟡 items go to backlog.
