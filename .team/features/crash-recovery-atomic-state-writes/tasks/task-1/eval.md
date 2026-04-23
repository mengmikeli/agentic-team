## Parallel Review Findings

### [security]
---

## Security Review Findings

🔴 bin/lib/run.mjs:879 — Command injection: task.title is interpolated into a `shell: true` git commit command with only `"` escaping; backticks and `$()` execute on the host. Replace with `execFileSync("git", ["commit", "-m", ...], { cwd })` (no shell) to eliminate the injection surface.

🟡 bin/lib/run.mjs:413 — `for (const t of state.tasks)` throws uncaught TypeError when `state.tasks` is null or non-array; reachable via a partially-written (corrupted) STATE.

### [architect]
---

**Verdict: PASS** (1 warning flagged for backlog)

Files read: `run.mjs`, `harness-init.mjs`, `util.mjs`, `crash-recovery.test.mjs`, handshake + test artifact. All 354 tests pass.

---

**Findings:**

🟡 `bin/lib/run.mjs:407` — JSDoc return type `{ tasks, recovered: bool }` omits `crashedAt`; callers reading the doc won't know the field exists. Update to `{ tasks, recovered: bool, crashedAt?: string }`.

🔵 `bin/lib/harness-init.mjs:35` — `existsSync(featureDir)` is always true here (mkdirSync was called on line 32, making the guard dead code). Remove the outer `if` to simplify.

### [devil's-advocate]
**Verdict: PASS** (4 warnings for backlog)

---

**Findings:**

🟡 `bin/lib/run.mjs:732` — `initProgressLog` uses `writeFileSync` unconditionally on every recovery, overwriting pre-crash progress history; guard with `if (!recovery.recovered)` or append to existing file

🟡 `bin/lib/run.mjs:753` — GitHub issue creation iterates all recovered tasks without checking `if (!task.issueNumber)`; tasks recovered from a crash already have issue numbers, so a re-run creates duplicate open issues and loses the original issue references

---

## Architect Review (final)

**Overall Verdict: PASS**

**Files actually read:**
- `bin/lib/run.mjs` (lines 405–428, 700–800, 870–890)
- `bin/lib/util.mjs` (lines 53–192)
- `bin/lib/harness-init.mjs` (full)
- `test/crash-recovery.test.mjs` (full)
- `.team/features/crash-recovery-atomic-state-writes/tasks/task-1/artifacts/test-output.txt`

---

### Criterion-by-criterion results

**1. Detects `status: "executing"` and resumes — PASS**
Evidence: `run.mjs:409` checks `state.status === "executing"`. `run.mjs:411` preserves `state.tasks` over `plannedTasks` when the array exists. Test at `crash-recovery.test.mjs:75` verifies 3-task state is preserved over 1 planned task.

**2. `[crash-recovery]` log emitted — PASS**
Evidence: `run.mjs:725`: `console.log(\`${c.yellow}[crash-recovery]${c.reset} Resuming from crashed state at ${recovery.crashedAt}\`)`. Gated on `recovery.recovered === true`.

**3. `passed` tasks preserved, `in-progress` reset to `pending` — PASS**
Evidence: `run.mjs:412–413` iterates only to reset `in-progress` tasks; other statuses are untouched. Test at `crash-recovery.test.mjs:96–98` explicitly asserts `passed → passed`, `in-progress → pending`, `pending → pending`.

**4. `_recovered_from` and `_recovery_count` written — PASS**
Evidence: `run.mjs:416–417` sets both fields; `writeState` follows immediately at line 419. Test at `crash-recovery.test.mjs:101–116` reads back the file and asserts both fields.

**5. Atomic writes (STATE.json.tmp + rename) — PASS**
Evidence: `util.mjs:55–59`: `atomicWriteSync` writes to `${filePath}.tmp.${process.pid}.${Date.now()}` then calls `renameSync`. `writeState` at `util.mjs:191` delegates to `atomicWriteSync`. All STATE.json mutations go through `writeState`.

