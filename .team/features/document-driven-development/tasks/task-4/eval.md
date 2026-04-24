# PM Review — document-driven-development

**Reviewer role:** product
**Date:** 2026-04-24
**Task reviewed:** `agt brainstorm` (interactive mode) prompts the user for Requirements, Acceptance Criteria, Technical Approach, and Testing Strategy in addition to the existing prompts.

---

## Overall Verdict

**PASS**

The specific criterion is met with direct evidence. The four new prompts exist in code, the output includes all required sections, and 525/525 tests pass with explicit per-section assertions. Two user-experience gaps warrant backlog items. Three fabricated reviewer findings from task-2 eval must NOT enter the backlog — they contradict the actual code.

---

## Files Actually Read

- `bin/lib/brainstorm-cmd.mjs` (full, 297 lines)
- `templates/SPEC.md` (full)
- `.team/features/document-driven-development/SPEC.md` (full)
- `.team/features/document-driven-development/tasks/task-1/handshake.json`
- `.team/features/document-driven-development/tasks/task-2/handshake.json`
- `.team/features/document-driven-development/tasks/task-3/handshake.json`
- `.team/features/document-driven-development/tasks/task-1/eval.md` (full)
- `.team/features/document-driven-development/tasks/task-2/eval.md` (full)
- `.team/features/document-driven-development/tasks/task-3/eval.md` (full)
- `.team/features/document-driven-development/tasks/task-2/artifacts/test-output.txt` (full)
- `test/cli-commands.test.mjs` (grep: buildInteractiveSpec lines)

---

## Per-Criterion Results

### 1. Requirements prompt present
**PASS** — `interactiveBrainstorm` at `bin/lib/brainstorm-cmd.mjs:167–177` implements a multi-line loop collecting requirements one per line, terminating on empty input. Confirmed present in code.

### 2. Acceptance Criteria prompt present
**PASS** — `interactiveBrainstorm` at `bin/lib/brainstorm-cmd.mjs:180–190` implements an equivalent multi-line loop for acceptance criteria.

### 3. Technical Approach prompt present
**PASS** — Lines 193–199 present Option A/B free-text prompts, a preference question, and a detail prompt (`technicalApproach`). The four sub-questions together constitute the Technical Approach interactive section.

### 4. Testing Strategy prompt present
**PASS** — Line 203 prompts "How will this be tested?". Single-line input (see finding below).

### 5. All four sections appear in spec output
**PASS** — `buildInteractiveSpec` (lines 109–136) emits `## Requirements`, `## Acceptance Criteria`, `## Technical Approach`, and `## Testing Strategy` headings. Direct code read confirms all four are present.

### 6. Gate / test evidence
**PASS** — `test-output.txt` confirms exit code 0, 525/525 pass. Test suite at `test/cli-commands.test.mjs:412–519` includes five `buildInteractiveSpec` assertions: one per new section and one asserting all seven required sections are present. Evidence is concrete.

### 7. User-collected `users` answer reaches the spec
**FAIL (user value gap)** — `users` is collected at line 162 ("Who is this for?") and destructured in `buildInteractiveSpec` at line 93, but it is never interpolated into the output template. The user's answer is silently discarded. No spec section captures the target user. This is not a code defect but a feature gap: the prompt is shown, an answer is taken, and nothing happens with it.

### 8. `constraints` question vs. Requirements loop — user clarity
**WARN** — `constraints` ("Any constraints or requirements?", line 163) is collected and prepended to `requirements` via `allRequirements` (lines 104–107). So the data is NOT lost (prior reviewer claims of "silently discarded" are incorrect). However, the UX is confusing: a user who reads "Any constraints or requirements?" before the Requirements loop may enter the same information twice. The old question's wording directly overlaps the new Requirements section.

---

## Correction to Prior Review Findings

The following findings from task-2's parallel review cite code behavior that does not exist in the actual source. They must **not** be filed as backlog items:

1. **`buildBrainstormBrief` uses `## Scope`/`## Approach` (old schema)** — Cited at `brainstorm-cmd.mjs:65` by architect, tester, simplicity, product, and engineer reviewers. **Actual code at line 66 reads `## Requirements`; lines 69–76 read `## Acceptance Criteria`, `## Technical Approach`, `## Testing Strategy`.** The agent brief was updated. These claims are fabricated. The compound gate correctly tripped `fabricated-refs`.

2. **`buildInteractiveSpec` emits a `## Users` section** — Cited at `brainstorm-cmd.mjs:103` by engineer, tester, and product reviewers. **Actual code: `users` is destructured at line 93 but never interpolated into the output string. No `## Users` heading is emitted.** This finding is fabricated.

These two false findings account for the compound gate WARN on task-2. They should be discarded, not entered into the backlog.

---

## Findings

🟡 `bin/lib/brainstorm-cmd.mjs:162` — `users` answer ("Who is this for?") is collected and passed to `buildInteractiveSpec` but never included in any spec section; users see a question with no corresponding output — either include it under Goal or as a `## Users` section, or remove the question

🟡 `bin/lib/brainstorm-cmd.mjs:163` — `constraints` question ("Any constraints or requirements?") overlaps semantically with the new Requirements loop at line 167; users may enter the same information twice without realizing it — reword to "Any hard constraints (non-functional, compliance, platform)?" to distinguish from functional requirements, or remove it

🔵 `bin/lib/brainstorm-cmd.mjs:203` — Testing Strategy is a single-line prompt while Requirements and Acceptance Criteria use guided multi-line loops; a single `ask()` produces thin Testing Strategy entries — consider a multi-line loop or structured sub-prompts (unit tests? integration? manual?)

---

## Backlog Items (from this review)

