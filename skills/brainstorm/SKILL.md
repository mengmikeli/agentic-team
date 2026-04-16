---
name: brainstorm
description: "Explore an idea and produce an approved spec before any implementation begins. Loads product and team context, asks clarifying questions one at a time, proposes approaches with trade-offs, and writes SPEC.md. Use when: starting new work, exploring a feature idea, someone says 'let's build X', 'I have an idea', 'brainstorm', or any creative/planning discussion before code."
---

> **Requires:** `@mengmikeli/agentic-team` (`npm install -g @mengmikeli/agentic-team`) for mechanical enforcement via agt-harness.

# Brainstorm

The design phase. Takes a vague idea and turns it into an approved spec through structured exploration. No implementation happens until the spec is approved.

**Announce at start:** "I'm using the brainstorm skill to explore this idea before we commit to building it."

## Design Principles

1. **Spec before code.** No implementation without an approved design.
2. **One question at a time.** Don't overwhelm with a wall of questions.
3. **Propose, don't prescribe.** Present 2-3 approaches with trade-offs. Let the operator choose.
4. **Incremental validation.** Get approval per section, not one giant reveal at the end.
5. **Scope ruthlessly.** If it's too big for one sprint, decompose into sub-sprints. Ship something small first.

## Process

### Step 1: Load Context

Before asking anything, read:
- `.team/PRODUCT.md` — what are we building toward? (vision, users, success metrics)
- `.team/AGENTS.md` — what team do we have? (roles, capabilities)
- `.team/SPRINTS.md` — what's shipped? what's active? (avoid re-doing work)
- `.team/PROJECT.md` — what's the stack? (technical constraints)

If any of these are missing, note it but don't block. Brainstorming can happen before full setup.

### Step 2: Understand the Idea

Ask **one at a time**:

1. **What's the goal?** — What should exist when this is done? One sentence.
2. **Who benefits?** — Which users from PRODUCT.md? Or a new audience?
3. **What's the trigger?** — Why now? What changed or what hurts?

If the idea is already clear (operator gave a detailed brief), skip to Step 3. Don't re-ask what's already answered.

### Step 3: Scope Check

Evaluate size:
- **Small** (1-5 tasks, ships in hours) → proceed as single sprint
- **Medium** (5-15 tasks, ships in 1-2 days) → proceed, but flag scope risk
- **Large** (15+ tasks, multi-day) → propose decomposition into sub-sprints before continuing

If decomposing: identify the smallest useful first milestone. "What's the minimum that ships value?" Build that first.

### Step 4: Explore Approaches

Propose **2-3 approaches** with trade-offs:

```
### Approach A: {name}
{Description}
- ✅ {advantage}
- ✅ {advantage}
- ⚠️ {trade-off}
- Effort: {small/medium/large}

### Approach B: {name}
{Description}
- ✅ {advantage}
- ⚠️ {trade-off}
- ⚠️ {trade-off}
- Effort: {small/medium/large}
```

**Recommend one** with reasoning. Don't just list options — have an opinion.

Wait for operator to pick or modify before continuing.

### Step 5: Design in Detail

Walk through the chosen approach section by section:
- What components/files/features are involved?
- What's the architecture?
- What are the edge cases?
- What's explicitly out of scope?

Get approval **per section**. Don't design the whole thing and then present it.

### Step 6: Write SPEC.md

When the design is approved, write `.team/sprints/{id}/SPEC.md`:

```markdown
# {Sprint Name} — Spec

## Goal
{One sentence from Step 2}

## Architecture
{Chosen approach from Step 4, design details from Step 5}

## Scope
{What's included — concrete deliverables}

## Out of Scope
{What's explicitly excluded}

## Done When
- [ ] {Concrete, verifiable criterion}
- [ ] {Concrete, verifiable criterion}
- [ ] ...
```

### Step 7: Review and Approve

Present the spec to the operator:
- "Here's the spec. Review it — I'll wait for your approval before we start building."
- If changes requested → update spec → re-present
- If approved → proceed to sprint-init

### Step 8: Handoff

Once approved:
- **Invoke sprint-init** — creates sprint directory, updates tracking
- Sprint-init feeds into **orchestrate** for autonomous execution

The chain: **brainstorm → sprint-init → orchestrate**

## Rules

- **No implementation during brainstorming.** Not even "let me just prototype this real quick." Spec first, always.
- **One question at a time.** Seriously. Not two. Not "a couple quick ones." One.
- **Propose, don't ask "what do you want?"** — always bring options. "Here are 3 ways to do this, I recommend B because..." beats "How should we approach this?"
- **Scope is sacred.** If the operator wants to add scope mid-brainstorm, acknowledge it but explicitly flag the size change. "That adds ~5 more tasks — want to include it now or save for a follow-up sprint?"
- **Done-when must be verifiable.** "Works well" is not a criterion. "All 11 skills have valid YAML frontmatter and consistent structure" is.
- **If PRODUCT.md exists, use it.** Every recommendation should connect to product goals and success metrics. If it doesn't advance the product, ask why we're building it.
