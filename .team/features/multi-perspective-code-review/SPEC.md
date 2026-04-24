# Feature: Multi-Perspective Code Review

## Goal
Run six specialist reviewers (architect, engineer, product, tester, security, simplicity) in parallel during the multi-review phase and synthesize their findings into a single report ranked by severity.

## Scope

- **Six review roles** dispatched in parallel during the `multi-review` flow phase:
  - `architect` — system design, modularity, boundaries, patterns
  - `engineer` — implementation quality, correctness, maintainability
  - `product` — user value, requirements fit, acceptance criteria
  - `tester` — test coverage, edge cases, regression risk
  - `security` — threat surface, input validation, secrets, permissions
  - `simplicity` — dead code, premature abstraction, unnecessary indirection, gold-plating

- **Role definition files** at `roles/<role>.md` for all six roles. Each file describes the role's focus areas, what triggers a critical finding, and what to look for. Existing role files (architect, security, tester, pm/product) are updated or created as needed; `engineer` and `simplicity` are new.

- **Role-specific context injection**: each reviewer's brief includes the content of its `roles/<role>.md` file so reviewers operate from a stable, repeatable definition rather than inline instructions.

- **Merged synthesis report**: after all six reviewers complete, findings are merged into a single `eval.md`. Findings are sorted severity-first: critical → warning → suggestion. Each finding is prefixed with its source role (e.g. `[security] 🔴 ...`).

- **Per-role summary header** in the merged report: one line per role showing role name, verdict (PASS / critical / warning), and finding counts.

- **Verdict rule**: FAIL if any reviewer produces ≥1 critical finding. PASS otherwise. Backlog warnings are tracked as before.

- **`PARALLEL_REVIEW_ROLES` constant** updated to include all six roles.

- **All existing tests continue to pass.**

## Out of Scope

- Simplicity veto (simplicity warnings escalating to FAIL) — that is feature #15.
- Max review rounds and human escalation after round 3 — that is feature #19.
- Document-driven development / PRD templates — that is feature #17.
- Adding roles beyond the six listed above.
- Changing the gate mechanism or verdict computation for non-multi-review flows.
- Role selection UI or per-feature role configuration.

## Done When

- [x] `roles/architect.md`, `roles/engineer.md`, `roles/product.md`, `roles/tester.md`, `roles/security.md`, and `roles/simplicity.md` all exist with substantive focus descriptions.
- [x] `PARALLEL_REVIEW_ROLES` in `flows.mjs` contains all six roles: `["architect", "engineer", "product", "tester", "security", "simplicity"]`.
- [x] `buildReviewBrief()` injects the content of `roles/<role>.md` into each reviewer's brief.
- [ ] The merged `eval.md` produced by a multi-review run lists findings in severity order (all criticals before warnings before suggestions) with role prefix on each finding.
- [ ] The merged `eval.md` includes a per-role summary section at the top showing verdict and finding counts for each of the six roles.
- [ ] A unit test verifies that findings from multiple roles are merged and sorted correctly by severity.
- [ ] An integration test runs the multi-review phase against a fixture task and confirms all six role names appear in the output.
- [ ] All existing tests pass.