1. Capture `users` answer in spec output or remove the question — from 🟡 above
2. Disambiguate `constraints` question from Requirements loop — from 🟡 above
3. Discard these previously-filed backlog items (they are fabricated): "buildBrainstormBrief uses ## Scope/## Approach" and "buildInteractiveSpec emits ## Users section"

---

# Tester Review — document-driven-development

**Reviewer role:** tester
**Date:** 2026-04-24
**Overall Verdict:** PASS

---

## Files Actually Read

- `bin/lib/brainstorm-cmd.mjs` (full, 297 lines)
- `test/cli-commands.test.mjs:390–519` (brainstorm-cmd module tests)
- `bin/lib/outer-loop.mjs:256–315` (buildOuterBrainstormBrief)
- `bin/lib/outer-loop.mjs:375–420` (validateSpecFile)
- `bin/lib/outer-loop.mjs:655–729` (minimalSpec fallback, brainstorm step)
- `test/outer-loop.test.mjs:688–699` (minimalSpec assertion)
- `templates/SPEC.md` (full)
- `.team/features/document-driven-development/tasks/task-2/artifacts/test-output.txt` (full)
- All three handshake.json files (task-1, task-2, task-3)
- task-1/eval.md, task-3/eval.md (full)

---

## Per-Criterion Results

### 1. Core feature: four new sections in `buildInteractiveSpec`
**PASS** — `test/cli-commands.test.mjs:412–518` directly asserts `## Requirements`, `## Acceptance Criteria`, `## Technical Approach`, `## Testing Strategy`, and the combined 7-section test at line 497. Gate confirms 525/525 pass, exit 0.

### 2. Content propagation
**PASS** — Tests verify section headings AND content: Requirements (line 429–431: "Must be fast", "Must be reliable"), Acceptance Criteria (line 451–452: "Given X, when Y, then Z"), Technical Approach (line 472–473: "Detailed technical plan here"), Testing Strategy (line 493–494: "Jest unit tests with 90% coverage"). Content reaches the spec correctly on the happy path.

### 3. TBD fallback paths
**PARTIALLY UNTESTED** — Three TBD fallbacks exist in code:
- `acceptanceCriteria: []` → `"- TBD"` (line 118) — no test asserts the "- TBD" content
- `testingStrategy: ""` → `"TBD"` (line 129) — no test asserts the "TBD" content
- `criteria: []` → empty string (line 135: `criteria.map(...).join("\n")`) — produces an empty `## Done When` section; `interactiveBrainstorm` has a default at line 220–223 but `buildInteractiveSpec` (exported) has no guard

The `criteria: []` case passes `validateSpecFile` (which checks heading presence only) but produces a spec with no checkboxes.

### 4. Interactive flow coverage
**UNTESTED** — `interactiveBrainstorm` (lines 139–232) — the readline loop — has no unit test. Coverage is only a CLI smoke test at `test/cli-commands.test.mjs:96–98` that verifies the header prints (18.9s test). No test asserts spec content from the interactive path.

### 5. Prior review fabricated claims
**CONFIRMED FALSE** — task-1 cited `buildBrainstormBrief` as using old 5-section schema and `minimalSpec` as writing `## Scope`. Both are contradicted by the actual code:
- `buildBrainstormBrief` (line 36–89): uses `## Requirements`, `## Acceptance Criteria`, `## Technical Approach`, `## Testing Strategy` — 7-section schema present
- `minimalSpec` (outer-loop.mjs:726): writes all 7 sections including `## Requirements`, `## Acceptance Criteria`, `## Technical Approach`, `## Testing Strategy`
- `test/outer-loop.test.mjs:698`: asserts `spec.includes("## Requirements")`, NOT `## Scope`

The compound gate correctly tripped `fabricated-refs` on task-1. These findings must not enter backlog.

### 6. Edge case: `preferred` input parsing
**UNTESTED** — `approachText` at line 94–98 checks `preferred.toLowerCase().startsWith("a/b")`. Only "a" and "b" exactly are exercised in tests. Inputs like "option A", "a." or `preferred = ""` fall through to the catch-all. Low risk for CLI but no coverage of these paths.

---

## Findings

🟡 `bin/lib/brainstorm-cmd.mjs:135` — `criteria.map(c => \`- [ ] ${c}\`).join("\n")` has no empty-array guard; `criteria: []` produces a blank `## Done When` section that passes `validateSpecFile` but contains no checkboxes — add a fallback matching `interactiveBrainstorm` line 220–223; add a test for `criteria: []`

🟡 `test/cli-commands.test.mjs:96` — `agt brainstorm` CLI test only verifies the header prints; the full `interactiveBrainstorm` readline path has zero content assertions — add a test that stubs `readline.createInterface` and verifies all four new sections appear in the written SPEC.md

🟡 `bin/lib/brainstorm-cmd.mjs:93` — `users` parameter is destructured but never referenced in the output template (lines 109–136); confirmed by the PM review above; silent data loss on a user-facing input — either include it in the spec or remove the prompt at line 162 and the parameter

🔵 `test/cli-commands.test.mjs:412` — four individual section tests (lines 412–494) are subsumed by the "all seven" test at line 497 with no additional edge-case coverage — replace with edge-case variants (empty AC, empty testingStrategy, criteria: []) that test the TBD fallback paths instead

🔵 `bin/lib/brainstorm-cmd.mjs:94` — `preferred` input parsed with `startsWith("a")` / `startsWith("b")` (case-insensitive via toLowerCase); "option a", "a." and multi-word inputs behave differently from "a" — no tests cover these; document or tighten the contract

---

## Backlog Items (from this review)

1. Guard `criteria: []` in `buildInteractiveSpec` + add test — from 🟡 above
2. Add interactive flow test (stub readline, verify SPEC.md output) — from 🟡 above
3. Resolve `users` dead parameter — from 🟡 above (confirmed by PM review)
