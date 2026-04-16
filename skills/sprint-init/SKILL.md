---
name: sprint-init
description: "Start a new sprint. Creates sprint directory, SPEC.md, updates SPRINTS.md and PROJECT.md. Interactive — asks about goal, scope, execution model before scaffolding. Use when: starting new work, kicking off a sprint, or when someone says 'start sprint', 'new sprint', 'init sprint', 'let's build X'. Should be invoked after brainstorming produces a spec."
---

> **Requires:** `@mengmikeli/agentic-team` (`npm install -g @mengmikeli/agentic-team`) for mechanical enforcement via agt-harness.

# Sprint Init

Start a new sprint with proper tracking. Called once per sprint, before any implementation work begins.

**Announce at start:** "I'm using the sprint-init skill to set up this sprint."

## Process

### Step 1: Determine Sprint Identity

If coming from a brainstorming session with an approved spec:
- Derive sprint name and goal from the spec
- Confirm with the user

If starting fresh:
1. **What are we building?** — one-line goal
2. **What's in scope?** — key deliverables
3. **What's out of scope?** — explicitly excluded (prevents creep)

### Step 2: Sprint ID

Generate next sequential ID + kebab-case name:
- Check `.team/SPRINTS.md` for latest sprint number
- Propose: `s{N+1}-{name}` (e.g., `s8-ios-app-store`)
- Confirm with user

### Step 3: Execution Model

Ask (or infer from scope):
- **Subagent swarm** — sequential, clear spec, ship fast
- **Multi-agent team** — parallel, creative, multi-day
- **Hybrid** — critical path + side quests
- **Solo** — small enough for one agent

### Step 4: Scaffold

Create:

```
.team/sprints/{id}/
└── SPEC.md     — filled in from discovery
```

**SPEC.md contents:**
```markdown
# Sprint: {ID} — {Title}

## Goal
{One sentence from discovery}

## Scope
{Deliverables from discovery}

## Out of scope
{Exclusions from discovery}

## Execution model
{Model + reasoning}

## Done when
- [ ] {Concrete, verifiable criteria}
```

### Step 5: Update Tracking

1. **SPRINTS.md** — add row: `| {id} | 🔄 Active | — | {today}– | {model} |`
2. **PROJECT.md** — set `Active Sprint` to new sprint

### Step 6: Commit

```bash
git add .team/
git commit -m "chore: init sprint {id}"
```

### Step 7: Offer Next Steps

- **"Want to write the implementation plan?"** → writing-plans skill
- **"Ready to start building?"** → executing-plans or subagent-driven-development

## Rules

- **One active sprint per project.** If another sprint is active, close or pause it first.
- **Don't skip scope and out-of-scope.** This is where creep gets prevented.
- **Done-when must be verifiable.** "Make it good" is not a criterion. "All tests pass, deployed to staging" is.
- **If a spec already exists** (from brainstorming), don't re-ask — use it.
