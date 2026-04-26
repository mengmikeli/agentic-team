# Simplicity Review — task-5 (run_2): cron-based-outer-loop final state

**Reviewer role:** Simplicity Advocate
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-{1..5}/handshake.json` (all five)
- `bin/lib/cron.mjs` (full, 179 lines)
- `test/cron-tick.test.mjs` (full, 773 lines)
- `bin/lib/util.mjs` (lockFile at lines 98–157; getFlag at lines 35–38)
- `bin/lib/outer-loop.mjs` (readProjectNumber at lines 117–127)
- `bin/agt.mjs` (cron routing at lines 18, 72–73, 174–187, 246–247, 866–867)

---

## Test Verification

Ran `node --test test/cron-tick.test.mjs`: 27 tests, 0 failures.
Ran full suite via `npm test`: 558 tests, 556 pass, 2 skipped, 0 fail. Matches handshake claim.

---

## Four Veto Categories

### 1. Dead Code — PASS

No unused imports, unreachable branches, or commented-out code in `cron.mjs` or
`test/cron-tick.test.mjs`. The `lockFile` dep in early-exit tests (no-config, no-project-number)
is never called due to the pre-lock `process.exit(1)` path — this is defensive test setup, not
production dead code.

### 2. Premature Abstraction — PASS

- `quotePath` (cron.mjs:172) — used 4 times on the following line. Earns its keep.
- `makeLockSpy` (test:44) — used in 13 test cases across the file. Not premature.
- `readProjectNumber` dep injection (cron.mjs:53) — mocked in 7 test cases. Not premature.
- No new single-use abstractions introduced across any task in this feature.

### 3. Unnecessary Indirection — PASS

No wrapper functions or re-exports that only delegate. Every layer transforms or isolates.

### 4. Gold-Plating — PASS

`--interval` is explicitly required in SPEC.md. Four unit tests exercise its boundary cases
(default, custom, zero, negative). The `PATH=...` field in the generated cron line solves an
immediate practical problem (cron's minimal PATH). No speculative extensibility or unused config
options.

---

## Carry-Forward Finding

### `readProjectNumber` duplication — 🟡 (carry-forward, not introduced by this feature cycle)

`bin/lib/cron.mjs:20–31` and `bin/lib/outer-loop.mjs:117–127` are body-for-body identical:
same file path construction, same `/\/projects\/(\d+)/` regex, same try/catch, same return
contract. The only difference is the argument name (`cwd` vs `teamDir`). If the project-URL
format changes, both copies need updating. Flagged in every prior simplicity eval; still
unresolved. Not introduced by this feature.

---

## Findings

🟡 `bin/lib/cron.mjs:20` — `readProjectNumber` duplicates `outer-loop.mjs:117` body-for-body; extract to a shared helper in `util.mjs` (carry-forward from run_1; not introduced by this feature)

---

## Summary

The feature is implemented in 179 lines of production code and 773 lines of tests. No veto-category
violations in any of the five tasks. One carry-forward 🟡 for `readProjectNumber` duplication —
this existed before the feature and was not worsened by it.

**Simplicity Verdict: PASS**

---

# Tester Eval — task-5 (run_2): dispatch-ordering assertion + cron-setup CLI integration test

**Reviewer role:** Test Strategist
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-{1..5}/handshake.json` (all five)
- `bin/lib/cron.mjs` (full, 179 lines)
- `test/cron-tick.test.mjs` (full, 773 lines)
- `bin/agt.mjs` (cron-tick / cron-setup wiring, lines 18, 72–73, 174–187, 243–247)
- `bin/lib/util.mjs` (lockFile, getFlag — lines 35–157)
- `bin/lib/github.mjs` (listProjectItems, setProjectItemStatus — synchronous, lines 238–255)
- `.team/features/cron-based-outer-loop/tasks/task-5/eval.md` (prior rounds — tester run_1 through engineer)

---

## Claims vs Evidence

### Claim 1: dispatch-ordering assertion added to stale+ready coexistence test — VERIFIED

`test/cron-tick.test.mjs:414–416`: `setProjectItemStatus` mock sets `dispatchedIssueNumber = issueNumber` when `status === "in-progress"`.
`test/cron-tick.test.mjs:431`: `assert.equal(dispatchedIssueNumber, 3, "Recovered stale item #3 should be dispatched before item #4")`.

Logic path confirmed: items array from mock is `[{#3, "In Progress"}, {#4, "Ready"}]`. After stale recovery, `staleItem.status` is mutated to `"ready"` in place. `readyItems = items.filter(ready)` preserves array order → `[{#3}, {#4}]`. `readyItems[0]` = #3 → transitions to `"in-progress"` → assertion passes. Prior run_1 🟡 is closed.

### Claim 2: CLI subprocess integration test for `agt cron-setup` added — VERIFIED

`test/cron-tick.test.mjs:752–773`: new `describe("cron-setup CLI integration")` block. Runs `execFileSync("node", [agtPath, "cron-setup"])`, asserts exit 0, finds crontab line via `"* * * *"` search, asserts `"cd "`, `".team/cron.log"` (with `.team/` prefix), and `"2>&1"`. Prior run_1 🟡 is closed.

### Claim 3: 558 full-suite tests pass — CANNOT INDEPENDENTLY VERIFY

No `test-output.txt` artifact stored. Handshake claims "All 558 tests pass" but gate output in task spec is truncated. Count is plausible (553 from task-4 + 3 new tests claimed by task-4 + 2 new here = 558). Carry-forward from every prior PM eval.

---

## Prior run_1 🟡 Findings — Disposition

| Finding | Status |
|---|---|
| No CLI subprocess test for `agt cron-setup` | **FIXED** — test added at line 752 |
| Stale+ready coexistence only asserts `runCalled` | **FIXED** — `assert.equal(dispatchedIssueNumber, 3)` at line 431 |

---

## Remaining Coverage Gaps

### 🔵 Stale recovery: hyphen-format "in-progress" branch never exercised in stale tests

`cron.mjs:93`: matches `s === "in-progress"` (hyphen) OR `s === "in progress"` (space). All stale recovery tests (`cron-tick.test.mjs:409, 442, 477`) use `"In Progress"` (space format only). The hyphen branch is never tested as a stale item. Carry-forward from task-4.

### 🔵 Redirect unit test checks `cron.log` without `.team/` prefix

`test/cron-tick.test.mjs:609`: `assert.ok(output.includes("cron.log"), ...)` would pass if the log path regressed from `.team/cron.log` to `cron.log`. The CLI integration test at line 770 does assert `.team/cron.log` (stronger). Carry-forward from run_1.

### 🔵 Dead double-quote branch in cd unit test

`test/cron-tick.test.mjs:642`: assertion accepts `cd "${cwd}"` but `quotePath` only ever produces single-quoted output. The OR branch is dead. Carry-forward from run_1.

### 🔵 `PATH=` field not asserted in any test

`cron.mjs:173` embeds `PATH=${quotePath(process.env.PATH ?? "")}` — required for `agt` to resolve in cron's minimal environment. Neither the unit tests nor the CLI integration test assert this field is present. Removal would pass all 558 tests silently. Carry-forward from run_1.

### 🔵 `--interval` with non-integer string untested

