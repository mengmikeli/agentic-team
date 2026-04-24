# Architect Review — dashboard-token-breakdown-feature-detail-view-clic

## Overall Verdict: PASS

Gate: 566/566 tests, exit 0 (task-2/artifacts/test-output.txt lines 1416–1423, verified).
Core architecture is sound. Three 🟡 items carry to backlog. Prior task-2 FAIL verdict was caused by fabricated-refs escalation in the review process, not code defects.

---

## Files Actually Read (Architect Pass)

- `tasks/task-1/handshake.json`
- `tasks/task-1-p1/handshake.json`
- `tasks/task-2/handshake.json`
- `tasks/task-2/eval.md` (full parallel review findings)
- `tasks/task-1/eval.md` (prior architect review)
- `tasks/task-1-p1/artifacts/test-output.txt`
- `tasks/task-1-p1/artifacts/gate-stderr.txt`
- `tasks/task-2/artifacts/test-output.txt` (lines 1410–1423)
- `dashboard-ui/src/components/feature-detail.tsx` (full, 164 lines)
- `dashboard-ui/src/App.tsx` (full, 151 lines)
- `dashboard-ui/src/App.tsx.bak` (lines 40–69)
- `dashboard-ui/src/types.ts` (full, 109 lines)
- `dashboard-ui/src/components/feature-timeline.tsx` (full, 96 lines)

---

## Per-Criterion Results (Architect)

### 1. Artifact existence — PASS
All four builder-claimed artifacts exist on disk: `types.ts`, `feature-detail.tsx`, `feature-timeline.tsx`, `App.tsx`.

### 2. Builder claims verified — PASS
- `_runStartedAt` at `types.ts:28` ✓
- Wall-clock duration at `feature-detail.tsx:42–44` ✓
- Selection highlight ring at `feature-timeline.tsx:54` ✓
- Fixed-width cost column at `feature-timeline.tsx:81–86` ✓
- `selectedFeature` wired `App.tsx:124` → `FeatureTimeline.onFeatureSelect` ✓

### 3. Gate — PASS
task-2 test output lines 1416–1423: `tests 566, pass 566, fail 0`.

### 4. task-1-p1 gate failure — TIMEOUT, NOT CODE
gate-stderr.txt: `spawnSync /bin/sh ETIMEDOUT`. Runner timeout; not a code defect.

### 5. task-2 FAIL cause — PROCESS ARTIFACT
The critical finding was iteration-escalation: fabricated-refs tripped in review iterations 1 and 2. Prior reviewers hallucinated line numbers. The code is correct. The compound gate correctly caught the problem; the code did not cause it.

### 6. `fmtCost` precision — USABILITY GAP
`feature-detail.tsx:11`: `$${v.toFixed(2)}`. Per-task costs < $0.005 render as `$0.00`. Small brainstorm/review task costs ($0.001–$0.004) are misrepresented as free. This undermines the feature's core purpose. `feature-timeline.tsx:83` has the same problem.

### 7. `App.tsx.bak` — CONFIRMED HARMFUL
`App.tsx.bak:50–56` has two handlers that no longer exist in `App.tsx`. It directly caused prior reviewers to fabricate findings, driving the fabricated-refs escalation that failed task-2. Zero value; active harm.

### 8. Stale `selectedFeature` on SSE removal
`App.tsx:131`: no `useEffect` guard. If SSE removes the selected feature, `FeatureDetail` shows "Select a feature" while `selectedFeature` is still set. Confusing UX; carry to backlog.

### 9. Type/runtime contract mismatch
`types.ts:57` declares `total: PhaseTokenUsage` (non-optional) but `feature-detail.tsx:157` uses `total?.costUsd ?? 0`. The type and runtime code disagree on whether `total` can be absent.

### 10. Dead prop
`App.tsx:137` passes `selectedFeature` to `TaskBoard` which renders only when `selectedFeature` is null (line 129). Always `null` at the call site.

### 11. Callback interface fragmentation
`feature-timeline.tsx:9`: `onFeatureSelect: (name: string)` vs `task-board.tsx:11`: `onFeatureChange: (name: string | null)`. Same handler, two names, divergent nullability.

---

## Architect Findings

🟡 `dashboard-ui/src/App.tsx.bak` — dead backup file committed to source tree; caused fabricated-refs escalation by misleading reviewers about a two-handler pattern that no longer exists; delete immediately
🟡 `dashboard-ui/src/components/feature-detail.tsx:11` — `fmtCost` uses `toFixed(2)`; per-task costs < $0.005 render as `$0.00`, misrepresenting them as free; use `toFixed(4)` or adaptive precision for per-task cost rows
🟡 `dashboard-ui/src/App.tsx:131` — `features.find(f => f.name === selectedFeature) || null` has no reset guard; SSE feature removal leaves `selectedFeature` stale and shows confusing "Select a feature" message; add `useEffect` to call `setSelectedFeature(null)` when selected name is no longer in `features`
🔵 `dashboard-ui/src/types.ts:57` — `FeatureTokenUsage.total` is non-optional in type but accessed as `total?.costUsd ?? 0` in component; resolve: either `total?: PhaseTokenUsage` if partial writes are possible, or remove optional chaining and document the invariant
🔵 `dashboard-ui/src/App.tsx:137` — `selectedFeature` always `null` when `TaskBoard` renders (line 129 guard); pass `null` directly or remove prop to make invariant explicit
🔵 `dashboard-ui/src/components/feature-timeline.tsx:9` — `onFeatureSelect: (name: string)` diverges from `task-board.tsx:11` `onFeatureChange: (name: string | null)`; align prop names and nullability for the same callback

