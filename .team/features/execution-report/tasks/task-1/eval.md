## Parallel Review Findings

🔴 [product] `bin/lib/report.mjs:47` — Section heading is `## Activity`; spec requires `## Cost Breakdown`
🔴 [product] `bin/lib/report.mjs:47–54` — Cost Breakdown must show total cost (USD) and per-phase split (brainstorm / build / review) — or explicit `N/A`; current impl defers entirely to `agt metrics`
🔴 [product] `bin/lib/report.mjs:69` — Recommendations fire at `> 1` (≥2 attempts); spec threshold is `>= 3` — change `> 1` to `>= 3`
🔴 [product] `bin/lib/report.mjs:68–85` — "Gate warning history entries → surface repeated gate warnings" recommendation is absent; spec (`SPEC.md:19`) requires it
🔴 [product] `test/report.test.mjs:245–253` — "agt help report" test is a stub (only checks `typeof cmdReport === "function"`); spec requires actual CLI invocation verifying usage, `--output` flag, and example — follow existing `spawnSync` pattern used by other `agt help <command>` tests
🔴 [tester] `bin/lib/report.mjs:69` — Recommendations threshold uses `> 1` (fires at attempts ≥ 2) but SPEC requires `>= 3`; test uses `attempts: 3` which satisfies both, masking the bug — add a test asserting `attempts: 2` does NOT trigger
🔴 [tester] `bin/lib/report.mjs:62` — `task.status.toUpperCase()` throws `TypeError` if `task.status` is null/undefined on any blocked/failed task; no test covers this path
🔴 [simplicity] `test/report.test.mjs:246` — Remove `const { cmdHelp } = await import(...).then(() => ({})).catch(() => ({}))` — `cmdHelp` is always `undefined` (the transform discards the module) and is never referenced; dead variable
🔴 [simplicity] `test/report.test.mjs:248` — Remove `const agtPath = new URL("../bin/agt.mjs", import.meta.url).pathname` — `agtPath` is assigned and never used; dead variable
[simplicity] Two 🔴 dead-variable findings in `test/report.test.mjs:246–248`. Both are unused declarations with no side effects. Fix: delete those two lines, then the suite is clean to merge.
🟡 [architect] `bin/lib/report.mjs:47` — Section 3 omits `state.tokenUsage`; spec-required per-phase cost data exists in STATE.json (`run.mjs:1460` writes `total.costUsd` and `byPhase`); read `state.tokenUsage?.total?.costUsd` and `state.tokenUsage?.byPhase` to satisfy cost breakdown
🟡 [architect] `bin/lib/report.mjs:69` — Threshold `> 1` (≥ 2 attempts) contradicts SPEC (`>= 3`); change to `(t.attempts ?? 0) >= 3`
🟡 [architect] `test/report.test.mjs:245` — Help test is a type-check stub; add `agt help report` to `test/cli-commands.test.mjs` using `runAgt(["help", "report"])` matching the existing command test pattern
🟡 [engineer] `bin/lib/report.mjs:69` — Attempts threshold is `> 1` (fires at ≥2 attempts) but SPEC requires `>= 3`; change to `(t.attempts ?? 0) >= 3` to avoid spurious recommendations after a normal single retry
🟡 [engineer] `bin/lib/report.mjs:37` — Section heading is "Activity" but SPEC names it "Cost Breakdown" and requires total cost (USD) and per-phase split (brainstorm/build/review); section exists but with the wrong name and missing cost data
🟡 [engineer] `bin/lib/report.mjs:67` — Gate warning history recommendations not implemented; `gateWarningHistory` is persisted to STATE.json by `run.mjs:1196` and SPEC explicitly says to surface repeated gate warnings in Recommendations
🟡 [engineer] `test/report.test.mjs:245` — "agt help report" test asserts only that `cmdReport` is exported; never invokes `agt help report` or checks its output; the Done When criterion is untested
🟡 [product] `bin/lib/report.mjs:29` — In-progress label shows `"executing (in progress)"` rather than spec's "Run in progress"; consider a fixed string
🟡 [tester] `bin/lib/report.mjs:47-54` — Section 3 is named "Activity" not "Cost Breakdown" per SPEC; USD cost and per-phase split (brainstorm/build/review) are absent, replaced with a stub pointing to `agt metrics`
🟡 [tester] `bin/lib/report.mjs:67-85` — Recommendations never read `gateWarningHistory` from STATE.json; SPEC explicitly requires surfacing repeated gate warnings here
🟡 [tester] `test/report.test.mjs:244-252` — "agt help report" test only asserts `cmdReport` is a function; no CLI invocation ever runs `agt help report` or checks its output contains `--output` and an example
🟡 [tester] `test/cli-commands.test.mjs` — The `agt help <command>` suite covers 9 commands but omits `report`; the Done When criterion has zero functional test coverage
🟡 [security] `bin/lib/report.mjs:100,119,138` — `featureName` from CLI args is passed directly to `path.join` with no `../` guard. `path.join` normalizes but does not clamp the result. A traversal input like `../../../../tmp/dir` can point `featureDir` outside `.team/features/`. Read path: reveals STATE.json from arbitrary directories. Write path (`--output md`): `writeFileSync` at line 138 writes REPORT.md to the traversal destination. Fix: after resolving `featureDir`, assert it starts with `join(cwd, ".team", "features") + sep`; exit 1 if not.
🟡 [simplicity] `test/report.test.mjs:245` — Rename or expand test "agt help report: help entry has correct usage and description" — body only asserts `typeof mod.cmdReport === "function"`; does not verify help text content, so a broken `agt help report` response would not be caught
🟡 [simplicity] `bin/lib/report.mjs:69` — Change threshold from `> 1` to `>= 3` — SPEC specifies "Tasks with `attempts >= 3`"; current code fires at ≥ 2, and the corresponding test at line 94 reinforces the off-spec value
🔵 [engineer] `bin/lib/report.mjs:101` — `--output` accepts only "md" but silently ignores any other value; add a warning branch for unrecognized format values
🔵 [tester] `bin/lib/report.mjs:43` — Task Summary table shows `task.id` only; `task.title` is available in STATE.json and would improve readability without adding complexity
🔵 [tester] `bin/lib/report.mjs:12-17` — `formatDuration` rounds to nearest minute; runs under 60s display as "0m" — consider showing seconds for short runs
🔵 [security] `bin/lib/report.mjs:43,62-63` — `task.lastReason`, `task.title`, and `task.id` are interpolated verbatim into Markdown. A `lastReason` containing `\n## ` injects a fake heading; a `|` breaks the task table. In terminal mode this is cosmetic; in `--output md` mode the file is structurally corrupted. Suggest: `.replace(/[\r\n]+/g, " ↵ ")` before rendering.

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs