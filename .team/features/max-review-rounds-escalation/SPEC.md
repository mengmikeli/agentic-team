# Feature: Max Review Rounds + Escalation

## Goal
Cap review cycles at 3 rounds per task and escalate to a GitHub issue with a structured summary when the cap is reached, preventing infinite review loops.

## Background
The inner loop in `run.mjs` cycles build → gate → review → fix up to `MAX_RETRIES_PER_TASK` (3) attempts. Currently there is no distinction between "build failed" retries and "review FAIL" retries — they share the same attempt counter. When review repeatedly returns critical findings, the task eventually exhausts its tick budget and gets blocked with no context about what was flagged across rounds. This leaves no actionable signal for humans reviewing failures.

## Scope

- **Track `task.reviewRounds` in STATE.json** — a counter incremented each time a review phase returns a verdict of FAIL (i.e. `findings.critical > 0` or compound gate FAIL). Distinct from `task.attempts` (which includes build failures).
- **Cap at 3 review rounds** — after `reviewRounds >= 3`, stop retrying the review cycle for that task, even if `attempts` budget remains.
- **Generate an escalation summary** — when the cap is hit, produce a structured summary with: task title, round count, and a deduplicated list of critical/warning findings across all review rounds (sourced from handshake.json files).
- **Post the summary to GitHub** — create a comment on the task's linked GitHub issue (if one exists) containing the escalation summary. If no issue exists, log only to progress.md.
- **Block the task with reason** — set task status to `blocked`, set `task.lastReason` to `"review-escalation: 3 rounds exceeded"`.
- **Log escalation event in progress.md** — append a dated entry indicating which task escalated and a short summary of what was flagged.
- **Respect existing limits** — tick-limit enforcement, oscillation detection, and iteration-escalation (compound gate WARNs) continue to fire independently. Max review rounds is an additional guard, not a replacement.

## Out of Scope

- Human-in-the-loop wait / approval gate (no blocking until human responds — this is fire-and-forget escalation).
- Changes to the compound gate logic or iteration-escalation behavior.
- Changing how build failures (non-review) count toward retries.
- Slack/email/webhook notifications — GitHub issue comment is the only escalation channel.
- Configurable round cap via CLI flag or env var (hardcoded to 3).
- Auto-replan after escalation (task is blocked; replan is a separate concern).
- Cross-task escalation aggregation or sprint-level rollup.

## Done When

- [ ] `task.reviewRounds` field exists in STATE.json and increments by 1 each time a review phase produces a FAIL verdict (critical findings > 0 or compound gate FAIL).
- [ ] When `task.reviewRounds` reaches 3, the task is immediately blocked (no further retry attempts) with `lastReason = "review-escalation: 3 rounds exceeded"`.
- [ ] A GitHub comment is posted to the task's linked issue containing: task title, rounds attempted, and deduplicated critical findings from each round's handshake.json.
- [ ] If no GitHub issue is linked, escalation is logged to `progress.md` only (no crash or unhandled error).
- [ ] `progress.md` receives a dated escalation entry for every task that hits the cap.
- [ ] Existing behavior is unchanged when `reviewRounds < 3` — tasks still retry normally up to the attempt budget.
- [ ] Tick-limit enforcement, oscillation detection, and iteration-escalation all continue to fire independently (no regression).
- [ ] Unit tests cover: counter increment on review FAIL, no increment on build/gate FAIL, block fires at round 3, summary generation with deduplication.
- [ ] Integration test: a task that FAILs review 3 times ends up blocked with correct `lastReason` and a GitHub comment (or progress.md fallback) containing findings from all 3 rounds.
