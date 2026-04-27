# Simplicity Review — task-13: `artifactEmit` context requires `taskDir`, `verdict`

**Verdict: PASS**

## Files Actually Read

- `bin/lib/extensions.mjs` (lines 1–50, 140–170, 260–320) — implementation + sibling patterns
- `test/extension-system.test.mjs` — diff of test changes
- `bin/lib/run.mjs` (lines 1318–1324, 1405–1411) — both call sites
- `.team/features/extension-system/tasks/task-13/handshake.json` — builder claims
- `.team/features/extension-system/tasks/task-13/artifacts/test-output.txt` — gate output

## What Was Changed

6 lines of validation added to `runArtifactEmit()` (lines 276–281), requiring `taskDir` and `verdict` to be present and of type `string`. 5 existing tests updated from `taskDir: null` to real string paths. 4 new tests covering missing/invalid inputs.

## Veto Category Checklist

| Category | Status | Evidence |
|---|---|---|
| Dead code | Clean | No unused functions, variables, or imports introduced |
| Premature abstraction | Clean | No new abstractions — inline validation only |
| Unnecessary indirection | Clean | No wrappers or re-exports added |
| Gold-plating | Clean | Both fields are consumed: `taskDir` on line 295 for artifact writing, `verdict` forwarded to hooks |

## Pattern Consistency

The validation follows the identical pattern used by `mergePromptAppend` (lines 146–152) and `mergeVerdictAppend` (lines 167–172):

1. Call `validateContext(ctx)` for base fields
2. Check hook-specific fields with `!("field" in ctx) || typeof ctx.field !== "string"`
3. Throw descriptive `Error` with field name

No new pattern invented. Zero additional cognitive load for anyone who has read the sibling functions.

## Caller Verification

Both call sites in `run.mjs` already pass valid values:
- Line 1321: `{ phase: "review", taskId: task.id, featureName, cwd, taskDir, verdict: synth.verdict }`
- Line 1408: same shape

The breaking change from `null`-tolerant to `string`-required is correct — previously `taskDir: null` caused line 295's truthiness check to silently skip artifact writing, masking bugs.

## Edge Cases Checked

- Missing `taskDir` → throws (test added)
- Missing `verdict` → throws (test added)
- `taskDir: null` → throws (test added, was silently swallowed before)
- `verdict: 42` → throws (test added)
- `taskDir: ""` → passes type validation but line 295 truthiness prevents writing; harmless since empty paths are nonsensical

## Test Evidence

661/661 pass, 0 fail. 4 new negative tests specifically verify the validation contract.

## Findings

No findings.

## Summary

Minimal 6-line change that follows an established pattern exactly. No new abstractions, no speculative features, no dead code. The diff earns its keep by making an implicit contract explicit.
