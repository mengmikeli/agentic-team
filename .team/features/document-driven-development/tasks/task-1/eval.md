## Parallel Review Findings

🔴 [tester] `bin/lib/outer-loop.mjs:377` — `validateSpecFile` checks `["Goal", "Scope", "Out of Scope", "Done When"]` but the template uses `"Requirements"` not `"Scope"`; update the required array to match the seven sections in `templates/SPEC.md`
🔴 [tester] `bin/lib/outer-loop.mjs:291` — `buildOuterBrainstormBrief` instructs agents to write `## Scope`, conflicting with the template's `## Requirements`; update the embedded section list to the seven-section structure
🟡 [architect] bin/lib/outer-loop.mjs:377 — `validateSpecFile` required array still contains `"Scope"` (old section name); new template uses `"Requirements"`. Validation is inverted for new-template specs until task-5 fixes it. Flag task-5 as a hard prerequisite for task-6 in progress.md to prevent a regression when enforcement is added.
🟡 [engineer] `bin/lib/outer-loop.mjs:377` — `required` array still contains `"Scope"` (old section name); new template uses `"Requirements"`. Any SPEC.md authored from the updated template fails validation with a spurious "Scope missing" error. Update required array to the seven new sections when the validator task lands.
🟡 [tester] `test/outer-loop.test.mjs:253` — `validateSpecFile` "complete SPEC.md" fixture uses the old four-section format; update to match the new template or the test proves the wrong contract
🟡 [tester] `test/outer-loop.test.mjs:127` — asserts `## Scope` in `buildOuterBrainstormBrief` output, which contradicts the new template; update to `## Requirements` and add assertions for the five new sections
🟡 [simplicity] `bin/lib/outer-loop.mjs:377` — `validateSpecFile` checks for `"Scope"` but the new template uses `"Requirements"`; every spec produced from the updated template will fail validation with "Scope missing" — update the required array to the seven sections matching the template before tasks 2–4 dispatch agents that generate specs
🔵 [engineer] `test/outer-loop.test.mjs:253` — No test opens `templates/SPEC.md` directly and asserts `result.valid === true`. Add one fixture-free test to catch future template/validator drift.

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs