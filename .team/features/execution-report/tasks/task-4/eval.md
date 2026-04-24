## Security Review — execution-report

**Reviewer role:** Security specialist
**Overall verdict: PASS**

### Files actually read
- `bin/lib/report.mjs` (all 161 lines)
- `test/report.test.mjs` (lines 110–293)
- `.team/features/execution-report/tasks/task-1/handshake.json`
- `.team/features/execution-report/tasks/task-2/handshake.json`
- `.team/features/execution-report/tasks/task-3/handshake.json`
- `.team/features/execution-report/tasks/task-1/eval.md` (full — architect, tester, engineer reviews)
- `.team/features/execution-report/tasks/task-2/eval.md` (full — parallel review with security section)
- `.team/features/execution-report/tasks/task-3/artifacts/test-output.txt` (lines 1–100)

---

### Threat model

This is a local developer CLI tool. The threat surface is:
- **Accidental self-harm**: user passes malformed/adversarial args that cause unexpected file I/O outside `.team/features/`
- **Malformed STATE.json data**: harness-written, but if corrupt it should crash cleanly, not expose stack traces
- No privilege escalation path. No multi-user attack surface. No network exposure.

---

### Per-criterion results

#### 1. Path traversal — confirmed 🟡 backlog

`report.mjs:117`: `featureName = args.find(a => !a.startsWith("-"))` — no sanitization.
`report.mjs:136`: `path.join(_cwd(), ".team", "features", featureName)` — `path.join` normalizes but does not clamp.

Verified: `path.join("/proj", ".team", "features", "../../../../tmp/x")` → `/tmp/x`.

Two distinct I/O surfaces:
1. **Read**: `_readState(featureDir)` at line 144 — reads STATE.json from the resolved path
2. **Write**: `_writeFileSync(outPath, ...)` at line 155 — writes REPORT.md to `join(featureDir, "REPORT.md")` in `--output md` mode

The write surface is the higher-risk of the two: `agt report ../../../../tmp/x --output md` writes `REPORT.md` to `/tmp/x/REPORT.md` (if `/tmp/x` exists). Not privilege-escalating for a local CLI, but can silently clobber files outside the project directory.

Fix: after line 136, assert `resolve(featureDir).startsWith(resolve(_cwd(), ".team", "features") + sep)` and call `_exit(1)` on failure.

#### 2. Arg-ordering bug amplifies path traversal — confirmed 🟡 backlog

`report.mjs:117`: `args.find(a => !a.startsWith("-"))` returns the first non-flag token. For `["--output", "md", "my-feature"]` it returns `"md"`, not `"my-feature"`. Feature name is silently misdirected.

