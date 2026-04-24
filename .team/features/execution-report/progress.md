# Progress: execution-report

**Started:** 2026-04-24T11:05:49.342Z
**Tier:** functional
**Tasks:** 7

## Plan
1. `agt report <feature>` prints a readable report to stdout for a completed feature
2. Report includes all five sections: header, task summary, cost breakdown, blocked/failed tasks, recommendations
3. `agt report <feature> --output md` writes `REPORT.md` to `.team/features/<feature>/REPORT.md`
4. Works on in-progress features (renders partial report with a "Run in progress" label)
5. Exits with code 1 and descriptive error when the feature does not exist
6. `agt help report` shows usage, the `--output` flag, and an example
7. Unit tests cover: completed feature formatting, in-progress feature, missing feature error, `--output md` path

## Execution Log

