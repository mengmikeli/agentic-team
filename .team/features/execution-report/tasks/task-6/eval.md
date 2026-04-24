# PM Review — execution-report (`agt report <feature> --output md`)

**Reviewer role:** Product Manager
**Overall verdict: PASS**

---

## Files Actually Read

- `bin/lib/report.mjs` (full, 161 lines)
- `test/report.test.mjs` (full, 293 lines)
- `.team/features/execution-report/SPEC.md` (full)
- `.team/features/execution-report/tasks/task-1/handshake.json`
- `.team/features/execution-report/tasks/task-2/handshake.json`
- `.team/features/execution-report/tasks/task-3/handshake.json`
- `.team/features/execution-report/tasks/task-2/eval.md` (full — parallel review)
- `.team/features/execution-report/tasks/task-3/eval.md` (full — parallel review)
- `.team/features/execution-report/tasks/task-4/eval.md` (security + architect + engineer)
- `.team/features/execution-report/tasks/task-5/eval.md` (simplicity)

---

## Per-Criterion Results

### Done When #1 — `agt report <feature>` prints report to stdout
**PASS**

`bin/lib/report.mjs:157-158`: stdout branch confirmed. `test/report.test.mjs:228-238`: positive test asserts feature name, Task Summary, task IDs, passed status, no exit.

### Done When #2 — Report includes all five sections
**PASS with backlog deviations**

All five sections present:
1. Header — `report.mjs:32-36`, confirmed by test:48-51
2. Task Summary — `report.mjs:39-47`, confirmed by test:53-60
3. Cost Breakdown — `report.mjs:50-65`, confirmed by test:70-77
4. Blocked/Failed Tasks — `report.mjs:68-76`, confirmed by test:79-91
5. Recommendations — `report.mjs:79-102`, confirmed by test:100-131

Two backlog deviations in Section 5 (see Findings):
- Wording for high-attempt tasks deviates from spec
- Failure listing emits count, not per-task list with reason

### Done When #3 — `--output md` writes `REPORT.md` to `.team/features/<feature>/REPORT.md`
**PASS** — Primary criterion for this task.

Code path confirmed (`report.mjs:153-156`):
```js
const outPath = join(featureDir, "REPORT.md");
_writeFileSync(outPath, report + "\n");
_stdout.write(`report: written to ${outPath}\n`);
```
Test at `test/report.test.mjs:242-250` explicitly verifies:
- `join(tmpDir, ".team", "features", "test-feature", "REPORT.md")` is written
- File content includes feature name
- Stdout prints "written to" confirmation
Gate (task-3 handshake): `npm test` exit code 0, 685/685 pass.

### Done When #4 — Works on in-progress features with "Run in progress" label
**PASS**

`report.mjs:31`: `const statusLabel = isComplete ? "completed" : "Run in progress";`

`test/report.test.mjs:142-146`:
```js
it("marks in-progress features in header", () => {
  assert.ok(report.includes("Run in progress"), "Should mark in-progress with 'Run in progress' label");
});
```

**Note on fabricated-refs compound gate warning**: The task-3 parallel review product reviewer raised a 🔴 claiming the code emits `${status} (in progress)` instead of `"Run in progress"`, and a second 🔴 claiming the test uses `includes("in progress") || includes("executing")`. Both claims are false. The current code at line 31 already has `"Run in progress"` and the test at line 145 already checks `.includes("Run in progress")` exactly. The compound gate correctly flagged "fabricated-refs".

### Done When #5 — Exits code 1 with descriptive error when feature does not exist
**PASS**

Three failure paths, all tested:
- No feature name → exit 1 + "Usage:" (`test/report.test.mjs:201-206`)
- Feature dir missing → exit 1 + "not found" (`test/report.test.mjs:210-215`)
- STATE.json missing → exit 1 + "STATE.json" (`test/report.test.mjs:219-224`)

### Done When #6 — `agt help report` shows usage, `--output` flag, and example
**PASS**

`test/report.test.mjs:282-291`: live `spawnSync("node", [agtPath, "help", "report"])` asserts:
- Exit 0
- Output includes "agt report"
- Output includes "--output"
- Output includes "agt report my-feature"

### Done When #7 — Unit tests cover required scenarios
**PASS with gaps**

Covered: completed feature formatting, in-progress feature, missing feature error, `--output md` path.
Coverage gaps go to backlog (see Findings).

---

## Findings

🟡 bin/lib/report.mjs:82 — SPEC requires "consider breaking into smaller tasks" for tasks with attempts >= 3; implementation emits "Consider simplifying task X (N attempts)"; update wording to match spec

🟡 bin/lib/report.mjs:90-93 — SPEC requires "list failed tasks with reason" when failure rate > 0; implementation emits only a count (`"N task(s) need attention"`); failed tasks with reasons ARE in Section 4, but spec requires them listed in Recommendations too

🟡 bin/lib/report.mjs:117 — Arg-ordering bug: `agt report --output md <feature>` resolves featureName to "md" because `args.find(a => !a.startsWith("-"))` picks up the flag value; all tests exercise only feature-first ordering; fix: skip the token immediately following `--output`

🟡 bin/lib/report.mjs:136 — featureName from CLI piped to `path.join` with no prefix-clamp; `../../../../tmp/x` resolves to `/tmp/x`; assert `resolve(featureDir).startsWith(resolve(cwd, ".team", "features") + sep)` before any I/O

🟡 bin/lib/report.mjs:155 — `_writeFileSync` unguarded in `--output md` branch; ENOSPC/EACCES propagates as unhandled exception with stack trace; wrap in try/catch, call exit(1) with readable message

🟡 test/report.test.mjs:245 — All `--output md` tests use `["test-feature", "--output", "md"]` order only; no test for `["--output", "md", "test-feature"]`; arg-ordering bug is untested, preventing regression detection

🔵 bin/lib/report.mjs:59 — `v.costUsd?.toFixed(4)` does not guard `v` itself; `byPhase: { build: null }` throws TypeError; change to `v?.costUsd?.toFixed(4)`

🔵 bin/lib/report.mjs:19 — Truthy guard passes malformed ISO strings; `new Date("not-a-date").getTime()` → NaN → "NaNh" in header; add `if (isNaN(startMs)) { duration = "N/A"; }` after the getTime call

---

## Actionable Feedback

1. **Primary criterion PASS**: `--output md` writes REPORT.md to the correct path. Implementation, tests, and gate all confirm this.

2. **Fabricated-refs in task-3 parallel review**: Two 🔴 findings from the task-3 product reviewer described problems that do not exist in the current code. The compound gate correctly identified this. Do not re-open those issues.

3. **Backlog the two spec-wording deviations** (🟡 items 1–2): The Recommendations section is functionally present but wording deviates from the spec's quoted strings. File as backlog, not rework.

4. **Arg-ordering bug is the highest-priority backlog item** (🟡 item 3): Any user who writes `agt report --output md <feature>` (flag before positional — a natural CLI pattern) silently writes to the wrong directory. This is a UX failure. Treat as coupled with the path-traversal clamp (🟡 item 4).
