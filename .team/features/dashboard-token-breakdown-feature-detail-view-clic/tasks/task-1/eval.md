# Architect Review — dashboard-token-breakdown-feature-detail-view-clic

## Overall Verdict: PASS

566/566 tests green (task-2/artifacts/test-output.txt, lines 1416–1423). All prior 🔵 suggestions applied in current code. One pre-existing 🟡 (dispatch contract split) carries to backlog. One new 🔵 (type/runtime trust divergence on `total`).

---

## Files Read

- `bin/lib/run.mjs` lines 190–238, 256–290, 716–719
- `dashboard-ui/src/components/feature-detail.tsx` (full, 147 lines)
- `dashboard-ui/src/App.tsx` (full, 148 lines)
- `dashboard-ui/src/types.ts` lines 1–56
- `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`
- `tasks/task-2/artifacts/test-output.txt` (full)

---

## Per-Criterion Results

### 1. `resetRunUsage()` is called at feature start
**PASS** — `bin/lib/run.mjs:719` calls `resetRunUsage()` as the first statement of `_runSingleFeature`, with explanatory comment. Confirmed directly in source; line number updated from prior eval (was 715).

### 2. Token data surfaces in the feature detail panel
**PASS** — `feature-detail.tsx:55` guards `!tokenUsage` and renders "No token data available" on the null path. `TokenBreakdown` sub-component (line 65) renders per-task table, phase breakdown, and totals when `tokenUsage` is present. `taskMap` is now allocated inside `TokenBreakdown`, not on the null path.

### 3. `buildTokenUsage()` always returns a `total` field
**PASS** — `run.mjs:236` always returns `total: mapBucket(_runUsage)`. `_runUsage` initialized to `_emptyBucket()` (all zeros). Lines 140–142 use `total?.costUsd ?? 0` defensive access — runtime-safe for partial STATE.json writes.

### 4. Prior 🔵 suggestions applied
**PASS (all applied)** — Direct code evidence:
- `feature-detail.tsx:11`: `fmtCost` has `Number.isFinite(v)` guard ✓
- `feature-detail.tsx:12–14`: `fmtMs` has hours branch ✓
- `feature-detail.tsx:19–20`: `fmtK` has `Number.isFinite(v)` guard ✓
- `feature-detail.tsx:66`: `taskMap` inside `TokenBreakdown` (unreachable on null path) ✓
- `feature-detail.tsx:140–142`: `total?.costUsd ?? 0` optional chaining used ✓
- `bin/lib/run.mjs:198–200`: phase label freeze documented with inline comment ✓
- `bin/lib/run.mjs:282–284`: codex limitation documented with explicit comment ✓

### 5. Duplicate handler consolidated
**PASS** — `App.tsx:52` has only `handleFeatureChange`. Prior `handleFeatureSelect` is gone. Both `FeatureTimeline` (`onFeatureSelect`) and `TaskBoard` (`onFeatureChange`) route to the same function.

### 6. Dispatch contract divergence (architectural boundary)
**CONFIRMED PRE-EXISTING** — `run.mjs:278` claude returns `{ ok, output, error, usage, cost }`; `run.mjs:281` codex returns `{ ok, output, error }`. Limitation now documented in code comments. Architecturally unresolved: any new caller must still special-case codex. Backlog item.

### 7. Type/runtime trust divergence on `total`
**NEW FINDING** — `types.ts:55` declares `total: PhaseTokenUsage` (non-optional), but `feature-detail.tsx:140` uses `total?.costUsd`. TypeScript type asserts `total` always present; runtime code does not trust that. Either update the type to `total?: PhaseTokenUsage` or document why the invariant is trusted at the module boundary but not at the component.

### 8. Gate
**PASS** — task-2 handshake: `"verdict": "PASS"`, `"summary": "Gate command: npm test — exit code 0"`. Test output lines 1416–1423: `tests 566, pass 566, fail 0`.

---

## Findings

🟡 bin/lib/run.mjs:256 — `dispatchToAgent` has a split return contract: claude returns `{ ok, output, error, usage, cost }`, codex returns `{ ok, output, error }`; makes token tracking inherently agent-specific; add a normalising adapter so all return shapes are uniform (pre-existing; carry to backlog)
🔵 dashboard-ui/src/types.ts:55 — `FeatureTokenUsage.total` typed as non-optional (`total: PhaseTokenUsage`) but `feature-detail.tsx:140` accesses it with `total?.costUsd ?? 0`; change type to `total?: PhaseTokenUsage` to match defensive runtime access, or document the invariant with a comment

---

## Compound Gate (carried from task-1 handshake)

**Verdict:** WARN — `fabricated-refs` layer tripped in prior parallel review iterations (fabricated line numbers for `buildTokenUsage` citation). The current code references are verified correct.

---

# Engineer Review — dashboard-token-breakdown-feature-detail-view-clic

## Overall Verdict: PASS

566/566 tests green (task-2 gate, exit code 0). Feature delivers the described functionality: clicking a feature in the timeline replaces the TaskBoard with a `FeatureDetail` panel showing per-task and per-phase token breakdowns. All prior 🟡/🔵 findings resolved in current code.

---

## Files Read

- `dashboard-ui/src/components/feature-detail.tsx` (full, 135 lines)
- `dashboard-ui/src/App.tsx` (full, 151 lines)
- `dashboard-ui/src/types.ts` (full, 107 lines)
- `dashboard-ui/src/hooks/use-features.ts` (full, 88 lines)
- `bin/lib/run.mjs` lines 148–295, 700–760, 1380–1395
- `dashboard-ui/src/components/feature-timeline.tsx` (grep — lines 9, 12, 52–53)
- `dashboard-ui/src/components/task-board.tsx` (grep — lines 11, 91, 108)
- `tasks/task-2/artifacts/test-output.txt` (full)

