# PM Review — task-3

## Verdict: PASS

## Task Under Review
`agt run my-feature` with a `SPEC.md` that is missing one or more required sections exits non-zero, lists the missing sections, and does NOT modify the file or run any tasks.

## Files Actually Read
- `bin/lib/run.mjs` lines 927–957 (the section-gate hunk)
- `test/cli-commands.test.mjs` lines 280–345 (both regression tests)
- `.team/features/document-driven-development/tasks/task-3/handshake.json`

## Evidence
Ran `node --test --test-concurrency=1 test/cli-commands.test.mjs` → 39/39 pass, including:
- `agt run with SPEC.md missing required sections exits non-zero, lists them, and does not modify file`
- `agt run with complete SPEC.md proceeds past the section gate`

## Per-Criterion Results

| Criterion | Result | Evidence |
|---|---|---|
| Exits non-zero on partial spec | PASS | `run.mjs:950` calls `process.exit(1)`; test asserts `result.exitCode === 1` |
| Lists each missing section | PASS | `run.mjs:944-947` iterates and prints each missing name; test verifies all 5 missing sections are listed in output |
| Does NOT modify SPEC.md | PASS | The branch contains no write to `specPath` — control flow exits before any mutation; test reads file before/after and asserts equality |
| Does NOT plan/run tasks | PASS | `process.exit(1)` fires before `planTasks(...)` at `run.mjs:961`; test confirms no tasks in STATE.json |
| Required sections list aligns with brainstorm flow | PASS | The seven sections (Goal, Requirements, Acceptance Criteria, Technical Approach, Testing Strategy, Out of Scope, Done When) at `run.mjs:931-939` match what `buildInteractiveSpec` produces (verified in passing brainstorm-cmd tests) |
| Errors go to stderr with remediation pointer | PASS | `run.mjs:944-948` use `console.error` and direct user to `agt brainstorm <name>` |
| Complete spec is not falsely flagged | PASS | Pass-through smoke test (`good-feature` with all 7 sections) does not hit the gate |

## User-Value Assessment
This change closes a real gap in document-driven development: previously a partial spec could pass the existence check and still leave the user with a half-defined feature. Now the user is told exactly which sections are missing, before any code is generated or any state is written. The error message includes the exact remediation command (`agt brainstorm <featureName>`), so the next step is unambiguous.

## Scope Discipline
The diff stays scoped to the gate — no rewriting of the brainstorm flow, no extraction of a "spec validator" abstraction, no introduction of `--allow-incomplete-spec` escape hatches. Two tests, one for the failure path, one to confirm the happy path is not regressed. Appropriately minimal.

## Findings

🔵 bin/lib/run.mjs:941 — Section regex `^##\s+${s}\s*$` rejects annotated headings like `## Goal — overview` as "missing." Likely intentional strictness, but if real-world specs use annotated headings, consider relaxing to `^##\s+${s}\b`. Backlog-only.
🔵 bin/lib/run.mjs:931 — Required-sections list is duplicated between this gate and the brainstorm template. Hoist to a single constant only if a third caller appears.

No 🔴. No 🟡.

## Summary
Implementation matches the task statement exactly: partial-spec input is fail-closed, all missing sections are surfaced, the spec file is untouched, and no execution side-effects occur. Two regression tests cover the acceptance criteria. PM-side: PASS.