While this is primarily a functional bug, it has a security dimension: the arg parse logic and the path traversal guard must be fixed together. If the arg-ordering fix is applied without the path traversal clamp, the traversal surface remains. If the path traversal clamp is applied without the arg-ordering fix, a user running `agt report --output md ../../../../tmp/x` still resolves `featureName` to `"../../../../tmp/x"` (it's the first non-flag token).

The two fixes are coupled and should be treated as a unit.

#### 3. `writeFileSync` unguarded — confirmed 🟡 backlog

`report.mjs:155`: `_writeFileSync(outPath, report + "\n")` — no try/catch.

On ENOSPC, EACCES, or EROFS the process emits a full Node.js stack trace including the resolved `outPath`. The stack trace leaks the absolute write path. Wrap in try/catch and call `_exit(1)` with a readable message.

#### 4. `byPhase` null-entry TypeError — confirmed 🟡 backlog

`report.mjs:59`: `v.costUsd?.toFixed(4)` — the optional chain is placed on `.toFixed`, not on `v`. If any `byPhase` entry value is `null` or `undefined`, `v.costUsd` throws `TypeError: Cannot read properties of null`. The STATE.json `tokenUsage.byPhase` object is harness-written and unlikely to contain null entries, but no guard exists. Fix: `v?.costUsd?.toFixed(4)`.

#### 5. NaN date propagation — confirmed 🟡 backlog

`report.mjs:18–19`: `if (state.createdAt)` is a truthy check only. A non-empty invalid ISO string (e.g. `"bad-date"`) passes the guard; `new Date("bad-date").getTime()` → `NaN`; propagates to `Math.round(NaN/60000)` → `NaN`; `NaN < 60` → `false`; result: `duration = "NaNh"` in the report header. This is a data validation gap, not a direct security issue, but listed here for completeness. Fix: add `if (isNaN(startMs)) { duration = "N/A"; }` after line 19.

#### 6. Task title/lastReason verbatim in Markdown output — 🔵 suggestion

`report.mjs:72–73`: `task.title` and `task.lastReason` from STATE.json rendered verbatim into the report string. In `--output md` mode these values land in a Markdown file read by editors and renderers. Embedded `\n## Injected Heading` sequences can inject fake Markdown sections. Risk is low (harness-written source, local tool), but the harness copies reasons from AI-generated text which could include arbitrary content. Strip embedded newlines with `.replace(/[\r\n]+/g, " ")` before interpolation in lines 72–73.

#### 7. Unknown `--output` value silently falls through — 🔵 suggestion

`report.mjs:153–158`: `if (outputMd) { ... } else { _stdout.write(...) }`. An unrecognized format string (e.g., `--output html`) silently falls through to stdout. This is a minor UX issue with no security consequence, but a warning branch would prevent silent misconfiguration.

---

### Findings

🟡 `bin/lib/report.mjs:136` — `featureName` from raw CLI args flows to `path.join` with no prefix-clamp; `path.join("/proj", ".team", "features", "../../../../tmp/x")` → `/tmp/x`; assert `resolve(featureDir).startsWith(resolve(_cwd(), ".team", "features") + sep)` before any I/O and call `_exit(1)` if not
🟡 `bin/lib/report.mjs:117` — arg-ordering bug: `["--output", "md", "my-feature"]` resolves `featureName` to `"md"` (path traversal and arg fix are coupled — apply together); skip token immediately following `--output` when resolving positional
🟡 `bin/lib/report.mjs:155` — `_writeFileSync` unguarded; EACCES/ENOSPC propagates as unhandled exception leaking absolute write path in stack trace; wrap in try/catch and call `_exit(1)` with readable message
🟡 `bin/lib/report.mjs:59` — `v.costUsd?.toFixed(4)` does not guard `v`; null/undefined byPhase entry throws `TypeError`; change to `v?.costUsd?.toFixed(4)`
🟡 `bin/lib/report.mjs:19` — truthy guard passes malformed ISO strings; `new Date("bad-date").getTime()` → `NaN` → `"NaNh"` in header; add `if (isNaN(startMs)) { duration = "N/A"; }` after the assignment
🔵 `bin/lib/report.mjs:72` — `task.title` and `task.lastReason` rendered verbatim; strip `\r\n` before interpolation to prevent Markdown heading injection in `--output md` mode
🔵 `bin/lib/report.mjs:153` — unknown `--output` value silently falls through to stdout; add warning branch for unrecognized format values

---

### Edge cases checked

- `agt report ../../../../tmp/x` — path traversal read path: verified `path.join` does not clamp
- `agt report --output md ../../../../tmp/x` — path traversal write path: `outPath` resolves outside `.team`
- `agt report --output md my-feature` — arg-ordering bug: `featureName` resolves to `"md"`
- `--output` as last arg — `args[outputMdIdx + 1]` is `undefined`; `undefined === "md"` → false; `outputMd` stays false — safe, no crash
- `byPhase: { run: null }` — line 59 TypeError confirmed via code trace
- `createdAt: "bad-date"` — NaN propagation confirmed via code trace

### Actionable feedback

1. **No 🔴 critical blockers.** Does not block merge.
2. **Treat path traversal + arg-ordering fix as coupled** — apply both together to close the write-surface risk.
3. **Backlog** (🟡): writeFileSync error path, byPhase null guard, NaN date guard.
4. **Suggestion** (🔵): strip newlines from task.title/lastReason before Markdown interpolation in `--output md` mode.

---

## Architect Review — execution-report

**Reviewer:** architect
**Verdict: PASS**

### Files read

- `bin/lib/report.mjs` (full, 161 lines)
- `test/report.test.mjs` (full, 293 lines)
- `bin/agt.mjs` (grep — lines 19, 75, 188–195, 248, 666)
- All three handshake.json + task-2/eval.md (parallel review)

### Design assessment

**Boundaries and coupling — PASS**

- `buildReport(state)` is a pure function with no I/O. Fully bounded, deterministic, individually testable. Correct abstraction level.
- `cmdReport(args, deps)` owns all I/O through dependency injection. All six I/O surfaces (readState, existsSync, writeFileSync, stdout, exit, cwd) are injectable. This is the right pattern for a CLI command with filesystem side effects.
- Wired at `bin/agt.mjs:75` with no leakage of internals.
- No new shared modules, cross-cutting concerns, or architectural novelty introduced.

**Scalability — PASS (not applicable at this scope)**

This is a read-then-render command. At 10× feature count the only pressure point is `readState` (disk read), which is already abstracted. No concern.

**Feature completeness — PASS**

`--output md` branch at lines 153–156 writes `join(featureDir, "REPORT.md")`. Matches the spec path `.team/features/<feature>/REPORT.md`. Test at line 242–250 confirms the exact path is written and the stdout confirmation message is emitted. Verified both the test and the live code agree.

**Gate — PASS**

`npm test` exits 0, 685/685 pass. Gate artifact matches live re-run.

### Confirmed bugs (live execution, all 🟡 backlog)

All five were verified by directly running `node -e` against the live source. All pre-existed in task-2 backlog.

| Bug | Location | Live evidence |
|---|---|---|
| Arg-ordering: `featureName = "md"` | :117 | `["--output","md","my-feature"]` → writes to `.team/features/md/` |
| NaN in header | :19 | `createdAt: "not-a-date"` → `"Duration: NaNh"` |
| Path traversal to `/tmp/evil` | :136 | `"../../../tmp/evil"` → resolves outside `.team/features/` |
| TypeError on `null` byPhase entry | :59 | `byPhase: { build: null }` → throws |
| Unguarded writeFileSync | :155 | No try/catch; ENOSPC unwinds with stack trace |

### Findings

🟡 `bin/lib/report.mjs:136` — `featureName` from raw CLI args piped to `path.join` with no prefix-clamp; `"../../../tmp/evil"` resolves to `/tmp/evil`; assert `resolve(featureDir).startsWith(resolve(_cwd(), ".team", "features") + sep)` before any I/O
🟡 `bin/lib/report.mjs:117` — arg-ordering bug: `["--output","md","my-feature"]` resolves `featureName` to `"md"`; skip the value token following `--output` when resolving the positional feature name
🟡 `bin/lib/report.mjs:19` — truthy-only `createdAt` guard allows malformed ISO strings; `new Date("not-a-date").getTime()` propagates `NaN` → `"Duration: NaNh"`; add `if (isNaN(startMs)) { duration = "N/A"; }` after the getTime call
🟡 `bin/lib/report.mjs:59` — `v.costUsd?.toFixed(4)` does not guard `v` itself; `byPhase: { build: null }` throws TypeError; change to `v?.costUsd?.toFixed(4)`
🟡 `bin/lib/report.mjs:155` — `_writeFileSync` unguarded; EACCES/ENOSPC propagates as unhandled exception; wrap in try/catch, call `_exit(1)` with readable message
🔵 `bin/lib/report.mjs:153` — unknown `--output` value silently falls through to stdout; add a warning branch for unrecognized format values

### Overall verdict: PASS

Architecture is sound. Primary feature works correctly. All bugs are pre-existing backlog items that do not affect the primary usage path.

---

## Engineer Review — execution-report (`agt report --output md`)

**Reviewer role:** Software engineer
**Overall verdict: PASS**

### Files actually read

- `bin/lib/report.mjs` (all 161 lines — implementation)
- `test/report.test.mjs` (all 293 lines — tests)
- `bin/agt.mjs` (CLI dispatch)
- `bin/lib/util.mjs` lines 185–206 (`readState`)
- `.team/features/execution-report/tasks/task-3/artifacts/test-output.txt` (test output, all lines)

---

### Per-criterion results

#### 1. Correctness — PASS

**Core feature path verified** (`bin/lib/report.mjs:136,154`):
```js
const featureDir = join(_cwd(), ".team", "features", featureName);
const outPath = join(featureDir, "REPORT.md");
_writeFileSync(outPath, report + "\n");
```
Output path matches spec: `.team/features/<feature>/REPORT.md`. ✓

All 5 error/happy-path branches traced and confirmed passing (test-output.txt lines 1342–1351):
- No feature name → exit 1 + usage ✓
- Missing feature dir → exit 1 + "not found" ✓
- Missing STATE.json → exit 1 + error message ✓
- Stdout default → prints report ✓
- `--output md` → writes file + prints "written to" confirmation ✓

#### 2. Code quality — PASS (with suggestions)

`buildReport` is a pure function with no side effects. `cmdReport` is testable via injected deps. Coverage spans all 8 `cmdReport` tests and 13 `buildReport` tests. All pass.

Issues: arg parsing is positional-order-sensitive (see findings), error message misleading on parse failure, double trailing newline.

#### 3. Error handling — PASS

Three failure paths explicitly handled with `exit(1)`. Minor gaps:
- `readState` returns `null` for both file-not-found and JSON parse failure; message only says "STATE.json not found" — misleading for parse errors (🔵)
- `writeFileSync` unguarded — already flagged at 🟡 by prior reviews

#### 4. Performance — PASS

Single synchronous read + one conditional write. No n+1, no blocking I/O beyond minimum required.

---

### Findings

🟡 `bin/lib/report.mjs:117` — `args.find(a => !a.startsWith("-"))` returns first non-flag token; for `["--output", "md", "my-feature"]` returns `"md"` as featureName, silently resolving the wrong feature path; skip the token immediately following `--output` when searching for the positional feature name (pre-existing, already in backlog)

🔵 `bin/lib/report.mjs:147` — error message "STATE.json not found in …" also fires on JSON parse failure; split the two cases to distinguish missing file vs. corrupt file

🔵 `bin/lib/report.mjs:155,158` — `buildReport` already ends with a trailing `\n` (last `lines.push("") + join("\n")`); appending `+ "\n"` produces a double blank line at end of all output; remove the `+ "\n"` suffix at both write sites

🔵 `bin/lib/report.mjs:119` — no error or warning for unrecognized `--output` values (e.g. `--output html`); silently falls back to stdout; add a warning or `exit(1)` for unrecognized format values (pre-existing)

---

### Edge cases checked

- `--output` as last arg → `args[outputMdIdx + 1]` is `undefined`; `undefined === "md"` → false; no crash, falls back to stdout ✓
- `--output md` before feature name → featureName resolved to `"md"` (flagged 🟡, pre-existing backlog)
- `--output html` → silently falls back to stdout (flagged 🔵)
- `gateWarningHistory` with multiple layers → deduplication via `Set` correct ✓
- `tasks: []` (empty) → Task Summary section renders with no rows, no crash ✓
- `gates: []` (empty) → all tasks show `—` verdict ✓
