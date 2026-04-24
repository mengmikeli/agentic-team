# Progress: runbook-system

**Started:** 2026-04-24T12:01:39.538Z
**Tier:** functional
**Tasks:** 9

## Plan
1. `.team/runbooks/` directory is created by `agt init` (or lazily on first `agt run`)
2. At least 2 built-in runbooks ship as defaults and are present after init
3. `matchRunbook(description, spec)` returns the correct runbook for a description that matches a built-in pattern, and `null` when no pattern matches
4. `planTasks()` uses runbook tasks when `matchRunbook` returns a non-null result, confirmed by unit test
5. `progress.md` contains a `[runbook: <name>]` line when a runbook is applied to a feature run
6. `agt runbook list` prints all runbooks in `.team/runbooks/` with name, description, and patterns
7. `agt runbook add <feature-slug>` creates a valid runbook JSON file from a completed feature's task titles
8. `agt runbook show <name>` prints the full runbook definition
9. All new code has passing unit tests; existing test suite remains green

## Execution Log

