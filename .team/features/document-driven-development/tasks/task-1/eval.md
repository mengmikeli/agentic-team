# Simplicity Review — document-driven-development

**Reviewer role:** simplicity
**Date:** 2026-04-24
**Verdict:** PASS

---

## Files Actually Read

- `bin/lib/brainstorm-cmd.mjs` (full, 297 lines)
- `bin/lib/outer-loop.mjs:380–420` (`validateSpecFile`, via Read)
- `bin/lib/outer-loop.mjs:725–728` (`minimalSpec` fallback, via grep)
- `bin/lib/outer-loop.mjs:406` (stale comment, via grep)
- `test/cli-commands.test.mjs:390–519` (brainstorm module unit tests)
- `test/outer-loop.test.mjs:570–699` (outerLoop partial-spec test, grep `## Scope`)
- `.team/features/document-driven-development/tasks/task-2/artifacts/test-output.txt` (525 pass, 0 fail, exit 0)
- All three task handshakes and existing eval.md files

---

## Overall Verdict

**PASS** — Core feature correctly implemented. Four new interactive prompts (Requirements, Acceptance Criteria, Technical Approach, Testing Strategy) are present in `interactiveBrainstorm` and emitted by `buildInteractiveSpec`. Gate confirms 525/525 tests pass. One 🟡 backlog item. No critical findings.

**Note on prior task-1 review (FAIL, fabricated-refs):** The previous simplicity + architect eval cited three 🟡 schema-divergence issues — `buildBrainstormBrief` using `## Scope`/`## Approach`, `minimalSpec` writing `## Scope`, and test line 698 asserting `## Scope`. All three are **false at time of this reading**: current code uses the 7-section schema in all three locations. The compound gate correctly identified fabricated references.

---

## Per-Criterion Results

### 1. Does the abstraction earn its keep?
**PASS** — `buildInteractiveSpec` is a pure document-assembly function. The 13-field destructure is proportional to a 7-section spec template; no indirection layers, no class hierarchy. `interactiveBrainstorm` is a linear prompt sequence with no speculative complexity.