---

## Per-Criterion Results

### Correctness — PASS with caveats

- `resetRunUsage()` at `run.mjs:715` — confirmed present with comment
- `trackUsage()` at `run.mjs:270` for claude path — confirmed
- `buildTokenUsage()` at `run.mjs:1387` written to STATE.json after feature completion — confirmed
- `FeatureTimeline` passes `feature.name` (string) to `onFeatureSelect` at `feature-timeline.tsx:52` — wire-up correct
- `FeatureDetail` outer null check at `feature-detail.tsx:53` (`!tokenUsage`) gates all rendering — correct
- **Gap:** `feature-detail.tsx:126` accesses `tokenUsage.total` without null guard; partial STATE.json write (crash during `writeState` at `run.mjs:1387`) produces `tokenUsage` without `total`, causing TypeError that crashes the panel
- **Gap:** `run.mjs:279–288` codex path returns no `usage`/`cost` fields; panel silently shows "No token data available" for all codex-built features

### Code Quality — PASS with caveats

- `feature-detail.tsx:38`: `taskMap` allocated unconditionally before the `!tokenUsage` branch — wasted allocation on null path
- `App.tsx:52–58`: `handleFeatureSelect` and `handleFeatureChange` are identical one-liners — two names imply semantic distinction that does not exist
- `feature-detail.tsx:12`: `fmtMs` has no hours branch — renders "120.0m" for a 2-hour run

### Error Handling — WARN

- `fmtCost`/`fmtMs`/`fmtK` (lines 11–21) call `.toFixed()` with no `Number.isFinite(v)` guard. `(null).toFixed(4)` throws TypeError; `(NaN).toFixed(4)` renders "NaN$". Corrupt STATE.json numeric fields produce runtime errors or garbage output.

### Performance — PASS

No n+1, no blocking I/O. Linear iteration over task/phase buckets.

---

## Engineer Findings

🟡 `dashboard-ui/src/components/feature-detail.tsx:126` — `tokenUsage.total` accessed without null guard; partial STATE.json write (crash during writeState at run.mjs:1387) could produce `tokenUsage` without `total`, crashing the panel with TypeError; use `tokenUsage.total?.costUsd ?? 0` and similar optional chaining on lines 127–128
🟡 `bin/lib/run.mjs:279` — codex path never calls `trackUsage()`; features built via codex silently produce `tokenUsage: null`; add explicit console warning or UI label explaining the codex limitation so users understand "No token data available" is expected, not a bug
🟡 `dashboard-ui/src/App.tsx:52` — `handleFeatureSelect` and `handleFeatureChange` are identical one-liners; consolidate to one handler `(name: string | null) => setSelectedFeature(name)` to eliminate reader confusion about why two exist
🔵 `dashboard-ui/src/components/feature-detail.tsx:11` — `fmtCost`/`fmtK` call `.toFixed()` without `Number.isFinite(v)` guard; corrupted STATE.json null numeric fields throw TypeError; return `"—"` for non-finite inputs
🔵 `dashboard-ui/src/components/feature-detail.tsx:12` — `fmtMs` has no hours branch; a 2-hour run renders as "120.0m"; add `if (v >= 3_600_000) return \`${(v / 3_600_000).toFixed(1)}h\`` before minutes branch
🔵 `dashboard-ui/src/components/feature-detail.tsx:38` — `taskMap` allocated unconditionally before the `tokenUsage` null check; move inside the truthy block to avoid unnecessary allocation
🔵 `bin/lib/run.mjs:197` — task `phase` label frozen at first dispatch; `setUsageContext("review", task.id)` at line 1197 shifts phase context but does not update the existing task bucket label; add comment documenting this as intentional

---

# Security Review — dashboard-token-breakdown-feature-detail-view-clic

## Overall Verdict: PASS

566/566 tests green. No new critical security vulnerabilities introduced by this feature. One pre-existing 🟡 (path traversal + all-interface binding) carries forward with marginally elevated impact from new `tokenUsage` cost data in STATE.json. Previously flagged null-guard and `Number.isFinite` gaps are confirmed FIXED in the current code.

---

## Files Read

- `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`
- `tasks/task-2/artifacts/test-output.txt` (566 tests, 0 failures — lines 1416–1423)
- `dashboard-ui/src/components/feature-detail.tsx` (full, 147 lines — read directly)
- `bin/agt.mjs` lines 245–258 (`expandTilde`), 430–530 (API handlers), 580–590 (`server.listen`)
- `bin/lib/run.mjs` lines 265–298 (claude + codex dispatch), 716–720 (`resetRunUsage` call)

---

## Per-Criterion Results

### 1. Path traversal — `/api/state?path=` (pre-existing)

**Evidence:** `bin/agt.mjs:449`
```js
const fd = expandTilde(url.searchParams.get("path") || "");
const sp = join(fd, "STATE.json");
```
`expandTilde` at line 248 only resolves `~/` prefixes — it does NOT normalize `..` sequences or validate the resolved path against registered project roots. The same unvalidated pattern is used for every `/api/*` endpoint (lines 438, 442, 449, 455, 461, 469, 519).

`bin/agt.mjs:586`: `server.listen(parseInt(port))` — no hostname argument; Node.js defaults to `0.0.0.0` (all interfaces). Any local-network client that can reach the port can supply `?path=../../../some/other/project` to read arbitrary STATE.json files.

**Impact of this feature:** `tokenUsage` fields including `costUsd` are now written to STATE.json and returned by `/api/state`. Impact is marginally elevated. **Pre-existing; already in backlog.**

### 2. XSS / injection — NOT present

All STATE.json data (task names, phase labels, cost figures) is rendered as React text nodes via JSX in `feature-detail.tsx`. No `dangerouslySetInnerHTML` or `innerHTML` found. React escapes all text content. No XSS surface introduced by this feature.

