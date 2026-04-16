---
name: product-init
description: "Define the product vision, users, and success metrics for a project. Interactive wizard that infers from the repo, then asks targeted questions to produce PRODUCT.md. Use when: starting a new product, defining product direction, or when someone says 'define product', 'product vision', 'who are we building for'."
---

> **Requires:** `@mengmikeli/agentic-team` (`npm install -g @mengmikeli/agentic-team`) for mechanical enforcement via agt-harness.

# Product Init

One-time interactive setup that produces `.team/PRODUCT.md` — the product layer that answers *why* and *for whom* before projects, agents, and sprints figure out *how*.

**Announce at start:** "I'm using the product-init skill to define your product."

## Process

### Step 1: Discover

Before asking anything, **read the repo**:
- README, package.json, CHARTER.md, existing `.team/` files
- Infer: what it does, who it's for, what problem it solves
- If `.team/PRODUCT.md` already exists, offer to audit instead (→ product-ops)

Then ask **one at a time**:

1. **What does this product do?** — Confirm or correct what you inferred. One sentence.
2. **Who is it for?** — Primary users. Be specific (not "developers" — what kind, doing what?).
3. **What problem does it solve?** — The pain point that makes this worth building. What's broken without it?
4. **How do you know it's working?** — Success metrics. Concrete and measurable where possible (adoption, time saved, error reduction). "People use it" is too vague.
5. **What else exists?** — Competitive landscape. What do people use today? Why is this different or better?
6. **What's the roadmap?** — Ordered backlog of major milestones. What ships first, second, third?

Infer what you can. Confirm rather than ask from scratch.

### Step 2: Scaffold

Create `.team/PRODUCT.md`:

```markdown
# {Product Name} — Product Definition

## Vision
{One-paragraph description of what this product is and why it exists.}

## Users
{Who uses this, specifically. Not demographics — roles, contexts, needs.}

## Problem
{The pain point. What's broken or missing without this product.}

## Success Metrics
{How you know the product is working. Concrete, measurable where possible.}

## Landscape
{What else exists. Why this is different.}

## Roadmap
{Ordered milestones. What ships in what order.}
1. {Milestone} — {brief description}
2. {Milestone} — {brief description}
3. ...
```

Don't leave placeholders. If something is genuinely unknown, omit the section with a note: `TBD — not enough context yet`.

### Step 3: Commit

```bash
git add .team/PRODUCT.md
git commit -m "chore: add PRODUCT.md — product definition"
```

### Step 4: Offer Next Steps

- **"Want to set up the project?"** → project-init
- **"Want to define agent roles?"** → agent-init
- **"Ready to start building?"** → brainstorm or sprint-init

## Rules

- **Don't generate what you can infer.** Read the repo first.
- **Don't ask what you can confirm.** "I see this is a framework for agent teams — that right?" beats "What does your product do?"
- **Don't leave placeholders.** Fill it in or omit with a note.
- **Product ≠ project.** PRODUCT.md is *why* and *for whom*. PROJECT.md is *where* and *how* (stack, deploy, repo). Don't duplicate.
- **If PRODUCT.md already exists**, don't overwrite. Offer product-ops instead.
- **Success metrics must be concrete.** Push back on vague metrics. "Users find it useful" → "Teams adopt it for >1 sprint without reverting to ad-hoc."
