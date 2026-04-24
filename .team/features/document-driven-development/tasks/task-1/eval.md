## Parallel Review Findings

[tester] The prior eval.md's 🔴 claims that the validator still uses `"Scope"` and that tests use the old four-section format were **fabricated** — the compound gate correctly caught this. The code and tests are already aligned to the new seven-section schema.
🟡 [architect] `bin/lib/outer-loop.mjs:667` — Minimal fallback spec uses `## Scope` instead of `## Requirements` and omits `## Acceptance Criteria`, `## Technical Approach`, `## Testing Strategy`; fallback silently diverges from the schema `templates/SPEC.md` now defines — align fallback headings to the 7-section schema or call `validateSpecFile` after writing it
🟡 [engineer] `bin/lib/outer-loop.mjs:667` — Fallback `minimalSpec` uses `## Scope` (old name) and omits Requirements, Acceptance Criteria, Technical Approach, Testing Strategy; when task-5 adds `validateSpec` enforcement this will hard-block any feature that triggered the fallback — fix before task-5 lands
[engineer] - The `🟡` finding about the fallback at line 667 is real and confirmed — the fallback outputs `## Scope` which contradicts the new template; this becomes a correctness bug when task-5 enforcement lands
🟡 [product] `bin/lib/outer-loop.mjs:667` — Fallback minimal spec still writes `## Scope` instead of `## Requirements`; any spec produced via this path fails `validateSpecFile` and diverges from the new template. File as backlog.
🟡 [product] `test/outer-loop.test.mjs:698` — Asserts `spec.includes("## Scope")` in the minimal-spec creation test, locking in the stale section name. Fix in tandem with the fallback code change.
🟡 [tester] `templates/SPEC.md:1` — No test opens `templates/SPEC.md` directly and calls `validateSpecFile` on it. The `validateSpecFile` suite at `test/outer-loop.test.mjs:256` uses inline fixtures only. A future edit removing a section from the template would pass `npm test` silently. Add one test: `validateSpecFile(resolve("templates/SPEC.md"))` asserting `result.valid === true` and `result.sections.length === 7`.
[tester] The one actionable backlog item is the missing regression test for the template file itself (🟡 above).
🟡 [simplicity] `bin/lib/outer-loop.mjs:667` — Fallback `minimalSpec` uses `## Scope`; `validateSpecFile` now requires `"Requirements"` — update fallback and its test (`test/outer-loop.test.mjs:698`) to the seven-section schema
🔵 [architect] `bin/lib/outer-loop.mjs:284,389` — Section list is defined in three independent places (prompt scaffold at line 284, `validateSpecFile` required array at line 389, `templates/SPEC.md`); extract a single `SPEC_SECTIONS` constant to derive both the validation list and the prompt scaffold, eliminating silent drift risk
🔵 [engineer] `bin/lib/outer-loop.mjs:406` — Stale inline comment `// Match ## Goal, ## Scope, etc.` — update to current section names
🔵 [engineer] `test/outer-loop.test.mjs:256` — No test calls `validateSpecFile` against the actual `templates/SPEC.md` file; template/validator drift is undetectable until runtime
🔵 [product] `test/outer-loop.test.mjs:721,759,822,900,940,988,1049,1106,1130,1198` — Multiple integration test fixtures use `## Scope` in SPEC.md stubs. Tests pass (stubs aren't validated), but they model stale format.
🔵 [tester] `bin/lib/outer-loop.mjs:405` — `validateSpecFile` detects section heading presence but not that content below the heading is non-empty. A spec with `## Requirements\n\n## Acceptance Criteria` would pass validation. Emptiness enforcement is scoped to tasks 4–5, but it's a known gap against the full done-when criterion ("missing/empty sections").
🔵 [simplicity] `test/outer-loop.test.mjs:256` — No test opens `templates/SPEC.md` directly and calls `validateSpecFile` on it; add one fixture-free test to catch future template/validator drift

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs
🔴 iteration-escalation — Persistent eval warning: fabricated-refs recurred in iterations 1, 2

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs