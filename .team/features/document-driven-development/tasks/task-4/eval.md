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
