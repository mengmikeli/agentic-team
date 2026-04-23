# Feature: Compound Evaluation Gate

## Goal
After a review agent writes findings to `eval.md`, run automated multi-layer substance checks that hard-fail the verdict when ≥3 layers detect low-quality, fabricated, or superficial review content — preventing shallow reviews from passing tasks they shouldn't.

## Scope

### Detection Layers (5 total)

1. **Thin content** — Score findings for generic/vague language: phrases like "looks good", "seems correct", "appears to work", "implementation is reasonable" with no supporting evidence. Trip if generic-phrase density exceeds threshold.

2. **Missing code references** — Findings must cite specific files, functions, or line numbers. Trip if no specific code location is referenced across all non-suggestion findings.

3. **Low uniqueness** — Measure repetition: boilerplate sentences, near-duplicate paragraphs, or content that largely mirrors the spec/task description without added analysis. Trip if similarity to input context exceeds threshold.

4. **Fabricated references** — For every file path or function name cited in findings, verify it exists in the repo. Trip if any cited path/symbol cannot be resolved on disk.

5. **Aspirational claims** — Detect language asserting future or hypothetical correctness without present evidence: "this should work", "will handle", "is designed to". Trip if aspirational phrases appear in APPROVED/PASS-supporting findings.

### Gate Behavior

- Layers are evaluated independently against the parsed `eval.md` findings.
- A layer "trips" when its heuristic threshold is exceeded.
- **≥3 layers tripped → hard FAIL**, verdict overridden regardless of reviewer output.
- **1–2 layers tripped → WARNING** logged but verdict stands.
- **0 layers tripped → PASS**, no effect on verdict.

### Integration

- Gate runs in `synthesize.mjs` after `parseFindings()` and before `computeVerdict()` accepts the result.
- Gate result (layers tripped, details) appended to `eval.md` under a `## Compound Gate` section.
- Gate outcome recorded in `handshake.json` under a new `compoundGate` field: `{ tripped: number, layers: string[], verdict: "PASS"|"WARN"|"FAIL" }`.
- Hard FAIL from compound gate counts as a `🔴 Critical` finding for retry logic (same path as existing critical failures).

### New File

- `bin/lib/compound-gate.mjs` — exports `runCompoundGate(findings, repoRoot)` returning the gate result object.

### Tests

- Unit tests for each of the 5 layer detectors in `tests/compound-gate.test.mjs`.
- Integration test: a fixture `eval.md` with thin/fabricated content triggers hard FAIL.
- Integration test: a fixture `eval.md` with detailed, evidence-backed findings passes clean.

## Out of Scope

- Compound gate on **quality gate output** (stdout/stderr from shell commands) — only review findings are checked.
- **ML-based** language models or embeddings for analysis — heuristic/regex only.
- Changing how the review agent is prompted — this is a post-hoc check, not prompt engineering.
- Checking **test coverage completeness** — that belongs in a separate coverage gate.
- Applying the gate to **human-written** approval comments on GitHub issues.
- Per-layer configurable thresholds in this iteration — hardcoded defaults only.

## Done When

- [ ] `bin/lib/compound-gate.mjs` exists with `runCompoundGate(findings, repoRoot)` implementing all 5 layers.
- [ ] Each layer has its own named export function and can be tested independently.
- [ ] `synthesize.mjs` calls `runCompoundGate` after `parseFindings()` and before verdict is finalized.
- [ ] A `## Compound Gate` section is appended to `eval.md` showing which layers tripped and why.
- [ ] `handshake.json` includes a `compoundGate` field with `tripped`, `layers`, and `verdict`.
- [ ] ≥3 layers tripped produces `verdict: "FAIL"` that overrides the reviewer's verdict.
- [ ] 1–2 layers tripped produces `verdict: "WARN"` and is logged without blocking.
- [ ] Unit tests cover all 5 detectors with both positive (should trip) and negative (should not trip) cases.
- [ ] Integration test with a synthetic thin/fabricated `eval.md` fixture results in hard FAIL.
- [ ] Integration test with a detailed, code-referencing `eval.md` fixture passes the gate.
- [ ] All existing tests continue to pass.
