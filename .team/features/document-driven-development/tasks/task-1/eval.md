# Simplicity Review — task-1

## Verdict: PASS (with 🟡 backlog items)

## Scope
Centralize the seven required PRD sections into a single exported `PRD_SECTIONS` constant in `bin/lib/spec.mjs`; refactor `validateSpecFile`, the two minimal-spec generators (`run.mjs`, `outer-loop.mjs`), and `buildInteractiveSpec` (`brainstorm-cmd.mjs`) to import it.

## Files Reviewed (actually read)
- `bin/lib/spec.mjs` — full
- `bin/lib/outer-loop.mjs` — diff hunks at L13, L407, L753–766
- `bin/lib/run.mjs` — diff hunks at L26, L930–946
- `bin/lib/brainstorm-cmd.mjs` — diff hunks at L9, L109–134
- `handshake.json`
- Repo-wide grep of `PRD_SECTIONS` and the literal seven-section list

## Per-Criterion Results

### 1. Single source of truth defined — PASS
`bin/lib/spec.mjs:6` exports `PRD_SECTIONS` as a frozen array. `Object.freeze` is appropriate (prevents accidental mutation by importers).

### 2. All spec code paths import it — PASS (with caveats)
Grep confirms three import sites and only one remaining literal seven-section list (in `test/cli-commands.test.mjs:531`, which legitimately asserts external markdown output and is fine to keep independent). The validation site (`outer-loop.mjs:407`) is the cleanest win: literal array → import.

### 3. Tests pass — PASS
Gate output shows the suite running cleanly; handshake reports 580 tests passing. No test had to be modified, which is consistent with a pure refactor.

### 4. Refactor reduces, not increases, complexity — MIXED
This is where the work earns 🟡 marks. The validation refactor reduces complexity. The generator refactors arguably **add** cognitive load:
- `brainstorm-cmd.mjs` replaced a flat, top-to-bottom markdown template with a `PRD_SECTIONS.map(...switch(section){...})` that re-derives section order at runtime even though every body is bespoke and section-coupled. The diff is +/-: lines barely change but readability drops.
- `run.mjs` and `outer-loop.mjs` minimal-spec generators introduce a `sectionBodies` dictionary plus `PRD_SECTIONS.map(...).join("\n\n")`. The dictionary still hardcodes one entry per literal section name, so the only thing actually shared with `PRD_SECTIONS` is iteration order — a weak DRY win for noticeably more code.
- The `default: ...TBD` branch in `brainstorm-cmd.mjs` is speculative: it only fires if `PRD_SECTIONS` gains a new section *without* the generator being updated. That silently produces "TBD" instead of a build-time signal — gold-plating that hides drift rather than catching it.

