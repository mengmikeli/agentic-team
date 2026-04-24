# Simplicity Review — dashboard-token-breakdown-feature-detail-view-clic

**Reviewer role:** Simplicity advocate
**Verdict: FAIL** — 2 🔴 critical findings block merge

---

## Files Actually Read

- `dashboard-ui/src/components/feature-detail.tsx` (148 lines, full)
- `dashboard-ui/src/App.tsx` (149 lines, full)
- `dashboard-ui/src/types.ts` (108 lines, full)
- `dashboard-ui/src/components/feature-timeline.tsx` (90 lines, full)
- `.team/features/.../tasks/task-1/handshake.json` (full)
- `.team/features/.../tasks/task-2/handshake.json` (full)
- `.team/features/.../tasks/task-2/eval.md` (full)
- `.team/features/.../tasks/task-1/artifacts/test-output.txt` (first 50 lines)
- `dashboard-ui/src/components/task-board.tsx` (grep excerpts)

---

## Findings

### 🔴 Dead code — committed backup file

`dashboard-ui/src/App.tsx.bak` exists in the source tree. Confirmed via glob.
The file contains the pre-refactor two-handler implementation (`handleFeatureSelect` + `handleFeatureChange`). It is not imported, not tested, and never executed. It directly caused the Architect and Engineer reviewers in prior iterations to fabricate findings about "identical one-liners" that don't exist in the current `App.tsx`.

**Fix:** `git rm dashboard-ui/src/App.tsx.bak`

---

### 🔴 Unnecessary indirection — `handleFeatureChange` wrapper

`dashboard-ui/src/App.tsx:53`

```tsx
const handleFeatureChange = (featureName: string | null) => {
  setSelectedFeature(featureName);
};
```

This function adds no transformation, no validation, no logging, and no side-effects. It is used at exactly two call sites (lines 123, 137) and both delegate directly to `setSelectedFeature`. The `setSelectedFeature` setter (or an inline arrow) would be structurally equivalent and easier to follow.

**Fix:** Replace both usages with `setSelectedFeature` directly, or inline lambdas if TypeScript's dispatch type doesn't align. Remove the wrapper.

---

### 🟡 Misleading prop — `selectedFeature` always `null` in `TaskBoard`

`dashboard-ui/src/App.tsx:134`

```tsx
{selectedFeature ? (
  <FeatureDetail ... />
) : (
  <TaskBoard
    selectedFeature={selectedFeature}   {/* always null here */}
    onFeatureChange={handleFeatureChange}
  />
)}
```

`TaskBoard` is only rendered in the `!selectedFeature` branch, so `selectedFeature` is always `null` at this call site. Readers must trace the ternary to confirm the value. Inside `TaskBoard`, the `const feature = selectedFeature ? ...find() : null` (line 100) and the conditional render at line 130 always take the null path.

**Fix:** Pass `null` directly: `selectedFeature={null}`. This makes the invariant visible without reading the parent ternary.

---

## Per-Criterion Results

| Criterion | Status | Evidence |
|---|---|---|
| **Dead code** | ❌ FAIL | `App.tsx.bak` present on disk, confirmed via glob |
| **Premature abstraction** | ✅ PASS | `TokenBreakdown` is a single-site component extraction that reduces cognitive load in `FeatureDetail`; `fmtCost`/`fmtMs`/`fmtK` are each used multiple times |
| **Unnecessary indirection** | ❌ FAIL | `handleFeatureChange` at line 53 is a no-op wrapper with zero transformation |
| **Gold-plating** | ✅ PASS | No speculative config, no unused feature flags in new code |
| Test gate | ✅ PASS | 566/566 tests passing, verified via test-output.txt exit code 0 |
| Overall complexity | ✅ PASS | `feature-detail.tsx` is 148 lines doing exactly what it needs; `feature-timeline.tsx` cost column addition (lines 78–82) is minimal and clean |

---

## Actionable Feedback

1. **Delete `App.tsx.bak` immediately.** It actively corrupts AI reviewers by presenting stale code as current. One `git rm` resolves both this finding and the fabrication risk.

2. **Inline `handleFeatureChange`.** The two call sites are three lines apart in the same file. The wrapper buys nothing. After deleting the `.bak`, this is the only remaining indirection that earns a 🔴.

3. **Pass `null` directly to `TaskBoard`** (backlog-priority) — this is a 🟡 readability issue, not a correctness bug.
