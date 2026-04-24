## Parallel Review Findings

[product] Three 🟡 backlog items must be tracked (two are carryovers from the prior review that remain unresolved). No 🔴 critical findings — merge is not blocked.
🟡 [architect] `bin/lib/brainstorm-cmd.mjs:65` — `buildBrainstormBrief` (agent path) uses `## Scope`/`## Approach` while `buildInteractiveSpec` (interactive path) in the same file uses the 7-section schema; `cmdBrainstorm` routes to one or the other based on agent availability, so users with an agent installed silently get a spec that fails `validateSpecFile` — update agent brief to match the 7-section schema
🟡 [architect] `bin/lib/outer-loop.mjs:681` — `minimalSpec` fallback writes `## Scope` (old name), fails its own `validateSpecFile`; `test/outer-loop.test.mjs:698` locks in the stale name — fix both together; carried unresolved from prior cycle
[architect] - No critical findings. Two 🟡 backlog items: (1) same-module schema divergence between agent and interactive paths (new finding this cycle), (2) `minimalSpec` fallback still uses the stale `## Scope` heading (carried from prior cycle).
🟡 [engineer] `bin/lib/brainstorm-cmd.mjs:155` — `constraints` answer ("Any constraints or requirements?") is silently discarded when the user also enters items in the step-3 requirements loop; `buildInteractiveSpec:107` only uses `constraints` as a fallback when `requirements.length === 0` — merge `constraints` into the requirements array unconditionally when non-empty, or remove the overlapping question
🟡 [engineer] `bin/lib/brainstorm-cmd.mjs:103` — Interactive spec emits `## Users` section absent from `templates/SPEC.md`; canonical template defines exactly seven sections (Goal, Requirements, Acceptance Criteria, Technical Approach, Testing Strategy, Out of Scope, Done When) — add `## Users` to the template or remove it from `buildInteractiveSpec` to eliminate format drift before `validateSpecFile` enforcement lands
[engineer] All 525 tests pass (exit code 0 confirmed in `artifacts/test-output.txt`). The four new prompts (Requirements loop, Acceptance Criteria loop, Technical Approach questions, Testing Strategy question) are all present in `interactiveBrainstorm()` and exercised by the `brainstorm-cmd module` suite. `buildInteractiveSpec` correctly includes all seven sections. Two 🟡 warnings must go to backlog: (1) `constraints` data silently lost when requirements are also entered, (2) `## Users` section diverges from the canonical template.
🟡 [product] `bin/lib/brainstorm-cmd.mjs:65` — Agent-mode `buildBrainstormBrief` still uses old `## Scope`/`## Approach` format; both interactive and agent paths should produce the same 7-section schema — file as backlog
🟡 [product] `bin/lib/outer-loop.mjs:667` — Fallback minimal spec still writes `## Scope` (carryover finding, not fixed); will hard-block features on that path when `validateSpecFile` enforcement lands — fix in tandem with next task
🟡 [product] `test/outer-loop.test.mjs:698` — Asserts `spec.includes("## Scope")` for the minimal-spec test, locking in stale section name — update alongside fallback fix
🟡 [tester] `bin/lib/brainstorm-cmd.mjs:155` — `constraints` answer silently dropped when requirements loop is non-empty; merge constraints into requirements array or remove the redundant question
🟡 [tester] `bin/lib/brainstorm-cmd.mjs:103` — `buildInteractiveSpec` emits `## Users` not present in `templates/SPEC.md` or `validateSpecFile` required list; add it to the template or remove it from spec output to prevent format drift
🟡 [tester] `bin/lib/brainstorm-cmd.mjs:59` — `buildBrainstormBrief` (agent path) still specifies `## Scope` / `## Approach` instead of the seven-section schema; spec produced via agent will fail `validateSpecFile` — update agent brief prompt to match new template (this is 🟡, not 🔵 — it's a current correctness failure, not a future risk)
[tester] **Overall verdict: PASS** — Gate is green (525/525), the four new prompt sections are implemented and unit-tested in `buildInteractiveSpec`. Three 🟡 warnings go to backlog; no reds.
🟡 [security] `bin/lib/outer-loop.mjs:681` — Fallback minimal spec uses `## Scope` (stale heading); `validateSpecFile` will mark this path invalid when schema enforcement lands — align fallback to seven-section schema (backlog carry-forward from task-1)
🟡 [security] `test/outer-loop.test.mjs:698` — Asserts `spec.includes("## Scope")` on the fallback, locking in the stale name — fix in tandem with the code change (backlog carry-forward from task-1)
[security] The two 🟡 warnings are carry-forwards already in the backlog from the prior review (task-1). **Merge is safe.**
🟡 [simplicity] `bin/lib/brainstorm-cmd.mjs:60-77` — `buildBrainstormBrief` (agent path) still uses `## Scope` and `## Approach` (old schema); specs written when an agent is available will fail `validateSpecFile` — align to 7-section schema or file as backlog before enforcement tightens
🟡 [simplicity] `bin/lib/brainstorm-cmd.mjs:155` — `constraints` is collected from the user but silently discarded whenever `requirements` is non-empty (line 107 fallback); dead variable on the happy path — rename to `fallbackRequirement` or remove and let requirements default to "TBD"
🔵 [architect] `bin/lib/outer-loop.mjs:406` — stale inline comment `// Match ## Goal, ## Scope, etc.` — update to current section names
🔵 [architect] `bin/lib/brainstorm-cmd.mjs:36,bin/lib/outer-loop.mjs:284,bin/lib/outer-loop.mjs:389` — section schema defined in 4 independent locations; the agent-path drift above is concrete proof the fragmentation causes bugs — extract a `SPEC_SECTIONS` constant and derive all definitions from it
🔵 [engineer] `bin/lib/brainstorm-cmd.mjs:65` — `buildBrainstormBrief` (agent-mode path) still uses `## Scope` / `## Approach` section names that don't match the new schema; will hard-fail future `validateSpecFile` enforcement (task-5/6) — align before task-3 lands
🔵 [engineer] `test/cli-commands.test.mjs:514` — "all seven required sections" test does not assert the absence of unexpected sections; the spec silently includes an undeclared `## Users` section — assert section count or enumerate all expected headings
🔵 [engineer] `bin/lib/brainstorm-cmd.mjs:131` — `interactiveBrainstorm()` has zero test coverage; `buildInteractiveSpec` is well-tested but the I/O orchestration is untestable as-is — inject readline to enable unit testing
🔵 [product] `bin/lib/brainstorm-cmd.mjs:102` — `buildInteractiveSpec` emits a `## Users` section not present in `templates/SPEC.md`; benign now but drifts from the canonical template
🔵 [tester] `bin/lib/brainstorm-cmd.mjs:131` — `interactiveBrainstorm()` function body (readline I/O, SPEC.md write, criteria fallback) has no tests; mock readline to cover the orchestration layer
🔵 [tester] `test/cli-commands.test.mjs:514` — "all seven sections" test does not assert absence of unexpected sections; the spec silently has `## Users` as an 8th section — add an exact section-count assertion to catch future drift
🔵 [tester] `bin/lib/brainstorm-cmd.mjs:88` — `preferred` value that is neither "a" nor "b" lands verbatim in `techSection` when `technicalApproach` is empty; no test covers this branch
🔵 [tester] `bin/lib/brainstorm-cmd.mjs:212` — `criteria.length === 0` auto-inserts two default "Done When" entries; no test verifies this fallback
🔵 [security] `bin/lib/brainstorm-cmd.mjs:87` — `buildInteractiveSpec` accepts unbounded string inputs with no max-length guard; benign for a local CLI tool but worth noting if network input paths are ever added
🔵 [simplicity] `bin/lib/brainstorm-cmd.mjs:88-96` — `approachText` is always shadowed by `technicalApproach` on lines 94–96 (the happy path); inline as `technicalApproach || approach1 || "TBD"` and remove the 5-line dead variable
🔵 [simplicity] `test/cli-commands.test.mjs:412-474` — four individual section tests are fully subsumed by the "all seven" test at line 497; ~60 lines of duplicate fixtures with no additional coverage
🔵 [simplicity] `bin/lib/outer-loop.mjs:406` — stale comment `// Match ## Goal, ## Scope, etc.` flagged in prior eval and still present; update to reflect current section names

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs