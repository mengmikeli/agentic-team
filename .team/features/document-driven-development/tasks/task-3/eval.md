## Parallel Review Findings

🟡 [engineer] test/run-spec-sections-gate.test.mjs:78 — Replace `assert.notEqual(result.exitCode, 0)` with `assert.equal(result.exitCode, 2)` to lock the contract (matches task-2's hardening on the sibling test).
[tester] **Verdict: PASS** (with 2 🟡 backlog + 3 🔵 suggestions)
🟡 [tester] test/run-spec-sections-gate.test.mjs:78 — Replace `assert.notEqual(result.exitCode, 0)` with `assert.equal(result.exitCode, 2)` to match `process.exit(2)` and the hardening in the sibling run-spec-gate test.
🟡 [tester] test/run-spec-sections-gate.test.mjs:44 — PARTIAL_SPEC only drops 3 of 7 PRD sections; add a fixture missing `Goal`/`Requirements`/`Technical Approach`/`Out of Scope` so the regex isn't half-covered.
🔵 [architect] bin/lib/outer-loop.mjs:390 — `validateSpecFile` is conceptually a SPEC concern; consider relocating to `bin/lib/spec.mjs` alongside `PRD_SECTIONS` (future refactor, out of scope).
🔵 [architect] bin/lib/run.mjs:929 — `existsSync` check + `validateSpecFile` overlap on missing-file case; two distinct messages is intentional UX but a unified gate is also reasonable.
🔵 [engineer] test/run-spec-sections-gate.test.mjs:99 — `if (existsSync(statePath))` makes the no-tasks check a soft skip; assert `!existsSync(statePath) || tasks.length === 0` so both forms count.
🔵 [engineer] bin/lib/outer-loop.mjs:393 — `existsSync` inside `validateSpecFile` is unreachable from this caller (run.mjs:929 already gated); harmless dead defense.
🔵 [engineer] bin/lib/run.mjs:943 — Bare `{ ... }` scope adds noise; drop braces or extract a helper.
🔵 [tester] test/run-spec-sections-gate.test.mjs:59 — Add an "all sections missing" / empty-spec case to exercise the heavy missing-list output path.
🔵 [tester] test/run-spec-sections-gate.test.mjs:59 — Add case-insensitive (`## goal`) and malformed-header (`### Goal`) cases to lock the `/mi` regex contract in outer-loop.mjs:409.
🔵 [tester] test/run-spec-sections-gate.test.mjs:96 — Strengthen "no tasks persisted" to also assert no `tasks/task-*` directories or runbook files exist, not just STATE.json's `tasks` array.
🔵 [security] package.json:test — `test/run-spec-sections-gate.test.mjs` not listed in `npm test` script; only runs via `npm run test:full`. Coverage gap, not a security issue.
🔵 [simplicity] test/run-spec-sections-gate.test.mjs:17 — Test helpers (`createTmpDir`, `runAgt`) duplicated from `run-spec-gate.test.mjs`; optional to extract.
🔵 [simplicity] bin/lib/run.mjs:950 — "A complete spec is required..." message partially mirrors the missing-file branch at line 934.

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs