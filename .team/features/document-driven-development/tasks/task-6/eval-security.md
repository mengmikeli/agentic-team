# Security Review — task-6 (gate)

## Verdict: PASS

## Scope of Change Reviewed
- `bin/lib/brainstorm-cmd.mjs` — derives section list and fenced example body from `PRD_SECTIONS`, exports `buildBrainstormBrief`.
- `test/brainstorm-cmd.test.mjs` — direct unit tests for the brief builder.
- Test output: `tasks/task-6/artifacts/test-output.txt` — 591/591 pass.

## Threat Model
The touched code:
- Reads a developer-supplied `idea` string, optional product context file, and `cwd`.
- Composes a prompt string passed to a local LLM agent invoked by the same developer.
- Does not handle network input, secrets, auth, PII, or persisted data.

Adversary surface is essentially limited to a developer running `agt brainstorm` against their own machine. No realistic external-attacker threat model applies.

## Per-Criterion Findings

### Input validation
- `idea`, `productContext`, and `cwd` are interpolated as plain text into a prompt template. There is no SQL, shell, or HTML sink — the string is fed to an LLM. Existing safeguard: `productContext.slice(0, 3000)` caps file size injected from `PRODUCT.md`. (`bin/lib/brainstorm-cmd.mjs:39`).
- `SECTION_PLACEHOLDERS[s] ?? "{TBD}"` — safe object lookup over a closed set (`PRD_SECTIONS`). No prototype pollution exposure (lookup, not assignment).

### Secrets management
- No secrets, tokens, env vars, or credentials are read or emitted by this change.

### AuthZ / AuthN
- Not applicable — local CLI prompt construction.

### Error handling / safe defaults
- `??` fallback ensures every section gets a placeholder even if `PRD_SECTIONS` adds an entry without a matching placeholder map entry. Reasonable safe default.

### Prompt-injection considerations (informational)
- A malicious `PRODUCT.md` could embed instructions intended to steer the LLM. This is an inherent property of any feature that ingests local docs into prompts and is consistent with prior behavior; no regression introduced. Out of scope for this change.

## Evidence
- Read diff for `bin/lib/brainstorm-cmd.mjs` (commits `2269241`, `ae34fa1`, `2e37d11`).
- Read `test/brainstorm-cmd.test.mjs` summary in gate output (4 new direct tests pass).
- Confirmed gate `npm test`: 591 pass / 0 fail (`tasks/task-6/artifacts/test-output.txt`).

## Findings
No findings.
