# Progress: runbook-system

**Started:** 2026-04-26T15:58:39.812Z
**Tier:** functional
**Tasks:** 19

## Plan
1. `bin/lib/runbooks.mjs` exists and exports `loadRunbooks`, `scoreRunbook`, `matchRunbook`, `resolveRunbookTasks`.
2. `loadRunbooks(dir)` reads all `.yml` files from a directory, validates schema (id, name, patterns, minScore, tasks, flow), returns array.
3. `scoreRunbook(description, runbook)` returns a numeric score: regex patterns add their weight on match, keyword patterns add `occurrences × weight`.
4. `matchRunbook(description, runbooks)` returns `{ runbook, score }` for the best match above threshold, or `null`.
5. `resolveRunbookTasks(runbook, allRunbooks)` expands `include:` entries one level deep and returns flat task array.
6. `planTasks()` in `run.mjs` loads runbooks, matches, and uses matched tasks when found.
7. `agt run --runbook add-cli-command` forces that runbook regardless of description.
8. `agt run --runbook nonexistent` logs a warning and falls through to brainstorm.
9. Console output names the matched runbook and score before task execution.
10. 3 built-in runbooks exist in `.team/runbooks/` with valid schema and ≥4 tasks each.
11. Unit tests cover: scoring (regex hit, keyword hit, combined, below threshold), matching (best-of-many, tie-break, no-match), `--runbook` override, unknown runbook fallthrough, `include:` resolution.
12. Full test suite (`npm test`) passes with no regressions.
13. `bin/lib/runbooks.mjs` exists with `loadRunbooks`, `scoreRunbook`, `matchRunbook`, `resolveRunbookTasks` exports.
14. `planTasks()` in `run.mjs` integrates runbook matching before brainstorm fallback.
15. `agt run --runbook <name>` flag is parsed and wired through.
16. 3 built-in runbooks in `.team/runbooks/` with valid schema and ≥4 tasks each.
17. `test/runbooks.test.mjs` passes with ≥10 cases covering scoring, matching, loading, includes, and CLI override.
18. Full test suite (`npm test`) passes with no regressions.
19. Console output names the matched runbook before task execution begins.

## Execution Log

### 2026-04-26 16:14:24
**Task 1: `bin/lib/runbooks.mjs` exists and exports `loadRunbooks`, `scoreRunbook`, `matchRunbook`, `resolveRunbookTasks`.**
- Verdict: 🟡 Review FAIL (attempt 1)
- Will retry with review feedback

### 2026-04-26 16:28:30
**Task 1: `bin/lib/runbooks.mjs` exists and exports `loadRunbooks`, `scoreRunbook`, `matchRunbook`, `resolveRunbookTasks`.**
- Verdict: 🟡 Review FAIL (attempt 2)
- Will retry with review feedback

### 2026-04-26 16:44:01
**Task 1: `bin/lib/runbooks.mjs` exists and exports `loadRunbooks`, `scoreRunbook`, `matchRunbook`, `resolveRunbookTasks`.**
- 🔴 Review-round escalation: blocked after 3 review FAIL round(s)