### 3. `tokenUsage.total` null guard — FIXED

Previous finding: `feature-detail.tsx:126` accessed `tokenUsage.total.costUsd` without guarding `total`.

**Current code evidence:** `feature-detail.tsx:67` extracts `const total = tokenUsage.total;` and `feature-detail.tsx:140–142` uses optional chaining throughout: `total?.costUsd ?? 0`, `total?.inputTokens ?? 0`, `total?.cachedInput ?? 0`, `total?.outputTokens ?? 0`, `total?.durationMs ?? 0`. Partial STATE.json writes that produce `tokenUsage` without `total` will now render `$0.0000` rather than throwing TypeError. FIXED.

### 4. `fmtCost`/`fmtMs`/`fmtK` — `Number.isFinite` guard — FIXED

Previous finding: formatting helpers called `.toFixed()` on potentially null/NaN values.

**Current code evidence:**
- `feature-detail.tsx:11`: `function fmtCost(v: number) { return Number.isFinite(v) ? \`$\${v.toFixed(4)}\` : '—'; }` — guarded
- `feature-detail.tsx:12–13`: `fmtMs` opens with `if (!Number.isFinite(v)) return '—';` — guarded
- `feature-detail.tsx:19–20`: `fmtK` opens with `if (!Number.isFinite(v)) return '—';` — guarded

Corrupt STATE.json null numeric fields now return `"—"` instead of throwing TypeError. FIXED.

### 5. Codex agent path — explicit comment added, no security implications

`bin/lib/run.mjs:282–283` now has a comment: `// NOTE: codex does not return usage/cost fields; trackUsage() is not called here. // Features built via codex will always show tokenUsage: null in the dashboard.` No sensitive data leaked; no access control bypassed. Feature completeness gap only.

---

## Security Findings

🟡 bin/agt.mjs:449 — `/api/state?path=` + all-interface binding (`server.listen` line 586) exposes STATE.json (now including cost/token data) to local-network clients via unvalidated path parameter; validate `path` against registered project roots before reading (pre-existing finding; impact marginally elevated by `tokenUsage` field added in this feature)

---

# Tester Review — dashboard-token-breakdown-feature-detail-view-clic

## Overall Verdict: PASS

566/566 tests green (task-2 gate, exit code 0). The feature-detail component is correctly implemented and the token tracking pipeline is functional. Primary gap: the UI click-to-detail flow has zero component-level tests.

---

## Files Read

- `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`
- `tasks/task-2/artifacts/test-output.txt` (566 tests, 0 failures)
- `dashboard-ui/src/components/feature-detail.tsx` (full, 146 lines)
- `dashboard-ui/src/App.tsx` (full, 147 lines)
- `dashboard-ui/src/components/feature-timeline.tsx` (grep — lines 9, 12, 52–53)
- `bin/lib/run.mjs` lines 190–298, 710–729

---

## Per-Criterion Results

### 1. Core feature works — PASS

`App.tsx:120–138`: clicking a feature in `FeatureTimeline` calls `handleFeatureChange(feature.name)` (line 121), sets `selectedFeature`, and swaps `TaskBoard` for `FeatureDetail`. `FeatureDetail` renders `TokenBreakdown` when `tokenUsage` is truthy (`feature-detail.tsx:55–59`) or "No token data available" (`feature-detail.tsx:56`). Wire-up is correct.

### 2. Token tracking pipeline — PASS

`bin/lib/run.mjs:719`: `resetRunUsage()` is called as first statement of `_runSingleFeature` with explanatory comment. Line 272 calls `trackUsage(parsed)` on the claude path. Lines 220–238: `buildTokenUsage()` always returns `{ byTask, byPhase, total }`. Codex path (line 281–291) skips `trackUsage()` by design, with comment at lines 282–284.

### 3. Null safety — PASS (prior eval findings were stale)

Verified against actual committed code:
- `feature-detail.tsx:11`: `fmtCost` has `Number.isFinite(v)` guard ✓
- `feature-detail.tsx:13`: `fmtMs` has `Number.isFinite(v)` guard and hours branch at line 14 ✓
- `feature-detail.tsx:20`: `fmtK` has `Number.isFinite(v)` guard ✓
- `feature-detail.tsx:140–142`: `total?.costUsd ?? 0` with optional chaining ✓
- `feature-detail.tsx:66`: `taskMap` is inside `TokenBreakdown`, only called when `tokenUsage` is truthy ✓

The engineer and security reviews (eval.md lines 88–114, 162–164) flagged all of the above as missing. They are not missing in the committed code. Those findings described an earlier draft. The compound gate `fabricated-refs` warning on task-1 was accurate.

### 4. UI test coverage — WARN (coverage gap)

Zero tests for `FeatureDetail` component rendering, click-to-detail interaction, or format helpers (`fmtCost`, `fmtMs`, `fmtK`). All 566 tests cover back-end harness and utility code only.

### 5. Stale selectedFeature edge case — WARN (untested)

`App.tsx:128`: if `selectedFeature` is set and a subsequent SSE update removes that feature from `features`, `features.find(f => f.name === selectedFeature)` returns undefined. `FeatureDetail` receives `feature={null}` and renders "Select a feature" — confusing UX since `selectedFeature` still holds a value. No test covers this path.

---

## Tester Findings

🟡 No test file for `FeatureDetail` component — the core user-facing behavior (click feature → render token breakdown) has zero component tests; happy path, null-tokenUsage path, and close-button path are all untested; add component unit tests or an integration test for the click-to-detail flow
🟡 `dashboard-ui/src/App.tsx:128` — `features.find(f => f.name === selectedFeature)` returns undefined when SSE removes a feature mid-session; `FeatureDetail` receives `feature={null}` and renders "Select a feature" while `selectedFeature` is still set; add a `useEffect` that resets `selectedFeature` when the named feature is no longer in `features`
🔵 `dashboard-ui/src/components/feature-detail.tsx:11` — `fmtCost`, `fmtMs`, `fmtK` are pure functions with no unit tests; the recently-added hours branch at line 14 has no coverage; add unit tests for boundary values (0, 999, 1000, 60000, 3600000)
🔵 `dashboard-ui/src/components/feature-detail.tsx:72` — when both `byTask` and `byPhase` are empty (codex agent, no trackUsage called) but `tokenUsage` is non-null, only the Total row renders with `$0.0000 0 tokens 0ms`; no test covers this and the UX is silent about why there are no rows
🔵 `.team/features/dashboard-token-breakdown-feature-detail-view-clic/tasks/task-1/handshake.json:6` — handshake records `"verdict": "FAIL"` with 12 criticals, but the final eval.md concludes PASS with 0 criticals; the artifacts are inconsistent and undermine the audit trail; the handshake should be regenerated to reflect the final review state

---

# Simplicity Review — dashboard-token-breakdown-feature-detail-view-clic

## Overall Verdict: PASS

566/566 tests green. Feature code is clean and appropriately sized. One 🟡 dead backup file committed to source tree caused measurable confusion in prior reviewers (it generated false findings in both Architect and Engineer sections above). Two 🔵 cosmetic issues.

---

## Files Actually Read

- `dashboard-ui/src/components/feature-detail.tsx` (full, 146 lines)
- `dashboard-ui/src/App.tsx` (full, 147 lines)
- `dashboard-ui/src/App.tsx.bak` (lines 45–84)
- `dashboard-ui/src/components/feature-timeline.tsx` (grep — lines 9, 12, 52–53)
- `dashboard-ui/src/components/task-board.tsx` (grep — lines 11, 91, 108)
- `bin/lib/run.mjs` (lines 705–734)
- `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`
- `tasks/task-2/artifacts/test-output.txt`

---

## Per-Criterion Results

### 1. Component complexity — PASS

`feature-detail.tsx` is 146 lines: 3 formatters + 2 components. The split into `FeatureDetail` (null gate) and `TokenBreakdown` (rendering) is correct and avoids deep conditional nesting. `NonNullable<Feature['tokenUsage']>` at line 65 propagates null safety through the type system, eliminating the need for runtime guards inside `TokenBreakdown`. No new hooks, context, or abstraction layers.

### 2. Dead backup file caused reviewer harm — CONFIRMED

`App.tsx.bak` (lines 50–56) has two handlers: `handleFeatureSelect: (name: string) => void` and `handleFeatureChange: (name: string | null) => void`. The current `App.tsx` has only one: `handleFeatureChange`. The Architect review (line 45) and Engineer review (line 112) both describe "handleFeatureSelect and handleFeatureChange as identical one-liners" — a finding that matches `.bak` but not `App.tsx`. The `.bak` file is the root cause of this reviewer confusion and adds zero value.

### 3. Prop naming inconsistency — low complexity cost

`FeatureTimeline.onFeatureSelect: (name: string) => void` vs `TaskBoard.onFeatureChange: (name: string | null) => void`. Both receive the same `handleFeatureChange` handler from `App.tsx`. TypeScript silently accepts this because the wider `(string | null) => void` type satisfies a `(string) => void` callback position. Cognitive cost: a reader must trace both props to confirm they're equivalent. Acceptable but worth cleaning up.

### 4. Previously-flagged issues are already fixed — confirmed by direct read

The Architect and Engineer sections list findings that describe code that does not exist in the current file. Verified against actual file contents:

| Claim in eval.md | Reality |
|---|---|
| `tokenUsage.total.costUsd` no null guard | `total?.costUsd ?? 0` at line 140 |
| `fmtMs` no hours branch | hours branch at line 14 |
| `fmtCost`/`fmtK` no `isFinite` guard | guards at lines 11–24 |
| `taskMap` allocated before null check | `taskMap` at line 66 inside `TokenBreakdown` |

These findings should not appear in backlog. The Security and Tester reviewers also confirmed all four as fixed.

---

## Findings

🟡 `dashboard-ui/src/App.tsx.bak` — dead backup file in source tree; caused Architect and Engineer reviewers to generate findings about a two-handler pattern that no longer exists in `App.tsx`; delete it

🔵 `dashboard-ui/src/components/feature-timeline.tsx:9` — `onFeatureSelect: (name: string)` vs `task-board.tsx:11` `onFeatureChange: (name: string | null)`; sibling components use divergent names and nullability for the same callback; align to one interface to eliminate cross-file tracing

🔵 `dashboard-ui/src/App.tsx:52` — `handleFeatureChange` is a single-line wrapper for `setSelectedFeature`; the wrapper is acceptable if future intercepts are planned but adds indirection with no current benefit; document intent or remove the wrapper

---

# Tester Review (run_2) — dashboard-token-breakdown-feature-detail-view-clic

## Overall Verdict: PASS

Gate output (from prompt): 566/566 tests pass, exit 0. All 6 claimed fixes from task-1 run_2 verified directly against committed code. No new test failures introduced. Coverage gaps are real but confined to UI components — the backend token tracking pipeline is well covered.

---

## Files Actually Read

- `dashboard-ui/src/components/feature-detail.tsx` (full, 166 lines)
- `dashboard-ui/src/components/feature-timeline.tsx` (full, 95 lines)
- `dashboard-ui/src/App.tsx` (full, 153 lines)
- `dashboard-ui/src/hooks/use-features.ts` (full, 92 lines)
- `dashboard-ui/src/types.ts` (full, 109 lines)
- `bin/lib/run.mjs` lines 755–765, 895–910, 1460–1470
- `test/token-usage.test.mjs` (full, 224 lines)
- `tasks/task-1/handshake.json`, `tasks/task-1-p1/handshake.json`, `tasks/task-2/handshake.json`

