---
name: project-init
description: "Set up a new project for agentic team workflow. Interactive wizard that asks about the project (stack, repo, deploy, team) and scaffolds a tailored .team/ directory with PROJECT.md, AGENTS.md, SPRINTS.md. Use when: starting a new project, onboarding an existing project to the agentic-team framework, or when someone says 'set up a project', 'init project', 'onboard this repo'."
---

# Project Init

One-time interactive setup that scaffolds a `.team/` directory tailored to your project. Asks questions instead of handing you blank templates.

**Announce at start:** "I'm using the project-init skill to set up your project."

## Process

### Step 1: Discover

Ask these questions **one at a time** (don't dump them all at once):

1. **What is this project?** — one-line description
2. **Where's the code?** — check for existing repo, local path. If already has `.team/`, offer to audit instead (→ project-ops).
3. **What's the stack?** — language, framework, key deps. Can often be inferred from package.json/Cargo.toml/etc — confirm rather than ask.
4. **How do you deploy?** — staging + production targets. Or "not yet" is fine.
5. **Who's working on it?** — just you? team of agents? which roles? (→ feeds into agent-init later)
6. **Any visual identity or design constraints?** — skip if not relevant (CLI tools, libraries)

Infer what you can from the repo before asking. If there's a README, package.json, or existing docs — read them and confirm rather than asking from scratch.

### Step 2: Scaffold

Create project files:

```
README.md               — project overview (if missing or bare)
.team/
├── PROJECT.md          — filled in from discovery answers
├── AGENTS.md           — initial roles (can be refined via agent-init)
├── SPRINTS.md          — empty table, ready for first sprint
└── sprints/            — empty directory
```

**README.md** — generate if missing. Should answer: what is this, who is it for, how to use it. Keep it concise. If a README already exists and is adequate, leave it alone.

**PROJECT.md** — fill in all fields from discovery. Don't leave placeholders.

**AGENTS.md** — minimal roles based on team answer:
- Solo: just operator
- With agents: coordinator + operator + any mentioned specialties
- Can be expanded later via agent-init

**SPRINTS.md** — empty history table with project name. No fake entries.

### Step 3: Commit

```bash
git add .team/
git commit -m "chore: init .team/ — agentic team setup"
```

### Step 4: Offer Next Steps

After scaffolding, offer:
- **"Want to set up agent roles in detail?"** → agent-init
- **"Ready to start your first sprint?"** → sprint-init
- **"Want to review the charter first?"** → point to CHARTER.md

## Rules

- **Don't generate what you can infer.** Read the repo first.
- **Don't ask what you can confirm.** "I see this is a SvelteKit project — that right?" beats "What framework are you using?"
- **Don't leave placeholders.** If you don't know something, omit the field or mark it TBD — don't write `{fill this in}`.
- **Don't overscaffold.** No SPEC.md, PLAN.md, or RETRO.md at project init — those come from sprint-init when actual work starts.
- **If `.team/` already exists**, don't overwrite. Offer to audit via project-ops instead.
