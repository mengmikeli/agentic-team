# Security Review — max-review-rounds-escalation

**Verdict:** PASS

## Files Read
- `bin/lib/review-escalation.mjs` (full)
- `bin/lib/run.mjs` lines 1220–1380 (review-fail / escalation integration)
- `bin/lib/github.mjs` (`runGh`, `commentIssue`)
- `test/review-escalation.test.mjs` (full)
- `.team/features/max-review-rounds-escalation/tasks/{task-1,task-2,task-3}/handshake.json`
- Gate output (npm test) — exit 0, all suites pass

## Per-Criterion Evidence

- **Input handling / shell injection** — PASS.
  `commentIssue` and `harness("transition", ...)` flow through `spawnSync("gh", args, ...)` with array args (github.mjs:10), so the comment body, task title, and `lastReason` cannot break shell quoting. Verified by reading `runGh`.

- **JSON parsing of untrusted round archives** — PASS.
  `buildEscalationSummary` wraps `JSON.parse` in try/catch (review-escalation.mjs:74-79). Malformed `handshake-round-N.json` is silently dropped; tested at test/review-escalation.test.mjs:216-228.

- **Path traversal in round-file lookup** — PASS.
  Loop bound `for r in 1..reviewRounds` joins integer `r` into `handshake-round-${r}.json`. No untrusted input contributes to the path.

- **Secrets / credential exposure** — PASS.
  No env var, token, or credential is read or logged. `gh` auth is implicit via the user's existing CLI session.

- **Authorization** — N/A.
  Posting comments is gated only by `task.issueNumber` presence (run.mjs:1352). The trust boundary is the local STATE.json — already an established trust boundary in this codebase.

- **Markdown / GitHub comment injection** — flagged (see findings).
  `taskTitle` and finding `text` come ultimately from agent output (review LLMs reading repo content). They are interpolated verbatim into the comment body except for `|` escaping (review-escalation.mjs:54). A finding text containing `\n@channel` or `<details>` would render unexpectedly. Pipe escaping addresses table formatting only.

- **Race / concurrency** — PASS for the threat model.
  STATE.json is read-modify-written without a lock, but the run loop is single-process per feature (parallel-run scoping is enforced elsewhere — commit a24de11).

## Findings

🔵 bin/lib/review-escalation.mjs:54 — Newline in finding `text` will break the table row layout; replace `\n` with space when emitting table cells.
🔵 bin/lib/review-escalation.mjs:54 — `taskTitle` and `text` are interpolated into a GitHub comment without sanitizing markdown/HTML/`@mentions`. Low risk given trusted authors today, but if review prompts ever ingest untrusted issue/PR content, an attacker could craft a finding that pings `@everyone` or smuggles HTML. Consider stripping `@` at word boundaries and disallowing HTML.
🔵 bin/lib/review-escalation.mjs:79 — Silent `catch {}` on `JSON.parse` hides corruption of round archives. A `console.warn` would surface this instead of invisibly losing findings.
🔵 bin/lib/review-escalation.mjs:53 — No length cap on the rendered comment; with extreme finding counts could approach GitHub's 65535-char body limit and the post would silently fail (commentIssue returns false but caller ignores it at run.mjs:1352).

No 🔴 or 🟡 findings.

## Notes
- Verified the gate task's `npm test` artifact (task-3/artifacts/test-output.txt) — all 26 test files pass concurrently=1.
- Builder claims (handshake task-3 PASS, test-result artifact present) match evidence.
- Earlier task-1/task-2 review FAILs reflect prior iteration cycles; they are not part of the current head state and are not security-relevant to the gate.
