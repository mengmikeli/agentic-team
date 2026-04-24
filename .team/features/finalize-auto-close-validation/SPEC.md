# Feature: Finalize Auto-Close Validation

## Goal
Add integration tests that verify `agt finalize` marks a feature completed and closes all its associated GitHub issues (task issues + approval issue) end-to-end.

## Scope

- Integration test: `agt finalize` sets `STATE.json` status to `"completed"` when all tasks are terminal
- Integration test: `issuesClosed` in the finalize JSON output equals the number of tasks that had an `issueNumber`
- Integration test: the approval issue (`state.approvalIssueNumber`) is also closed by finalize (currently missing — fix + test)
- Tests use a controlled `gh` CLI stub/mock so no real GitHub calls are made
- The stub records which issue numbers were closed so tests can assert correctness
- Cover the case where some tasks lack an `issueNumber` (should not count toward `issuesClosed`)
- Cover the already-finalized idempotency path (no duplicate close attempts)

## Out of Scope

- Project board status updates (those are best-effort and tested elsewhere)
- Changing any finalize validation logic beyond the approval-issue close gap
- End-to-end tests that call the real GitHub API
- Testing `agt run` issue creation — only finalize is in scope

## Done When

- [ ] Test: `agt finalize` on a feature with 2 task issues returns `issuesClosed: 2` in JSON output
- [ ] Test: each closed task issue receives the correct comment (`"Task completed — gate passed."` for passed, status-specific for skipped)
- [ ] Test: `finalize` also closes `state.approvalIssueNumber` when present, and `issuesClosed` reflects it
- [ ] Test: tasks without `issueNumber` are skipped silently and do not affect the count
- [ ] Test: calling `finalize` on an already-completed feature does not re-close issues
- [ ] Implementation: `finalize.mjs` closes `state.approvalIssueNumber` in addition to task issues
- [ ] All existing finalize tests continue to pass