`cron.mjs:166–167`: `parseInt("foo", 10)` → `NaN`; `!NaN` is `true` → defaults to 30. Correct behavior, but the NaN-default branch has no test. Carry-forward from run_1.

### 🔵 Multiple simultaneous stale in-progress items untested

All stale recovery tests exercise exactly one stale item. The loop at `cron.mjs:95–103` handles multiple, but no test verifies that all are recovered when two or more co-exist.

---

## Findings

🔵 `test/cron-tick.test.mjs:642` — Redirect unit test asserts `cronLine.includes("cron.log")` without `.team/` prefix; assert `".team/cron.log"` to match the stronger CLI integration test assertion at line 770 (carry-forward)

🔵 `test/cron-tick.test.mjs:638` — cd assertion accepts `cd "${cwd}"` as valid but `quotePath` always produces single-quoted output; the double-quote OR branch is dead — remove it (carry-forward)

🔵 `test/cron-tick.test.mjs` (cmdCronSetup block) — No test asserts `PATH=` is present in the generated cron line; a regression removing this field would pass all current tests (carry-forward)

🔵 `test/cron-tick.test.mjs:409,442,477` — All stale recovery tests use `"In Progress"` (space); the `"in-progress"` (hyphen) branch at `cron.mjs:93` is never exercised in a stale-item scenario (carry-forward)

---

## Summary

Both run_1 🟡 findings are closed with direct evidence: dispatch-ordering assertion is present and logically correct (`dispatchedIssueNumber === 3`), and the `cron-setup` CLI integration test is a real subprocess test asserting exit 0 + three key tokens. No critical (🔴) or warning (🟡) findings. Four 🔵 suggestions, all carry-forwards from prior rounds. No new regressions introduced.

**Verdict: PASS**

---

# Tester Eval — task-5 (run_1): cron-setup cd-to-project-root and log-redirect tests

