# Architect Review — dashboard-token-breakdown-feature-detail-view-clic

## Overall Verdict: PASS

566/566 tests green (task-2/artifacts/test-output.txt, lines 1416–1423). No critical architectural issues.

---

## Files Read

- `bin/lib/run.mjs` lines 190–236, 270–290, 706–725
- `dashboard-ui/src/components/feature-detail.tsx` (full, 135 lines)
- `dashboard-ui/src/App.tsx` lines 1–80
- `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`
- `tasks/task-2/artifacts/test-output.txt`

---

## Per-Criterion Results

### 1. `resetRunUsage()` is called at feature start
**PASS** — `bin/lib/run.mjs:715` calls `resetRunUsage()` as the first statement of `_runSingleFeature`, with an explanatory comment. 24 tests in `test/token-usage.test.mjs` (test-output.txt lines 1388–1415) cover `resetRunUsage`, `trackUsage`, and `buildTokenUsage`. The prior eval's 🔴 findings claiming "zero callers" were fabricated.

### 2. Token data surfaces in the feature detail panel
**PASS** — `feature-detail.tsx:53` guards `!tokenUsage` and renders "No token data available" on the null path. Lines 58–129 render per-task table, phase breakdown, and totals when `tokenUsage` is present. The component correctly maps task IDs to titles via `taskMap`.

### 3. `buildTokenUsage()` always returns a `total` field
**PASS** — `run.mjs:234` always returns `total: mapBucket(_runUsage)`. `_runUsage` is initialized to `_emptyBucket()` (all zeros) and is never undefined in normal operation. The 🔵 risk is corrupt STATE.json where `tokenUsage.total` is absent — the outer null check at line 53 does not guard against this.

### 4. Codex agent path — token tracking gap
**CONFIRMED GAP** — `run.mjs:279–288` codex path returns `{ ok, output, error }` with no `usage`/`cost` fields and no `trackUsage()` call. Features built via codex silently show "No token data available" with no label explaining why. This is the core UX regression for codex users flagged by the parallel review's 🔴 [product] finding (eval.md line 8). No fix was applied in this iteration; carrying forward as 🟡 backlog.

### 5. Dispatch contract inconsistency (architectural boundary)
**CONFIRMED** — The `dispatchAgent` function has a split return contract: claude returns `{ ok, output, error, usage, cost }`, codex returns `{ ok, output, error }`. This is an undocumented boundary divergence. Callers must special-case for codex, which makes token tracking agent-specific rather than uniform.

### 6. Gate
**PASS** — task-2 handshake: `"verdict": "PASS"`, `"summary": "Gate command: npm test — exit code 0"`. Test output confirms 566 pass, 0 fail.

---

## Findings

🟡 bin/lib/run.mjs:279 — codex path returns no `usage`/`cost`; `trackUsage()` is never called; features built with codex silently show "No token data available" with no explanation; add explicit comment marking this as a known inherent limitation of codex's output format
🟡 dashboard-ui/src/App.tsx:52 — `handleFeatureSelect` and `handleFeatureChange` are functionally identical one-liners (both call `setSelectedFeature`); two names with different signatures imply a semantic distinction that does not exist; consolidate to one handler to prevent future divergence confusion
🔵 dashboard-ui/src/components/feature-detail.tsx:126 — `tokenUsage.total.costUsd` accessed without null guard on `.total`; normal operation is safe (buildTokenUsage always produces total), but corrupt STATE.json where `tokenUsage` exists without `total` throws TypeError; add `tokenUsage.total?.costUsd ?? 0` guard
🔵 dashboard-ui/src/components/feature-detail.tsx:38 — `taskMap` allocated unconditionally before `tokenUsage` null check at line 53; wasted allocation on the "No token data" path; move inside the truthy block
🔵 dashboard-ui/src/components/feature-detail.tsx:12 — `fmtMs` has no hours branch; runs ≥1h render as e.g. "120.0m"; add `if (v >= 3_600_000) return \`${(v/3_600_000).toFixed(1)}h\`` before the minutes branch
🔵 bin/lib/run.mjs:197 — task `.phase` label frozen at first dispatch; subsequent `setUsageContext()` calls shift the phase context but do not update the bucket label; add an inline comment marking this as intentional to prevent future "fix"

---

## Compound Gate (carried from task-1 handshake)

**Verdict:** WARN — `fabricated-refs` layer tripped in prior parallel review iterations (fabricated line numbers for `buildTokenUsage` citation). The current code references are verified correct.