---

## Claims Verified vs Evidence

| Claim (task-1 run_2 handshake) | Verified | Evidence |
|---|---|---|
| Deleted `App.tsx.bak` | ✅ | Glob for `*.bak` returns no files |
| Inlined no-op handler — `setSelectedFeature` passed directly | ✅ | `App.tsx:126` `onFeatureSelect={setSelectedFeature}`, `App.tsx:141` `onFeatureChange={setSelectedFeature}` — no `handleFeatureChange` wrapper exists |
| Adaptive cost precision (`toFixed(4)` for sub-cent) | ✅ | `feature-detail.tsx:11–13` `v < 0.01 ? toFixed(4) : toFixed(2)` |
| `Number.isFinite` guard on timeline cost | ✅ | `feature-timeline.tsx:83` `Number.isFinite(feature.tokenUsage.total.costUsd) ? ... : '—'` |
| `useEffect` reset guard for SSE-evicted feature | ✅ | `App.tsx:49–53` — resets `selectedFeature` to `null` when feature is no longer in `features` array |
| Polling blocked while SSE active | ✅ | `use-features.ts:19` `sseActiveRef`, set `true` on open (line 45), `false` on error (line 64), checked at polling (line 74) |

---

## Per-Criterion Results

### 1. Backend token tracking — PASS

`test/token-usage.test.mjs` covers: `resetRunUsage` clears all state (4 cases), `trackUsage` accumulates correctly across phases/tasks/runs (9 cases), `buildTokenUsage` shape and field mapping (6 cases), cross-feature isolation (1 case). 20 total cases with edge coverage for missing fields and null/undefined inputs.

`bin/lib/run.mjs:761` calls `resetRunUsage()` at feature start — confirmed. `run.mjs:1465–1470` persists `buildTokenUsage()` to STATE.json after feature completion — confirmed. Backend pipeline is sound and tested.

### 2. UI wire-up — PASS (untested)

`App.tsx:49–53` resets `selectedFeature` when SSE evicts it — **but this fix is unverified by any test**. The prior tester review (run_1) flagged it as missing; the builder added it, but the guard works by React state update on next render: there is a brief flash where `FeatureDetail` receives `feature={null}` and shows "Select a feature" before the effect runs. Correct behavior, zero test coverage.

### 3. Formatter safety — PASS (partially untested)

All three formatters have `Number.isFinite` guards and `fmtMs` has the hours branch. No TypeError risk on corrupt data. However none of these pure functions have unit tests. The `v >= 3_600_000` (hours) branch and the `v < 0.01` (sub-cent) branch are both new in this feature and neither has a boundary test.

### 4. Timeline cost precision — WARN (inconsistency)

`feature-timeline.tsx:83` always calls `toFixed(2)`. A feature costing $0.005 renders as "$0.01" in the timeline but "$0.0050" in the detail panel (`fmtCost` switches at `< 0.01`). The two surfaces disagree on the same value. No test covers this discrepancy.

### 5. Silent catch — WARN (pre-existing, still unaddressed)

`bin/lib/run.mjs:1469` `catch { /* best-effort */ }` swallows tokenUsage write failures with no `console.warn`. A failed `writeState` means dashboard shows no token data permanently, with no log entry. This was a 🟡 in the task-2 review; task-1 run_2 did not address it.

---

## Findings

🟡 No component tests for `FeatureDetail` — the acceptance criterion "click a feature to see per-task cost, phase breakdown, run duration" cannot be caught by `npm test`; if someone breaks the `App.tsx` render gate or `TokenBreakdown` table, no test fails; add Vitest/RTL tests for: null feature, populated tokenUsage, null tokenUsage, close button
🟡 `dashboard-ui/src/components/feature-timeline.tsx:83` — timeline cost uses `toFixed(2)` unconditionally; a $0.005 feature shows "$0.01" in timeline but "$0.0050" in detail panel; apply the same `< 0.01` threshold used by `fmtCost` for consistent display, or extract `fmtCost` to a shared utility
🟡 `bin/lib/run.mjs:1469` — `catch { /* best-effort */ }` still silently discards tokenUsage write failures with no `console.warn`; pre-existing finding from task-2 review, not addressed in run_2; dashboard shows stale/missing data with no operator signal
🔵 `dashboard-ui/src/components/feature-detail.tsx:11` — `fmtCost`, `fmtMs`, `fmtK` are pure functions with no unit tests; the hours branch (`v >= 3_600_000`) and sub-cent branch (`v < 0.01`) are both new and untested; add unit tests for boundary values (0, 999, 1000, 60000, 3600000, 0.009, 0.01)
🔵 `dashboard-ui/src/components/feature-detail.tsx:73` — when `tokenUsage` is non-null but `byTask` and `byPhase` are both empty (codex agent path), only the Total row renders showing `$0.0000 0 tokens 0ms`; user has no way to know this is a codex limitation rather than a data error; no test covers this state

---

# Security Review (run_2) — dashboard-token-breakdown-feature-detail-view-clic

## Overall Verdict: PASS

No new security vulnerabilities introduced by this feature. One pre-existing 🟡 (unvalidated `?path=` parameter with all-interface binding) carries to backlog. All previously flagged null-safety and input-guard issues confirmed fixed in the committed code.

---

## Files Actually Read

- `dashboard-ui/src/components/feature-detail.tsx` (167 lines)
- `dashboard-ui/src/components/feature-timeline.tsx` (95 lines)
- `dashboard-ui/src/App.tsx` (153 lines)
- `dashboard-ui/src/hooks/use-features.ts` (91 lines)
- `dashboard-ui/src/lib/api.ts` (62 lines)
- `dashboard-ui/src/types.ts` (109 lines)
- `bin/agt.mjs` lines 586–694 (API request handler block)
- `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`, `tasks/task-1-p1/handshake.json`
- `tasks/task-2/eval.md` (previous review)