**Reviewer role:** Test Strategist
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-5/handshake.json`
- `bin/lib/cron.mjs` (full, 179 lines)
- `test/cron-tick.test.mjs` (full, 649 lines)
- `.team/features/cron-based-outer-loop/SPEC.md` (full)
- `.team/features/cron-based-outer-loop/tasks/task-4/eval.md` (all sections, for carry-forward tracking)

---

## Tests Counted

Test file has 26 tests across three describe blocks:

- `cmdCronTick`: 16 unit tests (lines 79–581)
- `cmdCronSetup`: 7 unit tests (lines 600–648)
- `cron-tick CLI integration`: 3 subprocess tests (lines 651–743)

Builder claims 26 cron-tick suite / 555 full suite. Count checks out.

---

## Per-Criterion Results

### CR1: cd to project root is present in crontab line — PASS

`cron.mjs:173`: `cd ${quotePath(cwd)} && ...` — `cwd` is `process.cwd()`, path is single-quoted via `quotePath`.
Test at `test/cron-tick.test.mjs:633`: calls `cmdCronSetup([])`, extracts the cron line, reads `process.cwd()` directly, and asserts `cronLine.includes("cd '${cwd}'")`. Test passes and directly exercises the claimed behavior.

One issue noted: the assertion also accepts `cd "${cwd}"` (double-quoted) as valid — see findings.

### CR2: stdout and stderr redirect to .team/cron.log — PASS

`cron.mjs:173`: `>> ${quotePath(cwd + "/.team/cron.log")} 2>&1` — absolute path, single-quoted.
Test at `test/cron-tick.test.mjs:642`: asserts `cronLine.includes(">> ")`, `cronLine.includes("cron.log")`, and `cronLine.includes("2>&1")`. All three sub-assertions pass.

Partial gap: `"cron.log"` matches the implementation's `.team/cron.log` path, but also matches `cron.log` at any location — see findings.

---

## Coverage Gaps

### 🟡 No CLI integration test for `agt cron-setup`

`cron-tick` has three subprocess tests (lines 651–743) that validate CLI wire-up, exit codes, and stdout. `cron-setup` has zero. The command's entire user-visible behavior is the line it prints to stdout; a regression in the agt.mjs dispatcher (wrong command name, wrong function imported, silent exception) would not be caught by unit tests alone. The existing `cmdCronSetup` unit tests call the function directly — they bypass the CLI entry point (`bin/agt.mjs`) entirely.

### 🟡 Stale+ready dispatch priority untested — carry-forward from task-4

`test/cron-tick.test.mjs:399`: after stale recovery, item #3 (mutated to `"ready"`) lands first in `readyItems` and is dispatched ahead of item #4 (originally `"Ready"`). The test only asserts `runCalled === true`. A reordering regression would pass silently. Carry-forward from task-4 tester eval.

### 🔵 `cd` test accepts dead double-quote branch

`test/cron-tick.test.mjs:638`: `cronLine.includes('cd "${cwd}"')` is a dead branch — `quotePath` only produces single-quoted output. Creates a false impression that both quoting styles are acceptable output.

### 🔵 Redirect test does not assert `.team/` directory prefix

`test/cron-tick.test.mjs:646`: `cronLine.includes("cron.log")` would pass if the path regressed to `cwd + "/cron.log"` (dropping `.team/`). Stricter assertion on `".team/cron.log"` would catch this.

### 🔵 PATH forwarding in cron line has no test

`cron.mjs:173` includes `PATH=${quotePath(process.env.PATH ?? "")}` — critical for `agt` resolving in cron's minimal environment. No test asserts this field is present. A removal would pass all current tests.

### 🔵 `--interval` non-integer string is untested

`cron.mjs:166–167`: `parseInt("foo", 10)` returns `NaN`; `!NaN` is `true`, defaults to 30. Correct behavior, but the NaN-default branch has no test.

### 🔵 `listProjectItems` throws path has no test — carry-forward

`cron.mjs:86`: bare call inside `try`. If it throws, the `finally` releases the lock but no `console.error` is emitted. Carry-forward from task-4 tester eval.

### 🔵 Stale tests only use "In Progress" (space) not "in-progress" (hyphen) — carry-forward

`test/cron-tick.test.mjs:409,442,477`: all use space format. The `s === "in-progress"` hyphen branch at `cron.mjs:93` is never exercised in a stale-scenario test. Carry-forward from task-4 tester eval.

---

## Findings

🟡 `test/cron-tick.test.mjs` — No CLI subprocess test for `agt cron-setup`; three subprocess tests exist for cron-tick but zero for cron-setup; add a test that runs `node agt.mjs cron-setup` and asserts the printed line contains `cd`, `.team/cron.log`, and `2>&1`

🟡 `test/cron-tick.test.mjs:399` — Stale+ready coexistence test only asserts `runCalled === true`; dispatch ordering is not asserted; add `assert.equal(dispatchedIssueNumber, 3)` to catch reordering regressions (carry-forward)

🔵 `test/cron-tick.test.mjs:638` — `cd` test accepts `cd "${cwd}"` (double-quoted) as valid output but `quotePath` only produces single-quoted paths; the `||` branch is dead — remove it and assert only `cd '${cwd}'`

🔵 `test/cron-tick.test.mjs:646` — Redirect test checks `cronLine.includes("cron.log")` without the `.team/` prefix; assert `cronLine.includes(".team/cron.log")` to prevent path-regression false passes

🔵 `test/cron-tick.test.mjs` (cmdCronSetup block) — No test asserts `PATH=` is present in the cron line; this field is required for `agt` to resolve in cron's minimal PATH environment

🔵 `test/cron-tick.test.mjs` (cmdCronSetup block) — `--interval` with a non-integer string (e.g., `"foo"`) defaults to 30 via the `!NaN` branch at `cron.mjs:167` but is untested

---

## Summary

**Verdict: PASS**

Both claimed tests are present and exercise the correct behaviors: `cd` to project root (line 633) and `>> .team/cron.log 2>&1` (line 642). All 26 cron-tick suite tests pass. No critical findings.

Two 🟡 backlog items: no CLI integration test for `cron-setup`, and the stale+ready dispatch-priority carry-forward from task-4. Six 🔵 suggestions for test precision and coverage; none are blocking.

---

# Security Review — task-5 (cron-based-outer-loop)

**Reviewer role:** Security specialist
**Date:** 2026-04-26
**Verdict:** PASS

---

## Files Read

- `bin/lib/cron.mjs` (full)
- `bin/lib/util.mjs` lines 35–157 (`getFlag`, `lockFile`)
- `bin/lib/github.mjs` lines 8–20, 219–222 (`runGh`, `commentIssue`)
- `test/cron-tick.test.mjs` (full)
- All 5 `handshake.json` files

---

## Per-Criterion Results

### 1. Crontab shell injection — PASS

**Claim:** `cmdCronSetup` single-quotes paths to handle spaces and special characters.

**Evidence (cron.mjs:172–173):**
```js
const quotePath = (p) => `'${p.replace(/'/g, "'\\''")}'`;
const cronLine = `*/${interval} * * * * cd ${quotePath(cwd)} && PATH=${quotePath(...)} ${quotePath(agtPath)} cron-tick >> ${quotePath(...)} 2>&1`;
```

All four runtime values (`cwd`, `PATH`, `agtPath`, log path) are passed through `quotePath`, which:
- Wraps in single quotes (prevents `$()`, backtick, `~`, and glob expansion in POSIX sh)
- Escapes embedded single quotes with the `'\''` technique

An input like `/path/with'quotes` produces `/path/with'\''quotes` — confirmed correct.

`PATH='...'` as an env-var prefix before the command is valid POSIX sh syntax. Cron invokes `sh -c`, so this holds.

The `--interval` flag is `parseInt`'d before use (line 166–167), so a value like `1; rm -rf /` becomes `NaN` → defaults to 30. Safe.

### 2. Prompt injection via issue title — PASS

**Claim:** Issue title is sanitized of control chars and Unicode line separators before being passed to `runSingleFeature`.

**Evidence (cron.mjs:118):**
```js
const title = (item.title || "").replace(/[\r\n\x00-\x1f\x7f\u0085\u2028\u2029]/g, " ").trim().slice(0, 200);
```

Strips:
- ASCII control chars (U+0000–U+001F, U+007F)
- CR/LF
- U+0085 (NEL), U+2028 (Line Separator), U+2029 (Paragraph Separator)
- Truncates to 200 characters

Test coverage verified at lines 320–370 in `test/cron-tick.test.mjs` — four dedicated tests covering ASCII controls, Unicode separators, and length truncation.

### 3. Shell injection via `commentIssue(err.message)` — PASS

**Evidence (github.mjs:8–19):**
```js
function runGh(...args) {
  const result = spawnSync("gh", args, { ... });
}
```

`commentIssue` calls `runGh("issue", "comment", String(number), "--body", body)`. Arguments are passed as an array to `spawnSync` with no `shell: true` option. The body string (which may contain `err.message`) is therefore treated as a literal argument — no shell expansion possible regardless of content.

### 4. Concurrent run protection — PASS

**Evidence (cron.mjs:77–82):**
```js
const lock = _lockFile(lockPath, { timeout: 0, command: "cron-tick" });
if (!lock.acquired) {
  console.log("cron-tick: tick already running (lock held by another process)");
  process.exit(0);
}
```

`timeout: 0` means try-once semantics. `lockFile` writes an exclusive file (`wx` flag at util.mjs:134) and validates PID liveness on read. Lock is released unconditionally in `finally` (cron.mjs:154).

CLI integration test at `test/cron-tick.test.mjs:703` writes a lock file owned by the live test-runner PID and asserts the subprocess exits 0 with "already running".

### 5. `--dry-run` flag isolation — PASS

**Evidence (cron.mjs:129):**
```js
await _runSingleFeature([], title);
```

Empty args array `[]` is hardcoded, not forwarded from CLI. This was an explicit fix per task-4 handshake. Test at line 177 asserts `runArgs === []`.

### 6. Stale in-progress recovery — PASS

When the lock is acquired and an in-progress item is found, the recovery path (cron.mjs:95–101) correctly:
- Calls `_setProjectItemStatus(item, "ready")` first
- Only mutates in-memory status in the `else` branch (successful revert)
- Emits a warning when the revert fails, continuing without re-dispatching the item

No TOCTOU issue — the in-memory mutation only affects the local `items` array used for filtering in the same tick.

---

## Findings

No critical (🔴) or warning (🟡) findings.

🔵 bin/lib/cron.mjs:144 — `err.message` posted as GitHub comment with no length bound; if an agent throws a very long error, `gh` API call may fail silently (already handled: returns false → logs warning). Consider `.slice(0, 2000)` to stay well under GitHub's 65,536-char limit.

🔵 bin/lib/cron.mjs:173 — If `process.env.PATH` is empty string, generated crontab sets `PATH=''`; cron job would fail to find `node`. No security impact but may surprise user. Could note in the printed instructions to verify PATH is set.

---

## Overall Verdict: PASS

All security-relevant paths are covered:
- Crontab output is safe against shell injection via single-quoting
- Issue title is sanitized against prompt injection with Unicode coverage
- GitHub API calls use `spawnSync` arg arrays (no shell injection surface)
- Concurrency guard is enforced at the filesystem level with PID-liveness checking
- CLI flag isolation prevents `--dry-run` from leaking into automated feature runs
- Stale recovery is logically correct with no TOCTOU exposure

---

# Architect Eval — task-5 (cron-setup: cd to project root + log redirect)

**Reviewer role:** Software Architect
**Date:** 2026-04-26
**Handshake run:** run_1
**Verdict: PASS**

---

## Files Read

- `bin/lib/cron.mjs` (full, 179 lines)
- `test/cron-tick.test.mjs` (full, 743 lines)
- `bin/agt.mjs` (CLI wiring at lines 18, 72–73, 877)
- `bin/lib/util.mjs` (lockFile, getFlag — lines 35–166)
- `bin/lib/github.mjs` (listProjectItems, setProjectItemStatus, readTrackingConfig)

---

## Per-Criterion Results

### 1. `cmdCronSetup` feature correctness — PASS

`cron.mjs:165–179`:
- `cd '${cwd}'` is included in the cron line (test line 633–639 asserts this directly)
- `>> '${cwd}/.team/cron.log' 2>&1` present (test line 642–648 asserts `>>`, `cron.log`, `2>&1`)
- All four runtime values (`cwd`, `PATH`, `agtPath`, log path) passed through `quotePath` which escapes embedded single quotes via `'\\''`
- `PATH=...` prefix in cron line is valid POSIX sh env-var assignment

