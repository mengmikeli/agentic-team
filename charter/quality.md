# Quality

## Mechanical Gates

Quality gates are **mechanical** — computed by tools, not judged by agents. The orchestrator runs the gate command and reads the exit code. Pass = 0, fail = non-zero. No interpretation.

### For code projects

Every task completion must pass the project's gate:

```bash
# Defined in .team/PROJECT.md under "Quality Gate"
npm test && npm run check && npm run build
```

If no gate is defined, fall back to: tests pass + build succeeds.

### For non-code projects (markdown, skills, docs)

Quality checks are structural:
- Valid YAML frontmatter (skills)
- Consistent structure with existing files
- No broken cross-references
- Files exist where referenced

### Gate characteristics

- **Binary.** Pass or fail. No "close enough."
- **Automated.** Run by orchestrate after each task. No manual step.
- **Non-negotiable.** A failing gate blocks task completion. The task gets retried or marked blocked.
- **Project-specific.** Each project defines its own gate command in PROJECT.md.

## Definition of Done

A single canonical checklist for every sprint:

- [ ] All tasks attempted (completed or explicitly blocked with reason)
- [ ] Mechanical gates pass on all completed tasks
- [ ] Spec updated if implementation deviated from plan
- [ ] Completion report generated with metrics
- [ ] Operator reviews and approves deliverable

## Metrics

Captured at sprint close. Metrics make execution model decisions data-driven.

| Metric | Source | Why |
|--------|--------|-----|
| Commits | `git log --oneline` | Volume of work |
| PRs merged | `gh pr list --state merged` | Deliverable count |
| Duration | Start → close dates | Calendar time |
| Tasks completed vs blocked | STATE.json | Execution effectiveness |
| Execution model | SPEC.md | Model selection data |

### Using metrics

- **Execution model selection** — compare cost/speed across sprints with different models
- **Anomaly detection** — if a sprint burns 3x usual effort, investigate
- **Budget planning** — after a few sprints, you know roughly what a sprint costs

Metrics are descriptive, not punitive. Track to learn, not to blame.

## No Separate QA Phase

Previous iterations had a dedicated QA agent and QA phase. This is replaced by:

1. **Mechanical gates** — automated checks after each task (during orchestrate)
2. **Operator review** — human verifies the final deliverable

This eliminates the bottleneck of a QA agent judging work quality (subjective, slow, unreliable) in favor of computed checks (objective, fast, deterministic).