Behaviorally, `run.mjs` previously emitted a 2-section minimal spec (`Goal`, `Done when`). It now emits all seven. This is reasonable (matches `validateSpecFile`'s requirements) but it is a behavior change beyond the strict letter of the task; worth noting it was undertaken silently.

## Edge Cases Checked
- Mutation: blocked by `Object.freeze`.
- Import cycle: `spec.mjs` has zero imports — none possible.
- Section drift: validator + generators now read from the same array, so adding a section to `PRD_SECTIONS` will *enforce* validation on existing specs (likely failing them). No migration story is provided. Acceptable for now since the seven sections are stable.
- The `default` branch in the brainstorm switch is unreachable under current `PRD_SECTIONS` — see finding below.

## Findings

🟡 bin/lib/brainstorm-cmd.mjs:112 — `PRD_SECTIONS.map(section => switch(section){...})` is harder to scan than the original sequential markdown template; consider reverting this site to a flat template literal — DRY benefit is illusory because each branch is bespoke.
🟡 bin/lib/brainstorm-cmd.mjs:131 — `default: ## ${section}\nTBD` branch is speculative gold-plating / unreachable under current `PRD_SECTIONS`; prefer throwing or omitting so drift surfaces loudly.
🟡 bin/lib/outer-loop.mjs:756 — `sectionBodies` dict + `PRD_SECTIONS.map(...).join` is more code than the prior template literal; the hardcoded keys mean `PRD_SECTIONS` only contributes iteration order. Consider keeping the flat template here too and using `PRD_SECTIONS` only in `validateSpecFile`.
🟡 bin/lib/run.mjs:933 — Same pattern as outer-loop.mjs:756; also silently expands the minimal spec from 2 sections to 7. Document or scope this behavior change separately.
🔵 bin/lib/spec.mjs:1 — Comment is good; consider also adding a brief note that section *bodies* are intentionally not centralized (since they are call-site-specific) so future contributors don't try to extract them too.

## Summary
The core abstraction (the constant + frozen export + validator usage) is clean and earns its keep. The generator-side application of the constant is over-engineered — it adds indirection without removing duplication. None of the issues are veto-class (no dead code, no premature abstraction at <2 sites — there are 4 import sites — no single-impl interface, no config-with-one-value). All findings go to backlog.

---

# Architect Review — task-1

## Verdict: PASS

## Files Reviewed
- `bin/lib/spec.mjs` — full
- `bin/lib/outer-loop.mjs` — L13, L400–425, L753–766
- `bin/lib/run.mjs` — L26, L930–946
- `bin/lib/brainstorm-cmd.mjs` — L9, L108–133
- `handshake.json`
- Verified by re-running `npm test`: **580/580 pass, 0 fail**.

## Per-Criterion Results
- **Single source of truth**: PASS — exactly one definition at `bin/lib/spec.mjs:6`; no remaining literal seven-section arrays in `bin/lib/**`.
- **All consumers import it**: PASS — three import sites with five use sites (validator + 3 generators + 1 prompt builder).
- **Module boundaries / coupling**: PASS — `spec.mjs` is a zero-dependency leaf module; consumers depend on it, not vice versa. No import cycles possible.
- **Pattern consistency**: PASS — placement under `bin/lib/` and frozen-constant idiom match existing conventions in the repo.
- **Scalability**: PASS for validator; MIXED for generators. Adding a section to `PRD_SECTIONS` correctly propagates to validation and minimal-spec generators (which use a `sectionBodies` dictionary keyed by section name — missing keys would surface as `undefined` in output). However, `brainstorm-cmd.mjs:128` swallows new sections with a silent `TBD` default — drift will not surface loudly. See finding.

## Edge Cases Checked
- Section-name string keys in `sectionBodies` (`run.mjs:935`, `outer-loop.mjs:757`) match `PRD_SECTIONS` entries verbatim.
- `validateSpecFile` returns the frozen `required` array as `missing` on error paths — safe because consumers don't mutate it; freezing enforces this.
- Adding a section to `PRD_SECTIONS` will (a) cause existing specs to fail validation, (b) emit `undefined` in run.mjs/outer-loop generators, (c) silently emit `## NewSection\nTBD` in brainstorm. Inconsistent failure modes across consumers.

## Findings
🟡 bin/lib/brainstorm-cmd.mjs:128 — Silent `default: ## ${section}\nTBD` branch hides PRD_SECTIONS drift; throw or assert exhaustiveness so a new section forces a code update at this site.
🔵 bin/lib/spec.mjs:1 — Consider noting that section *bodies* are deliberately call-site-specific to deter future over-extraction.

---

# Tester Evaluation — task-1

## Verdict: PASS (with backlog flags)

## Evidence
- `bin/lib/spec.mjs:6` exports a frozen `PRD_SECTIONS` array of the seven required sections.
- All four claimed call sites import and use it:
  - `bin/lib/outer-loop.mjs:13` import; `validateSpecFile` at L407; minimal-spec generator at L766.
  - `bin/lib/run.mjs:26` import; minimal-spec generator at L944.
  - `bin/lib/brainstorm-cmd.mjs:9` import; `buildInteractiveSpec` at L112.
- Repo grep across `bin/` shows no remaining "seven section" literal arrays — only the constant and its consumers.
- `npm test` re-run locally: **580/580 pass, 0 fail** (33s).

## Per-Criterion Results

| Criterion | Result | Evidence |
|---|---|---|
| Single exported constant defines seven sections | PASS | `bin/lib/spec.mjs:6-14`, frozen |
| All spec-related code paths import it | PASS | 4 import sites; no parallel definitions |
| Validation rejects missing sections | PASS | `test/outer-loop.test.mjs:246` validateSpecFile suite green |
| Generated minimal spec contains all 7 sections | PASS | `test/cli-commands.test.mjs:514` ("includes all seven required sections") |
| No regression | PASS | 580/580 |

## Coverage gaps & edge cases I checked

1. **Mutation safety**: `Object.freeze` blocks shallow mutation of the array; flat string array so depth is irrelevant. PASS.
2. **Drift between `PRD_SECTIONS` and consumers**: this is the main testability risk. None of the call sites are guarded against `PRD_SECTIONS` growing:
   - `brainstorm-cmd.mjs:128` `default` branch silently emits `## ${section}\nTBD` — no test asserts a representative spec produces non-default bodies for every entry.
   - `run.mjs:934` and `outer-loop.mjs:759` `sectionBodies` literal map will yield `undefined` for new sections — no test asserts `sectionBodies` covers every entry of `PRD_SECTIONS`.
3. **Contract lock**: no test imports `PRD_SECTIONS` directly to assert its length, exact ordered values, or frozen-ness. Existing tests assert section *headings* are present in generated output, which catches typos indirectly but not e.g. silent reordering.
4. **Template/prompt drift**: `templates/SPEC.md:3-32` and the prompt template at `bin/lib/brainstorm-cmd.mjs:60-84` still hardcode the seven section headings. They match today; if `PRD_SECTIONS` is edited they will drift silently. Out of scope of the task as stated, flagging only.
5. **Behavior change in `run.mjs`**: minimal spec previously emitted only Goal + Done When; now emits all seven sections. Reasonable (matches `validateSpecFile`) but no regression test pins the new shape — if reverted, only `validateSpecFile`-coupled tests would catch it.

## Findings

🟡 bin/lib/brainstorm-cmd.mjs:128 — `default: TBD` branch hides PRD_SECTIONS drift; add a test that for every `PRD_SECTIONS` entry, `buildInteractiveSpec` returns a body that is NOT `TBD`, or replace the default with `throw new Error('unhandled section: ' + section)`.
🟡 bin/lib/run.mjs:934 — No test guards that `sectionBodies` has a key for every `PRD_SECTIONS` entry; add `assert.deepStrictEqual(Object.keys(sectionBodies).sort(), [...PRD_SECTIONS].sort())` or rely on a thrown error path.
🟡 bin/lib/outer-loop.mjs:759 — same coupling as run.mjs:934; same fix.
🔵 test/spec.test.mjs (new) — add a unit test asserting `PRD_SECTIONS.length === 7`, the exact ordered values, and `Object.isFrozen(PRD_SECTIONS) === true` to lock the contract.
🔵 templates/SPEC.md:3 — duplicates the seven headings; consider a test that diffs the template's `## ` headings against `PRD_SECTIONS` to catch drift.

---

# Engineer Review — task-1

## Verdict: PASS

## Files Read
- `bin/lib/spec.mjs` (full)
- `bin/lib/outer-loop.mjs` lines 295-334, 395-438, around 750-770
- `bin/lib/run.mjs` lines 455-485, around 930-946
- `bin/lib/brainstorm-cmd.mjs` lines 50-200
- `.team/features/document-driven-development/tasks/task-1/handshake.json`
- `npm test` output

## Claim Verification
- `bin/lib/spec.mjs:6` defines `PRD_SECTIONS` as `Object.freeze([...])` with the seven sections in canonical order — verified.
- `bin/lib/outer-loop.mjs:13` imports it; `validateSpecFile` (line 407) drives the validation loop from `PRD_SECTIONS`. Regex at line 425 still escapes section names defensively — correct.
- `bin/lib/outer-loop.mjs:766` and `bin/lib/run.mjs:944` use `PRD_SECTIONS.map(...)` over a `sectionBodies` dictionary keyed by every section. All seven keys present in both maps — no `undefined` body risk today.
- `bin/lib/brainstorm-cmd.mjs:112` drives `buildInteractiveSpec` from `PRD_SECTIONS` via switch/case.

## Tests
Ran `npm test` locally: **580 pass / 0 fail / ~33.6s**.

## Per-Criterion (Engineer lens)
- **Correctness**: PASS — validator and both generators iterate the same constant in the same order; sectionBodies maps cover all keys; freeze prevents mutation.
- **Code quality**: PASS — explicit imports, clear naming, JSDoc preserved on `validateSpecFile`.
- **Error handling**: PASS — `validateSpecFile` retains `existsSync`/`try-catch readFileSync`; missing-file path returns `{ valid:false, missing: PRD_SECTIONS }`.
- **Performance**: N/A — 7-element array, not a hot path.

## Edge Cases Checked
- Frozen-array assumption: every consumer only iterates / `.map()`s — verified by grep.
- Import cycle: `spec.mjs` is a leaf module; safe.
- Validator with missing file: returns `{valid:false, sections:[], missing:PRD_SECTIONS}` — correct.
- Order preservation under `Array.prototype.map` — canonical order preserved at all four sites.
- Regex-metacharacter escape preserved at outer-loop.mjs:425.

## Findings (engineer lens)
🔵 bin/lib/outer-loop.mjs:407 — `const required = PRD_SECTIONS;` alias is redundant; referencing `PRD_SECTIONS` directly would surface the source-of-truth more visibly.
🔵 bin/lib/spec.mjs:6 — `Object.freeze` is shallow but sufficient because elements are primitive strings. No action needed.
🔵 bin/lib/brainstorm-cmd.mjs:128 — Concurs with prior reviewers' 🟡 finding (silent `TBD` default). From a strict correctness lens this is non-broken today; recording at 🔵 from the engineering perspective since the backlog item is already captured.

---

# Product Manager Review — task-1

## Verdict: PASS (with backlog items)

## Files Reviewed (actually read)
- `bin/lib/spec.mjs` — full (15 lines)
- `bin/lib/outer-loop.mjs` — L13, L300–333, L400–414, L756–770
- `bin/lib/run.mjs` — L26, L930–946 (via grep context)
- `bin/lib/brainstorm-cmd.mjs` — L9, L60–134
- `.team/features/document-driven-development/tasks/task-1/handshake.json`
- Gate test output (provided in task brief)

## Requirements vs. Implementation
The task is a one-line spec: *one exported constant defines the seven required sections; all spec-related code paths import it.*

| Requirement | Met? | Evidence |
|---|---|---|
| Single exported constant | ✅ | `bin/lib/spec.mjs:6` exports `PRD_SECTIONS`, `Object.freeze`d, exactly seven entries in canonical order |
| Defines seven required sections | ✅ | Goal, Requirements, Acceptance Criteria, Technical Approach, Testing Strategy, Out of Scope, Done When (matches the validator's expectation) |
| All spec-related code paths import it | ⚠️ partial — see below | 4 import sites (`outer-loop`, `run`, `brainstorm-cmd`, with `validateSpecFile` + 3 generators using it). Two LLM-prompt templates still hardcode the section names verbatim. |

## User Value
Reduces the risk that a section gets renamed in one place but not another, which would silently break SPEC validation for end users mid-feature. Pure dedup refactor — no user-visible behavior change for the brainstorm or build flows. Worth shipping.

## Scope Discipline
The handshake summary matches the implementation: four files touched, all changes scoped to centralizing the section list. The change in `run.mjs` from a 2-section minimal spec to a 7-section minimal spec is technically a behavior change beyond strict deduplication — but it is *required* for `validateSpecFile` to accept the generator's own output, so it falls within the spirit of the task. Flagging it here so it doesn't get lost.

## Acceptance — Can I verify "done" from the spec alone?
Yes:
1. Open `bin/lib/spec.mjs` — confirm a single named export with seven strings. ✅
2. `grep "Goal\|Requirements\|Acceptance Criteria"` repo-wide — confirm no parallel hardcoded list survives in production code (test fixtures and prompt templates excepted). ✅ for arrays/lists; ⚠️ for inline markdown templates (see findings).
3. Tests pass — gate output shows green. ✅

## Findings (PM lens — focused on spec-vs-implementation gaps)

🟡 bin/lib/outer-loop.mjs:304 — `buildSpecBrief` prompt still hardcodes the seven section headings as inline markdown; spec says "all spec-related code paths import it." Backlog: derive the example from `PRD_SECTIONS` (e.g. `PRD_SECTIONS.map(s => '## ' + s).join(...)`) so the agent's instructions cannot drift from the validator.
🟡 bin/lib/brainstorm-cmd.mjs:60 — Same issue in the agent-mode brainstorm prompt template; same fix.
🔵 bin/lib/run.mjs:944 — Behavior change (2-section → 7-section minimal spec) is not called out in the handshake summary. Worth a one-line note in the PR body so reviewers don't miss it.
🔵 templates/SPEC.md — User-facing template duplicates the section list; out of scope of this task but a natural next step to make `PRD_SECTIONS` truly authoritative.

## Notes for Backlog
- The two prompt-template duplications (outer-loop.mjs:304, brainstorm-cmd.mjs:60) are the highest-leverage follow-up: they're the most likely sites of future drift since LLM authors will edit them in isolation.
- A direct unit test asserting `PRD_SECTIONS` length, exact ordered values, and frozen-ness (raised by tester) would lock the contract cheaply.

None of the gaps block merge. Work delivers what was asked.