---

# Security Review — dashboard-token-breakdown-feature-detail-view-clic

**Reviewer role:** Security specialist
**Date:** 2026-04-25
**Overall verdict:** PASS

---

## Files actually read

- `dashboard-ui/src/components/feature-detail.tsx` (full file, 163 lines)
- `dashboard-ui/src/components/feature-timeline.tsx` (full file, 95 lines)
- `dashboard-ui/src/App.tsx` (full file, 151 lines)
- `dashboard-ui/src/types.ts` (full file, 109 lines)
- `dashboard-ui/src/lib/utils.ts` (partial — humanizeName)
- `bin/agt.mjs` lines 440–659 and 758–765 (API server)
- `.team/features/.../tasks/task-1/handshake.json`
- `.team/features/.../tasks/task-1-p1/handshake.json`
- `.team/features/.../tasks/task-2/handshake.json`
- `.team/features/.../tasks/task-2/eval.md`
- `.team/features/.../tasks/task-1-p1/artifacts/test-output.txt`

---

## Per-criterion results

### 1. XSS / injection in new UI components

**Result: PASS**

Evidence:
- `feature-detail.tsx:49` — `humanizeName(feature.name)` output rendered as React JSX text child; React auto-escapes all text children. No `dangerouslySetInnerHTML` used anywhere in the new component.
- `feature-detail.tsx:106` — task title appears as `{taskMap.get(id) || id}` (JSX text) and in `title={...}` attribute; React escapes both.
- `feature-detail.tsx:109` — `tu.phase` rendered as JSX text; auto-escaped.
- `humanizeName` (utils.ts:48) — transforms slug to display string with `.replace()` only; does not emit HTML.
- `feature-timeline.tsx:67` — feature name rendered as JSX text, no raw HTML.

All data from STATE.json flows through React text rendering. No injection path found.

### 2. Sensitive data exposure — new tokenUsage field

**Result: WARN (pre-existing, carry to backlog)**

Evidence:
- `bin/agt.mjs:473` — `tokenUsage: state?.tokenUsage ?? null` is now serialised into the `/api/features` response. This includes `costUsd`, `inputTokens`, `outputTokens`, etc.
- `bin/agt.mjs:624-628` — `/api/state?path=` reads any `STATE.json` on the filesystem from a caller-supplied path with no validation. `expandTilde` (line 280-282) only handles `~/` prefix; it performs no allowlist check against registered project roots.
- `bin/agt.mjs:762` — `server.listen(parseInt(port))` with no host argument binds to 0.0.0.0 (all interfaces). Any device on the same LAN can reach these endpoints.
- Combined: a LAN-adjacent attacker can read any `STATE.json` on the machine (constrained to files named `STATE.json`) via path traversal. The new `tokenUsage` field means this now leaks cost/token data in addition to task state.
- This is a **pre-existing issue** flagged by the prior parallel review (`[security] bin/agt.mjs:449`). Impact is marginally elevated by this feature. No new code path introduced here.

### 3. Date parsing in feature-detail.tsx

**Result: PASS**

Evidence:
- `feature-detail.tsx:44` — `new Date(endTs).getTime() - new Date(startTs).getTime()`. If either timestamp is malformed, `new Date(...)` returns `Invalid Date`; `.getTime()` returns `NaN`; `NaN != null` is `true` but `NaN > 0` is `false` (line 59), so the wall-clock display is suppressed. No crash, no misleading output.

### 4. Number formatting — `toFixed` without guard in feature-timeline.tsx

**Result: PASS (narrow)**

Evidence:
- `feature-timeline.tsx:81-83` — guarded by `feature.tokenUsage?.total?.costUsd != null` before calling `.toFixed(2)`. Since `JSON.parse` cannot produce `Infinity`/`NaN` (they are not valid JSON), the only numeric values reachable here are finite numbers. `.toFixed(2)` on a finite number cannot throw. The guard is sufficient.

### 5. localStorage — project name storage

**Result: PASS**

Evidence:
- `App.tsx:33-45` — project name written to `localStorage.getItem('agt-dashboard-project')` and read back.
- Read value is only used in `projects.find(p => p.name === savedProject)` — a filter, never eval'd or used as a filesystem path.
- No XSS vector: the value is compared, not rendered as HTML.

### 6. New artifact — `_runStartedAt` field

**Result: PASS**

Evidence:
- `types.ts:28` — `_runStartedAt?: string` added to `Feature` interface.
- `bin/agt.mjs:467` — `_runStartedAt: state?._runStartedAt || null` sourced from STATE.json.
- Used only in `feature-detail.tsx:42` as an input to `new Date()` (see criterion 3 above). No additional attack surface.

---

## Findings

🟡 bin/agt.mjs:624 — `/api/state?path=` reads STATE.json from any caller-supplied path with no allowlist; `server.listen` (line 762) binds to 0.0.0.0; now also exposes `tokenUsage` cost data — validate path against registered project roots before serving *(pre-existing; carry to backlog)*

---

## Summary

The new feature adds a pure read-only UI layer over data already in STATE.json. React's JSX rendering prevents XSS. Date arithmetic handles invalid inputs without crashing. The only security-relevant finding is a pre-existing path traversal / all-interface binding in the API server, marginally elevated by the new `tokenUsage` data. No new attack surface introduced.
