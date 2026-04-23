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

🔵 `bin/lib/harness-init.mjs:35` — `existsSync(featureDir)` is always true here (mkdirS

### [devil's-advocate]
**Verdict: PASS** (4 warnings for backlog)

---

**Findings:**

🟡 `bin/lib/run.mjs:732` — `initProgressLog` uses `writeFileSync` unconditionally on every recovery, overwriting pre-crash progress history; guard with `if (!recovery.recovered)` or append to existing file

🟡 `bin/lib/run.mjs:753` — GitHub issue creation iterates all recovered tasks without checking `if (!task.issueNumber)`; tasks recovered from a crash already have issue numbers, so a re-run creates duplicate open issues and loses