### 2. Lock correctness — PASS

`lockFile(lockPath, { timeout: 0 })` at `cron.mjs:78`:
- `timeout: 0` → `deadline = Date.now()` → any live-holder check returns `{ acquired: false }` on the first loop iteration
- Stale (dead-PID) locks are cleaned up and acquired — verified by CLI integration test at line 703
- `lock.release()` is in the outer `finally` (line 153–155) — every code path calls it

### 3. Stale in-progress recovery — PASS with noted coupling

`cron.mjs:91–103` correctly filters, reverts, warns on failure, and mutates `staleItem.status = "ready"` so recovered items enter the ready pool. Three tests at lines 399–499 cover all three sub-cases.

### 4. No arg forwarding to `runSingleFeature` — PASS

`cron.mjs:129`: `_runSingleFeature([], title)` — empty array hardcoded. Test line 177 asserts `runArgs` is `[]`.

### 5. CLI wiring — PASS

`agt.mjs:72–73` routes both commands. `main().catch(err => { console.error(err); process.exit(1); })` at line 877 handles any propagating unhandled rejection.

---

## Findings

🟡 `bin/lib/cron.mjs:101` — `staleItem.status = "ready"` mutates the object from the `items` array in-place; the downstream filter at line 106 depends on this mutation. If `listProjectItems` is ever refactored to return frozen or structurally-cloned objects the mutation silently no-ops — stale items would be skipped without error. Track recovered item IDs in a separate `Set` (or `recoveredItems` array) and build the ready pool as `[...recoveredItems, ...items.filter(ready)]` to remove the reference dependency. (Carry-forward from Simplicity run_3.)

🟡 `bin/lib/github.mjs:266` — `setProjectItemStatus` re-calls `gh project item-list` internally on every invocation even though the caller (`cron.mjs:86`) already obtained item IDs from its own `listProjectItems` call. One tick with stale recovery + dispatch makes 1 (initial list) + up to 3 redundant lists inside each status transition = 4+ `item-list` calls total. The item `id` field is present in the `listProjectItems` result (github.mjs:246) but unused. Thread the item `id` as an optional parameter to eliminate redundant API calls; backlog for rate-limit headroom.

🔵 `bin/lib/cron.mjs:173` — `cwd + "/.team/cron.log"` uses string concatenation where the rest of the module uses `join()`. Change to `join(cwd, ".team", "cron.log")` for consistency.

---

## Edge Cases Checked

- No ready items → exits 0, lock released ✓
- Lock held by live PID → exits 0 immediately ✓
- `readTrackingConfig` returns null → exits 1 before lock acquired ✓
- `readyId` absent → `!tracking.statusOptions["ready"]` exits 1 (line 64) ✓
- `listProjectItems` throws in production → caught internally, returns `[]` ✓
- Stale item only (no other ready items) → recovered and re-dispatched ✓
- `commentIssue` throws on failure → swallowed, original error preserved ✓
- Title with 300 chars → truncated to 200 ✓
- Cron line paths with spaces/single-quotes → `quotePath` escapes correctly ✓
- `--interval` non-numeric → `parseInt` → `NaN` → defaults to 30 ✓

---

## Not Checked (scope boundary)

- `runSingleFeature` implementation (separate module)
- Real GitHub CLI API responses
- Actual crontab installation on target OS

---

## Summary

Implementation is correct and well-tested. `cmdCronSetup` correctly includes `cd` to project root and redirects output to `.team/cron.log`. All prior task-4 findings are closed. Two 🟡 backlog items: the in-place mutation coupling in stale recovery (carry-forward), and the redundant `item-list` API calls inside `setProjectItemStatus`. Neither blocks merge.

**Architect Verdict: PASS**

---

# Simplicity Review — task-5 (run_1): cron-setup cd-to-project-root and log-redirect tests