---

## Per-Criterion Results

| Criterion | Result | Evidence |
|---|---|---|
| XSS via feature/task names rendered in UI | PASS | `feature-detail.tsx:52,109,144` — all rendered as React JSX text children (auto-escaped); no `dangerouslySetInnerHTML` anywhere in the new files |
| XSS via tokenUsage fields (phase strings, task IDs) | PASS | Same — `feature-detail.tsx:112,144` render phase and task ID strings through JSX, escaped |
| `title={}` HTML attribute injection | PASS | `feature-detail.tsx:109` — `title={taskMap.get(id) || id}` rendered as React prop, escaped |
| localStorage project name used as lookup only | PASS | `App.tsx:34-35` — `localStorage.getItem('agt-dashboard-project')` only used in `projects.find(p => p.name === ...)` against server-supplied list; never injected into URL construction or filesystem paths |
| Timestamp parsing of arbitrary strings | PASS | `feature-detail.tsx:47` — `new Date(endTs).getTime()` produces `NaN` for invalid strings; `wallClockMs != null && wallClockMs > 0` guard (`NaN > 0` is false) hides section silently |
| Numeric formatting with non-finite input | PASS | `feature-detail.tsx:12,16,23` — all three formatters lead with `if (!Number.isFinite(v)) return '—'`; corrupt STATE.json nulls cannot produce TypeError or NaN output |
| `tokenUsage.total` optional chaining | PASS | `feature-detail.tsx:160-162` — `total?.costUsd ?? 0`, `total?.inputTokens ?? 0`, etc. throughout; partial STATE.json writes that omit `total` render `$0.0000` not a crash |
| SSE JSON parse isolation | PASS | `use-features.ts:49-58` — `JSON.parse(e.data)` inside try/catch; malformed SSE data logged, not re-thrown |
| No CSRF exposure from new code | PASS | No state-mutating API calls introduced; new feature is purely read-only |
| `App.tsx.bak` deleted | PASS | Confirmed: `ls` returns "No such file or directory" |
| Path traversal — `?path=` backend API (pre-existing) | FLAGGED 🟡 | `bin/agt.mjs:594,610,618,625,631,637,645,695` — `expandTilde(url.searchParams.get("path"))` with no path validation used at every `/api/*` endpoint; `expandTilde` only resolves `~/`, does not strip `..` sequences or validate against registered roots; combined with `server.listen(port)` binding to all interfaces, any local-network client can read arbitrary STATE.json files including the new `tokenUsage`/cost fields |

---

## Findings

🟡 bin/agt.mjs:594 — Pre-existing: `?path=` query parameter accepted without validation at all `/api/*` endpoints (features, state, events, loop-status, sprints, backlog); `expandTilde` does not normalize `..` traversal; combined with all-interface `server.listen`, local-network clients can read arbitrary filesystem paths; validate resolved path against `parseProjectsTable` allowlist before any `join(pp, ".team", ...)` call; impact marginally elevated now that `tokenUsage.costUsd` (financial data) is included in STATE.json responses

---

## Security Notes

The new UI code (`feature-detail.tsx`, `feature-timeline.tsx`, `App.tsx` delta, `use-features.ts` delta) introduces zero new attack surface:
- All server data rendered through React JSX (auto-escaped)
- No `dangerouslySetInnerHTML`, `eval`, or dynamic script execution
- No new write endpoints
- `localStorage` used only for project-name preference, value scoped to lookup, not URL construction
- Numeric and timestamp inputs defensively guarded at every render path

The pre-existing path traversal issue at `bin/agt.mjs:594` is the only security finding. It was already in the backlog before this feature. This feature does not worsen the attack vector beyond adding cost data to an already-readable STATE.json.

---

# Architect Review (run_2) — dashboard-token-breakdown-feature-detail-view-clic

## Overall Verdict: PASS

Gate passes (566/566, exit 0). Feature delivers stated goal. No critical or blocking issues. One new 🟡 UX inconsistency in the cost column (user-visible format divergence); three prior 🔵 suggestions not addressed in the fix iteration.

---

## Files Actually Read

- `dashboard-ui/src/components/feature-detail.tsx` (full, 167 lines)
- `dashboard-ui/src/components/feature-timeline.tsx` (full, 95 lines)
- `dashboard-ui/src/App.tsx` (full, 153 lines)
- `dashboard-ui/src/hooks/use-features.ts` (full, 91 lines)
- `dashboard-ui/src/types.ts` (full, 109 lines)
- `dashboard-ui/src/lib/api.ts` (full, 62 lines)
- `dashboard-ui/src/components/task-board.tsx` (lines 1–12 — prop interface)
- `bin/lib/run.mjs` (lines 186–264 — usage tracking; lines 1460–1470 — persistence)
- `bin/agt.mjs` (lines 455–477 — features API response shape)
- `tasks/task-1/handshake.json`, `tasks/task-1-p1/handshake.json`, `tasks/task-2/handshake.json`
- `tasks/task-2/eval.md` (prior review — full)

---

## Per-Criterion Results

