# Feature: Execution Report

## Goal
Add `agt report <feature>` — a CLI command that reads a completed feature's STATE.json and produces a structured, human-readable post-run summary covering what shipped, task outcomes, time spent, token cost, and flagged issues.

## Scope

- New `agt report <feature>` command in `bin/agt.mjs` and `bin/lib/report.mjs`
- Reads `.team/features/<feature>/STATE.json` — no new data collection
- Terminal output (default): formatted Markdown rendered to stdout
- `--output md` flag writes a `REPORT.md` file into the feature directory alongside STATE.json
- Report sections:
  1. **Header** — feature name, status (completed/in-progress), run duration, completion timestamp
  2. **Task Summary** — table of tasks: name, status (passed/failed/skipped), attempt count, gate verdict
  3. **Cost Breakdown** — total cost (USD), dispatches, and per-phase split (brainstorm / build / review)
  4. **Blocked / Failed Tasks** — list of tasks with `lastReason` if any are blocked or failed
  5. **Recommendations** — derived from existing data only:
     - Tasks with `attempts >= 3` → "consider breaking into smaller tasks"
     - Overall failure rate > 0 → list failed tasks with reason
     - Gate warning history entries → surface repeated gate warnings
- Works on both completed features (`status: completed`) and in-progress features (partial report, clearly labelled)
- Exits with code 1 and a clear error message if the feature directory or STATE.json does not exist
- `agt help report` returns usage, flags, and an example

## Out of Scope

- Sprint-level or cross-feature aggregation (covered by `agt metrics`)
- Dashboard integration
- Real-time reporting during execution (progress.md already handles that)
- Historical comparisons between runs
- Any new data collection — report is derived entirely from STATE.json and summary already written by `agt finalize`
- Recommendations that require external context (e.g., estimated complexity, team velocity)
- HTML or JSON output formats

## Done When

- [ ] `agt report <feature>` prints a readable report to stdout for a completed feature
- [ ] Report includes all five sections: header, task summary, cost breakdown, blocked/failed tasks, recommendations
- [ ] `agt report <feature> --output md` writes `REPORT.md` to `.team/features/<feature>/REPORT.md`
- [ ] Works on in-progress features (renders partial report with a "Run in progress" label)
- [ ] Exits with code 1 and descriptive error when the feature does not exist
- [ ] `agt help report` shows usage, the `--output` flag, and an example
- [ ] Unit tests cover: completed feature formatting, in-progress feature, missing feature error, `--output md` path
