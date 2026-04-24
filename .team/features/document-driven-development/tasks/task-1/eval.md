# Simplicity Review — document-driven-development
**Reviewer role:** simplicity
**Date:** 2026-04-24
**Verdict:** PASS

---

## Overall Verdict

**PASS** — The interactive mode implementation is correct and tests pass (525/525). No critical simplicity issues block merge. Two backlog-worthy warnings and three non-blocking suggestions. Prior PM eval findings confirmed and extended.

---

## Files Read

- `bin/lib/brainstorm-cmd.mjs` (full, 289 lines)
- `templates/SPEC.md`
- `bin/lib/outer-loop.mjs:375–415` (validateSpecFile)
- `bin/lib/outer-loop.mjs:655–684` (minimalSpec fallback)
- `test/cli-commands.test.mjs:399–517` (brainstorm unit tests via grep)
- `task-2/artifacts/test-output.txt` (gate evidence: 525 pass, 0 fail)

---

## Per-Criterion Results

### 1. Does the abstraction earn its keep?
**PASS** — `buildInteractiveSpec` is a pure function mapping named fields to a markdown document. No indirection layers, no class hierarchy, no framework overhead. Complexity is proportional to the number of inputs it assembles.

### 2. Is it over-engineered?
**PASS with caveat** — The core flow is straightforward. However, `approachText` (lines 88–96) is a dead variable on the happy path: whenever `technicalApproach` is provided (the normal case), `approachText` is computed but never reaches `techSection`. It still feeds the Trade-offs block (line 117), but the coupling is invisible at the call site.

### 3. Cognitive load
**PASS with caveat** — The 13-field destructure parameter is at the high end but acceptable for a document-assembly function. More problematic: `constraints` is collected from the user (line 155) but silently discarded whenever `requirements` is non-empty (line 107 fallback). A reader must trace both files to understand the fallback; the user is never told their constraint answer was discarded.

### 4. Deletability
**PASS** — The new code (Requirements, Acceptance Criteria, Technical Approach, Testing Strategy prompts + template sections) adds ~30 lines of interaction and ~25 lines of template assembly. No unnecessary abstractions were introduced. The test suite adds ~120 lines, of which ~60 are redundant (four individual section tests subsumed by the "all seven" test at line 497).

### 5. Two-path schema divergence
**WARN** — `buildBrainstormBrief` (agent path, lines 41–83) still uses `## Scope` and `## Approach` (old schema). When an agent is available, `agt brainstorm <idea>` silently writes a spec that fails `validateSpecFile`. Feature scope is "interactive mode," but this growing divergence is a maintenance hazard.

### 6. Test output verification
**PASS** — `task-2/artifacts/test-output.txt` confirms exit code 0, 525/525 tests pass. Tests at `test/cli-commands.test.mjs:122–130` directly verify all four new sections appear in `buildInteractiveSpec` output. Evidence is concrete, not aspirational.

---

## Findings

🟡 `bin/lib/brainstorm-cmd.mjs:60-77` — `buildBrainstormBrief` (agent path) uses `## Scope` and `## Approach` (old schema); specs written when an agent is available will fail `validateSpecFile` — align to 7-section schema or file as backlog before enforcement tightens

🟡 `bin/lib/brainstorm-cmd.mjs:155` — `constraints` is collected from the user but silently discarded whenever `requirements` is non-empty (line 107 fallback); dead variable on the happy path — rename to `fallbackRequirement` or remove and let requirements default to "TBD"

🔵 `bin/lib/brainstorm-cmd.mjs:88-96` — `approachText` is always shadowed by `technicalApproach` on lines 94–96 (the happy path); inline as `technicalApproach || approach1 || "TBD"` and remove the 5-line dead variable

🔵 `test/cli-commands.test.mjs:412-474` — four individual section tests (Requirements, Acceptance Criteria, Technical Approach, Testing Strategy) are fully subsumed by the "all seven" test at line 497; ~60 lines of duplicate fixtures with no additional coverage

🔵 `bin/lib/outer-loop.mjs:406` — stale comment `// Match ## Goal, ## Scope, etc.` flagged in prior eval and still present; update to reflect current section names

---