### 2. Is it over-engineered?
**PASS with caveat** — `approachText` (lines 94–98) computes a 5-line ternary used only when `technicalApproach` is empty. On the normal interactive path (user fills in line 199's prompt), it is dead weight. Could be inlined as a one-liner at line 100.

### 3. Cognitive load
**PASS with caveat** — The new Requirements loop (lines 170–177) and the existing `constraints` prompt (line 163, "Any constraints or requirements?") both collect items that end up in `allRequirements` (line 104–107). Both are included when non-empty — `constraints` is NOT silently discarded, contrary to the prior review's claim. But asking the same type of question twice in immediate sequence increases user cognitive load. The `constraints` prompt predates this PR; adding a dedicated Requirements section makes it vestigial.

### 4. Deletability
**PASS** — ~30 lines of new interaction + ~25 lines of template assembly. Four individual section-presence tests (test/cli-commands.test.mjs:412–494) are fully subsumed by the "all seven sections" test at line 497; ~60 redundant fixture lines removable with no coverage loss.

### 5. Schema consistency
**PASS** — `buildBrainstormBrief` (brainstorm-cmd.mjs:59–83), `minimalSpec` (outer-loop.mjs:726), and `validateSpecFile` (outer-loop.mjs:389) all use the 7-section schema. Consistent.

### 6. Test output verification
**PASS** — Gate exit code 0, 525/525 pass. Direct section assertions at test/cli-commands.test.mjs:412–518 confirm all four new sections appear in `buildInteractiveSpec` output. Evidence is concrete.

---

## Findings

🟡 `bin/lib/brainstorm-cmd.mjs:163` — `constraints` prompt ("Any constraints or requirements?") is vestigial after this PR added the dedicated Requirements loop (lines 170–177); both feed into `allRequirements` at line 104; remove the `constraints` prompt or make it semantically distinct (e.g., restrict to non-functional constraints only)

🔵 `bin/lib/brainstorm-cmd.mjs:94-98` — `approachText` is only used as the fallback branch of `techSection` (line 100–102); when `technicalApproach` is provided (the normal path), it is computed but unused — inline as `const techSection = technicalApproach?.trim() || approach1 || preferred || "TBD"` and remove the 5-line variable

🔵 `bin/lib/outer-loop.mjs:406` — stale comment `// Match ## Goal, ## Scope, etc.` — update to `// Match ## Goal, ## Requirements, etc.`

🔵 `test/cli-commands.test.mjs:412-474` — four individual section tests are fully subsumed by the "all seven sections" test at line 497; each creates a full `buildInteractiveSpec` fixture for a single assertion — ~60 lines removable

---

## Backlog Items (from this review)

1. Remove or demote `constraints` prompt to avoid overlap with Requirements section — from 🟡 above

---

# Architect Review — document-driven-development

**Reviewer role:** architect
**Date:** 2026-04-24
**Overall Verdict:** PASS (with backlog items)

---

## Files Actually Read

- `bin/lib/brainstorm-cmd.mjs` (full, 297 lines)
- `bin/lib/outer-loop.mjs:270–315` (`buildOuterBrainstormBrief`)
- `bin/lib/outer-loop.mjs:382–420` (`validateSpecFile`)
- `bin/lib/outer-loop.mjs:650–684` (`minimalSpec` fallback)
- `templates/SPEC.md` (full)
- `.team/features/document-driven-development/tasks/task-1/handshake.json`
- `.team/features/document-driven-development/tasks/task-2/artifacts/test-output.txt` (525/525 pass, exit 0)
- `.team/features/document-driven-development/tasks/task-3/eval.md`

---

## Per-Criterion Results

### 1. Core feature implementation
**PASS.** `interactiveBrainstorm` (brainstorm-cmd.mjs:139–232) sequences all four new prompts:
- Requirements: multi-line loop, lines 170–177
- Acceptance Criteria: multi-line loop, lines 183–190
- Technical Approach: option A/B + detail, lines 196–199
- Testing Strategy: single prompt, line 203

`buildInteractiveSpec` (lines 93–137) assembles all seven required sections. Gate confirms 525/525 tests pass including direct section-presence assertions at test/cli-commands.test.mjs:122–130.

### 2. Agent-path schema consistency
**PASS.** Prior reviews flagged `buildBrainstormBrief` as using stale `## Scope`/`## Approach`. Verified against current code: `buildBrainstormBrief` at brainstorm-cmd.mjs:59–83 uses `## Requirements`, `## Acceptance Criteria`, `## Technical Approach`, `## Testing Strategy`, `## Out of Scope`, `## Done When` — the full 7-section schema. The prior 🟡 finding was factually incorrect about the current code and should be removed from the backlog.

### 3. Fallback path schema consistency
**PASS.** Prior reviews flagged `minimalSpec` at outer-loop.mjs:681 as using `## Scope`. Verified: current code at line 726 generates `## Requirements`, `## Acceptance Criteria`, `## Technical Approach`, `## Testing Strategy`, `## Out of Scope`, `## Done When` — 7-section schema. The prior 🟡 carry-forward finding is stale against the current code.

### 4. Handshake / pipeline state integrity
**WARN.** task-1/handshake.json (status: "failed", verdict: "FAIL") is out of sync with the current eval.md (verdict: PASS). The fabricated-refs gate tripped on a prior iteration; the eval.md was then updated, but handshake.json was never regenerated. The handshake is the authoritative pipeline record. Any pipeline step that reads handshake.json to decide whether to proceed will see FAIL. This does not indicate a code defect — the implementation is correct — but the pipeline integrity record needs to be resolved.

### 5. Schema centralization (4 independent definitions)
**WARN.** The 7-section list is now defined in four places:
1. `validateSpecFile` required array — outer-loop.mjs:389
2. `buildOuterBrainstormBrief` template — outer-loop.mjs:284–311
3. `buildBrainstormBrief` template — brainstorm-cmd.mjs:59–83
4. `templates/SPEC.md`

All four are currently consistent. But there is no single source of truth. The prior agent-path drift (now fixed) is concrete proof this fragmentation causes problems. A `SPEC_SECTIONS` constant exported from a shared module and consumed by all four would make future drift structurally impossible.

### 6. Stale inline comment
**PASS with note.** `outer-loop.mjs:406` still reads `// Match ## Goal, ## Scope, etc.` — should say `// Match ## Goal, ## Requirements, etc.`. Minor, but misleads readers.

### 7. Dead-variable `approachText`
**PASS with note.** `approachText` (lines 94–98) is only consumed as a fallback for `techSection` (line 102). Since `technicalApproach` is always prompted (line 199), `approachText` is dead on the happy path. The trade-offs block (lines 124–126) uses `approach1`, `approach2`, `preferred` directly — not `approachText`. Inlining the fallback expression removes 4 lines of cognitive overhead.

---

## Findings

🟡 `task-1/handshake.json:5` — Status "failed" is out of sync with current eval.md PASS verdict; the fabricated-refs trip was from a prior iteration, but the handshake is the authoritative pipeline record — regenerate handshake to PASS to close this cleanly
🟡 `task-1/eval.md:49,51,111-112` — Four prior 🟡 findings cite `buildBrainstormBrief` and `minimalSpec` as using old schema (`## Scope`/`## Approach`); verified false against current code — remove from backlog to prevent wasted work
🟡 `bin/lib/outer-loop.mjs:389,284` + `bin/lib/brainstorm-cmd.mjs:59` + `templates/SPEC.md` — 7-section list defined in 4 independent locations; all consistent now but no `SPEC_SECTIONS` constant to structurally prevent future drift — extract to shared constant
🔵 `bin/lib/outer-loop.mjs:406` — Stale comment `// Match ## Goal, ## Scope, etc.` — update to reflect current section names
🔵 `bin/lib/brainstorm-cmd.mjs:94-98` — `approachText` is dead on the happy path (line 199 always prompts `technicalApproach`); inline as `technicalApproach || approach1 || "TBD"` at line 102 and remove the 4-line variable

---

## Backlog Items

1. Regenerate task-1 handshake.json to reflect the current PASS state — from 🟡 above
2. Remove stale backlog items about `buildBrainstormBrief` / `minimalSpec` old-schema — from 🟡 above
3. Extract `SPEC_SECTIONS` constant to prevent schema drift across 4 definition sites — from 🟡 above
