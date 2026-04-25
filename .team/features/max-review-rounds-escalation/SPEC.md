# Feature: Max Review Rounds + Escalation

## Goal
Cap per-task review FAIL rounds at 3 and, on the 4th would-be retry, halt that task, summarize accumulated findings, and escalate to the human via GitHub issue comments — preventing infinite review-loop spend.

## Requirements
- Track per-task `reviewRounds` counter, persisted in `STATE.json` so it survives crashes and resumes.
- Increment counter once per review FAIL (single-reviewer or multi-perspective synth).
- When `reviewRounds >= 3`, do NOT dispatch another implementation retry; transition the task to `blocked` and break the task loop.
- On escalation, build a deduplicated summary of all critical/warning findings across rounds and post it as a comment on the task's GitHub issue.
- Also append a pointer to the parent (feature/approval) issue body so the human sees the block on the project board.
- Persist per-round handshake archives (`handshake-round-N.json`) containing the round's findings list.
- Cap value `MAX_REVIEW_ROUNDS = 3` is a constant (no CLI flag exposure required for v1).
- `progress.md` records a 🔴 escalation entry with the round count.

## Acceptance Criteria
- [ ] After 3 consecutive review FAILs on the same task, the 4th attempt does not run; task is transitioned to `blocked` with reason `review-escalation: 3 rounds exceeded`.
- [ ] A markdown comment titled `## Review-Round Escalation: <task title>` is posted to the task's GitHub issue with a deduplicated severity/finding table.
- [ ] Findings with identical text across rounds appear once in the table.
- [ ] Parent approval issue body is updated to reference the escalation.
- [ ] `STATE.json` for the task contains `reviewRounds: 3` after the cap is hit.
- [ ] `handshake-round-1.json`, `handshake-round-2.json`, `handshake-round-3.json` exist in the task directory.
- [ ] `progress.md` has a 🔴 line noting the escalation.
- [ ] Subsequent feature tasks are not executed once a task escalates (loop breaks).
- [ ] Successful review (no critical findings) does NOT increment `reviewRounds`.

## Technical Approach
**Module:** `bin/lib/review-escalation.mjs` exporting:
- `MAX_REVIEW_ROUNDS = 3` constant.
- `incrementReviewRounds(task)` — initializes to 0 if absent, then `+= 1`. Mutates in place.
- `shouldEscalate(task, maxRounds = MAX_REVIEW_ROUNDS)` — returns `(task.reviewRounds ?? 0) >= maxRounds`.
- `deduplicateFindings(findings)` — Set-based dedup keyed on `text`.
- `buildEscalationComment(taskTitle, reviewRounds, findings)` — pure markdown builder, escapes `|` in finding text.
- `buildEscalationSummary(taskDir, taskTitle, reviewRounds)` — reads `handshake-round-{1..N}.json`, concatenates `findingsList`, dedupes, returns markdown.

**Integration in `bin/lib/run.mjs`:**
- On review FAIL (both single-reviewer path and multi-perspective synth path):
  1. Call `incrementReviewRounds(task)` and persist counter back to `STATE.json`.
  2. Write `handshake-round-${task.reviewRounds}.json` containing `{...handshake, findingsList: [{severity, text}, ...]}` for critical+warning.
- After FAIL handling, before re-dispatching implementation:
  1. If `shouldEscalate(task)`: build summary via `buildEscalationSummary`, `commentIssue(task.issueNumber, summary)`, append to `state.approvalIssueNumber` body if present, run harness `transition --status blocked --reason "review-escalation: N rounds exceeded"`, increment `blocked` counter, append progress.md line, log to console, `break` out of the task loop.

**Data structures:**
- `task.reviewRounds: number` in `STATE.json`.
- `handshake-round-N.json: { ...handshakeFields, findingsList: Array<{severity: string, text: string}> }`.

## Testing Strategy
- Unit tests in `test/review-escalation.test.mjs` (Node built-in `node:test`):
  - `incrementReviewRounds`: initializes to 1; increments existing.
  - `shouldEscalate`: false at 0/1/2; true at 3; respects custom `maxRounds`.
  - `deduplicateFindings`: drops same-text, keeps distinct text even when severity differs.
  - `buildEscalationComment`: includes title, round count, table rows; escapes `|`; renders empty placeholder when no findings.
  - `buildEscalationSummary`: reads multiple round files from a tmp dir, dedupes across rounds, tolerates missing/malformed files.
- Integration smoke (manual or scripted): run a feature with a force-failing reviewer to confirm task blocks after round 3 and issue comment is posted.

## Out of Scope
- Configurable cap via CLI flag or env var (constant for v1).
- Auto-unblock or auto-retry after human edits the spec.
- Notifying via channels other than GitHub issue comments (no Slack/email/desktop).
- Per-round backoff timers or token-budget caps (separate concerns).
- Changing the review semantics themselves (compound gate, simplicity veto, multi-perspective synth all unchanged).
- Resetting `reviewRounds` between distinct features or after spec edits.

## Done When
- [ ] `bin/lib/review-escalation.mjs` exports the 5 functions + constant listed above.
- [ ] `bin/lib/run.mjs` integrates increment + per-round archive write on every review FAIL path (single + multi-perspective).
- [ ] `bin/lib/run.mjs` checks `shouldEscalate` before retry dispatch and performs the full escalation sequence (comment, parent body update, transition blocked, progress log, loop break).
- [ ] `test/review-escalation.test.mjs` covers all exported functions; `npm test` passes.
- [ ] `STATE.json` `reviewRounds` survives a `agt run` restart (persisted via `writeState`).
- [ ] PRODUCT.md roadmap entry #19 marked ✅ Done.
