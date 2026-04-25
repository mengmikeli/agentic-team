# Architect Review — task-3

## Verdict: PASS

## Task
`agt run my-feature` with a `SPEC.md` missing one or more required sections must exit non-zero, list the missing sections, and not modify the file or run any tasks.

## Evidence

### Files I actually read
- `bin/lib/run.mjs:920-959` — the gate
- `test/cli-commands.test.mjs:287-345` — two new regression tests (full diff via `git show af0e668`)
- `handshake.json` — claims match the diff
- `git show 8385c43 af0e668` — verified scope of the change

### Test run
`npm test` → 583 pass / 0 fail / 0 skipped (32.5s). Includes both new cases.

### Per-criterion
| Criterion | Result | Evidence |
|---|---|---|
| Exits non-zero | PASS | `process.exit(1)` at run.mjs:950; test asserts `exitCode === 1` |
| Lists missing sections | PASS | Loop at run.mjs:945-947; test asserts all 5 section names in stderr |
| Does NOT modify SPEC.md | PASS | Gate runs before any write to `specPath`; test asserts `after === before` |
| Does NOT plan/run tasks | PASS | `process.exit(1)` precedes the planning section at run.mjs:959; test asserts STATE.json absent or `tasks` empty |

## Architecture Assessment

**Boundaries.** Gate is local to `_runSingleFeature`, runs immediately after `readFileSync(specPath)` and immediately before the planning section. No new module, no new dependency, no exported surface. Mirrors the shape of the sibling missing-file gate at run.mjs:952-957 — same color tokens, same remediation hint, same exit code. Consistent pattern, low cognitive load.

**Coupling.** Zero new coupling. The seven required-section names are inlined as a const array; nothing else imports them today. If `agt brainstorm` evolves to scaffold sections from the same canonical list, that would be the moment to hoist to a shared constant — not before.

**Scalability/maintainability.** O(n × m) where n=7 sections and m=spec length, with a fresh `RegExp` per section. Trivially fine. The strict regex `^##\s+<name>\s*$` rejects `### Goal`, `# Goal`, or `## Goal extra` — these are correct rejections (subsections and trailing words shouldn't satisfy the gate).

**Edge cases I checked by reading the code:**
- All 7 missing → all 7 enumerated (per-section filter is independent). ✓
- `## Goal ` (trailing space) → matches via `\s*$`. ✓
- `### Goal` → rejected (anchor requires exactly `##`). ✓
- Order-independent: gate doesn't care about section order. ✓

**Edge cases not verified:** CRLF line endings (regex `m` flag should handle, untested); unicode whitespace in titles; case variants (`## goal` is rejected — strict by design, acceptable if SPEC template is the only producer).

## Findings

🔵 bin/lib/run.mjs:931-939 — Seven required sections inlined here. If `agt brainstorm` scaffolds the same list elsewhere, extract to a single module-level `REQUIRED_SPEC_SECTIONS` constant to keep the canonical list in one place. Not a blocker — one call site today.

🔵 bin/lib/run.mjs:943-951 vs :952-956 — Two adjacent error branches share the same trailing two lines ("Document-driven development requires…" / "Run: agt brainstorm…"). Minor duplication; trivially DRY-able if a third gate appears. Not worth doing for two call sites.

🔵 bin/lib/run.mjs:941 — `new RegExp` constructed per filter iteration. Could pre-compile once outside the filter. Pure micro-optimization — irrelevant at n=7, mention only for completeness.

No 🟡. No 🔴. Architecture is clean: minimal surface area, no new dependencies, fails fast before any side effect, follows the existing gate pattern in the same function.