**Reviewer role:** Simplicity Advocate
**Date:** 2026-04-26
**Handshake run:** run_1
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-5/handshake.json`
- `bin/lib/cron.mjs` (full, 179 lines)
- `test/cron-tick.test.mjs` (full, 743 lines)
- `.team/features/cron-based-outer-loop/SPEC.md` (full)
- `.team/features/cron-based-outer-loop/tasks/task-4/eval.md` (all sections — simplicity and architect runs)
- `bin/lib/util.mjs` (`getFlag` definition, lines 35–38)
- `bin/lib/outer-loop.mjs` (`readProjectNumber` at lines 117–125)

---

## Claim Verification

Builder claims:
1. `cmdCronSetup` was already implemented in `bin/lib/cron.mjs` — **VERIFIED** (`cron.mjs:165–179`)
2. Two new tests added: cd-to-project-root and log-redirect — **VERIFIED** (`cron-tick.test.mjs:633` and `:642`)
3. 26 passing cron-tick tests — **CONSISTENT** with prior count of 24 + 2 new tests

---

## Four Veto Categories

### 1. Dead Code — PASS

No dead code. Both new tests exercise real, observable behavior in `cmdCronSetup`:
- Line 633: asserts `cronLine.includes(\`cd '${cwd}'\`)` — `cron.mjs:173` emits exactly this.
- Line 642: asserts `>> `, `cron.log`, and `2>&1` in the cron line — `cron.mjs:173` emits exactly this.

No existing code is made unreachable by the new tests.

### 2. Premature Abstraction — PASS

No new abstractions introduced. The `quotePath` helper at `cron.mjs:172` (pre-existing) is used 3
times on the immediately following line 173. `makeLockSpy()` is a pre-existing test helper. No
new helpers or types added by task-5.

### 3. Unnecessary Indirection — PASS

No new wrappers or delegates.

### 4. Gold-Plating — PASS

The `--interval` flag is explicitly in the SPEC (`SPEC.md:50`). No new config options, feature
flags, or speculative extensibility introduced by task-5. The `PATH=...` clause in the generated
cron line (`cron.mjs:173`) solves an immediate practical problem (cron's default minimal PATH
would fail to find `agt`) and is not speculative — it captures the current process PATH.

---

## Implementation Review (pre-existing, not changed by task-5)

`cmdCronSetup` (`cron.mjs:165–179`) is 15 lines: reads one flag, constructs one string, prints
three lines. No abstractions beyond `quotePath`, no conditional branching beyond interval
validation.

### `quotePath` usage — clean

Used 3 times in the same statement at line 173. Inlining three identical single-quote-escape
expressions would be harder to read. Passes the 2-call-site threshold by one.

### Test at line 600 partial overlap — acceptable

The existing test at line 600 already asserts `output.includes("cron.log")`. The new test at
line 642 also checks `cron.log` but adds `>>` and `2>&1`, testing redirect syntax rather than
filename presence. Not redundant.

---

## Carry-Forward Issues (not introduced by task-5)

### `readProjectNumber` duplication — carry-forward 🟡

`cron.mjs:20–31` and `outer-loop.mjs:117–125` are body-for-body identical: same regex
(`/\/projects\/(\d+)/`), same try/catch, same return contract. Flagged in every prior simplicity
eval; still unresolved. Task-5 did not introduce or worsen it.

---

## Findings

🟡 `bin/lib/cron.mjs:20` — `readProjectNumber` duplicates `outer-loop.mjs:117` body-for-body; if the project-URL regex changes, both copies need updating — extract to a shared utility (carry-forward, not introduced by task-5)

---

## Summary

Task-5 is minimal: two targeted tests that verify two observable properties of `cmdCronSetup`.
No new implementation, no new abstractions, no new complexity. Both tests are well-scoped —
they find the cron line by searching for `"* * * *"` and assert specific substrings. No veto-
category violations. The single carry-forward finding was already in the backlog from prior runs.

**Simplicity Verdict: PASS**

---

# PM Eval — task-5: `agt cron-setup` prints crontab line with cd + log redirect

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-5/handshake.json`
- `bin/lib/cron.mjs` (full, 179 lines)
- `test/cron-tick.test.mjs` (full, 743 lines)
- `bin/agt.mjs` (cron-setup wire-up at line 73)
- `.team/features/cron-based-outer-loop/SPEC.md` (full)

---

## Requirement

> `agt cron-setup` prints a crontab line that cd's to the project root and invokes `agt cron-tick >> .team/cron.log 2>&1`

---

## Per-Criterion Results

### CR1: cd to project root — PASS

`cron.mjs:173`: the cron line includes `cd ${quotePath(cwd)}` where `cwd = process.cwd()`.
Test at `cron-tick.test.mjs:633` asserts `cronLine.includes(\`cd '${cwd}'\`)`. Direct evidence. ✅

### CR2: invokes `agt cron-tick` — PASS

`cron.mjs:173`: `${quotePath(agtPath)} cron-tick` where `agtPath = process.argv[1]` resolves to the installed `agt` binary path. Test at `cron-tick.test.mjs:603` asserts `output.includes("cron-tick")`. ✅

### CR3: redirects stdout and stderr to `.team/cron.log` — PASS

`cron.mjs:173`: `>> ${quotePath(cwd + "/.team/cron.log")} 2>&1`. The log path is absolute (appends cwd prefix), which is strictly more robust than relative since cron may not inherit the shell's cwd.
Test at `cron-tick.test.mjs:642` asserts the cron line includes `>>`, `cron.log`, and `2>&1`. ✅

### CR4: Two new tests added and structurally correct — PASS

Task-5 handshake claims two new tests; both exist:
- `cron-tick.test.mjs:633` — "includes cd to the project root in the crontab line"
- `cron-tick.test.mjs:642` — "redirects cron-tick output to .team/cron.log"

Both tests follow the same mock-restore pattern (`beforeEach`/`afterEach` manages `console.log`). Tests are synchronous and self-contained. ✅

Total cron-tick test count: 26 (verified by counting `it(` occurrences in the file — matches handshake claim). CLI wire-up at `agt.mjs:73` is correct.

---

## Scope Check

Task-5 handshake states the function was pre-existing and only tests were added. Code confirms: `cmdCronSetup` at `cron.mjs:165` is unchanged from prior runs; only the two assertions at lines 633 and 642 are new. No scope creep detected.

---

## Carry-Forward Items (unchanged from prior reviews)

1. No `test-output.txt` artifact stored — handshake test counts unverifiable from artifacts alone.
2. `.cron-lock.lock` not gitignored.
3. `readProjectNumber` duplicates `outer-loop.mjs:117`.

---

## Findings

🟡 `.team/features/cron-based-outer-loop/tasks/*/artifacts/` — No `test-output.txt` stored in any task artifact directory; the gate output in the task spec is truncated and does not show cron-setup test results; claimed full-suite count (555) is not independently verifiable from artifacts — store test runner output as a task artifact (carry-forward from task-4 PM eval)

🔵 `test/cron-tick.test.mjs:638` — The cd assertion `cronLine.includes(\`cd '${cwd}'\`)` produces a false negative if `process.cwd()` contains a single quote, because `quotePath` escapes it as `'\''` while the test checks for the literal character; test fragility for unusual tmpdir paths, not a code correctness issue

---

## Summary

Both user-facing behaviors are implemented correctly:
1. The crontab line cd's to the project root (`cron.mjs:173`).
2. stdout and stderr are redirected to `.team/cron.log` (`>> ... 2>&1`).

Task-5 added exactly the two tests claimed in the handshake. The implementation was already complete from a prior run; this task closed the remaining test-coverage gap. No critical or warning-level code findings.

**PM Verdict: PASS**

---

# Engineer Review — task-5 (cron-based-outer-loop)

**Reviewer role:** Software engineer
**Date:** 2026-04-26
**Verdict:** PASS

---

## Files Read

- `.team/features/cron-based-outer-loop/tasks/task-{1..5}/handshake.json` (all five)
- `bin/lib/cron.mjs` (full — `cmdCronSetup` and `cmdCronTick`)
- `test/cron-tick.test.mjs` (full — 26 test cases)
- `bin/agt.mjs` lines 1–75 (CLI wire-up)
- `bin/lib/util.mjs` lines 33–51 (`getFlag`)

---

## Per-Criterion Results

### 1. Crontab line cd's to project root — PASS

`cmdCronSetup` (cron.mjs:168) captures `cwd = process.cwd()` and embeds it as
`cd ${quotePath(cwd)}` in the cron line. Test #22 (`includes cd to the project root`, line 633)
asserts `cronLine.includes("cd '${cwd}'")`. Logic path: `cwd` is set unconditionally and used
unconditionally in the template literal — no branch can suppress it.

### 2. Invokes `agt cron-tick` — PASS

The cron line uses `${quotePath(agtPath)} cron-tick` where `agtPath = process.argv[1]` resolves
to the `agt.mjs` script path during real CLI invocation. `bin/agt.mjs` has `#!/usr/bin/env node`
shebang (line 1), so it is directly executable without prefixing `node`. CLI wire-up confirmed at
`agt.mjs:73`. The `cron-tick` argument is hardcoded in the template string.

### 3. Appends to `.team/cron.log` with `>>` and `2>&1` — PASS

Line 173 generates `>> ${quotePath(cwd + "/.team/cron.log")} 2>&1`. Ordering is correct:
`>>` before `2>&1` routes stderr to stdout (the log file). Inverted order (`2>&1 >> file`)
would send stderr to the terminal. Log path is absolute. Test #23 (line 642) asserts all three
tokens (`>>`, `cron.log`, `2>&1`) present.

### 4. Interval flag handling — PASS

`getFlag(args, "interval", "30")` returns the next argv element or fallback `"30"`.
`parseInt(..., 10)` parses it. Guard `(!rawInterval || rawInterval < 1) ? 30 : rawInterval`
handles: zero (falsy → 30), negative (< 1 → 30), NaN from non-numeric (`!NaN` = true → 30).
Four unit tests confirm boundary cases.

### 5. Shell quoting — PASS (edge case verified)

`quotePath` (cron.mjs:172): for input `/foo's bar`, after replace → `/foo'\''s bar`, wrapped →
`'/foo'\''s bar'`. Shell evaluation: `/foo's bar`. Correct POSIX escaping. Applied to all four
runtime values: cwd, PATH, agtPath, log path.

### 6. Test count — PASS

Counted 26 `it(` occurrences: 16 in `cmdCronTick`, 7 in `cmdCronSetup`, 3 in CLI integration.
Matches builder's claim. Tests #22 and #23 are the two new tests added by task-5.

---

## Edge Cases Checked

- `--interval 0` → 30 (zero is falsy; covered by test)
- `--interval -5` → 30 (negative < 1; covered by test)
- Non-numeric `--interval` → NaN → 30 (guaranteed by `parseInt`; not explicitly tested)
- Path with single quote in cwd → `quotePath` escapes correctly per POSIX
- `process.env.PATH` undefined → `?? ""` fallback → `PATH=''` in cron line → may fail to find `node` (already flagged by security reviewer)
- `process.argv[1]` in test context → test-runner path, not agt.mjs; tests skip asserting on this value so they pass; production behavior unaffected

---

## Engineer Findings

🔵 bin/lib/cron.mjs:173 — `cwd + "/.team/cron.log"` uses string concat; rest of codebase uses
`path.join()` consistently. Functionally equivalent on POSIX but inconsistent style.

🔵 bin/lib/cron.mjs:169 — `agtPath = process.argv[1]` is not injectable for testing. In unit
tests this resolves to the test-runner binary; tests avoid asserting on the path so they pass,
but the generated cron line is wrong in test context. Suggest adding optional `agtPath` dep param
alongside the existing `deps` injection pattern used in `cmdCronTick`.

🔵 test/cron-tick.test.mjs:638 — Assertion accepts single OR double-quoted forms. Double-quote
branch is dead code — `quotePath` always produces single quotes. Would silently pass if quoting
regressed to double-quotes (which do not prevent shell expansion). Assert single-quotes only.

---

## Engineer Overall Verdict: PASS

The implementation correctly fulfills the task. `cmdCronSetup` generates a crontab line that
cd's to project root, sets PATH, invokes `agt cron-tick`, and appends stdout+stderr to
`.team/cron.log`. The `>>` + `2>&1` ordering is correct. POSIX single-quote escaping handles
special characters. Two new tests directly exercise the task-5 deliverables. Three
suggestion-level findings only; none block merge.

---

# Security Gate Review — cron-based-outer-loop (gate run)

**Reviewer role:** Security specialist
**Date:** 2026-04-26
**Verdict:** PASS

---

## Files Actually Read

- `bin/lib/cron.mjs` (full, 179 lines)
- `bin/lib/util.mjs` (full, 220 lines)
- `test/cron-tick.test.mjs` (full, 773 lines)
- `bin/agt.mjs` lines 1–80 (CLI wire-up)
- `bin/lib/github.mjs` — `listProjectItems`, `commentIssue`, `setProjectItemStatus` (grep + context)
- All 5 `handshake.json` files
- `tasks/task-5/eval.md` prior security review section (lines 111–233)

---

## Per-Criterion Results

### 1. Crontab shell injection — PASS

`cron.mjs:172–173`: `quotePath` wraps every runtime value in single quotes and escapes embedded
single quotes via the POSIX `'\''` technique (`p.replace(/'/g, "'\\''")`). All four values are
quoted: `cwd`, `process.env.PATH`, `agtPath`, and the log path. `--interval` is `parseInt`'d
before substitution; a value like `1; rm -rf /` becomes `NaN` → defaults to 30. No injection
surface.

### 2. Prompt injection via issue title — PASS

`cron.mjs:118`: regex `[\r\n\x00-\x1f\x7f\u0085\u2028\u2029]` strips all ASCII control
characters (U+0000–U+001F, U+007F), CR/LF, and Unicode structural newlines (NEL, LS, PS).
Truncated to 200 chars. Four dedicated tests at lines 320–395 cover each character class.

### 3. Shell injection via `commentIssue(err.message)` — PASS

`github.mjs:219–221`: `commentIssue` calls `runGh("issue", "comment", String(number), "--body",
body)` — args array passed to `spawnSync` with no `shell: true`. The `body` string is a literal
argv element regardless of content; shell metacharacters in `err.message` are inert.

### 4. Concurrent run protection — PASS

`util.mjs:134`: lock written with `{ flag: "wx" }` (O_EXCL atomic create). PID liveness checked
on read; stale locks cleaned up. `timeout: 0` = try-once. Lock released unconditionally in
`finally` block at `cron.mjs:153–155`. CLI integration test at line 707 writes a live-PID lock
file and asserts subprocess exits 0 with "already running".

### 5. `--dry-run` flag isolation — PASS

`cron.mjs:129`: `_runSingleFeature([], title)` — empty args array hardcoded, not forwarded from
CLI. Test at line 177 asserts `runArgs` is `[]`.

### 6. `listProjectItems` null safety — PASS

`github.mjs:238–241`: function explicitly returns `[]` on failure (`if (!itemsJson) return []`),
never `null`. The `.filter()` call at `cron.mjs:91` is safe.

---

## Edge Cases Checked

- Path with embedded single quote → `quotePath` escapes correctly (`'/foo'\''bar'`)
- `--interval` injection string → `parseInt` returns `NaN` → defaults to 30
- SIGKILL'd stale in-progress items → reverted before dispatch, lock prevents double-run
- Lock file owned by dead PID → cleaned and re-acquired
- `commentIssue` throws → swallowed, original error preserved in console.error

---

## Findings

🔵 `bin/lib/cron.mjs:144` — `err.message` has no length bound before posting as a GitHub comment;
if a feature throws a very large error, the `gh issue comment` call may fail silently (already
handled: returns false → logs warning). Consider `.slice(0, 2000)` to stay well under GitHub's
65,536-char body limit.

🔵 `bin/lib/cron.mjs:173` — `process.env.PATH ?? ""` bakes `PATH=''` when PATH is unset; cron
job would fail to find `node`. No security impact, but silently produces a broken crontab entry.
Consider omitting the `PATH=` clause or emitting a warning when PATH is empty.

---

## Overall Verdict: PASS

No critical (🔴) or warning (🟡) findings. Both suggestion-level findings are carry-forwards from
the prior security review. All six threat areas verified against actual code paths with direct
evidence.

---

# Architect Review — task-5 (run_2): dispatch-ordering assertion + cron-setup CLI integration test

**Reviewer role:** Software Architect
**Date:** 2026-04-26
**Handshake run:** run_2
**Verdict: PASS**

---

## Files Read

- `bin/lib/cron.mjs` (full, 179 lines)
- `test/cron-tick.test.mjs` (full, 773 lines)
- `bin/agt.mjs` (cron dispatch lines 72–73)
- `bin/lib/util.mjs` (lockFile, lines 98–154)
- `.team/features/cron-based-outer-loop/SPEC.md`
- All five `handshake.json` files

---

## What Changed in run_2

1. `test/cron-tick.test.mjs:431` — `assert.equal(dispatchedIssueNumber, 3)` added to stale+ready coexistence test (addresses tester 🟡 from run_1)
2. `test/cron-tick.test.mjs:749–773` — New `cron-setup CLI integration` describe block with one subprocess test (addresses tester 🟡 from run_1)

Both run_1 tester warnings are closed. Code in `cron.mjs` is unchanged.

---

## Per-Criterion Results

### AC1–AC7 — PASS (code unchanged from run_1; carry-forward from prior Architect eval)

### New test: dispatch-ordering assertion — PASS

`test/cron-tick.test.mjs:414–431`: `setProjectItemStatus` mock records the last `issueNumber` transitioned to `"in-progress"` as `dispatchedIssueNumber`. `assert.equal(dispatchedIssueNumber, 3)` verifies the recovered stale item is dispatched rather than the pre-existing ready item (#4).

The ordering guarantee is deterministic: `staleItem.status = "ready"` mutates the object at index 0 of `items` (`cron.mjs:101`), so `items.filter(ready)` returns `[item3, item4]` and `readyItems[0]` is item3. The SPEC (AC4) says recovered items "may be dispatched in the same tick" — no ordering mandate. If a future change to `listProjectItems` sorts by creation date, item #4 may arrive first, this test would fail, and that is the correct outcome (forces a conscious ordering decision).

### New test: cron-setup CLI integration — PASS

`test/cron-tick.test.mjs:752–773`: `execFileSync("node", [agtPath, "cron-setup"])` spawns the real CLI. Asserts exit 0, crontab line present, contains `cd `, `.team/cron.log`, and `2>&1`. Closes the gap where only `cmdCronSetup()` was called directly — the CLI wire-up at `agt.mjs:73` is now exercised end-to-end.

---

## Findings

🟡 `bin/lib/cron.mjs:101` — `staleItem.status = "ready"` mutates a `listProjectItems` result object in-place. The ready pool filter at line 106 depends silently on this mutation. If `listProjectItems` ever returns frozen or cloned objects, stale recovery silently no-ops. Build the ready pool explicitly to remove the reference dependency. (Carry-forward — unresolved across all prior architect evals.)

🟡 `bin/lib/cron.mjs:173` — `process.env.PATH` is baked into the generated crontab at setup time. A Node upgrade (nvm) or project move silently breaks the cron job. Add a one-line note in the printed instructions: "Re-run `agt cron-setup` after Node upgrades or project moves." (Carry-forward.)

🔵 `bin/lib/cron.mjs:173` — `cwd + "/.team/cron.log"` uses string concatenation; rest of module uses `path.join()`. Change to `join(cwd, ".team", "cron.log")`. (Carry-forward.)

---

## Artifacts

No `test-output.txt` in `task-5/artifacts/`. Builder claimed 558 tests pass. Gate output confirms suite is running; exact count not independently verifiable from the file system. Process gap, not a code defect.

---

## Overall Verdict: PASS

All seven acceptance criteria confirmed. Both run_1 tester 🟡 warnings resolved. Two carry-forward 🟡 warnings (in-place mutation coupling, stale PATH capture) should remain in the backlog. No critical issues. Safe to merge.

---

# PM Eval — task-5 (run_2): dispatch-ordering assertion + cron-setup CLI integration test

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Handshake run:** run_2
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-5/handshake.json` (run_2)
- `bin/lib/cron.mjs` (full, 179 lines)
- `test/cron-tick.test.mjs` (full, 773 lines)
- `.team/features/cron-based-outer-loop/SPEC.md` (full)
- `.team/features/cron-based-outer-loop/tasks/task-5/eval.md` (run_1 PM section)

---

## Requirement

The feature task being reviewed:
> `agt cron-setup` prints a crontab line that cd's to the project root and invokes `agt cron-tick >> .team/cron.log 2>&1`

run_2 closes two tester 🟡 findings from run_1:
1. Add dispatch-ordering assertion to the stale+ready coexistence test.
2. Add a CLI subprocess integration test for `agt cron-setup`.

---

## Per-Criterion Results

### CR1: Dispatch-ordering assertion added — PASS

`test/cron-tick.test.mjs:431`:
```js
assert.equal(dispatchedIssueNumber, 3, "Recovered stale item #3 should be dispatched before item #4");
```
`dispatchedIssueNumber` is captured by the `setProjectItemStatus` spy at line 416 when
`status === "in-progress"`. The assertion directly verifies the recovered stale item (#3) is
dispatched before the pre-existing ready item (#4). Exact gap flagged in run_1 — closed. ✅

Trace verified: mock returns `[item3 (In Progress), item4 (Ready)]` → stale recovery mutates
`item3.status = "ready"` → filter produces `[item3, item4]` → `readyItems[0]` = item3 →
`_setProjectItemStatus(3, _, "in-progress")` → `dispatchedIssueNumber = 3`. Assertion holds. ✅

### CR2: CLI subprocess integration test for `agt cron-setup` — PASS

`test/cron-tick.test.mjs:752–773`: new describe block `"cron-setup CLI integration"` runs
`node agt.mjs cron-setup` as a subprocess and asserts:
- Exit code 0 ✅
- A cron line containing `* * * *` is printed ✅
- `cronLine.includes("cd ")` ✅
- `cronLine.includes(".team/cron.log")` ✅
- `cronLine.includes("2>&1")` ✅

Directly addresses the run_1 finding: "cron-setup has zero subprocess tests." The new test
validates CLI wire-up through the live `agt.mjs` entry point. ✅

---

## Scope Check

run_2 made exactly two changes: one assertion added to an existing test (line 431), and one new
describe block with one test (lines 749–773). No implementation code changed. Total cron-tick
suite: 27 tests (26 from run_1 + 1 new). No scope creep. ✅

---

## Findings

🟡 `.team/features/cron-based-outer-loop/tasks/*/artifacts/` — No `test-output.txt` in any task
artifact directory; gate output is truncated (stops mid-run, never reaches cron-tick suite);
handshake claims 558 total but only 1 net-new test visible in cron-tick.test.mjs (27 − 26 = 1),
leaving the claimed total of 558 (vs. 555) unverifiable by +2 — store full test runner output
as an artifact (carry-forward from all prior PM evals)

🔵 `test/cron-tick.test.mjs:769` — CLI integration asserts `cronLine.includes("cd ")` with no
path check; a regression where `cd` points to an unrelated directory would pass silently —
tighten to assert that the actual project path appears after `cd`

🔵 `test/cron-tick.test.mjs:431` — Assert `dispatchedIssueNumber === 3` encodes an ordering
guarantee (stale before ready) not stated in SPEC.md; SPEC says "may be dispatched in the same
tick" with no priority order — either document the contract in SPEC.md or relax the assertion

---

## Summary

Both run_2 fixes are present and verified by direct code inspection. The core feature requirement
was already complete; run_2 closed the two test-coverage gaps the tester flagged. No critical
findings. The persistent missing-artifact issue remains the only 🟡 carry-forward.

**PM Verdict: PASS**

---

# Engineer Review — task-5 (run_2): dispatch-ordering assertion + cron-setup CLI integration test

**Reviewer role:** Software engineer
**Date:** 2026-04-26
**Handshake run:** run_2
**Verdict:** PASS

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-{1..5}/handshake.json` (all five)
- `bin/lib/cron.mjs` (full, 179 lines)
- `test/cron-tick.test.mjs` (full, 774 lines)
- `bin/agt.mjs` (shebang + cron wire-up, lines 1–73)
- `bin/lib/util.mjs` (getFlag lines 35–38, lockFile lines 98–170)
- `bin/lib/github.mjs` (readTrackingConfig lines 41–65, listProjectItems lines 238–255, setProjectItemStatus lines 258–295)
- `.team/features/cron-based-outer-loop/SPEC.md` (full)

---

## Claim Verification (run_2)

1. Dispatch-ordering assertion added: `assert.equal(dispatchedIssueNumber, 3)` — **VERIFIED** (`test/cron-tick.test.mjs:431`)
2. CLI subprocess integration test for `agt cron-setup` added — **VERIFIED** (`test/cron-tick.test.mjs:752–773`)

---

## Per-Criterion Results

### 1. `cmdCronSetup` crontab line — PASS

`cron.mjs:173`:
```js
const cronLine = `*/${interval} * * * * cd ${quotePath(cwd)} && PATH=${quotePath(process.env.PATH ?? "")} ${quotePath(agtPath)} cron-tick >> ${quotePath(cwd + "/.team/cron.log")} 2>&1`;
```
- `cd ${quotePath(cwd)}`: absolute path from `process.cwd()`, single-quoted. Unconditional.
- `>> ${quotePath(cwd + "/.team/cron.log")} 2>&1`: `>>` before `2>&1` is the correct ordering — appends stdout to log, then routes stderr to that same fd. Inverted form (`2>&1 >> file`) would send stderr to the terminal. This is right.
- `PATH=${quotePath(...)}`: valid POSIX sh `VAR=value command` syntax. Required because cron's minimal PATH excludes `/usr/local/bin` where `node` usually lives.
- `agt.mjs` has `#!/usr/bin/env node` shebang (line 1), so it is directly executable without an explicit `node` prefix.

### 2. POSIX shell quoting — PASS

`quotePath` (cron.mjs:172): `'${p.replace(/'/g, "'\\''")}'`

For `/path/with'quotes`: replace → `/path/with'\''quotes`, wrap → `'/path/with'\''quotes'`. Shell decodes to `/path/with'quotes`. Standard POSIX single-quote escaping, applied to all four runtime values.

`--interval` is `parseInt`'d before embedding — not a shell injection surface.

### 3. Stale in-progress recovery logic — PASS (ordering dependency noted)

`cron.mjs:91–106`: filters items by `"in-progress"` or `"in progress"` (case-insensitive), reverts each via `setProjectItemStatus`, and on success mutates `staleItem.status = "ready"` in-place so the item enters the `readyItems` filter at line 106.

Trace for the dispatch-ordering test:
- `items = [{#3, "In Progress"}, {#4, "Ready"}]`
- After loop: `items[0].status = "ready"`
- `readyItems = [{#3, "ready"}, {#4, "Ready"}]`
- `item = readyItems[0]` → `#3` dispatched, `dispatchedIssueNumber = 3` ✓

**Implicit ordering dependency:** correctness depends on the `readyItems` filter (line 106) running after the mutation loop (lines 95–103). No structural constraint enforces this. See findings.

### 4. Dispatch-ordering assertion (run_2 addition) — PASS

`test/cron-tick.test.mjs:431`:
```js
assert.equal(dispatchedIssueNumber, 3, "Recovered stale item #3 should be dispatched before item #4");
```
`dispatchedIssueNumber` is set in the `setProjectItemStatus` mock when `status === "in-progress"`, pinning the assertion to observable dispatch behavior rather than internal array ordering. Correct.

### 5. `cron-setup` CLI integration test (run_2 addition) — PASS

`test/cron-tick.test.mjs:752–773`: spawns `execFileSync("node", [agtPath, "cron-setup"])` using the real `bin/agt.mjs` path. Asserts exit 0, crontab line found, `"cd "`, `".team/cron.log"`, `"2>&1"` present. Validates the full chain — CLI wire-up → `cmdCronSetup` → stdout — without any mocking.

### 6. Lock acquire/release — PASS

`timeout: 0` → `deadline = Date.now()` → live-holder check returns `{acquired: false}` immediately. Lock released unconditionally in `finally` (cron.mjs:154). Pre-flight exits (lines 58–74) occur before lock acquisition, so no release needed on those paths.

### 7. Empty args forwarded to `runSingleFeature` — PASS

`cron.mjs:129`: `await _runSingleFeature([], title)`. Empty array hardcoded. Test line 177 asserts `runArgs === []`. Prevents `--dry-run` or other flags from leaking.

### 8. Failure path exit code — PASS

When `runSingleFeature` throws: `catch` block handles revert + comment + `console.error`, then falls through. `finally` releases lock. Function returns normally → process exits 0. Satisfies AC3.

---

## Edge Cases Checked

| Case | Result |
|---|---|
| No ready items | `return` before dispatch; lock released in `finally` ✓ |
| Lock held by live PID | `process.exit(0)` before `try` block; no lock to release ✓ |
| `readTrackingConfig` returns null | `process.exit(1)` before lock acquired ✓ |
| `"ready"` absent from config | `process.exit(1)` at line 65 ✓ |
| Stale item revert fails | status NOT mutated; item absent from `readyItems`; warning logged ✓ |
| `commentIssue` throws | inner try/catch swallows; `console.error` still logs original error ✓ |
| Title 300 chars | `slice(0, 200)` verified by dedicated test ✓ |
| `--interval 0` / negative / NaN | `(!rawInterval || rawInterval < 1)` → 30 ✓ |
| `process.env.PATH` undefined | `?? ""` fallback; `PATH=''` generated — cron job would fail to find `node` |

---

## Findings

🟡 `bin/lib/cron.mjs:101` — `staleItem.status = "ready"` mutates the `items` array element in-place; the `readyItems` filter at line 106 is only correct because it runs after this loop. If the filter is moved above the loop in a future refactor, stale items silently drop from dispatch with no error. Add a comment documenting the ordering dependency, or build `readyItems` explicitly as `[...recoveredItems, ...items.filter(i => i.status?.toLowerCase() === "ready")]` with a separate tracked array.

🔵 `bin/lib/cron.mjs:173` — `cwd + "/.team/cron.log"` uses string concatenation; the rest of the module uses `join(cwd, ...)`. Functionally equivalent on POSIX but inconsistent.

🔵 `bin/lib/cron.mjs:169` — `agtPath = process.argv[1]` is not injectable via the `deps` pattern used by `cmdCronTick`. In unit test context this resolves to the test runner binary, making the generated cron line wrong. Tests avoid the issue by not asserting on the path value. Adding `agtPath` as an optional `deps` parameter would make the function fully unit-testable.

🔵 `test/cron-tick.test.mjs:642` — `cronLine.includes(\`cd '${cwd}'\`) || cronLine.includes(\`cd "${cwd}"\`)` — the double-quote branch is dead since `quotePath` always produces single-quoted output. Double-quotes do not prevent `$VAR` expansion in POSIX sh; a quoting regression to double-quotes would pass this test silently. Assert single-quote form only.

---

## Overall Verdict: PASS

Both run_2 deliverables are present and correct. The dispatch-ordering assertion (line 431) directly verifies recovered stale items are dispatched before native ready items. The `cron-setup` CLI integration test (lines 752–773) validates the full subprocess path. All SPEC acceptance criteria (AC1–AC7) are satisfied. One 🟡 finding: implicit ordering dependency in stale recovery. Three 🔵 suggestions, none blocking.
