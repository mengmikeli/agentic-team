## Parallel Review Findings

🟡 [architect] bin/lib/extensions.mjs:124 — Pre-existing: `Promise.race` timeout leaves the losing promise dangling; risk of unhandled rejection. Add `.catch(() => {})` on the hook promise before racing.
🟡 [architect] examples/extensions/log-phases.mjs:22 — Pre-existing: Example extension interpolates `ctx.taskTitle` (LLM-generated text) into a shell command without escaping. Users copying this pattern inherit shell injection risk.
🟡 [engineer] test/flows.test.mjs:335 — No unit test exercises `contextBrief` parameter directly; the ordering guarantee (contextBrief appended before `mergePromptAppend`) is verified only by reading the source, not by a test. Add a test that passes `contextBrief: "CTX_SENTINEL"` and asserts the extension hook receives it in `ctx.brief`.
🟡 [product] examples/extensions/log-phases.mjs:22 — Shell injection in example code: `ctx.taskTitle` (LLM-generated) is interpolated unescaped into a shell command. Users copying this pattern inherit the risk. Fix: use `JSON.stringify()` or avoid string interpolation in shell commands. File as backlog.
🟡 [tester] test/flows.test.mjs:335 — No behavioral test for the primary task-17 fix (contextBrief ordering with extensions); add a test that passes both `contextBrief` and a `registry` to `buildReviewBrief` and asserts the hook's received `brief` contains the contextBrief text — this is the one scenario the builder specifically claimed to fix, yet zero test files reference `contextBrief` (confirmed via grep)
🟡 [simplicity] `bin/lib/run.mjs:1169` — Asymmetric extension integration: `buildBrainstormBrief` and `buildReviewBrief` in flows.mjs encapsulate `mergePromptAppend` internally, but `buildTaskBrief` in run.mjs handles it externally at the call site. Two patterns for the same concern increases cognitive load. Consider unifying by moving `buildTaskBrief` to flows.mjs with the same `{ registry, taskId }` options pattern.
🔵 [architect] bin/lib/run.mjs:1169 — Build-phase `mergePromptAppend` remains in `run.mjs` rather than a brief-builder. Acceptable — no `buildBuildBrief` exists in `flows.mjs`. Document the asymmetry if the API contract is formalized.
🔵 [architect] bin/lib/flows.mjs:94 — `buildReviewBrief` has 7 parameters (5 positional + options object). Consider consolidating if more parameters are added.
🔵 [architect] test/flows.test.mjs:336 — Extension integration test only covers `engineer` role; the `null` role path through `mergePromptAppend` is untested in the flows test suite (covered elsewhere).
🔵 [architect] test/flows.test.mjs:347 — Tests verify extension append presence via `includes()` but not ordering relative to base brief.
🔵 [engineer] bin/lib/flows.mjs:94 — `buildReviewBrief` has 5 positional params + options object; consider collapsing to a single options object in future (pre-existing).
🔵 [product] bin/lib/flows.mjs:86 — The `taskId: null` sentinel for brainstorm phase is undocumented in the spec's hook context table but is tested. Document when extension API docs are formalized.
🔵 [tester] test/flows.test.mjs:335 — `buildReviewBrief — extension integration` only tests with `engineer` role; add a variant with `null` role to cover the `role ?? null` coalescing path
🔵 [tester] test/extension-system.test.mjs:2115 — Source assertion for review-phase `mergePromptAppend` is a regex proxy, not behavioral verification; supplement with an integration test
🔵 [tester] test/flows.test.mjs:307 — Append ordering tested via `includes()` which cannot detect misordering; consider asserting index ordering
🔵 [security] bin/lib/extensions.mjs:125 — Shallow copy `{ ...ctx }` won't isolate nested objects if context ever gains array/object fields; consider documenting the string-only contract for hook context

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**