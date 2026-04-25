# Engineer Eval — task-3 (SPEC.md required-section gate)

**Verdict: PASS**

## Evidence

- Read implementation at `bin/lib/run.mjs:925-957`.
- Read test additions at `test/cli-commands.test.mjs:287-345`.
- Ran `node --test test/cli-commands.test.mjs` → 39 pass / 0 fail, including:
  - `agt run with SPEC.md missing required sections exits non-zero, lists them, and does not modify file`
  - `agt run with complete SPEC.md proceeds past the section gate`
- Compared handshake claims (run.mjs + cli-commands.test.mjs touched) to `git show af0e668` — match exactly.

## Per-Criterion

1. **Exits non-zero on missing sections** — PASS. `process.exit(1)` at run.mjs:950; test asserts `exitCode === 1`.
2. **Lists missing sections** — PASS. Loop at run.mjs:945-947 emits `  - <Section>` to stderr; test verifies all five expected names appear.
3. **Does NOT modify SPEC.md** — PASS. Gate runs immediately after `readFileSync`; no write path is reachable before `process.exit`. Test reads file before/after and asserts equality.
4. **Does NOT plan or run tasks** — PASS. Gate precedes `planTasks` (run.mjs:961) and the flow loop. Test additionally asserts no populated `STATE.json.tasks`.
5. **Required-section list matches brainstorm template** — PASS. Same seven names exercised by the existing `brainstorm-cmd module` tests.
6. **Errors routed to stderr** — PASS. All four messages use `console.error`, consistent with the sibling missing-SPEC.md branch.

## Edge Cases Checked

- Regex `^##\s+${name}\s*$` with `m` flag anchors per-line and tolerates trailing whitespace; no section name contains regex metacharacters, so direct interpolation is safe.
- `###` headers will not satisfy the gate — intentional, matches brainstorm output.
- Case-sensitive match: `## goal` (lowercase) would fail. Acceptable since brainstorm emits canonical casing; not tested either way.
- Did not test: section header with trailing inline content (e.g. `## Goal — short`), which would currently fail the gate. Acceptable per scope.

## Findings

🔵 bin/lib/run.mjs:931-942 — Required-section list and the matching regex are duplicated with the brainstorm template; consider extracting `REQUIRED_SPEC_SECTIONS` to a shared module if/when a third caller appears.
🔵 bin/lib/run.mjs:941 — Regex is recompiled per section per invocation; trivial at n=7, just noting.

No 🔴. No 🟡.
