# Tester Eval — max-review-rounds-escalation / task-1

## Overall Verdict: FAIL

---

## Files Opened and Read

- `.team/features/max-review-rounds-escalation/tasks/task-1/handshake.json`
- `.team/features/max-review-rounds-escalation/tasks/task-1/artifacts/test-output.txt`
- `bin/lib/review-escalation.mjs`
- `test/review-escalation.test.mjs`
- `bin/lib/run.mjs` (import block lines 1–25; review+retry logic lines 1155–1305)

---

## Per-Criterion Results

### Criterion 1: `task.reviewRounds` increments by 1 on review FAIL (critical > 0 or compound gate FAIL)

**PASS** — with evidence.

`incrementReviewRounds` is called at `run.mjs:1163` and `run.mjs:1242` inside `if (synth.critical > 0)` for both single-reviewer and multi-reviewer paths. Compound gate FAIL injects a synthetic critical finding before `computeVerdict` (`run.mjs:1132–1136`, `run.mjs:1208–1210`), so a compound gate FAIL triggers `incrementReviewRounds` indirectly through `synth.critical > 0`.

### Criterion 2: `task.reviewRounds` persisted to STATE.json

**PASS** — with evidence.

After each call, `run.mjs` reads STATE.json fresh, finds the matching task by ID, copies `task.reviewRounds` onto it, and writes it back. Lines 1164–1168 (single review) and 1243–1247 (multi-review).

### Criterion 3: Escalation fires when `reviewRounds` reaches `MAX_REVIEW_ROUNDS`

**FAIL** — no enforcement in runtime.

`shouldEscalate` is not imported in `run.mjs` (only `incrementReviewRounds` is imported at line 18). The function exists in `review-escalation.mjs:26–28` and has unit tests, but is never called anywhere in the run loop. No code path reads `task.reviewRounds` back and blocks the task when the cap is hit. A task that review-fails 3+ times falls through to the generic `maxRetries`/tick-limit instead of being blocked by this mechanism.

Evidence: `shouldEscalate` appears in zero lines of `run.mjs`.

### Criterion 4: Unit tests for `incrementReviewRounds` and `shouldEscalate`

**PASS** (unit level only).

14 tests in `test/review-escalation.test.mjs` covering: initialization from absent field, increment from 0/N, mutation in place, field isolation, `shouldEscalate` at boundaries (0, 1, 2, 3, 4, absent), custom `maxRounds`, and caller-semantics narrative. All 14 pass per `test-output.txt` lines 1244–1263.

### Criterion 5: Integration / run-loop test for escalation action

**FAIL** — gap confirmed.

No test file other than `test/review-escalation.test.mjs` references `reviewRounds`, `shouldEscalate`, or `MAX_REVIEW_ROUNDS`. No test in `integration.test.mjs`, `harness.test.mjs`, `e2e.test.mjs`, or `smoke-terminates.test.mjs` exercises the path "3 consecutive review FAILs → task blocked via review-rounds cap". The smoke test at `test-output.txt:1265` terminates via tick-limit-exceeded, not `MAX_REVIEW_ROUNDS`.

---

## Actionable Feedback

1. **Import and wire `shouldEscalate`** — the cap is computed but never enforced. After `incrementReviewRounds(task)` in both review paths (lines 1163 and 1242 of `run.mjs`), add: `if (shouldEscalate(task)) { harness("transition", "--task", task.id, "--status", "blocked", "--dir", featureDir, "--reason", \`Max review rounds (${MAX_REVIEW_ROUNDS}) exceeded\`); blocked++; break; }`.

2. **Add a run-loop integration test** — simulate a task that always produces critical findings and assert it blocks after exactly `MAX_REVIEW_ROUNDS` FAILs, not after `maxRetries` ticks.

3. **Add a compound-gate-FAIL → increment test** — run `runCompoundGate` on thin findings (≥3 layers trip), feed the synthetic critical finding through `computeVerdict`, assert `incrementReviewRounds` is the correct next call and `task.reviewRounds` increments.
