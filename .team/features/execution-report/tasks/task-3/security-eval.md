# Security Review — execution-report (`agt report --output md`)

**Reviewer role:** Security specialist
**Overall verdict: PASS**
**Date:** 2026-04-24

---

## Threat Model

Local developer CLI tool. Threat surface is narrow:
- **Accidental self-harm via adversarial args**: user or automation passes a crafted feature name causing unexpected filesystem I/O outside `.team/features/`
- **Malformed STATE.json**: harness-written; corrupt entries should fail cleanly, not expose stack traces or crash with TypeError
- No privilege escalation. No multi-user attack surface. No network exposure. No secrets handled.

---

## Files Actually Read

- `bin/lib/report.mjs` (all 161 lines — implementation)
- `test/report.test.mjs` (all 293 lines — test suite)
- `.team/features/execution-report/tasks/task-1/handshake.json`
- `.team/features/execution-report/tasks/task-2/handshake.json`
- `.team/features/execution-report/tasks/task-3/handshake.json`
- `.team/features/execution-report/tasks/task-3/eval.md` (automated parallel reviews)
- `.team/features/execution-report/tasks/task-4/eval.md` (prior security + architect + engineer reviews)
- `.team/features/execution-report/tasks/task-5/eval.md` (simplicity review)
- `.team/features/execution-report/STATE.json`

---

## Per-Criterion Results

### 1. Input validation (featureName) — FAIL (backlog)

**`report.mjs:117`**: `featureName = args.find(a => !a.startsWith("-"))`
**`report.mjs:136`**: `const featureDir = join(_cwd(), ".team", "features", featureName)`

`path.join` normalizes path separators but does NOT clamp to a base directory. Verified:
```
path.join("/proj", ".team", "features", "../../../../tmp/x") → "/tmp/x"
```

Two I/O surfaces affected:
1. **Read** (`readState` at line 144): STATE.json is read from the resolved path
2. **Write** (`_writeFileSync` at line 155): REPORT.md is written to `join(featureDir, "REPORT.md")` when `--output md`

Write surface is higher risk: `agt report ../../../../tmp/x --output md` writes `REPORT.md` to `/tmp/x/REPORT.md` (if `/tmp/x` exists). Silently clobbers files outside project directory.

**Fix**: after line 136, add:
```js
const { resolve, sep } = await import("path"); // already available via "path"
const resolved = resolve(featureDir);
const base = resolve(_cwd(), ".team", "features") + sep;
if (!resolved.startsWith(base)) {
  _stdout.write(`report: invalid feature name: ${featureName}\n`);
  _exit(1);
  return;
}
```

Rating: **🟡** — personal CLI tool; user controls invocation; not 🔴 for this threat model.

---

### 2. Arg-ordering bug (coupled to traversal fix) — FAIL (backlog)

**`report.mjs:117`**: `args.find(a => !a.startsWith("-"))` returns the first non-flag token.

For `["--output", "md", "my-feature"]`, `featureName` resolves to `"md"`, not `"my-feature"`. The path traversal guard and the arg-ordering fix MUST be applied together:
- Traversal guard alone: `agt report --output md ../../../../tmp/x` still misdirects (featureName = `"../../../../tmp/x"`)
- Arg fix alone: path traversal surface remains open

These are two bugs that share one fix surface. Apply as a unit.

Rating: **🟡** — pre-existing; does not affect documented usage pattern `agt report <feature> --output md`

---

### 3. Unguarded writeFileSync leaks absolute path — FAIL (backlog)

**`report.mjs:155`**: `_writeFileSync(outPath, report + "\n")` — no try/catch.

On ENOSPC, EACCES, or EROFS the process emits a full Node.js stack trace to stderr. The stack trace includes the resolved `outPath` (absolute filesystem path). While not a high-severity information leak for a local tool, it violates the principle that errors should be readable messages, not stack traces.

**Fix**: wrap in try/catch, call `_exit(1)` with a message like `"report: could not write ${outPath}: ${err.message}"`.

Rating: **🟡**

---

### 4. byPhase null-entry TypeError — FAIL (backlog)

**`report.mjs:59`**: `v.costUsd?.toFixed(4)` — the optional chain is on `.toFixed`, not on `v`.

If `tokenUsage.byPhase` contains a null-valued entry (e.g. `{ build: null }`), then `v.costUsd` throws `TypeError: Cannot read properties of null (reading 'costUsd')`. STATE.json is harness-written so this is unlikely in practice, but no guard exists.

**Fix**: `v?.costUsd?.toFixed(4)`

Rating: **🟡**

---

### 5. NaN duration from malformed createdAt — FAIL (backlog)

