# Simplicity Review — task-2: slugToBranch

## Verdict: PASS

## Evidence

### Files actually opened and read
- `.team/features/git-worktree-isolation/tasks/task-2/handshake.json`
- `bin/lib/run.mjs` (lines 140–169)
- `test/worktree.test.mjs` (lines 1–45 + grep for all `slugToBranch` references)

### Implementation review
`slugToBranch` at `bin/lib/run.mjs:154-160` is 6 lines, a single chained transformation:
1. `.toLowerCase()` — lowercase
2. `.replace(/[\s_]+/g, "-")` — whitespace/underscores → `-`
3. `.replace(/[^a-z0-9\-\.]/g, "")` — strip outside `[a-z0-9.-]`
4. `.slice(0, 72)` — truncate to 72

This matches the spec exactly. No helper functions, no config object, no options bag, no abstraction layer.

### Test coverage
`test/worktree.test.mjs:14-39` covers all six spec branches: clean passthrough, space→dash, underscore→dash, strip special chars, 72-char truncation, dot preservation.

### Per-criterion (simplicity lens)
| Category | Result | Evidence |
|---|---|---|
| Dead code | PASS | No unused imports/branches; function is exported and consumed at `run.mjs:164` |
| Premature abstraction | PASS | Single concrete function, ≥2 call sites (line 164 + tests) |
| Unnecessary indirection | PASS | Direct chain on input; no wrappers |
| Gold-plating | PASS | No config flags, no options, no extension hooks |

### Cognitive load
6 lines, linear. Reader holds one thing in head: "normalize then truncate."

### Deletability
Cannot be made meaningfully smaller without losing correctness.

## Findings

No findings.

---

# PM Review — task-2: slugToBranch

## Verdict: PASS

## Spec vs. Implementation

Spec: `slugToBranch(slug)` lowercases, replaces whitespace/underscores with `-`, strips characters outside `[a-z0-9.-]`, and truncates to 72 chars.

Implementation at `bin/lib/run.mjs:154-160`:
- `.toLowerCase()` (line 156)
- `.replace(/[\s_]+/g, "-")` (line 157)
- `.replace(/[^a-z0-9\-\.]/g, "")` (line 158)
- `.slice(0, 72)` (line 160)

All four spec clauses are present in order.

## Per-Criterion Results

| Criterion | Result | Evidence |
|---|---|---|
| Lowercases | PASS | `.toLowerCase()` line 156 |
| Whitespace/underscores → `-` | PASS | line 157; tests `"my feature"→"my-feature"`, `"my_feature"→"my-feature"` pass |
| Strips outside `[a-z0-9.-]` | PASS | line 158; test `"hello@world!"→"helloworld"` passes; `"v1.0"→"v1.0"` confirms dot allowed |
| Truncate to 72 | PASS | `.slice(0, 72)` line 160; test `"a".repeat(80)` → length 72 |

## Test Verification

Ran `node --test test/worktree.test.mjs` directly. Output: `tests 25 / pass 25 / fail 0`. All 6 `slugToBranch` cases pass plus 2 `slugToBranch normalization` cases covering integration with `feature/{slug}` branch naming.

## User Value

Consumed at `bin/lib/run.mjs:164` to construct `feature/<slug>` branch names for `git worktree add`. Producing git-safe branch names from arbitrary feature slugs is a genuine correctness requirement.

## Scope Discipline

Handshake claims no code changes were needed; function pre-existed and passed tests. Artifacts listed match what is on disk. No scope creep observed.

## Findings

No findings.

## Out-of-scope notes (future backlog only — not blockers)

- The function does not strip leading/trailing `-` or `.` after slicing. Git rejects branch names ending in `.lock` or starting with `-`, and a 72-char truncation could land on `.` or `-`. Spec does not require this guard. If a hardening pass is desired later, file as separate work.

---

# Engineer Review — task-2: slugToBranch

## Verdict: PASS

## Files Read
- `.team/features/git-worktree-isolation/tasks/task-2/handshake.json`
- `bin/lib/run.mjs` (lines 140–179)
- `test/worktree.test.mjs` (full file, 278 lines)

## Implementation Correctness — `bin/lib/run.mjs:154-160`

```js
export function slugToBranch(slug) {
  return slug
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\-\.]/g, "")
    .slice(0, 72);
}
```

Order of operations is correct:
1. Lowercase first so the strip regex can use plain `[a-z0-9.-]` without an `i` flag.
2. Whitespace/underscore→`-` must precede strip; the `+` quantifier collapses runs, avoiding `--` clusters from `"a   b"` or `"a__b"`.
3. Strip is anchored to the spec character set; `\-` and `\.` escapes inside the class are redundant but valid.
4. Slice last so the 72-char cap applies post-normalization (otherwise truncation could leave a trailing partial multi-byte rune that the strip would then drop, producing < 72 chars from a > 72-char input — current order is the right one).

## Test Verification

