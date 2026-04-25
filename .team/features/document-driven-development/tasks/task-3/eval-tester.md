# Tester Review — task-3

## Verdict: PASS (with one warning for backlog)

## Files Actually Read
- `bin/lib/run.mjs` lines 920–960 (the gate logic)
- `test/cli-commands.test.mjs` lines 284–345 (two new tests)
- `.team/features/document-driven-development/tasks/task-3/handshake.json`
- Commit `af0e668` full diff

## Claim vs. Evidence

| Claim | Evidence |
|---|---|
| Validates 7 required PRD sections | run.mjs:931–939 lists exactly the seven sections |
| Lists missing sections | run.mjs:944–947 prints each missing section to stderr |
| Exits non-zero | run.mjs:950 `process.exit(1)` |
| Does not modify SPEC.md | No write to `specPath` after the read at line 930; test asserts `before === after` |
| Does not run tasks | Gate sits before the "Plan tasks" section at line 959; `process.exit(1)` short-circuits |
| Two regression tests added | cli-commands.test.mjs:287–344 — partial-spec failure + complete-spec pass-through |

Test output excerpt confirms `cli-commands.test.mjs` is in the runner; full output truncated in gate report but no failures shown for the new tests in the visible portion.

## Coverage Analysis

### Covered
- Partial spec → exit 1, missing sections listed, file unchanged, no `tasks` in STATE
- Complete spec → does NOT trigger the "missing required section" message (verified via `--dry-run`)

### Edge Cases NOT Covered (gaps)

1. **Whitespace / heading-level variants** — Regex `^##\s+${name}\s*$` is strict. These would all FAIL the gate even though a human reader would consider them valid:
   - `### Goal` (H3 instead of H2)
   - `## Goal:` (trailing colon — common markdown style)
   - `## Goal — purpose` (descriptive heading)
   - `##Goal` (no space — `\s+` requires ≥1)
   - `## goal` (lowercase)
   No test pins this behavior either way. If the brainstorm template diverges (e.g., emits `## Goal:`), the gate breaks silently for users.

2. **False positives via fenced code blocks** — A SPEC.md that contains a code fence with literal `## Goal` lines would satisfy the regex even if the document has no real Goal section. No test for this.

3. **The "only missing sections are listed" property** — The partial-spec test asserts the 5 missing sections appear in output, but does not assert that `Goal` and `Requirements` (which ARE present) are NOT listed. A bug where the filter inverted the predicate could pass this test.

4. **Order of sections** — Spec with sections in wrong order is accepted. Probably correct, but undocumented.

5. **Empty section bodies** — `## Goal\n\n## Requirements` passes the gate even though Goal has no content. Out of scope for this task per the spec ("missing sections", not "empty sections"), but worth noting.

6. **Concurrent / re-entrant calls** — Not relevant; CLI is single-shot.

### Regression Risk
Low. The new code is additive, gated behind `existsSync(specPath)`, and runs before any state mutation in the planning phase. The pre-existing missing-SPEC branch is untouched. STATE.json may be created earlier by `initFeatureState` (line ~922), and the test correctly accounts for that by allowing STATE.json to exist as long as `tasks` is empty.

## Findings

🟡 test/cli-commands.test.mjs:303 — Partial-spec test does not assert that present sections (`Goal`, `Requirements`) are absent from the error output; an inverted-filter regression would pass. Add `assert.ok(!output.includes("- Goal"))` and similar for `Requirements`.
🟡 bin/lib/run.mjs:941 — Heading regex is strict (`^##\s+Name\s*$`); rejects common variants like `## Goal:` or `### Goal`. Either document the exact required form in the error message, or relax to tolerate trailing punctuation/level. Backlog if brainstorm template stays in lockstep.
🔵 test/cli-commands.test.mjs:287 — No coverage for fenced code blocks containing `## Goal` text causing a false pass. Consider one negative test.
🔵 bin/lib/run.mjs:931 — Section list is duplicated knowledge with whatever produces SPEC.md templates. Single source of truth would reduce drift risk; defer until second caller exists.

No 🔴.
