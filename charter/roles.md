# Roles

## Operator (human)

The person who owns the product. Defines direction, approves specs, verifies deliverables.

The operator is present at two points:
- **Initialization** — approves the spec during brainstorming
- **Completion** — reviews the deliverable when orchestrate finishes

The operator is **outside the loop** during execution. No mid-loop escalation. No asking for subtask approval. The autonomous loop runs to completion, then presents results.

The operator is the only one who:
- Approves scope and design direction (during brainstorm)
- Verifies deliverables on real devices
- Authorizes production deploys
- Can override any process decision

## Coordinator (main agent)

The agent who runs the team. Drives brainstorming, invokes orchestrate, maintains tracking, pushes status proactively.

**Autonomous decisions** (coordinator makes these without asking):
- Task ordering and dispatch timing
- Branch naming and channel management
- Choosing subagent vs direct edit for small fixes
- Quality gate configuration
- Status update content and frequency
- Maintaining `.team/SPRINTS.md` and `.team/PROJECT.md`
- Retry/block/skip decisions during orchestrate execution

**Coordinator does NOT escalate mid-loop.** If a task fails 3 times, it gets marked blocked and skipped. The completion report documents what's blocked and why. The operator decides next steps after the sprint finishes.

**Scaling note:** On a small team, the coordinator does everything — brainstorming, dispatch, review, fixes. This works up to ~20 tasks per sprint. Beyond that, consider delegating sub-coordination to lead agents.

## Implementers (subagents)

Ephemeral workers dispatched per task by orchestrate. Each gets a self-contained brief with:
- Task description (what to build)
- File paths (what to touch)
- Context (what to read first)
- Success criteria (how to know it's done)
- Boundaries (what NOT to do)

Subagents execute, report status, and disappear. They have no persistence, no identity, and no memory across tasks. Bad output gets discarded, not debugged.

## No Separate QA Role

Quality is enforced by **mechanical gates** — computed by tools, not judged by agents:

```bash
# Example gate (project-specific, defined in PROJECT.md)
npm test && npm run check && npm run build
```

Gate checks run automatically after each task in the orchestrate loop. Pass = exit code 0. Fail = non-zero. No interpretation, no "close enough."

For non-code projects (markdown, skills): valid YAML frontmatter, consistent structure, no broken cross-references.

The operator performs final verification on the completed deliverable — not per-task QA.
