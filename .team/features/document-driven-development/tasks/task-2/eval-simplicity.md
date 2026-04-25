# Simplicity Review — task-2 (SPEC.md gate)

## Verdict: ITERATE

One critical simplicity finding (dead import) blocks merge. The change itself is small, focused, and well-scoped — just a stray import that needs to be removed.

## Findings

🔴 bin/lib/run.mjs:26 — `buildMinimalSpec` import is now unused (dead code: removed only call site at lines 933–939). Delete the import: `import { buildMinimalSpec } from "./spec.mjs";`
🔵 bin/lib/run.mjs:926 — Section comment still reads `// ── Read or create spec ──` but the branch no longer creates a spec. Update to `// ── Read spec (required) ──` or similar.
🔵 bin/lib/run.mjs:937-938 — Two channels of user feedback (console.log + harness notify) for the same error. Acceptable since notify reaches the parent harness, but worth confirming both are needed.

## Per-Criterion

### 1. Dead code — FAIL
`buildMinimalSpec` is imported at `bin/lib/run.mjs:26` but no longer referenced anywhere in the file (verified by grep). The previous code path that used it (auto-stubbing SPEC.md) was the only call site, and was deleted in this change. This is a concrete instance of veto category #1.

Other usages confirmed live in `bin/lib/outer-loop.mjs:740` and `test/spec.test.mjs`, so the export itself stays.

### 2. Premature abstraction — PASS
No new abstractions introduced. The change is straight inline error reporting + `process.exit(2)`. No interface, no helper, no config knob.

### 3. Unnecessary indirection — PASS
The error message is emitted directly via `console.log` and the existing `harness()` helper (already used throughout the file). No new wrappers.

### 4. Gold-plating — PASS
- No config option for the exit code (hard-coded 2 — fine)
- No flag to opt out of the gate (correct — that would defeat the requirement)
- No speculative "auto-fix" path
- Test coverage matches the SPEC item exactly: exit non-zero, names file, points at brainstorm, no auto-create

## Cognitive Load

The diff replaces 5 lines of silent stubbing with 6 lines of explicit error + exit. Reading top-to-bottom of `_runSingleFeature` is now clearer: "if no spec, stop." No new mental model required.

## Deletability

Could the gate be smaller? Marginally — the two `console.log` lines plus `harness notify` could be a single composed message, but the test asserts on substrings across the combined output and they read well as-is. Leave it.

## Evidence

- Diff inspected: `git diff HEAD~2 HEAD -- bin/lib/run.mjs test/run-spec-gate.test.mjs`
- Dead import confirmed: `grep -rn buildMinimalSpec bin/ test/` shows only the import line in run.mjs, no call sites
- Tests pass: `task-2/artifacts/test-output.txt` shows 581/581 pass
- Logic path traced: existsSync(specPath) false → 3 console.logs → harness notify → process.exit(2). Matches all four test assertions in `test/run-spec-gate.test.mjs`.

## Required Fix Before Merge

Remove the unused import at `bin/lib/run.mjs:26`. After that, this is a clean, minimal change.