**6. Orphaned tmp cleanup on init — PASS**
Evidence: `harness-init.mjs:36–41` iterates the feature directory, matches `/^STATE\.json\.tmp\./`, and calls `unlinkSync` with best-effort catch. Test at `crash-recovery.test.mjs:194–213` plants two orphan files and asserts they're removed.

**7. No recovery for `status: "paused"` or `status: "completed"` — PASS**
Evidence: `run.mjs:409` gates recovery strictly on `=== "executing"`. Tests at `crash-recovery.test.mjs:143–187` cover both statuses.

**8. New tests cover crash-recovery path — PASS**
Evidence: `test/crash-recovery.test.mjs` has 8 new tests organized in 4 describe blocks. All 354 tests pass per `test-output.txt`.

---

### Findings requiring attention

**Security reviewer's 🔴 is a FALSE POSITIVE — does NOT block merge.**
Claim: `task.title` interpolated into `shell: true` git commit. Reality: the git commit is at `run.mjs:884` using `execFileSync("git", ["commit", "-m", ...])` with no `shell` option. Lines 881–882 (`git add -A`, `git diff --cached --stat`) do use `shell: true` but inject no user data. The 🔴 should not block this merge.

**Devil's-advocate 🟡 findings are stale — code already handles both:**
- `run.mjs:734`: `if (!recovery.recovered)` guard already prevents `initProgressLog` from overwriting on recovery.
- `run.mjs:758`: `if (task.issueNumber) continue;` already prevents duplicate issue creation.

**Real findings (carry to backlog):**

🟡 bin/lib/run.mjs:407 — JSDoc return type `{ tasks, recovered: bool }` is incomplete; `crashedAt` field is absent from the doc but always returned. Update the comment to `{ tasks, recovered: bool, crashedAt?: string }`.

🔵 bin/lib/harness-init.mjs:35 — `existsSync(featureDir)` is dead code; `mkdirSync(featureDir, { recursive: true })` was called on line 32 so the directory is guaranteed to exist. Remove the outer `if`.

🔵 bin/lib/run.mjs:881 — `git add -A` and `git diff --cached --stat` use `shell: true` unnecessarily. No injection risk here (no user data), but inconsistent with the `execFileSync` pattern on line 884. Recommend `execFileSync("git", ["add", "-A"])` for consistency.

---

## Devil's Advocate — Final Review

**Files actually read:**
- `bin/lib/run.mjs` (lines 390–428, 610–615, 700–740, 755–780, 860–890, 950–1003)
- `bin/lib/util.mjs` (lines 1–59, 178–192)
- `bin/lib/harness-init.mjs` (full)
- `test/crash-recovery.test.mjs` (lines 1–190 via grep)

**Overall Verdict: PASS** (2 new warnings → backlog, 1 new suggestion)

---

### What the architect missed

The architect review is thorough and I agree the security 🔴 is a false positive and the devil's-advocate stale warnings are indeed already fixed. However, two edge cases were not examined:

**Edge case: empty `state.tasks` array**

`run.mjs:411`: `const recoveredTasks = Array.isArray(state.tasks) ? state.tasks : plannedTasks;`

`Array.isArray([])` is `true`. If the process crashed before tasks were populated in STATE.json (i.e., `state.tasks` is `[]`), `recoveredTasks` will be `[]` and the feature resumes with zero tasks, silently completing with no work done. The test at `crash-recovery.test.mjs:87-95` always uses a non-empty `state.tasks` (3 tasks), so this case was never exercised.

**Edge case: no circuit breaker on `_recovery_count`**

`run.mjs:417`: `state._recovery_count = (state._recovery_count || 0) + 1;`

There is no upper bound and no escalation warning. A feature that consistently crashes during execution (e.g., the agent or the gate crashes the process every time) will be silently "recovered" on every subsequent `agt run` call. The user gets no signal that they're stuck in a loop. `_recovery_count` can grow to 50+.

**Gap: no CLI-level integration test**

