# PM Evaluation — task-2 (synthesis header)

## Verdict: PASS

## Spec
> The merged output starts with a synthesis header showing total severity counts and a per-role count table, followed by the severity-ranked findings.

## Evidence

- **Synthesis header present** — `bin/lib/flows.mjs:218` constructs `## Parallel Review Synthesis` with totals line and a `| Role | Critical | Warning | Suggestion |` table.
- **Totals line** — `bin/lib/flows.mjs:213` aggregates totals across roles (`X critical · Y warning · Z suggestion`).
- **Per-role table** — `bin/lib/flows.mjs:215-217` emits one row per role with counts.
- **Order: synthesis before findings** — `bin/lib/flows.mjs:222` returns `${synthesis}\n\n## Parallel Review Findings\n\n${body}`.
- **Severity-ranked findings preserved** — `bin/lib/flows.mjs:209` sort still in place.
- **Test coverage** — `test/flows.test.mjs:304` asserts header presence, totals, table header, and synthesis-before-findings ordering. Ran `node --test test/flows.test.mjs` → 39/39 pass, including the new case.
- **No regression in parseFindings** — header uses text labels (no severity emojis), so it cannot be mistaken for a finding line. Existing simplicity-veto and severity-sort tests still pass.

## User Value
A reviewer skimming the merged output now gets an immediate at-a-glance summary (totals + per-role distribution) before drilling into individual findings. Clear win, scope-disciplined.

## Findings
No findings.