| Criterion | Result | Evidence |
|---|---|---|
| Click feature → per-task cost table | PASS | `feature-detail.tsx:87–121` — renders `byTask` table with task name, phase, in, cached, out, cost, dur columns |
| Click feature → phase breakdown | PASS | `feature-detail.tsx:124–152` — renders `byPhase` table when `Object.keys(byPhase).length > 0` |
| Click feature → run duration | PASS | `feature-detail.tsx:45–47` — `wallClockMs` from `_runStartedAt\|createdAt` → `completedAt\|_last_modified`; renders only when `> 0` |
| Cost column in FeatureTimeline | PASS (with caveat — see 🟡) | `feature-timeline.tsx:81–87` — fixed `w-14` column; `Number.isFinite` guard present; format diverges from detail view |
| Selected feature highlight | PASS | `feature-timeline.tsx:54` — `ring-1 ring-primary/40` when `isSelected && !isActive` |
| FeatureDetail/TaskBoard conditional render | PASS | `App.tsx:132–143` — `selectedFeature ? <FeatureDetail> : <TaskBoard>` |
| Reset selected feature on SSE eviction | PASS | `App.tsx:49–53` — `useEffect` clears `selectedFeature` when it drops from `features` list |
| SSE polling suppression | PASS | `use-features.ts:19,73–74` — `sseActiveRef` scoped per effect invocation; fresh on each `projectPath` change |
| `.bak` dead file removed | PASS | Glob `**/*.bak` returns no files |
| Gate | PASS | 566/566 tests, exit 0 (from prompt gate output) |

---

## Architecture Assessment

**Data flow is clean and unidirectional.** `run.mjs` (tracking) → `STATE.json` (persistence) → `agt.mjs /api/features` → `useFeatures` hook → `App.tsx` state → `FeatureTimeline` + `FeatureDetail`. No circular dependencies introduced.

**No new dependencies.** All new UI uses existing `lucide-react`, shadcn/ui cards, and project utilities.

**Component boundary is appropriate.** `FeatureDetail` is purely presentational — no hooks, no side effects. `TokenBreakdown` sub-component separated behind a `NonNullable<>` type gate; null path handled in the outer component.

**Pre-existing architectural concern (module-level singletons in `run.mjs`):** `_runUsage`, `_phaseUsage`, `_taskUsage` are process-global. Correct for the current single-feature-at-a-time loop (`resetRunUsage()` called at feature start). Not introduced by this feature; carry to backlog if concurrent execution is ever planned.

**Formatter duplication is the primary maintainability gap.** `fmtCost` (adaptive precision: `toFixed(4)` when `< 0.01`) lives in `feature-detail.tsx`; `feature-timeline.tsx` formats the same cost inline with `.toFixed(2)`. These have already diverged and the divergence is user-visible: a feature costing $0.003 shows as `$0.00` in the timeline and `$0.0030` in the detail panel.

---

## Findings

🟡 `dashboard-ui/src/components/feature-timeline.tsx:83` — Cost column uses hardcoded `.toFixed(2)`; features costing under $0.01 display as `$0.00` in the timeline, making the column useless for small runs. `feature-detail.tsx:13` uses adaptive precision (`toFixed(4)` when `< 0.01`). The same cost renders differently in two views — a user sees `$0.00` in the list then clicks to see `$0.0030`. Extract `fmtCost` to `lib/utils.ts` and use it in both components.

🔵 `dashboard-ui/src/App.tsx:141` — `selectedFeature={selectedFeature}` passed to `TaskBoard` is structurally always `null` in that branch (TaskBoard only renders when `!selectedFeature`). Dead prop misleads readers. Pass `null` directly or remove it. (Prior 🔵 from task-2 eval; not addressed in run_2 fix.)

🔵 `dashboard-ui/src/types.ts:57` — `FeatureTokenUsage.total` typed as non-optional (`total: PhaseTokenUsage`) but `feature-detail.tsx:160` accesses it with `total?.costUsd ?? 0`. Type and runtime access disagree. `buildTokenUsage()` always returns `total`, so the type is correct — remove the optional chaining to match, or change to `total?: PhaseTokenUsage`. (Prior 🔵 from task-2 eval; not addressed.)

🔵 `dashboard-ui/src/components/feature-detail.tsx:11` — `fmtCost`, `fmtMs`, `fmtK` are module-private; `feature-timeline.tsx` duplicates cost formatting inline and uses different precision. Extract to `lib/utils.ts` to prevent further divergence. (Prior 🔵 from task-2 eval; not addressed.)

---

# PM Review (run_2) — dashboard-token-breakdown-feature-detail-view-clic

## Overall Verdict: PASS

All five user-facing requirements are implemented and traceable directly to code. Gate passes (566/566). All six claimed run_2 fixes verified against committed code. Four 🟡 items must go to backlog; none block merge.

---

## Files Actually Read

- `dashboard-ui/src/components/feature-detail.tsx` (full, 163 lines)
- `dashboard-ui/src/components/feature-timeline.tsx` (full, 95 lines)
- `dashboard-ui/src/App.tsx` (full, 153 lines)
- `dashboard-ui/src/hooks/use-features.ts` (full, 92 lines)
- `dashboard-ui/src/types.ts` (full, 109 lines)
- `.team/features/dashboard-token-breakdown-feature-detail-view-clic/SPEC.md`
- `tasks/task-1/handshake.json`, `tasks/task-1-p1/handshake.json`, `tasks/task-2/handshake.json`
- `tasks/task-2/eval.md` (full, parallel review output)
- `tasks/task-1/eval.md` (run_1 + run_2 multi-role reviews, lines 1–507)
- `Glob dashboard-ui/src/**/*.bak` — 0 files (App.tsx.bak confirmed deleted)

---

## Per-Criterion Results

### 1. Click a feature to see the detail panel — PASS

**Evidence:** `feature-timeline.tsx:56` calls `onFeatureSelect(feature.name)` on click and on Enter/Space keydown. `App.tsx:126-134` renders `<FeatureDetail>` when `selectedFeature` is truthy, replacing `<TaskBoard>`. `onFeatureSelect={setSelectedFeature}` at `App.tsx:126` — no wrapper indirection. Wire-up complete.

### 2. Per-task cost — PASS

