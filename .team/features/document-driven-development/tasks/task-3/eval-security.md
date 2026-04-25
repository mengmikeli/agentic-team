# Security Review — task-3 (SPEC.md missing-sections gate)

## Verdict: PASS

## Files Reviewed
- `bin/lib/run.mjs` (lines 927–957: SPEC.md required-section gate; lines 799–803: featureName sanitization)
- `test/cli-commands.test.mjs` (lines 288–345: regression tests)
- `.team/features/document-driven-development/tasks/task-3/handshake.json`

## Verification
Re-ran the two new tests directly:
```
✔ agt run with SPEC.md missing required sections exits non-zero, lists them, and does not modify file (105ms)
✔ agt run with complete SPEC.md proceeds past the section gate (155ms)
ℹ pass 2  fail 0
```

## Threat Model

This gate is a local CLI guard, not a network surface. Adversary surface:
1. Malicious `featureName` argument (path traversal / regex injection).
2. Malicious `SPEC.md` content (ReDoS, file-system side effects).
3. Information disclosure in error output.

## Per-Concern Findings

### 1. Path traversal via `featureName`
`featureName` is normalized at run.mjs:799–803 via `.toLowerCase().replace(/[^a-z0-9]+/g,"-")` and length-capped to 50. By the time `specPath = join(featureDir, "SPEC.md")` is computed, no `..` or absolute paths are reachable. **Safe.**

### 2. Regex injection
`new RegExp(\`^##\\s+${s}\\s*$\`, "m")` at run.mjs:941 interpolates `s` from the hardcoded constant array `requiredSections` declared inline at run.mjs:931–939. No user input reaches the regex. **Safe.**

### 3. ReDoS via SPEC.md content
The pattern `^##\s+<literal>\s*$` is anchored, has no nested quantifiers, runs once per required section. Linear in spec length. **Safe.**

### 4. File modification on the failure path
The handler only calls `readFileSync` and `console.error`, then `process.exit(1)`. No write to SPEC.md, no shell exec on the failure path. Regression test at line 308–310 byte-compares the file before/after. **Safe.**

### 5. Information disclosure in error output
Output prints the absolute `specPath` and the hardcoded `requiredSections` names. No spec contents, env vars, or secrets are echoed. The path leak is normal CLI behavior. **Safe.**

### 6. Side effects before the gate
`harness("init", …)` at run.mjs:888 may create `STATE.json` *before* the SPEC.md check. Test allows this (line 313–316: "if STATE.json exists, no tasks"). `planTasks`, worktree creation, and agent dispatch all sit *after* `process.exit(1)`, so no code is written, no commands executed, no remote calls. **Safe.**

### 7. TOCTOU between `existsSync` and `readFileSync`
Race window exists, but worst case is an uncaught exception aborting the process — fail-closed. Not exploitable. **Safe.**

## Per-Criterion Results

| Criterion | Result | Evidence |
|---|---|---|
| Exits non-zero on incomplete spec | PASS | Test asserts `exitCode === 1` |
| Lists every missing section | PASS | Test iterates 5 missing names and finds each |
| Does NOT modify SPEC.md | PASS | Test byte-compares before/after; code path is read-only |
| Does NOT plan/run tasks | PASS | `process.exit(1)` precedes `planTasks` and dispatch |
| Complete spec proceeds | PASS | Second test confirms no flag with full spec |
| Errors routed to stderr | PASS | Four messages use `console.error` (run.mjs:944–949) |

## Findings

No findings.
