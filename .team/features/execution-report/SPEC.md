# Feature: Execution Report

## Goal
Give users a single command (`agt report <feature>`) that prints a structured, human-readable post-run summary of what shipped, what failed, how long it took, and what it cost.

## Requirements
- `agt report <feature>` prints the report to stdout; `--output md` writes it to `.team/features/<feature>/REPORT.md` instead.
- Report **Header** shows: feature name, final status (completed / in-progress / blocked), wall-clock duration, and total task count.
- Report **What Shipped** section lists every task that reached `passed` status by title (not just ID). If no tasks passed, the section is omitted.
- Report **Task Summary** table includes columns: Task ID, Title, Status, Attempts, Gate Verdict. Title must not be blank for tasks that have one.
- Report **Cost Breakdown** section shows: total cost in USD, total dispatch count, gate run count (pass / fail split), and per-phase cost split (brainstorm / build / review). When token data is unavailable, each field shows `N/A (see agt metrics)`.
- Report **Blocked / Failed Tasks** section lists every task with status `blocked` or `failed`, including its `lastReason` if present. Section omitted when no such tasks exist.
- Report **Recommendations** section emits actionable bullets for: tasks with ≥ 3 attempts, tasks with repeated gate warning layers, features where all tasks are blocked (stalled), and features with zero gate passes. Section omitted when no recommendations apply.
- `agt help report` prints usage, `--output md` flag description, and at least one example.
- Command exits 0 on success, 1 on any error (missing feature name, directory not found, STATE.json missing).
- All behavior is unit-testable via injectable `deps` (no filesystem side-effects in tests).

## Acceptance Criteria
- [ ] `agt report <feature>` prints all required sections to stdout for a completed feature.
- [ ] `agt report <feature> --output md` writes REPORT.md to the feature dir and prints a confirmation line; does NOT also print the full report to stdout.
- [ ] Task Summary table includes a Title column populated from `task.title`.
- [ ] What Shipped section lists passed-task titles; absent when no tasks passed.
- [ ] Cost Breakdown shows `$X.XXXX` when `tokenUsage.total.costUsd` is present; shows `N/A` otherwise.
- [ ] Cost Breakdown shows per-phase split from `tokenUsage.byPhase` when available.
- [ ] Blocked / Failed section shows `lastReason` for each problem task; section absent when all tasks passed.
- [ ] Recommendations fires for tasks with ≥ 3 attempts, gate warning history, all-blocked feature, and zero-pass gates.
- [ ] `agt help report` exits 0 and includes "agt report", "--output", and "agt report my-feature".
- [ ] `agt report` exits 1 with usage message when no feature name given.
- [ ] `agt report no-such-feature` exits 1 with "not found" in output.
- [ ] All existing `test/report.test.mjs` tests pass.

## Technical Approach

**Existing code:** `bin/lib/report.mjs` (`buildReport`, `cmdReport`) and `test/report.test.mjs` are already substantially implemented. The CLI entry in `bin/agt.mjs` (case `"report"`) and help registration are already present.

**Gaps to close:**

1. **Task Summary table — add Title column.** `buildReport` currently renders `| ${task.id} | ${task.status} | ${task.attempts} | ${lastVerdict} |` with no title. Add a Title column: `| ${task.id} | ${task.title || '—'} | ${task.status} | ${task.attempts} | ${lastVerdict} |`. Update the header row accordingly.

2. **What Shipped section.** After the header and before Task Summary, emit a `## What Shipped` section listing passed tasks by title. If `task.title` is missing, fall back to the task ID. Skip section entirely when `tasks.filter(t => t.status === 'passed').length === 0`.

3. **Tests for new sections.** Add test cases in `test/report.test.mjs` for:
   - Title column present in Task Summary table
   - What Shipped section lists passed task titles
   - What Shipped section absent when no tasks passed

No new files needed. No changes to STATE.json schema (title already stored in `task.title`). No CLI changes needed (command, help text, and `--output md` are already wired).

## Testing Strategy

- **Unit tests** (`test/report.test.mjs`): test `buildReport()` directly with injected state fixtures. Existing 15+ tests continue passing; add 3 new tests for title column and What Shipped section.
- **CLI integration test** (`agt help report`): existing `spawnSync` test verifies help output format.
- **Manual smoke test**: run `agt report <any completed feature>` against a real `.team/features/` directory and confirm all sections render correctly with actual token data.

## Out of Scope
- Multi-feature or sprint-level aggregate reports (that's `agt metrics`).
- Token input/output counts in the report (cost USD is sufficient; raw token counts live in `agt metrics`).
- Diff or file-level "what changed" listing (no reliable source in STATE.json).
- PR number or GitHub issue linking in the report.
- Interactive / paged output formats.
- `--output json` flag.

## Done When
- [ ] `buildReport` adds Title column to Task Summary table and emits What Shipped section for passed tasks.
- [ ] Three new unit tests covering title column and What Shipped pass alongside all existing tests (`node --test test/report.test.mjs`).
- [ ] `agt report <feature>` and `agt report <feature> --output md` work end-to-end against a real feature directory.
- [ ] `agt help report` exits 0 with correct output (covered by existing integration test).
- [ ] Feature marked completed in `.team/PRODUCT.md` completed list.
