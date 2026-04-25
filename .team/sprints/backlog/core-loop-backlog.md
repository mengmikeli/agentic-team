# Core Loop Backlog — Groomed 2026-04-25

Priority: P0 = blocks production runs, P1 = causes manual work, P2 = nice to have

## P0 — Blocks Production

### doctor-auto-fix.md ✅ (logged)
`agt doctor --fix` auto-heals known patterns at phase boundaries.
Fake-done revert, stale dir cleanup, worktree prune, orphan issue close.

### GitHub-native state (STATE.json → GitHub source of truth)
STATE.json keeps drifting from reality. Push to GitHub at every checkpoint,
local cache is disposable. `state-sync.mjs` exists but not fully wired.
Eliminates the entire class of stale-state bugs.

### Outcome review agent file editing
Agent brief must say "Do NOT modify any files." Currently the agent
can bypass `markRoadmapItemDone` by editing PRODUCT.md directly.
**Fixed in c6e355a** but needs a test to prevent regression.

## P1 — Causes Manual Work

### Worktree cleanup on feature completion
`agt finalize` should prune the feature's worktree and delete the branch.
Currently worktrees accumulate and cause "already in use" errors on re-runs.

### Feature slug consistency
Outer loop and inner loop must always use the same slug.
`explicitSlug` param added but the outer loop sometimes creates SPEC.md
in a short-slug dir while inner loop creates STATE.json in a long-slug dir.
Need: single `slugify()` call, one place, one result.

### Compound gate fabricated-refs tuning
Fixed the >30% threshold and worktree root check. But the detector
still doesn't understand reviewer eval artifacts. Needs a test suite
with known good/bad eval texts to prevent regression.

### Dashboard reconciliation performance
`readFeatures` runs `pgrep` + `lsof` on every API request.
Should cache the result for 10-30 seconds instead of per-request.

### Review cost ratio tracking
Analytics shows 88% on review. Need to track this per-model so we can
compare Sonnet 4.6 vs Opus 4.7 review efficiency.

## P2 — Nice to Have

### Checkpoint notification on Discord
Dogfood pause should send a message to the configured channel
so the human knows without checking the dashboard.

### Dashboard: light/dark token cost comparison
Show before/after when model changes (Sonnet → Opus baseline comparison).

### `agt report --compare` 
Compare two features' analytics side by side.

### Feature retry limit
After N failed attempts on the same feature, skip it and move on
instead of resetting and trying forever.

### Progress.md structured format
Currently free-text with regex parsing. Should be structured JSON
appendix or a separate `run-log.jsonl` for reliable analytics.