Ran `node --test test/worktree.test.mjs` locally:
```
ℹ tests 25 / pass 25 / fail 0
```
All 6 `slugToBranch` cases plus 2 `slugToBranch normalization` cases pass.

## Edge Cases I Actually Checked
- Empty string → `""` (no throw)
- Repeated whitespace `"a  b"` → `"a-b"` (good — `+` quantifier collapses)
- Mixed `"a _b"` → `"a-b"` (good — single class matches both)
- Unicode `"café"` → `"caf"` (matches spec; spec doesn't require transliteration)
- 80×`"a"` → length 72 (verified by test)
- Pathological: `slugToBranch("..")` → `".."`. Combined with `feature/` prefix this yields `feature/..` which git's refname check rejects. Out of spec scope, flagged below.
- Non-string input (e.g. `null`, `undefined`): throws `TypeError` on `.toLowerCase()`. Caller's responsibility; current call site at `run.mjs:164` always passes a slug from validated feature config.

## Per-Criterion Results

| Criterion | Result | Evidence |
|---|---|---|
| Lowercases | PASS | `.toLowerCase()` line 156 |
| Whitespace → `-` | PASS | `\s` covers space/tab/newline; test line 19-21 |
| Underscores → `-` | PASS | `_` in same class; test line 23-25 |
| Strips outside `[a-z0-9.-]` | PASS | line 158; test line 27-29 |
| Truncates to 72 | PASS | `.slice(0, 72)`; test line 31-34 |
| Dots preserved | PASS | dot in allow-list; test line 36-38 |

## Findings

🔵 bin/lib/run.mjs:158 — `\-` and `\.` inside a character class are unnecessary; `/[^a-z0-9.-]/g` is equivalent and more idiomatic. Cosmetic only.
🔵 bin/lib/run.mjs:154 — No guard against pathological outputs (`""`, `".."`, leading `-`, trailing `.lock`). Spec doesn't require this; current call sites pass already-validated slugs. File a follow-up only if user-typed slugs ever reach this function unfiltered.

## Notes
- Handshake's claim that no code changes were necessary is verified — the function predates this task and already satisfies every spec branch.
- No `tasks/task-2/artifacts/test-output.txt` was written, but the gate output in the prompt and a local re-run both show green. Minor process gap, not blocking.

---

# Architect Review — task-2: slugToBranch

## Verdict: PASS

## Evidence
- Read: `handshake.json`, `bin/lib/run.mjs:140-169`, `test/worktree.test.mjs:12-39` and grep of `slugToBranch` references.
- Gate output (provided) plus prior reviewer reruns confirm `node --test test/worktree.test.mjs` → 25/25 passing.

## Per-Criterion (architecture lens)
| Criterion | Result | Evidence |
|---|---|---|
| Component bounded & loosely coupled | PASS | Pure function; single internal consumer at `run.mjs:164` |
| Dependencies justified | PASS | None added |
| Scales at 10x | PASS | O(n) on tiny strings; called once per worktree create |
| Follows established patterns | PASS | Co-located under "Git worktree helpers" with `createWorktreeIfNeeded`; matches existing helper style |
| Cross-cutting concerns | N/A | No auth/cache/error-handling impact |
| Module boundaries | PASS | Cleanly exported and consumed locally + via tests; no seam leakage |

## Edge Cases Considered (non-blocking; already noted by PM/Engineer)
- Leading `-` after stripping; `..` survives; truncation lands on `.`/`-`; empty input; non-string input throws.

## Findings

🔵 bin/lib/run.mjs:159 — Optional hardening: collapse repeat `-`/`.` and trim leading/trailing `-`/`.` for defensive git ref-format compliance. Not required for v1.
🔵 bin/lib/run.mjs:154 — Optional: empty-result fallback (e.g., `"feature"`) for future callers with unsanitized input.

No critical or warning findings.

---

# Security Review — task-2: slugToBranch

## Verdict: PASS (with backlog warnings)

## Files actually opened and read
- `.team/features/git-worktree-isolation/tasks/task-2/handshake.json`
- `bin/lib/run.mjs` lines 140–179 (slugToBranch + createWorktreeIfNeeded + removeWorktree)
- `test/worktree.test.mjs` (full file)

## Threat Model
- **Input source:** feature slugs derived from `.team/features/<slug>/` directory names — operator-controlled, not external.
- **Sink:** `git worktree add ... -B feature/<branch>` invoked via `execFileSync` (run.mjs:169) — argument vector, no shell.
- **Adversary surface:** essentially nil for this codebase. Threat model is "accidentally invalid input" rather than attacker-supplied.

## Per-criterion (security lens)

| Criterion | Result | Evidence |
|---|---|---|
| Shell/command injection | PASS | run.mjs:169 uses `execFileSync("git", [array])`; no shell interpolation. Regex strip is defense-in-depth. |
| Input validation completeness | WARN | `slugToBranch("@@@")` → `""`; `slugToBranch("a..b")` → `"a..b"`. Both yield git-invalid refs that fail late at the git layer. |
| Type safety | INFO | Non-string input throws `TypeError` on `.toLowerCase()`. Acceptable for an internal helper. |
| Path traversal (adjacent) | WARN | run.mjs:163 joins **raw** `slug` into the worktree path; only the branch name is sanitized. A slug with `../` would escape `.team/worktrees/`. Not exploitable today; asymmetry is a hardening gap. |

## Findings

🟡 bin/lib/run.mjs:154 — `slugToBranch` can return empty string when all chars are stripped (e.g., `"@@@"` → `""`); downstream branch becomes `feature/`, which git rejects. Validate non-empty result or fall back to a sentinel.
🟡 bin/lib/run.mjs:154 — Output may contain `..`, trailing `.lock`, or leading `.`/`-`, which git refuses as ref names. Failures surface at `git worktree add` rather than at sanitize time.
🔵 bin/lib/run.mjs:154 — No type guard on `slug`; non-string input throws `TypeError`.
🔵 bin/lib/run.mjs:163 — `createWorktreeIfNeeded` uses raw `slug` for the filesystem path while branch name is sanitized; consider sanitizing the path segment too. Out of scope for this task; backlog only.

## Recommendation
PASS — ship as is. No critical findings. Two yellows go to backlog.

---

# Tester Review — task-2: slugToBranch

## Verdict: PASS (with backlog items)

## Evidence
- Read `tasks/task-2/handshake.json`: builder claims no code changes; existing impl at `bin/lib/run.mjs:154-160` and tests at `test/worktree.test.mjs` satisfy spec.
- Read `bin/lib/run.mjs:140-179`.
- Read `test/worktree.test.mjs` (full, 278 lines).
- Re-ran `node --test test/worktree.test.mjs` directly: **25/25 pass**. (Gate output pasted in the prompt is truncated before the worktree suite.)
- No `tasks/task-2/artifacts/` directory — consistent with the "no code changes" handshake.

## Per-Criterion (testing lens)
| Spec clause | Test cited | Status |
|---|---|---|
| Lowercase | implicit only — no dedicated `"FOO"→"foo"` case | covered indirectly |
| Whitespace → `-` | `worktree.test.mjs:19` | PASS |
| Underscore → `-` | `worktree.test.mjs:23`, `:213` | PASS |
| Strip non-`[a-z0-9.-]` | `worktree.test.mjs:27` | PASS |
| Allow dots | `worktree.test.mjs:36` | PASS |
| Truncate to 72 | `worktree.test.mjs:31` | PASS |

## Coverage Gaps (downstream-risk; not spec violations)
The output flows directly into `git worktree add -B feature/<slug>` at `bin/lib/run.mjs:169`. These inputs would produce git-rejecting refs and are untested:

1. **Empty / fully-stripped input.** `slugToBranch("")` and `slugToBranch("@@@")` return `""` → `feature/`, which git rejects.
2. **Trailing `.` after normalization or truncation.** Git refs may not end in `.` (also `.lock`).
3. **Consecutive `..`.** Git refs disallow `..`; the strip regex preserves them.
4. **Leading `-`.** A slug like `"-foo"` survives; `git worktree add` may treat the ref as a flag or reject it.
5. **Separator collapsing.** Regex uses `+` so `"a   b" → "a-b"`, but no test pins this — easy to silently regress to `[\s_]`.
6. **Uppercase-only input** is not asserted as its own case.
7. **Non-string input** throws `TypeError`; no boundary handling test.
8. **Regression risk for the call site.** `worktree.test.mjs:223-230` asserts the call signature `runGateInline(gateCmd, featureDir, task.id, cwd)` via a regex on source — fragile to formatting changes (e.g., a code formatter inserting newlines in the call); a behavioral test would be more robust.

## Findings

🟡 bin/lib/run.mjs:154 — Inputs that strip to empty (`""`, `"@@@"`) yield branch `feature/`, which `git worktree add` rejects; add a fallback (throw or default name) plus a test.
🟡 test/worktree.test.mjs:39 — Add edge-case tests: empty string, all-stripped input, trailing dot, consecutive `..`, leading `-`, and consecutive-separator collapsing — these are the inputs most likely to break `createWorktreeIfNeeded` consumers.
🟡 test/worktree.test.mjs:227 — Source-regex assertion of call shape is brittle (would break under reformatting); replace with a behavioral test that injects a mock and verifies `cwd === worktreePath`.
🔵 bin/lib/run.mjs:158 — Consider trimming trailing `-` and `.` (and rejecting `..`) post-normalization to satisfy `git-check-ref-format`.
🔵 test/worktree.test.mjs:14 — Add explicit uppercase-only and mixed-case tests so the lowercase clause is pinned independently.
🔵 bin/lib/run.mjs:154 — Non-string inputs throw `TypeError`; if reachable from external input, normalize with `String(slug ?? "")` at the boundary.
