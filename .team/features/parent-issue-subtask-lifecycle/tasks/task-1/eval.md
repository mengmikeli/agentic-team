## Parallel Review Findings

🔴 [architect] bin/lib/run.mjs:955 — `getIssueBody() || ""` silently falls back to empty string on any API failure; `editIssue` then fires with an empty base body, overwriting and destroying the parent issue's SPEC.md content with only the checklist; guard with `if (currentBody === null) return;` before calling `editIssue`
[architect] **Why FAIL:** The 🔴 at `run.mjs:955` is a real, confirmed data-loss bug on a realistic failure mode (transient GitHub API error). The engineer review independently found the same issue but mislabeled the verdict PASS. The fix is a single guard line. The other three findings are 🟡 and go to the backlog.
🔴 [engineer] bin/lib/run.mjs:955 — `getIssueBody()` null fallback `|| ""` causes `editIssue` to overwrite parent issue body with only the checklist if the fetch fails; guard with `if (currentBody === null) { /* skip or warn */ }` before calling `editIssue`
[engineer] The 🔴 is real: if `getIssueBody()` returns `null` (transient CLI failure, permission error), the `|| ""` fallback causes `editIssue` to replace the parent approval issue's entire body with just the checklist — the SPEC.md content and everything else is permanently lost. The fix is one-line: check for `null` before proceeding.
🔴 [product] bin/lib/run.mjs:955 — (from Engineer reviewer, concurred) `getIssueBody()` null fallback `|| ""` causes `editIssue` to overwrite the parent issue body with only the checklist if the fetch fails, permanently destroying the existing SPEC.md content; guard against null before calling `editIssue`
[product] **Summary:** The core implementation is correct — `buildTasksChecklist` produces the right markdown, the integration in `run.mjs:951-960` appends it to the parent approval issue with idempotency protection, and the formatter has solid unit test coverage. The 🔴 critical issue (data loss on `getIssueBody` null) was already caught by the Engineer reviewer and must be fixed before this can ship. The two 🟡 warnings (tautological back-link tests, silent `editIssue` failure) go to the backlog.
[security] The 🟡 finding (brittle `## Tasks` duplicate check) goes to backlog. The 🔴 data-loss risk at run.mjs:955 (`getIssueBody() || ""`) was already caught by the Engineer and Architect reviewers and blocks merge — I concur.
🟡 [architect] bin/lib/run.mjs:956 — `currentBody.includes("## Tasks")` idempotency guard too broad; any SPEC.md body containing a `## Tasks` heading permanently suppresses the checklist with no diagnostic; use a unique marker (e.g. `<!-- agt-tasks-checklist -->`) in `buildTasksChecklist` and match it here
🟡 [architect] bin/lib/run.mjs:938 — PROJECT.md re-read per task inside the creation loop despite `projectNum` already parsed at line 924; replace `readFileSync` + re-parse with `if (projectNum) addToProject(issueNum, projectNum)`
🟡 [architect] test/parent-checklist.test.mjs:60 — back-link tests construct the body template inline rather than calling from `run.mjs`; they test a local string literal and provide false coverage confidence; refactor to call a production helper or label clearly as spec documentation
🟡 [engineer] bin/lib/run.mjs:937-940 — PROJECT.md re-read inside per-task loop; `projectNum` is already computed at line 924 — replace inner read+parse with `if (projectNum) addToProject(issueNum, projectNum)`
🟡 [engineer] bin/lib/run.mjs:957 — `editIssue()` return value is ignored; silent failure leaves checklist unappended with no user-visible warning; check return value and log `⚠ Could not append Tasks checklist to issue #N`
[engineer] The two 🟡s are clean-up items: the per-task PROJECT.md re-read is dead redundancy (the outer `projectNum` variable already holds the parsed value), and unlogged `editIssue` failures leave users with no indication the append didn't happen.
🟡 [product] test/parent-checklist.test.mjs:59 — back-link tests assert on their own inline template string, not `run.mjs:929`; a production regression passes silently; replace with a test that calls through to production code
🟡 [product] bin/lib/run.mjs:957 — `editIssue(...)` return value is discarded; if the GitHub edit fails the checklist is silently not appended with no user warning; check return value and log a warning
🟡 [tester] test/parent-checklist.test.mjs:59 — Back-link tests construct strings in-test without calling production code; rewrite to invoke a real helper or mock `createIssue` and assert on the passed argument
🟡 [tester] bin/lib/run.mjs:951 — The `getIssueBody` + `editIssue` integration block (lines 951–960) has zero test coverage; add an integration test mocking both functions and asserting the checklist is appended
🟡 [tester] bin/lib/run.mjs:1324 — Replanned tasks injected via `applyReplan` never get GitHub issues created and the parent checklist is never updated; checklist becomes stale after any replan — test or fix
🟡 [security] `bin/lib/run.mjs:956` — `currentBody.includes("## Tasks")` is a naive substring match; a SPEC.md body containing "## Tasks" as a heading silently prevents the checklist from ever being appended with no user feedback — use a line-anchored pattern (`/^## Tasks$/m`) or a unique sentinel to distinguish the machine-written block from user content
🟡 [simplicity] test/parent-checklist.test.mjs:59 — "back-link template" tests reconstruct the template inline instead of calling production code; add to backlog to replace with tests that exercise `run.mjs:929` directly
🔵 [engineer] bin/lib/run.mjs:956 — `includes("## Tasks")` idempotency check is fragile; any pre-existing `## Tasks` heading in the parent body silently blocks the append; consider a more specific pattern like `## Tasks\n- [ ]`
🔵 [tester] bin/lib/github.mjs:124 — `getIssueBody` and `editIssue` have no null-input guard tests (unlike `commentIssue`); add parity tests to the github integration suite
🔵 [security] `bin/lib/github.mjs:139` — `t.title` is embedded in checklist markdown without newline stripping; a LLM-generated title containing `\n` produces a broken checklist item — add `.replace(/[\r\n]+/g, " ")` before interpolation
🔵 [security] `bin/lib/github.mjs:138` — `t.issueNumber` passes only a truthiness check; an explicit `Number.isInteger(t.issueNumber) && t.issueNumber > 0` guard would harden against corrupt STATE.json data reaching GitHub API calls (risk is low given existing HMAC tamper detection)
🔵 [simplicity] bin/lib/run.mjs:929 — `backLink` is constant per call but recomputed on each loop iteration; hoist above the `for` loop
🔵 [simplicity] bin/lib/github.mjs:136 — `buildTasksChecklist` is a pure string formatter with no `gh` I/O; consider moving to `util.mjs` to keep `github.mjs` as a pure I/O boundary

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs