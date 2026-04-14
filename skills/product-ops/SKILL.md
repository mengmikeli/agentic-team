---
name: product-ops
description: "Maintain product direction — prioritize backlog against goals, validate sprint outcomes against success metrics, update PRODUCT.md as vision evolves. Use when: deciding what to build next, after a sprint closes, product direction feels stale, or when someone says 'product status', 'what should we build next', 'did that sprint matter'."
---

# Product Ops

Ongoing product maintenance. Keeps PRODUCT.md honest and connects sprint work back to product goals.

**Announce at start:** "I'm using the product-ops skill to [prioritize/validate/maintain] product direction."

## Operations

### Prioritize

Rank the backlog by impact against PRODUCT.md goals:

1. **Read PRODUCT.md** — vision, users, problem, success metrics, roadmap
2. **Read SPRINTS.md** — what's shipped, what's active
3. **Gather candidates** — from roadmap items, filed issues, operator input
4. **Rank** — for each candidate, evaluate:
   - Impact on success metrics (high/medium/low)
   - Effort estimate (small/medium/large)
   - Dependencies (blocked by anything?)
   - Risk (does this bet on unknowns?)
5. **Recommend** — top 1-3 candidates for next sprint, with reasoning
6. **Offer** — "Want to brainstorm the top pick?" → brainstorm

Don't just list options. Make a recommendation and defend it.

### Validate

After a sprint closes, check outcomes against product goals:

1. **Read sprint SPEC.md and RETRO.md** — what was the goal, what shipped
2. **Read PRODUCT.md** — success metrics
3. **Evaluate** — did this sprint move the product toward its goals?
   - Which success metrics were affected?
   - Any metrics that should have moved but didn't?
   - Any unexpected outcomes (good or bad)?
4. **Report** — brief assessment: impact on product trajectory
5. **Update roadmap** — mark completed milestones, adjust ordering if priorities shifted

This is a lightweight check, not a formal review. One paragraph, not a document.

### Maintain

When product direction evolves:

- **Vision shift** → rewrite PRODUCT.md vision section, note what changed and why
- **New users discovered** → update Users section
- **Metric proved wrong** → update Success Metrics, note why the old metric didn't work
- **Roadmap reshuffle** → reorder milestones, archive completed items
- **Competitive change** → update Landscape section

These updates happen as side effects of other work (sprint close, operator input, market change), not as standalone tasks.

### Connect

Link sprint results back to product goals:

- At sprint close: "This sprint shipped X, which advances roadmap milestone Y"
- At retro: "Success metric Z hasn't moved in 3 sprints — worth discussing"
- At prioritization: "Roadmap item A directly addresses our top success metric"

Product context prevents sprints from drifting into busywork.

## Rules

- **Recommend, don't just list.** "Here are 5 options" is a search engine. "Build X next because it directly addresses your top success metric" is product ops.
- **Connect to metrics.** Every recommendation should reference PRODUCT.md success metrics. If it doesn't advance a metric, why are we doing it?
- **Fix, don't flag.** If PRODUCT.md is stale, update it now.
- **Lightweight validation.** One paragraph per sprint, not a report. Did it matter? Yes/no, here's why.
- **Respect the operator.** Product ops recommends. The operator decides.
