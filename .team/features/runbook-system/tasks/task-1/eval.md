# Eval: task-1 — `.team/runbooks/` directory creation

**Verdict: PASS**
**Date:** 2026-04-24
**Reviewer role:** Product Manager

---

## Criterion

> `.team/runbooks/` directory is created by `agt init` (or lazily on first `agt run`)

---

## Files Opened and Read

- `.team/features/runbook-system/tasks/task-1/handshake.json`
- `.team/features/runbook-system/SPEC.md`
- `.team/features/runbook-system/STATE.json`
- `.team/features/runbook-system/progress.md`
- `.team/features/runbook-system/tasks/task-1/artifacts/test-output.txt` (sampled: lines 1–50, grep for runbook lines)
- `bin/lib/init.mjs` (full)
- `bin/lib/run.mjs` (lines 750–770)
- `test/runbook-dir.test.mjs` (full)

---

## Per-Criterion Results

### 1. `agt init` creates `.team/runbooks/`

**PASS — direct evidence**

`bin/lib/init.mjs:45`:
```js
mkdirSync(join(teamDir, "runbooks"), { recursive: true });
```
Appears immediately after the matching `mkdirSync` for `features` (line 44), within the scaffold block. `{ recursive: true }` makes it idempotent.

### 2. `agt run` lazily creates `.team/runbooks/`

**PASS — direct evidence**

`bin/lib/run.mjs:759–760`:
```js
// Lazily ensure .team/runbooks/ exists (may not be present in older projects)
mkdirSync(join(teamDir, "runbooks"), { recursive: true });
```
Placed after the `.team/` existence guard (line 754) and before any feature logic, ensuring it runs on every `agt run` invocation for older projects.

### 3. Tests cover both paths and pass

**PASS — test output confirmed**

From `test-output.txt` lines 1395–1402:
```
▶ init.mjs creates .team/runbooks/
  ✔ init.mjs source calls mkdirSync for runbooks alongside features (0.760917ms)
  ✔ runbooks mkdirSync appears after features mkdirSync in init.mjs (0.289375ms)
✔ init.mjs creates .team/runbooks/ (1.794834ms)
▶ agt run lazily creates .team/runbooks/
  ✔ creates .team/runbooks/ on first run even if dir was absent (252.548708ms)
  ✔ does not fail if .team/runbooks/ already exists (268.547208ms)
✔ agt run lazily creates .team/runbooks/ (521.032667ms)
```

Full gate: `npm test` exit code 0 — existing suite green.

### 4. Scope discipline

**PASS**

The implementation adds exactly 3 lines of production code (`init.mjs:45`, `run.mjs:759–760`) plus one test file. No other scope from SPEC.md was touched. No scope creep detected.

---

## Findings

One minor observation (no backlog impact):

- `init.mjs:126` — The success message reads `"Created .team/ with PRODUCT.md, PROJECT.md, AGENTS.md, HISTORY.md"` and does not mention `.team/runbooks/`. This could cause mild confusion for users who want to verify the directory was created. File as cosmetic follow-up if desired.

- The `init.mjs` tests use **static source inspection** (reading the file, checking for regex matches on `mkdirSync` calls) rather than an end-to-end integration test of `agt init`. This is a pragmatic tradeoff given that `agt init` is interactive (readline-based), but worth noting: the tests validate *intent* (source contains the call) not *behavior* (running init actually creates the dir). For this task's scope and risk level, it is acceptable.

---

## Summary

The implementation is minimal, correct, and scoped exactly to the task. Both code paths are implemented (`init.mjs` + lazy in `run.mjs`), idempotency is handled via `{ recursive: true }`, and all 4 new tests pass alongside the existing suite. No red flags.
