# Engineer Eval — task-6

## Verdict: PASS

## Summary
The change derives the advertised SPEC.md sections in both `buildBrainstormBrief` (bin/lib/flows.mjs) and the brainstorm CLI prompt (bin/lib/brainstorm-cmd.mjs) from the single source of truth `PRD_SECTIONS` in bin/lib/spec.mjs. Two new tests in test/flows.test.mjs assert (a) the brief contains every PRD_SECTIONS entry as `## <section>`, and (b) templates/SPEC.md contains them as well.

## Per-criterion

- **Correctness**: PASS. `PRD_SECTIONS` (spec.mjs:6-14) lists the same seven sections that `validateSpecFile` checks, and both code paths now interpolate them via `PRD_SECTIONS.map(s => \`- ## ${s}\`).join("\n")`. Manually verified `templates/SPEC.md` headings match.
- **Tests**: PASS. Ran `node --test test/flows.test.mjs` — 39/39 pass, including the two new assertions. The new test in `templates/SPEC.md` describe block uses a per-section regex, so a missing section yields a precise failure.
- **Code quality**: PASS. Both files import `PRD_SECTIONS` rather than duplicating the list. Inline `sectionList` constant in flows.mjs is appropriately scoped.
- **Error handling**: N/A — pure string templating; PRD_SECTIONS is frozen and statically imported.
- **Performance**: N/A — one-time map/join per brief invocation.

## Evidence
- bin/lib/flows.mjs:8, 66-67, 83-87 — imports PRD_SECTIONS and renders section list in the brief.
- bin/lib/brainstorm-cmd.mjs:58-62 — prompt now advertises the same seven sections.
- test/flows.test.mjs:130-151 — assertions for both brief and templates/SPEC.md.
- Test output: 39 pass / 0 fail.

## Findings
No findings.