---

# Engineer Review — dashboard-token-breakdown-feature-detail-view-clic

## Overall Verdict: PASS

566/566 tests green (task-2 gate, exit code 0). Feature delivers the described functionality: clicking a feature in the timeline replaces the TaskBoard with a `FeatureDetail` panel showing per-task and per-phase token breakdowns.

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

566/566 tests green. No new critical security vulnerabilities introduced by this feature. One pre-existing 🟡 (path traversal + all-interface binding) has slightly elevated impact due to new `tokenUsage` cost data in STATE.json. Two 🔵 null-guard gaps cause UI crashes on corrupt STATE.json but are not exploitable.

---

## Files Read

- `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`
- `tasks/task-2/artifacts/test-output.txt` (566 tests, 0 failures)
- `dashboard-ui/src/components/feature-detail.tsx` (full, 135 lines)
- `bin/agt.mjs` lines 430–520 (all API endpoint handlers)
- `bin/lib/run.mjs` lines 270–294 (codex agent return path)

---

## Per-Criterion Results

### 1. Path traversal — `/api/state?path=` (pre-existing)

**Evidence:** `bin/agt.mjs:449`
```js
const fd = expandTilde(url.searchParams.get("path") || "");
const sp = join(fd, "STATE.json");
```
`expandTilde` (line 248) only resolves `~/` — it does not normalize `..` sequences or validate against registered project roots. The same unvalidated pattern is repeated for every `/api/*` endpoint (lines 438, 442, 455, 461, 469, 519).

`bin/agt.mjs:586`: `server.listen(parseInt(port))` — no hostname argument, Node.js defaults to `0.0.0.0` (all interfaces).

**Impact of this feature:** `tokenUsage` fields (including `costUsd` values) are now written to STATE.json and returned by `/api/state`. A local-network client can now read cost data from arbitrary project directories, not just the project the dashboard was opened for.

**This is pre-existing and already in backlog.** Impact is marginally elevated by new cost data. No new action required beyond confirming the backlog entry.

### 2. XSS / injection — NOT present

All data from STATE.json (task names, phase labels, cost figures) is rendered as React text nodes in JSX. No `dangerouslySetInnerHTML` or `innerHTML` usage found in `feature-detail.tsx`. React escapes all text node content. No XSS surface introduced.

### 3. `tokenUsage.total` null guard gap

**Evidence:** `feature-detail.tsx:53` checks `!tokenUsage` (outer object), but `feature-detail.tsx:126` accesses `tokenUsage.total.costUsd` without guarding `tokenUsage.total`. If STATE.json is partially written during a crash and contains `tokenUsage: { byTask: {}, byPhase: {} }` without a `total` key, the component throws TypeError. This is a UI crash (client-side DoS on corrupt data), not an exploitable security path. Bounded to the React component tree.

### 4. `fmtCost`/`fmtMs`/`fmtK` — no `Number.isFinite` guard

**Evidence:** `feature-detail.tsx:11`: `function fmtCost(v: number) { return \`$\${v.toFixed(4)}\`; }`. TypeScript types are erased at runtime. If STATE.json has `"costUsd": null` (partial write), `fmtCost(null)` calls `null.toFixed(4)` and throws TypeError, crashing the component. Not exploitable — the data originates from a local filesystem path controlled by the user.

### 5. Codex agent path — no security implications

`bin/lib/run.mjs:279–288` codex branch returns no `usage`/`cost` fields. No sensitive data leaked; no access control bypassed. Feature completeness gap only (codex users see "No token data available").

---

## Security Findings

🟡 `bin/agt.mjs:449` — `/api/state?path=` + all-interface binding (`server.listen` line 586) exposes STATE.json (now including cost/token data) to local-network clients via unvalidated path parameter; validate `path` against registered project roots before reading (pre-existing finding; impact elevated by `tokenUsage` field added in this feature)
🔵 `dashboard-ui/src/components/feature-detail.tsx:126` — `tokenUsage.total.costUsd` accessed without null guard on `.total`; partial STATE.json write on crash throws TypeError and crashes the detail panel; add `tokenUsage.total?.costUsd ?? 0`
🔵 `dashboard-ui/src/components/feature-detail.tsx:11` — `fmtCost`/`fmtMs`/`fmtK` call `.toFixed()` with no `Number.isFinite(v)` guard; corrupt STATE.json with null numeric fields throws TypeError; return `"—"` for non-finite or non-number inputs
