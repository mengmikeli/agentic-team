---
name: sprint-ops
description: "Manage active sprints — close completed sprints, update phase progress, check tracking accuracy, capture metrics. Use when: a sprint finishes, a PR merges that completes sprint work, tracking feels stale, or when someone says 'close sprint', 'sprint status', 'update sprint', 'are we on track'. Pairs with finishing-a-development-branch."
---

# Sprint Ops

Ongoing sprint management. Keeps SPRINTS.md and SPEC.md in sync with reality.

**Announce at start:** "I'm using the sprint-ops skill to [close/update/check] sprint tracking."

## Operations

### Close

When a sprint's work has shipped:

1. **Verify** — all "Done when" items in SPEC.md are checked off
2. **Write shipped summary** — derive from git log and merged PRs, not from memory:
   ```bash
   git log --oneline --since="{start}" main
   ```
3. **Capture metrics** — see Metrics section below
4. **Update SPRINTS.md** — mark `✅ Done`, set version + dates + metrics
5. **Update PROJECT.md** — bump version, clear active sprint
6. **Commit** — `chore: close sprint {id} → v{version}`

If work from other planned sprints shipped inside this one, note it explicitly. (Anti-pattern: S6/S7 shipping inside S5 without tracking.)

### Update

When a PR merges that completes a sprint phase:

1. **Check off** the item in SPEC.md "Done when"
2. **Update SPRINTS.md** phase status if tracked there
3. **Include in merge commit** — not a separate PR

Lightweight. Just checkbox updates.

### Status

Compare tracking against reality:

1. Read SPRINTS.md active sprint
2. Read SPEC.md "Done when" checklist
3. Check git log / merged PRs for work matching spec items
4. Check metrics if available — token usage trending, anomalies
5. Report:
   - Items SPRINTS.md says pending but actually shipped
   - Planned future sprints whose work already landed
   - Untracked work on main that should be attributed
   - Cost anomalies (sudden spikes in token usage)

**Fix drift immediately.** Don't report and move on.

### Pause

When switching to different work mid-sprint:

1. Note current state in SPEC.md (what's done, what's left)
2. Update SPRINTS.md — mark `⏸ Paused`
3. Update PROJECT.md active sprint

## Metrics

Capture at sprint close and optionally during status checks. Metrics make execution model decisions data-driven instead of gut-feel.

### What to Capture

At sprint close, record in SPRINTS.md:

| Metric | Source | Why it matters |
|--------|--------|---------------|
| **Commits** | `git log --oneline --since="{start}" main \| wc -l` | Volume of work |
| **PRs merged** | `gh pr list --state merged --search "merged:>{start}"` | Deliverable count |
| **Duration** | Start → close dates | Calendar time spent |
| **Execution model** | SPEC.md | What model was used (swarm/team/hybrid) |
| **Agent sessions** | pew or session logs (if available) | How many agent runs it took |
| **Token usage** | pew sync data or session metadata (if available) | Compute cost |
| **Tests added** | `git diff --stat` on test files | Quality investment |

### SPRINTS.md Format

Extended table with metrics columns:

```markdown
| Sprint | Status | Version | Dates | Commits | PRs | Model |
|--------|--------|---------|-------|---------|-----|-------|
| s5-release-polish | ✅ Done | v4.2 | Apr 1–7 | 96 | 12 | Hybrid |
```

Don't force metrics you can't easily gather. Start with commits + PRs + duration (always available from git). Add token usage when tooling supports it.

### Sprint SPEC.md Metrics Section

Add to SPEC.md at close:

```markdown
## Metrics
- Commits: {N}
- PRs merged: {N}
- Duration: {N} days
- Token usage: {N} (if available)
- Execution model: {swarm/team/hybrid}
```

### Using Metrics

**Execution model selection** — compare cost/speed across sprints that used different models. "Subagent swarm: 25 tasks in 2.5h, 800K tokens. Multi-agent team: 8 tasks in 3 days, 1.2M tokens."

**Agent efficiency** — if one agent consistently takes more tokens per deliverable, investigate (bad prompts? wrong model? scope too big?).

**Budget planning** — after a few sprints, you'll know roughly what a sprint costs. Set soft budgets: "this sprint should be ~500K tokens; alert at 80%."

**Anomaly detection** — if a sprint suddenly burns 3x the usual tokens, something drifted (scope creep, agent spinning, unclear spec). Trigger an audit.

### Integration Points

- **pew installed?** Pull token data from `~/.config/pew/` at sprint close
- **Session logs available?** Count agent sessions from OpenClaw session history
- **Neither?** Just use git metrics (commits, PRs, duration) — still valuable

## Rules

- **Fix, don't flag.** If tracking is wrong, correct it now.
- **Derive from reality.** Shipped summary comes from git log, not from what the spec hoped for.
- **One active sprint.** Close or pause before starting another.
- **Attribute correctly.** If S6 work ships inside S5, say so.
- **Metrics are descriptive, not punitive.** Track to learn, not to blame.