The feature claim is "`agt run` logs `[crash-recovery]`". Every test in `crash-recovery.test.mjs` calls `applyCrashRecovery` directly. No test invokes `agt run` against a pre-existing `status: "executing"` STATE and asserts `[crash-recovery]` on stdout. The integration path in `_runSingleFeature` at lines 722-727 is untested.

---

### New Findings

🟡 bin/lib/run.mjs:411 — `Array.isArray([]) === true`: a crash before tasks are populated leaves `state.tasks = []`, so recovery uses an empty list and the feature silently completes with zero work done. Fix: `(Array.isArray(state.tasks) && state.tasks.length > 0) ? state.tasks : plannedTasks`

🟡 bin/lib/run.mjs:417 — No ceiling on `_recovery_count` and no user warning; a feature stuck in a crash loop is silently recovered forever. Add a `console.warn` when `_recovery_count >= 3` to surface the stuck state.

🔵 test/crash-recovery.test.mjs (missing coverage) — No test calls `agt run` against a STATE with `status: "executing"` to verify the CLI `[crash-recovery]` log. Add an `--dry-run` integration test to close the gap.

---

## Security Review (independent, final)

**Verdict: PASS**
**Files read:** `bin/lib/run.mjs` (full), `bin/lib/util.mjs` (full), `bin/lib/harness-init.mjs` (full), `handshake.json`, `test-output.txt`

---

### 🔴 Prior finding confirmed FALSE POSITIVE

The prior security reviewer's 🔴 at `run.mjs:879` claims `task.title` is interpolated into a `shell: true` git commit. **This is wrong.**

Evidence:
- `run.mjs:884`: `execFileSync("git", ["commit", "-m", \`feat: ${task.title.slice(0, 72)}\`], { cwd, stdio: "pipe" })` — uses `execFileSync` with an explicit array of arguments. `execFileSync` does **not** invoke a shell; the `-m` value is passed as a literal process argument directly to git. Backticks, `$()`, semicolons, and any other shell metacharacters in `task.title` are inert.
- `run.mjs:881-882`: `execSync("git add -A", { shell: true })` and `execSync("git diff --cached --stat", { shell: true })` do use `shell: true`, but both contain **static strings** with zero user input interpolated. No injection surface.

**The 🔴 does NOT block merge. This finding is dismissed.**

---

### Crash-recovery security surface — independent assessment

| Path | Finding |
|---|---|
| `harness-init.mjs:36-41` — orphaned tmp cleanup | `readdirSync` returns bare filenames; `join(featureDir, f)` cannot escape the directory. Regex constraint adds defense-in-depth. **SAFE.** |
| `run.mjs:411` — null state.tasks guard | `Array.isArray(state.tasks) ? state.tasks : plannedTasks` correctly falls back. **SAFE.** (Empty-array edge case is a functional concern per devil's-advocate, not a security issue.) |
| `run.mjs:417` — `_recovery_count` | Integer increment from trusted state file. No overflow risk in JS. No security issue. |
| `writeState` → `atomicWriteSync` | Write-then-rename prevents partial-write corruption. **SAFE.** |
| `state._recovered_from` = `state._last_modified` | Value originates from a trusted, nonce-protected STATE.json. Not user-supplied. **SAFE.** |

---

### Findings (security scope only)

🔵 `bin/lib/run.mjs:881` — `shell: true` on static git commands is unnecessary and inconsistent with `execFileSync` on line 884; no current injection risk but increases the attack surface if the command string is ever modified to include variables. Replace with `execFileSync("git", ["add", "-A"])` and `execFileSync("git", ["diff", "--cached", "--stat"])` (pre-existing issue, not introduced by this feature)

---

### Overall verdict

**PASS.** The crash-recovery implementation introduces no new security vulnerabilities. The 🔴 from the prior review is a false positive. Real 🟡 findings (empty task list, recovery count ceiling, missing CLI integration test) are valid backlog items per the devil's-advocate review and do not block merge.
