# Feature: Max Review Rounds + Escalation

## Goal
Cap each task at 3 consecutive review FAIL rounds and, when the cap is reached, block the task and post a deduplicated findings summary to the GitHub issue so a human can triage — preventing infinite review loops.

## Requirements
- `reviewRounds` is tracked per task in STATE.json, initialized to 0, and incremented only on a review FAIL verdict (not on build fail or compound-gate fail).
- `MAX_REVIEW_ROUNDS = 3` is the hard cap (configurable via optional `maxRounds` parameter on the check function).
- When `reviewRounds >= MAX_REVIEW_ROUNDS` after incrementing:
  - The task transitions to `status: "blocked"` with `lastReason: "review-escalation: N rounds exceeded"`.
  - Per-round findings are read from `tasks/{task-id}/handshake-round-{N}.json` (written at each review FAIL round).
  - Findings from all rounds are deduplicated by text and formatted into a markdown table.
  - A comment is posted to the task's GitHub issue: header, round count, deduplicated findings table.
  - The checklist item in the parent approval issue is marked as blocked (`[ ]` → `[x]` with a blocked note).
  - A `🔴 Review-round escalation: blocked after N review FAIL round(s)` line is appended to progress.md.
  - The retry loop breaks — no further build or review attempts for this task.
- Escalation fires in both single-review and multi-review flow paths.
- If no handshake files exist, the GitHub comment falls back to `_No findings recorded._`.
- Malformed handshake JSON is silently skipped (no crash).

## Acceptance Criteria
- [ ] After exactly 3 review FAILs on a task, `task.status` becomes `"blocked"` and `task.lastReason` is `"review-escalation: 3 rounds exceeded"`.
- [ ] After 1 or 2 review FAILs the task is NOT blocked — retry continues normally.
- [ ] A GitHub issue comment is posted containing the task title, round count, and deduplicated findings table on escalation.
- [ ] Findings that appear in multiple rounds appear only once in the comment table.
- [ ] A progress.md entry `🔴 Review-round escalation: blocked after 3 review FAIL round(s)` is written on escalation.
- [ ] Escalation does NOT fire on build fails or compound-gate fails — only on review verdict FAIL.
- [ ] Missing or malformed `handshake-round-N.json` files do not crash escalation; comment still posts with available data.
- [ ] `reviewRounds` is persisted to STATE.json after each increment so a crash-restart resumes the correct count.
- [ ] Both single-review (`flow.phases.includes("review")`) and multi-review (`flow.phases.includes("multi-review")`) paths trigger escalation.

## Technical Approach

### New module: `bin/lib/review-escalation.mjs`
Pure-function module with no side effects (I/O injected or tested separately):
- `MAX_REVIEW_ROUNDS = 3` — exported constant.
- `incrementReviewRounds(task)` — mutates `task.reviewRounds` in place; initializes to 0 if absent.
- `shouldEscalate(task, maxRounds?)` — returns `task.reviewRounds >= maxRounds`.
- `deduplicateFindings(findings[])` — filters by unique `text` field, preserving first occurrence.
- `buildEscalationComment(taskTitle, reviewRounds, findings[])` — returns markdown string; escapes `|` in finding text.
- `buildEscalationSummary(taskDir, taskTitle, reviewRounds)` — reads `handshake-round-{N}.json` files, deduplicates, calls `buildEscalationComment`.

### STATE.json schema additions
Each task object gains:
```json
{ "reviewRounds": 0 }
```
Written via existing atomic state-write path after every `incrementReviewRounds` call.

### Per-round handshake archive
On each review FAIL round, before deciding to retry, the run loop writes:
```
tasks/{task-id}/handshake-round-{N}.json
{ "findingsList": [{ "severity": "critical|warning", "text": "..." }] }
```
`N` equals the new value of `task.reviewRounds` after incrementing.

### Integration in `bin/lib/run.mjs`
In the task retry loop, after review verdict is computed for both single and multi-review paths:
1. If verdict is FAIL: call `incrementReviewRounds(task)`, write round handshake, persist `reviewRounds` to STATE.json.
2. Call `shouldEscalate(task)`.
3. If true: call `buildEscalationSummary`, post GitHub comment, mark parent checklist blocked, append progress.md, set task blocked, break.
4. If false: continue to next retry attempt as before.

Iteration escalation check is unchanged — runs independently after review-round escalation check.

## Testing Strategy
- **Unit tests** (`test/review-escalation.test.mjs`):
  - `incrementReviewRounds`: initializes, increments, does not touch other fields.
  - `shouldEscalate`: false at 0/1/2, true at 3+, respects custom maxRounds, absent field treated as 0.
  - `deduplicateFindings`: empty input, unique inputs, duplicates across rounds, preserves first occurrence.
  - `buildEscalationComment`: includes title and count, shows fallback on empty findings, renders table, escapes pipes.
  - `buildEscalationSummary`: reads round files, deduplicates, handles missing files, handles empty dir.
  - Integration scenario: 3 review FAILs → blocked with correct `lastReason` and progress line.
- **Integration tests** in `test/run.*.test.mjs` (or new `test/review-escalation-integration.test.mjs`):
  - Stub harness + GitHub calls; simulate review FAIL loop; assert task blocked at round 3, not before.
  - Assert STATE.json `reviewRounds` increments correctly across simulated crash/resume.
- **Manual check**: run `agt run` on a feature whose review always fails; confirm GitHub comment appears after round 3 and task shows blocked in dashboard.

## Out of Scope
- Making `MAX_REVIEW_ROUNDS` configurable via CLI flag or config file (use code change if needed).
- Notifying via Slack, email, or any channel other than GitHub issue comment.
- Auto-replanning or auto-simplifying the task after escalation.
- Resetting `reviewRounds` after a successful build (counter only resets if task is re-queued from scratch).
- Per-feature (not per-task) review round caps.
- Surfacing escalation status in the dashboard (deferred to a future dashboard pass).

## Done When
- [ ] `bin/lib/review-escalation.mjs` exists with all five exports (`MAX_REVIEW_ROUNDS`, `incrementReviewRounds`, `shouldEscalate`, `deduplicateFindings`, `buildEscalationComment`, `buildEscalationSummary`).
- [ ] `test/review-escalation.test.mjs` passes with full coverage of all exported functions and the integration scenario.
- [ ] `bin/lib/run.mjs` calls `incrementReviewRounds` + `shouldEscalate` in both single-review and multi-review paths, triggers escalation on round 3, and breaks the retry loop.
- [ ] `reviewRounds` is written to STATE.json after each increment via the atomic state-write path.
- [ ] Per-round `handshake-round-{N}.json` is written to the task artifact directory on each review FAIL.
- [ ] On escalation, a GitHub comment is posted with the deduplicated findings table (verified by test stub or manual run).
- [ ] `progress.md` receives the `🔴 Review-round escalation` line on escalation.
- [ ] All existing tests continue to pass (`npm test` green).