**Evidence:** `feature-detail.tsx:87-120` renders a per-task table with columns: Task, Phase, In, Cached, Out, Cost, Dur. Cost column at line 113 uses `fmtCost(tu.costUsd)`. Table renders only when `Object.keys(tokenUsage.byTask).length > 0`.

### 3. Phase breakdown (brainstorm/build/review) — PASS

**Evidence:** `feature-detail.tsx:123-151` renders a by-phase table with columns: Phase, Dispatches, Tokens, Cost, Dur. Phase labels are data-driven from STATE.json — correct, as the harness writes real phase names. Table renders only when `Object.keys(tokenUsage.byPhase).length > 0`.

### 4. Run duration — PASS

**Evidence:** `feature-detail.tsx:42-44` computes `wallClockMs` from `(feature._runStartedAt || feature.createdAt)` to `(feature.completedAt || feature._last_modified)`. `feature-detail.tsx:61` renders "Run duration: {fmtMs(wallClockMs)}" in the detail header. Conditional on `wallClockMs != null && wallClockMs > 0`. `_runStartedAt` typed at `types.ts:28`.

### 5. Cost column on feature timeline — PASS

**Evidence:** `feature-timeline.tsx:81-87` renders a fixed-width `w-14` cost cell on every row. When `feature.tokenUsage?.total?.costUsd != null`, shows cost with `Number.isFinite` guard; otherwise renders an empty `w-14` placeholder so row layout does not shift.

### 6. run_2 claimed fixes — ALL VERIFIED

| Claim | Verified | Evidence |
|---|---|---|
| Deleted App.tsx.bak | ✅ | Glob `dashboard-ui/src/**/*.bak` → 0 files |
| Inlined no-op handler | ✅ | `App.tsx:126` `onFeatureSelect={setSelectedFeature}`, `App.tsx:141` `onFeatureChange={setSelectedFeature}` — no `handleFeatureChange` wrapper |
| Adaptive cost precision | ✅ | `feature-detail.tsx:11-13` `v < 0.01 ? toFixed(4) : toFixed(2)` |
| `Number.isFinite` guard on timeline cost | ✅ | `feature-timeline.tsx:83` `Number.isFinite(...) ? ... : '—'` |
| `useEffect` stale-feature reset | ✅ | `App.tsx:49-53` resets `selectedFeature` to `null` when feature no longer in `features` array |
| Polling blocked while SSE active | ✅ | `use-features.ts:19` `sseActiveRef`, toggled on open/error, checked at line 74 before polling |

### 7. SPEC.md acceptance criteria — FAIL (spec quality gap)

**Evidence:** `SPEC.md:6-8` — "Done when" block is a verbatim copy of the goal string. Not a binary, independently testable condition. A PM cannot sign off on "done" from spec alone without reading code.

### 8. UI test coverage — FAIL (coverage gap)

**Evidence:** Confirmed by multiple reviewers: 0 test files in `dashboard-ui/`. All 566 tests cover backend harness only. Regressions to `FeatureDetail`, `TokenBreakdown`, `fmtCost`/`fmtMs`/`fmtK`, or the App.tsx render gate would pass `npm test` undetected.

### 9. Timeline cost precision — INCONSISTENT

**Evidence:** `feature-timeline.tsx:83` uses `toFixed(2)` unconditionally (confirmed by Simplicity reviewer at eval.md:501). A feature costing $0.003 shows `$0.00` in timeline and `$0.0030` in detail panel. Same cost, two surfaces, two values. Also flagged by Tester (run_2) at eval.md:378 and Simplicity at eval.md:501.

### 10. Codex agent token fallback — AMBIGUOUS UX

**Evidence:** `feature-detail.tsx:70-71` — `!tokenUsage` path renders generic "No token data available". Codex-built features produce `tokenUsage: null` by design (documented at `run.mjs:282-284`). User cannot distinguish expected codex limitation from data collection failure. Not addressed in run_2.

### 11. Silent tokenUsage write failure — UNADDRESSED

**Evidence:** `bin/lib/run.mjs:1469` — `catch { /* best-effort */ }` discards STATE.json tokenUsage write failures with no `console.warn`. Was 🟡 in task-2 review (eval.md:384); not addressed in run_2 (confirmed by Tester run_2 at eval.md:379).

---

## Findings

🟡 `dashboard-ui/src/components/feature-detail.tsx:1` — Zero UI component tests; acceptance criterion "click a feature to see per-task cost, phase breakdown, run duration" is unverifiable by `npm test`; add component tests for: null feature, populated tokenUsage, null tokenUsage, and close-button paths
🟡 `dashboard-ui/src/components/feature-timeline.tsx:83` — Timeline cost uses `.toFixed(2)` unconditionally; a $0.003 feature shows `$0.00` in the timeline but `$0.0030` in the detail panel; extract `fmtCost` to `lib/utils.ts` and use it in both surfaces for consistent display
🟡 `dashboard-ui/src/components/feature-detail.tsx:71` — "No token data available" is identical for codex limitation and data error; distinguish the two cases so users understand expected behavior vs unexpected data absence
🟡 `bin/lib/run.mjs:1469` — `catch { /* best-effort */ }` silently discards tokenUsage write failures with no `console.warn`; pre-existing gap not addressed in run_2; add `console.warn` so operators can detect STATE.json write failures that result in permanent token data absence
🔵 `dashboard-ui/src/types.ts:57` — `FeatureTokenUsage.total` typed as non-optional but `feature-detail.tsx:160-162` uses `total?.costUsd ?? 0`; align type to `total?: PhaseTokenUsage` or remove the optional chaining to match the type guarantee
🔵 `.team/features/dashboard-token-breakdown-feature-detail-view-clic/SPEC.md:6` — "Done when" criteria are verbatim copies of the goal; future specs must list discrete binary acceptance criteria so PM can verify done from spec alone
