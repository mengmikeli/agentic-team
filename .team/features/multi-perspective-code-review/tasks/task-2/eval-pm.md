# PM Review — Synthesis header in merged review

## Verdict: PASS

## Spec
> The merged output starts with a synthesis header showing total severity counts and a per-role count table, followed by the severity-ranked findings.

Three concrete acceptance criteria can be derived:
1. Output begins with a synthesis header.
2. Header contains total severity counts (critical / warning / suggestion).
3. Header contains a per-role count table.
4. Severity-ranked findings appear *after* the header.

## Evidence vs Claims

| Criterion | Evidence | Result |
|---|---|---|
| Starts with synthesis header | `bin/lib/flows.mjs:220` returns `${synthesis}\n\n## Parallel Review Findings\n\n${body}` — synthesis is prepended | ✅ |
| Total severity counts | `bin/lib/flows.mjs:208` builds `**Totals:** N critical · N warning · N suggestion` | ✅ |
| Per-role count table | `bin/lib/flows.mjs:209-213` builds markdown table with Role/Critical/Warning/Suggestion columns and one row per role | ✅ |
| Findings follow header | Test `test/flows.test.mjs:323-324` asserts `synthIdx < findingsIdx` | ✅ |
| User-value: scannability | A reviewer/PM can see severity totals + role distribution at a glance before drilling in. Real value. | ✅ |
| Doesn't break finding parsing | `bin/lib/flows.mjs:206-207` comment + design choice to use text labels (no raw severity emojis) in header so `parseFindings()` won't misclassify synthesis lines as findings | ✅ |

## Test Evidence
- `npm test` → 582 pass / 0 fail (artifacts/test-output.txt)
- New test `starts with a synthesis header showing totals and per-role table before findings` (test/flows.test.mjs:305-323) covers all four criteria including order.

## Scope
Implementation is tightly scoped: only `mergeReviewFindings` was touched plus its unit test. No drive-by refactors, no scope creep into adjacent flows. Builder used text-only header to avoid corrupting `parseFindings()` — that's a thoughtful, in-scope decision.

## Findings

No findings.

## Notes for backlog (not blocking)
- Per-role table iteration order follows insertion order of `findings[]` input. If product wants a canonical role ordering (e.g., `PARALLEL_REVIEW_ROLES` order) that is a future enhancement, not part of this spec.
- Roles with zero findings are *not* included in the table (Map only gets an entry when a finding is parsed). Spec is silent on this; current behavior is reasonable.