## Backlog Items (from this review)

1. Align `buildBrainstormBrief` (agent path) to the 7-section schema — from 🟡 above
2. Clarify or remove `constraints` variable in interactive flow — from 🟡 above

---

# Architect Review — document-driven-development

**Reviewer role:** architect
**Date:** 2026-04-24
**Verdict:** PASS

---

## Files Read

- `bin/lib/brainstorm-cmd.mjs` (full, 289 lines)
- `templates/SPEC.md` (full)
- `bin/lib/outer-loop.mjs:270–420` (buildOuterBrainstormBrief, validateSpecFile)
- `bin/lib/outer-loop.mjs:655–700` (minimalSpec fallback)
- `test/outer-loop.test.mjs` (grep: `## Scope`, `minimalSpec`, line 698)
- `tasks/task-2/artifacts/test-output.txt` (gate evidence: 525 pass, 0 fail)

---

## Overall Verdict

**PASS** — Interactive feature correctly implemented; 525/525 tests pass; no critical findings. Two 🟡 backlog items: same-module schema divergence between the agent and interactive paths, and the unresolved `minimalSpec` fallback from the prior cycle.

---

## Per-Criterion Results

### 1. System boundary: same-module path consistency
**WARN** — `bin/lib/brainstorm-cmd.mjs` exports two SPEC-producing paths: `buildInteractiveSpec` (7-section schema, updated by this task) and `buildBrainstormBrief` (agent path, still 5-section schema: `## Scope`, `## Approach`). Both paths are reached from the same entry point `cmdBrainstorm` and write to the same `SPEC.md` destination, but produce structurally incompatible outputs. When a coding agent is installed, `agt brainstorm <idea>` silently writes a spec that fails `validateSpecFile`. This is an in-module boundary violation introduced by updating only one of the two paths.

### 2. Cross-cutting schema: single source of truth
**WARN** — The 7-section schema is now defined in four independent locations: `validateSpecFile` required array (outer-loop.mjs:389), `buildOuterBrainstormBrief` template (outer-loop.mjs:284), `templates/SPEC.md`, and `buildBrainstormBrief` (brainstorm-cmd.mjs:65). The agent-path drift in this task is proof the fragmentation actively causes problems. A single `SPEC_SECTIONS` constant exported and consumed by all four would make drift structurally impossible.

### 3. Fallback path alignment
**WARN (carried)** — `outer-loop.mjs:681` `minimalSpec` still writes `## Scope`. Confirmed unchanged. `test/outer-loop.test.mjs:698` asserts `spec.includes("## Scope")`, locking in the stale name. Unresolved from prior review cycle; will hard-block features hitting the fallback once `validateSpecFile` enforcement tightens.

### 4. Core interactive feature implementation
**PASS** — `interactiveBrainstorm` correctly sequences all four new prompts: Requirements (multi-line loop, lines 158–169), Acceptance Criteria (multi-line loop, 171–182), Technical Approach (options A/B + detail, 184–191), Testing Strategy (195). `buildInteractiveSpec` emits all required sections. Gate confirms 525/525.

---

## Findings

🟡 bin/lib/brainstorm-cmd.mjs:65 — `buildBrainstormBrief` (agent path) uses `## Scope`/`## Approach` while `buildInteractiveSpec` (interactive path) in the same file uses the 7-section schema; `cmdBrainstorm` selects between them based on agent availability, so users with an agent get a spec that silently fails `validateSpecFile` — update `buildBrainstormBrief` to match the 7-section schema
🟡 bin/lib/outer-loop.mjs:681 — `minimalSpec` fallback writes `## Scope` (old name), fails its own `validateSpecFile`; update to 7-section schema and fix companion assertion at test/outer-loop.test.mjs:698
🔵 bin/lib/outer-loop.mjs:406 — stale inline comment `// Match ## Goal, ## Scope, etc.` — update to reflect current section names
🔵 bin/lib/brainstorm-cmd.mjs:36,bin/lib/outer-loop.mjs:284,bin/lib/outer-loop.mjs:389 — section schema defined in 4 independent locations; agent-path drift is concrete evidence of risk — extract a `SPEC_SECTIONS` constant and derive all definitions from it
