# Feature: Human Approval Gate

## Goal
After brainstorm writes SPEC.md, the outer loop creates a feature-level GitHub issue (SPEC.md as body), pauses execution, and only proceeds to EXECUTE once a human moves that issue to "Ready" on the project board.

## Background

The outer loop currently runs PRIORITIZE → BRAINSTORM → EXECUTE without any human checkpoint. The brainstorm agent writes SPEC.md autonomously, then immediately dispatches implementation. There is no point where a human can review scope before code is written.

The approval gate inserts a pause between BRAINSTORM and EXECUTE. The human's action — moving the GitHub Project item to "Ready" — is the signal to resume. No human action means no execution. Agents never self-approve scope.

Current gap: GitHub issues are created per *task* inside a feature (in `run.mjs`). This feature adds a *feature-level* issue that exists solely for scope approval, separate from task-level tracking issues.

## Scope

1. **Feature issue creation** — After BRAINSTORM validates SPEC.md, outer loop creates one GitHub issue per feature with:
   - Title: `[Feature] {feature name}` (no phase/roadmap label — this is a scope review, not a task)
   - Body: full SPEC.md content
   - Label: `awaiting-approval` (created if it doesn't exist)

2. **Project board placement** — Issue is added to the GitHub Project board with status `"Pending Approval"` (new column). `PROJECT.md` tracking config stores this column's field option ID.

3. **Outer loop pause** — After issue creation, outer loop prints the issue URL and a message ("Waiting for human approval..."), then enters a polling loop. It does NOT call `runSingleFeature` until the issue's project status is `"Ready"`.

4. **Poll until ready** — Loop polls the project board every N seconds (default 30s, configurable via `APPROVAL_POLL_INTERVAL` env var). On each poll, read the issue's current project status. If `"Ready"`, proceed to EXECUTE. If any other status (still `"Pending Approval"`, or moved to `"Blocked"`), keep waiting.

5. **"Ready" project board column** — A `"Ready"` status option must exist on the project board. `PROJECT.md` tracking config stores this column's field option ID alongside the existing `"todo"`, `"in-progress"`, `"done"` IDs.

6. **SIGINT while waiting** — If the user presses Ctrl+C while the loop is waiting for approval, the outer loop exits cleanly (prints "Stopped while waiting for approval on issue #N") without corrupting STATE.json or leaving a partial feature directory.

7. **Re-entry guard** — If the outer loop resumes and a feature already has an approval issue (stored in `STATE.json` as `approvalIssueNumber`), it skips issue creation and resumes polling from the existing issue. No duplicate issues.

8. **`STATE.json` tracking** — Feature-level `STATE.json` gains an `approvalIssueNumber` field (set after issue creation) and `approvalStatus` field (`"pending"` | `"approved"`). These are written atomically via the existing `atomicWriteSync`.

9. **`agt init` guidance** — `agt init` output or `--help` for this flow explains the two new project board columns ("Pending Approval", "Ready") that must exist, with instructions to add them manually if not present. No automated column creation — project board structure is human-configured.

10. **Unit tests** — Tests covering: feature issue creation, poll-until-ready logic, SIGINT exit during wait, re-entry guard (no duplicate issue), STATE.json fields written correctly.

## Out of Scope

- **Rejection flow** — No "Reject" or "Blocked" status handling. If the human doesn't move to "Ready", the loop waits indefinitely (until SIGINT). Rejection handling is a separate feature.
- **Spec editing round-trip** — No mechanism for human to leave comments and have the agent revise the spec. Approval is binary: move to Ready, or don't.
- **Email/Slack/webhook notifications** — No push notifications when waiting for approval. The CLI output and issue URL are the only signals.
- **Automated project board column creation** — `agt init` does not create "Pending Approval" or "Ready" columns programmatically. Human adds them to the board manually.
- **Dashboard changes** — No new dashboard panels or views for approval status.
- **Task-level approval** — Approval is feature-scope only. Task dispatching (inside `run.mjs`) is unchanged.
- **Multi-feature parallelism** — The outer loop is sequential; approval gates do not enable parallel feature execution.
- **Approval timeout** — No automatic escalation or timeout if human never approves. Indefinite wait until SIGINT.

## Done When

- [ ] After BRAINSTORM, outer loop creates a GitHub issue titled `[Feature] {name}` with SPEC.md as the body and label `awaiting-approval`, and records `approvalIssueNumber` in `STATE.json`
- [ ] Issue is added to the project board with status `"Pending Approval"` using the field option ID stored in `PROJECT.md`
- [ ] CLI prints the issue URL and "Waiting for approval (issue #{N})..." before pausing
- [ ] Outer loop polls the project board at an interval controlled by `APPROVAL_POLL_INTERVAL` env var (default: 30s) and prints elapsed wait time each poll
- [ ] When the project item is moved to `"Ready"`, the loop resumes EXECUTE and sets `approvalStatus: "approved"` in `STATE.json`
- [ ] Pressing Ctrl+C while waiting exits cleanly with a message identifying the pending issue number and no STATE.json corruption
- [ ] If `approvalIssueNumber` is already set in `STATE.json` on re-entry, the loop polls the existing issue instead of creating a new one
- [ ] `PROJECT.md` documents the field option IDs for both `"Pending Approval"` and `"Ready"` columns in the same format as existing status IDs
- [ ] `agt init` help text or `agt help run` explains that "Pending Approval" and "Ready" columns must be added to the project board manually before using the outer loop
- [ ] Unit tests pass for: issue creation writes `approvalIssueNumber`, poll resolves when status is "Ready", SIGINT during poll exits without corrupting state, re-entry guard skips issue creation when `approvalIssueNumber` exists