**`report.mjs:18-19`**:
```js
if (state.createdAt) {
  const startMs = new Date(state.createdAt).getTime();
```

The truthy guard passes any non-empty string, including malformed ISO dates. `new Date("bad-date").getTime()` → `NaN`. This propagates through `Math.round(NaN/60000)` → `NaN`; `NaN < 60` → `false`; result: `"Duration: NaNh"` in the report header.

Not a direct security issue, but STATE.json data is not always clean (see task-1/task-2 blocked state).

**Fix**: `if (isNaN(startMs)) { duration = "N/A"; }` after line 19.

Rating: **🟡**

---

### 6. Verbatim title/lastReason in Markdown output — suggestion

**`report.mjs:72-73`**:
```js
lines.push(`  [${...}] ${task.id}: ${task.title || "(no title)"}`);
if (task.lastReason) lines.push(`    Reason: ${task.lastReason}`);
```

`task.title` and `task.lastReason` are AI-generated strings stored in STATE.json. In `--output md` mode these land directly in a `.md` file opened by editors and renderers. A reason containing `\n## Injected Heading` would add a fake heading to the rendered output. Risk is low (this is an internal harness file), but AI-generated text is non-deterministic.

**Fix**: `.replace(/[\r\n]+/g, " ")` before interpolation at lines 72-73.

Rating: **🔵**

---

### 7. Unknown --output value silently falls through — suggestion

**`report.mjs:153`**: `if (outputMd) { ... } else { _stdout.write(report + "\n"); }` — an unrecognized format string (e.g. `--output html`) silently falls through to stdout. No user-visible warning.

Rating: **🔵**

---

## Findings

🟡 bin/lib/report.mjs:136 — `featureName` from raw CLI args flows into `path.join` with no prefix-clamp; `path.join(cwd, ".team", "features", "../../../../tmp/x")` → `/tmp/x`; assert `resolve(featureDir).startsWith(resolve(_cwd(), ".team", "features") + sep)` before any I/O and call `_exit(1)` if not
🟡 bin/lib/report.mjs:117 — arg-ordering bug couples with path traversal: `["--output", "md", "my-feature"]` resolves `featureName` to `"md"`; skip token immediately following `--output` when searching for the positional; apply both fixes together
🟡 bin/lib/report.mjs:155 — `_writeFileSync` unguarded; EACCES/ENOSPC throws unhandled exception leaking absolute write path in stack trace; wrap in try/catch and call `_exit(1)` with readable message
🟡 bin/lib/report.mjs:59 — `v.costUsd?.toFixed(4)` does not guard `v`; null byPhase entry throws TypeError; change to `v?.costUsd?.toFixed(4)`
🟡 bin/lib/report.mjs:19 — truthy guard passes malformed ISO strings; `new Date("bad-date").getTime()` → NaN → `"Duration: NaNh"` in header; add `if (isNaN(startMs)) { duration = "N/A"; }` after the assignment
🔵 bin/lib/report.mjs:72 — `task.title` and `task.lastReason` rendered verbatim in Markdown; strip `\r\n` before interpolation to prevent heading injection in `--output md` mode
🔵 bin/lib/report.mjs:153 — unknown `--output` value silently falls through to stdout; add warning branch for unrecognized format values

---

## Edge Cases Checked

| Input | Result |
|---|---|
| `agt report ../../../../tmp/x` | featureDir resolves to `/tmp/x` — path traversal read surface (no guard) |
| `agt report ../../../../tmp/x --output md` | outPath resolves to `/tmp/x/REPORT.md` — write surface (no guard) |
| `agt report --output md my-feature` | featureName = `"md"` (arg-ordering bug) |
| `agt report --output` (flag with no value) | `args[idx+1]` is `undefined`; `undefined === "md"` → false; no crash — safe |
| `agt report --output html my-feature` | outputMd=false; silently falls through to stdout — no warning |
| `byPhase: { run: null }` | `v.costUsd` throws TypeError (confirmed via code trace) |
| `createdAt: "bad-date"` | NaN propagation to "NaNh" (confirmed via code trace) |
| `task.lastReason = "text\n## Evil"` | Markdown heading injection in --output md mode (low risk, confirmed possible) |

---

## Overall Verdict: PASS

No 🔴 critical blockers. Five 🟡 warnings are all pre-existing backlog items confirmed by multiple prior reviewers (security, architect, engineer, simplicity). The primary feature (`--output md` writing to `.team/features/<feature>/REPORT.md`) is correctly implemented at lines 153–156 and verified by test at `test/report.test.mjs:242–250` (path written to `join(tmpDir, ".team", "features", "test-feature", "REPORT.md")` matches spec).

**Priority for backlog:** path traversal + arg-ordering fix are coupled — treat as one work item.
