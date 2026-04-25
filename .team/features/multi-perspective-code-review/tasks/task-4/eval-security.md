# Security Review — task-4 (multi-perspective-code-review)

## Verdict: PASS

The changes introduce a parallel-review dispatch path that fans out 6 reviewer subprocesses. From a threat-model perspective, the new code does **not** add new attack surface vs. the pre-existing single-review path: the same `spawn`-based dispatch is reused with `shell: false`, identical argv handling, and identical `cwd` propagation.

## Files Reviewed

- `bin/lib/parallel-reviews.mjs` — new (44 lines)
- `bin/lib/run.mjs` — `runParallelReviews` wrapper at 357–361, review-phase guard around 1188–1263
- `test/build-verify-parallel-review.test.mjs` — concurrency / fail-closed tests
- `.team/features/.../task-4/handshake.json` — review handshake

## Per-Criterion Evidence

### 1. Subprocess invocation safety — PASS
`dispatchToAgentAsync` (run.mjs:329-355) uses `spawn("claude", [...args, brief])` with `shell: false` (default for `spawn` when no shell option is passed). Because `brief` is passed as a single argv slot rather than concatenated into a shell command, shell metacharacters in `featureName`, `taskTitle`, or `gateOutput` cannot be re-interpreted as shell syntax. No injection vector is introduced by adding 5 more parallel dispatches of the same shape.

### 2. Reason / error string handling — PASS
`syntheticCrash` (parallel-reviews.mjs:17-22) coerces `reason` via `(reason || "...").toString().slice(0, 200)` before embedding it. The `[reviewer-crash:${role}]` token uses `role` only from the `PARALLEL_REVIEW_ROLES` constant, not user input — no template injection. The 200-char cap also prevents log-flooding from a misbehaving error.

### 3. Fail-closed semantics — PASS
The contract that a crashed reviewer surfaces a synthetic 🔴 (parallel-reviews.mjs:33-41) is the right defensive default: a reviewer that never ran cannot ship green. Three failure modes are handled — `{ok:false}` resolution, promise rejection, and synchronous throw in dispatch (try/catch at line 28-32). Tests at lines 145-192 verify all three. This protects against silent skipping which would be a real auth-bypass-shaped flaw in the gating layer.

### 4. cwd / privilege boundary — PASS
`cwd` is forwarded verbatim to every dispatch (test confirms at lines 132-143). The `cwd` is the per-feature worktree created via `slugToBranch()` (run.mjs:155-161) which strips non-alphanum chars and caps to 72 — no path traversal. The worktree is the sandboxed execution context, so each parallel reviewer runs in the same isolated directory, no privilege escalation across roles.

### 5. Secret leakage in briefs / merged output — INFO ONLY
`gateOutput` (= raw `stdout` from `npm test`) is interpolated into each of the 6 reviewer briefs and into `eval.md` (run.mjs:1227-1230). If the gate command ever logged secrets, they would be fanned out to 6 subprocess calls and committed in `eval.md`. This is a pre-existing concern — single-review already had it — and not regressed by the parallel change. Calibrated to the project's threat model (local CLI tool, not a multi-tenant service), this is acceptable.

### 6. Resource exhaustion / DoS — INFO ONLY
Fan-out is hardcoded to 6 (PARALLEL_REVIEW_ROLES.length). On a typical dev machine 6 concurrent `claude --print` subprocesses is fine; on a constrained CI runner this could spike RAM. No timeout is per-dispatch in `dispatchToAgentAsync` (the sync `dispatchToAgent` has 600s, but the async variant relies on the parent process lifetime). Not a security issue but worth flagging.

### 7. Gate output evidence — PASS
`artifacts/test-output.txt` shows all 6 build-verify-parallel-review tests passing, plus crash/reject/throw fail-closed tests. The handshake claim of "completed" matches.

## Findings

🔵 bin/lib/run.mjs:329 — Async dispatch has no per-call timeout (sync variant has 600s); a hung claude subprocess could hang the run indefinitely. Add a timeout via `child.kill()` after N ms for parity with sync dispatch.
🔵 bin/lib/parallel-reviews.mjs:18 — 200-char truncation on `reason` is fine, but consider stripping ANSI/control chars too so a misbehaving spawn error can't poison terminal output downstream.
🔵 bin/lib/run.mjs:1227 — Raw gate `stdout` is written to `eval.md` and committed; document in PROJECT.md that gate commands must not emit secrets, since reviewer briefs (and now `eval.md`) capture them.

No 🔴 or 🟡 findings.

## Anti-Rationalization

| Tempted to say | Reality | Did instead |
|---|---|---|
| "Looks safe" | Need to verify spawn isn't shell-mode | Read run.mjs:337, confirmed `spawn` without `shell:true` |
| "Reviewed everything" | Only opened the diff'd files | Listed exactly the 4 files reviewed above |
| "Trust the tests" | Tests prove behavior, not absence of vulns | Reasoned about threat model independent of test coverage |
