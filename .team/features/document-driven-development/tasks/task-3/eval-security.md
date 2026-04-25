# Security Review — task-3 (SPEC.md missing-sections gate)

## Verdict: PASS

## Files Reviewed
- `bin/lib/run.mjs` lines 925–960 (SPEC.md required-section gate)
- `.team/features/document-driven-development/tasks/task-3/handshake.json`
- Provided gate output (test suite passing)

## Verification
Did not re-run tests in this pass; relied on provided gate output and code inspection. The run_2 change is a regex relaxation only — surface area unchanged from run_1's reviewed implementation.

## Threat Model

Local CLI guard, not a network surface. Adversary surface:
1. Malicious `featureName` argument (path traversal / regex injection).
2. Malicious `SPEC.md` content (ReDoS, file-system side effects).
3. Information disclosure in error output.

## Per-Concern Findings

### 1. Path traversal via `featureName`
`featureName` is normalized upstream via `.toLowerCase().replace(/[^a-z0-9]+/g,"-")` and length-capped. By the time `specPath = join(featureDir, "SPEC.md")` is computed (run.mjs:927), no `..` or absolute paths are reachable. **Safe.**

### 2. Regex injection (run_2 change)
New pattern at run.mjs:944: `new RegExp(\`^#{2,}\\s+${s}\\b\`, "m")`. `s` is interpolated from the hardcoded `requiredSections` array at run.mjs:931–939. No user input reaches the regex constructor. **Safe.**

### 3. ReDoS via SPEC.md content
Pattern is anchored at line start, fixed `#{2,}` quantifier with no nesting, single literal section name, `\b` boundary. Linear in spec length, runs once per required section (7 iterations max). **Safe.**

### 4. Heading-match correctness (security-relevant correctness)
The relaxed regex `^#{2,}\s+Goal\b` correctly:
- Matches `## Goal`, `### Goal`, `## Goal:`, `## Goal — note`.
- Rejects `## Goalposts` (because `\b` requires a non-word boundary after `l`, and `p` is a word char). Confirmed by inspection.
This means the gate cannot be bypassed by a near-miss heading like `## Goalposts`. **Safe.**

### 5. File modification on the failure path
Failure path (run.mjs:946–953) only calls `console.error` and `process.exit(1)`. No write, no shell exec. **Safe.**

### 6. Side effects before the gate
`harness("init", …)` may create `STATE.json` before the SPEC.md check, but `planTasks`, worktree creation, and agent dispatch all sit after `process.exit(1)`. No code is written, no commands executed, no remote calls on the failure path. **Safe.**

### 7. Information disclosure in error output
Output prints the absolute `specPath` (run.mjs:947) and hardcoded section names. No spec contents, env vars, or secrets echoed. **Safe.**

### 8. TOCTOU between `existsSync` and `readFileSync`
Worst case is an uncaught exception aborting the process — fail-closed. Not exploitable. **Safe.**

## Per-Criterion Results

| Criterion | Result | Evidence |
|---|---|---|
| Exits non-zero on incomplete spec | PASS | `process.exit(1)` at run.mjs:953 |
| Lists every missing section | PASS | Loop at run.mjs:948–950 iterates `missing[]` |
| Does NOT modify SPEC.md | PASS | Failure path is read-only |
| Does NOT plan/run tasks | PASS | `process.exit(1)` precedes `planTasks` (line 964) |
| Errors routed to stderr | PASS | All four messages use `console.error` |
| Heading regex resists near-miss bypass | PASS | `\b` boundary rejects `Goalposts` |

## Findings

No findings.
