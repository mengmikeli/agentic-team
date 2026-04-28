# Feature: Self-Simplification Pass

## Goal
Before finalizing a feature, run the full feature-branch diff through the simplicity reviewer and block finalization if critical findings exist — countering AI-generated bloat with zero auto-fix complexity.

## Requirements
- New module `bin/lib/simplify-pass.mjs` with a single export `runSimplifyPass(dispatchFn, agent, featureDir, cwd)`.
- Called in `run.mjs` after the task loop completes, before `harness("finalize", ...)` (line ~1503).
- Computes the cumulative feature diff: `git diff $(git merge-base HEAD main)..HEAD`.
- If the diff is empty, skip with PASS verdict and a notice in `progress.md`.
- Builds a prompt from `roles/simplicity.md` + the diff (truncated at 12,000 chars with notice).
- Dispatches via the injected `dispatchFn` (same signature as existing review dispatch).
- Parses output with existing `parseFindings()` and scores with `computeVerdict()` from `synthesize.mjs`.
- Critical findings (🔴) → verdict FAIL → finalize is not called, function returns `"simplify-blocked"`.
- Warning (🟡) and suggestion (🔵) findings → logged but do not block.
- Writes findings to `<featureDir>/simplify-eval.md`.
- Appends summary to `progress.md` via `appendProgress()`.
- Persists `simplifyPass: { verdict, critical, warning, suggestion, durationMs }` to `STATE.json`.
- Fail-open: if dispatch throws or returns `{ ok: false }`, verdict is PASS, error logged to `progress.md`.
- Skippable via `--no-simplify` flag (checked as `args.includes("--no-simplify")` in `run.mjs`).

## Acceptance Criteria
- [ ] `bin/lib/simplify-pass.mjs` exists with `runSimplifyPass` export.
- [ ] `run.mjs` calls `runSimplifyPass` between the task loop and `harness("finalize")`.
- [ ] Pass uses `git diff $(git merge-base HEAD main)..HEAD`, not per-task diff.
- [ ] Critical findings block finalize; `_runSingleFeature` returns `"simplify-blocked"`.
- [ ] Warning/suggestion findings appear in `simplify-eval.md` and `progress.md` but do not block.
- [ ] `STATE.json` gains `simplifyPass` field with `{ verdict, critical, warning, suggestion, durationMs }`.
- [ ] Fail-open: dispatch failure or `{ ok: false }` yields PASS with error logged.
- [ ] `--no-simplify` flag skips the pass entirely.
- [ ] Existing per-task simplicity reviewer is unchanged.
- [ ] `npm test` passes with no regressions.

## Technical Approach

### New file: `bin/lib/simplify-pass.mjs`

Single-responsibility module. ~100 lines. No circular dependencies — receives `dispatchFn` via parameter.

```js
export function runSimplifyPass(dispatchFn, agent, featureDir, cwd) → {
  verdict: "PASS"|"FAIL", critical: number, warning: number, suggestion: number, durationMs: number
}
```

**Steps:**
1. `execFileSync("git", ["merge-base", "HEAD", "main"])` → base. Fallback to `master`.
2. `execFileSync("git", ["diff", `${base}..HEAD`])` → diff. Empty → early PASS.
3. Read `roles/simplicity.md`. Build prompt: role content + diff (capped at 12k chars).
4. `dispatchFn(agent, prompt, cwd)` → output.
5. `parseFindings(output)` + `computeVerdict(findings)`.
6. Write `simplify-eval.md`, append `progress.md`, update `STATE.json`.
7. Return result.

**Error path:** try/catch around steps 1–5. On any failure: log to `progress.md`, return `{ verdict: "PASS", critical: 0, ... }`.

### Modified: `bin/lib/run.mjs` (~15 lines)

Insert between line ~1501 (end of task loop) and line ~1505 (`harness("finalize")`):

```js
import { runSimplifyPass } from "./simplify-pass.mjs";

// After task loop, before finalize:
let simplifyBlocked = false;
if (agent && completed > 0 && !args.includes("--no-simplify")) {
  const sr = runSimplifyPass(dispatchToAgent, agent, featureDir, cwd);
  if (sr.verdict === "FAIL") simplifyBlocked = true;
}
if (simplifyBlocked) {
  // skip finalize, fall through to return "simplify-blocked"
}
```

At the return block (~line 1585), add `simplifyBlocked` check before the existing blocked/done logic:

```js
if (simplifyBlocked) return "simplify-blocked";
if (blocked > 0) return "blocked";
return "done";
```

### What does NOT change
- `synthesize.mjs` — `parseFindings()` / `computeVerdict()` reused as-is.
- `roles/simplicity.md` — reused as system prompt, no modification.
- `finalize.mjs` — unchanged; simplify pass gates before finalize is called.
- Per-task simplicity reviewer — remains active during per-task multi-perspective review.
- `outer-loop.mjs` — no changes (treats `"simplify-blocked"` as any non-`"done"` return).
- `compound-gate.mjs` — not involved; this is a separate pass, not a gate layer.

## Testing Strategy

### Unit tests: `test/simplify-pass.test.mjs`

Mock `dispatchFn`, `execFileSync` (git), and filesystem writes. Seven test cases:

1. **Empty diff** — git diff returns empty string. Assert: PASS, no `simplify-eval.md` written.
2. **Clean pass** — dispatch returns no finding lines. Assert: PASS, `simplify-eval.md` written.
3. **Warning-only** — dispatch returns 🟡 lines. Assert: PASS, warnings counted.
4. **Critical findings** — dispatch returns 🔴 lines. Assert: FAIL, critical counted.
5. **Dispatch failure (fail-open)** — dispatchFn throws. Assert: PASS, error in `progress.md`.
6. **STATE.json shape** — after run, `simplifyPass` has `{ verdict, critical, warning, suggestion, durationMs }`.
7. **`--no-simplify`** — pass is skipped entirely when flag is present.

### Regression
`npm test` must pass with zero new failures.

## Out of Scope
- **Auto-fix loop** — The v1 attempt burned $298 in review escalation trying to auto-fix findings. Critical findings block; humans or the next sprint fix them. No fix-and-re-review cycle.
- **Dashboard display** — `simplify-eval.md` is a file artifact. Dashboard integration deferred.
- **Configurable rules or thresholds** — `roles/simplicity.md` is sufficient.
- **Per-model cost tracking** — Aggregate metrics in STATE.json suffice for now.
- **Outer-loop special handling of `"simplify-blocked"`** — Outer loop already treats non-`"done"` returns as incomplete. No special case needed.
- **Notification on simplify-block** — Can be added trivially later.

## Done When
- [ ] `bin/lib/simplify-pass.mjs` exists with `runSimplifyPass` export (~100 lines)
- [ ] `run.mjs` calls it between the task loop and `harness("finalize")`
- [ ] Critical findings block finalize; warnings/suggestions do not
- [ ] Blocked runs return `"simplify-blocked"` from `_runSingleFeature`
- [ ] `simplify-eval.md` written for every non-empty-diff run
- [ ] `STATE.json` contains `simplifyPass` field after a run
- [ ] Fail-open on dispatch failure with error logged
- [ ] `--no-simplify` flag skips the pass
- [ ] 7 unit tests pass in `test/simplify-pass.test.mjs`
- [ ] `npm test` passes with no regressions
