# Product Manager Review — task-6

## Verdict: PASS

## Task
The brainstorm agent brief and template advertise the same seven sections that `validateSpecFile` checks for.

## Evidence

### Single source of truth
- `bin/lib/spec.mjs:6` exports a frozen `PRD_SECTIONS` array with exactly seven sections: Goal, Requirements, Acceptance Criteria, Technical Approach, Testing Strategy, Out of Scope, Done When.

### Brainstorm brief advertises all seven sections
- `bin/lib/flows.mjs:8` imports `PRD_SECTIONS`.
- `bin/lib/flows.mjs:67` derives the section list from `PRD_SECTIONS.map(s => `- ## ${s}`)` — no hardcoded list. Brief explicitly tells the agent at line 84: "these are the same sections validateSpecFile checks for".
- `bin/lib/brainstorm-cmd.mjs:9,60-61,117` — both the agent prompt and the SPEC.md generator iterate `PRD_SECTIONS`. The generated SPEC emits a labeled `## <section>` for every entry via switch-cases.

### templates/SPEC.md alignment
- `templates/SPEC.md` contains all seven `## <section>` headings in PRD_SECTIONS order.

### Tests verify the contract
- `test/flows.test.mjs:130-138` — asserts the brainstorm brief includes `## <section>` for every `PRD_SECTIONS` entry.
- `test/flows.test.mjs:141-153` — asserts `templates/SPEC.md` contains a top-level heading for every `PRD_SECTIONS` entry (case-insensitive, line-anchored).
- Ran `node --test test/flows.test.mjs`: **39/39 pass**, including both new assertions.

## Per-Criterion

| Criterion | Result | Evidence |
|---|---|---|
| Brief advertises sections from a single source | PASS | flows.mjs:67, brainstorm-cmd.mjs:60 import & iterate PRD_SECTIONS |
| templates/SPEC.md matches validateSpecFile sections | PASS | All 7 headings present; test passes |
| Drift is impossible going forward | PASS | All three sites read PRD_SECTIONS; template test fails if list grows but template lags |
| Test coverage proves the contract | PASS | Two new assertions added, both green |
| Acceptance: spec produced by brainstorm passes validateSpecFile | PASS (by construction) | Same source feeds brief, generator, validator |

## User Value
A user running `agt brainstorm` will reliably produce a SPEC.md that survives `validateSpecFile`. Removes a class of "spec rejected" loops that previously blocked sprint-init. Scope is tightly bounded — no behavior change to non-brainstorm paths.

## Findings

No findings.
