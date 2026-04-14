# agentic-team v1-foundations Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the agentic-team framework with 3 new skills + charter revision + self-validation.

**Architecture:** All work is markdown skill files — no code compilation, no tests to run. Quality gate is: skill follows the AgentSkills format (YAML frontmatter + markdown body), is internally consistent, and aligns with the rest of the framework.

**Tech Stack:** Markdown, SKILL.md format (AgentSkills spec)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `skills/product-init/SKILL.md` | Create | Interactive wizard → PRODUCT.md |
| `skills/product-ops/SKILL.md` | Create | Maintain product direction, prioritize, validate |
| `skills/brainstorm/SKILL.md` | Create | Idea → approved SPEC.md, adapted from superpowers |
| `CHARTER.md` | Rewrite | Compact charter reflecting current framework |
| `charter/roles.md` | Modify | Coordinator drives orchestrate, no mid-loop escalation |
| `charter/phases.md` | Modify | Orchestrate absorbs execution phases |
| `charter/quality.md` | Modify | Add mechanical gates, metrics |
| `charter/failure.md` | Modify | Retry → block → skip model |
| `.team/PRODUCT.md` | Create | Dogfood: product-init output for agentic-team itself |
| `.team/sprints/v1-foundations/SPEC.md` | Modify | Update done-when checklist |
| `README.md` | Modify | Final skill inventory |

---

## Task 1: Build product-init skill

**Files:**
- Create: `skills/product-init/SKILL.md`

**Reference:** Read existing init skills for pattern consistency:
- `skills/project-init/SKILL.md` (wizard pattern)
- `skills/agent-init/SKILL.md` (question flow)

- [ ] **Step 1: Write the skill file**

YAML frontmatter: name `product-init`, description triggers on "define product", "product vision", "who are we building for", "init product".

Body structure:
- Announce: "I'm using the product-init skill to define your product."
- Step 1 Discover: infer from repo (README, existing docs, PRODUCT.md). Questions one at a time:
  1. What does this product do? (one line)
  2. Who is it for? (target users)
  3. What problem does it solve for them?
  4. How will you know it's working? (success metrics)
  5. What else exists that does this? Why is yours different?
  6. What's the rough roadmap? (ordered priorities)
- Step 2 Scaffold: write `.team/PRODUCT.md` with sections: Vision, Users, Problem, Success Metrics, Landscape, Roadmap
- Step 3 Commit: `chore: init PRODUCT.md`
- Step 4 Offer next steps: agent-init, sprint-init, or brainstorm
- Rules: don't generate what you can infer, don't leave placeholders, if PRODUCT.md exists offer product-ops audit instead

- [ ] **Step 2: Verify consistency**

Check against project-init and agent-init — same announce pattern, same question-flow style, same rules section format.

- [ ] **Step 3: Commit**

```bash
git add skills/product-init/SKILL.md
git commit -m "feat: add product-init skill — interactive wizard for PRODUCT.md"
```

---

## Task 2: Build product-ops skill

**Files:**
- Create: `skills/product-ops/SKILL.md`

**Reference:** Read existing ops skills for pattern consistency:
- `skills/project-ops/SKILL.md`
- `skills/sprint-ops/SKILL.md`

- [ ] **Step 1: Write the skill file**

YAML frontmatter: name `product-ops`, description triggers on "prioritize backlog", "what should we build next", "product status", "validate outcomes", "review roadmap".

Body structure:
- Announce: "I'm using the product-ops skill to [prioritize/validate/maintain] product direction."
- Operations:
  - **Prioritize**: read PRODUCT.md (goals + success metrics) + SPRINTS.md (history) + backlog. Rank items by impact on product goals vs effort. Recommend next sprint with rationale.
  - **Validate**: after sprint close, compare outcomes against PRODUCT.md success metrics. Did the sprint move the needle? Update roadmap based on results.
  - **Maintain**: when vision/users/goals evolve, update PRODUCT.md. Keep roadmap ordered and current.
- Rules: derive priorities from PRODUCT.md goals (not vibes), update roadmap after every sprint, connect sprint outcomes to product metrics.

- [ ] **Step 2: Verify consistency**

Check against project-ops and sprint-ops — same operations format, same "fix don't flag" rule style.

- [ ] **Step 3: Commit**

```bash
git add skills/product-ops/SKILL.md
git commit -m "feat: add product-ops skill — prioritize, validate, maintain product direction"
```

---

## Task 3: Build brainstorm skill

**Files:**
- Create: `skills/brainstorm/SKILL.md`

**Reference:** Read for pattern porting:
- `~/.agents/skills/brainstorming/SKILL.md` (superpowers original — adapt, don't copy)
- `skills/product-init/SKILL.md` (question flow pattern from our framework)
- `skills/orchestrate/SKILL.md` (what brainstorm feeds into)

- [ ] **Step 1: Write the skill file**

YAML frontmatter: name `brainstorm`, description triggers on "brainstorm", "explore idea", "design this", "what should we build", "I have an idea". Must note: "Invoke before any implementation. Produces SPEC.md that feeds sprint-init → orchestrate."

Body structure:
- Announce: "I'm using the brainstorm skill to explore this idea."
- Hard gate: do NOT invoke orchestrate, sprint-init, or any implementation until spec is approved.
- Process:
  1. **Load context**: read PRODUCT.md (product goals), AGENTS.md (team), SPRINTS.md (history), recent git log
  2. **Scope check**: if idea spans multiple independent subsystems, decompose into sub-sprints first
  3. **Clarifying questions**: one at a time, multiple choice when possible. Focus on purpose, constraints, success criteria.
  4. **Propose 2-3 approaches**: with trade-offs and recommendation. Lead with recommended.
  5. **Present design**: in sections scaled to complexity. Get approval after each section.
  6. **Write SPEC.md**: save to `.team/sprints/{id}/SPEC.md`. Include: Goal, Scope, Out of Scope, Execution Model, Done When.
  7. **User reviews spec**: "Spec written. Review and let me know before we proceed."
  8. **Transition**: invoke sprint-init (which then invokes orchestrate).
- Key principles: one question at a time, YAGNI ruthlessly, explore alternatives, incremental validation
- Anti-patterns: jumping to implementation, dumping all questions at once, "this is too simple for a design"

- [ ] **Step 2: Verify consistency**

Confirm: output SPEC.md format matches what sprint-init expects. Transition chain: brainstorm → sprint-init → orchestrate.

- [ ] **Step 3: Commit**

```bash
git add skills/brainstorm/SKILL.md
git commit -m "feat: add brainstorm skill — idea exploration → approved SPEC.md"
```

---

## Task 4: Rewrite CHARTER.md

**Files:**
- Modify: `CHARTER.md`

**Reference:** Read current charter + all skills to ensure alignment:
- Current `CHARTER.md`
- `skills/orchestrate/SKILL.md` (execution model)
- `skills/product-init/SKILL.md` (product layer)
- `skills/brainstorm/SKILL.md` (design phase)

- [ ] **Step 1: Rewrite CHARTER.md**

Keep the compact format (always loaded). Sections:

1. **Layers** — product (why/what), project (where), agent (who), sprint (when/how). Each has init + ops skills.
2. **Roles** — Operator (human: direction + verification), Coordinator (agent: drives orchestrate), Implementers (agents/subagents: write code), QA (mechanical gates, not a role — embedded in orchestrate).
3. **Workflow** — human defines direction (product-init) → brainstorm → sprint-init → orchestrate (autonomous) → human verifies. Human is outside the execution loop.
4. **Execution Models** — keep the signal/model table. Add: orchestrate handles dispatch regardless of model.
5. **Quality** — mechanical gates (tests + types + build + lint). Exit code, not LLM judgment. The builder never evaluates its own work.
6. **Failure Handling** — retry with tighter brief → mark blocked → skip → continue. Never stall. No mid-loop escalation.
7. **Communication** — proactive (push status at every transition, phase summaries, anomaly alerts). Human never has to ask.
8. **Metrics** — captured at sprint close (commits, PRs, duration, tokens). Data-driven execution model selection.
9. **Files** — `.team/` structure including PRODUCT.md, STATE.json.
10. **Principles** — revise to reflect current framework. Keep ones that still apply, update ones that don't.

- [ ] **Step 2: Verify no contradictions with skills**

Read orchestrate, brainstorm, sprint-ops. Confirm charter doesn't say anything the skills contradict.

- [ ] **Step 3: Commit**

```bash
git add CHARTER.md
git commit -m "docs: rewrite CHARTER.md — four-layer model, orchestrate-driven execution"
```

---

## Task 5: Update charter/ detail files

**Files:**
- Modify: `charter/roles.md`
- Modify: `charter/phases.md`
- Modify: `charter/quality.md`
- Modify: `charter/failure.md`
- Skim: `charter/models.md`, `charter/conventions.md`

- [ ] **Step 1: Update roles.md**

- Coordinator: drives orchestrate, doesn't code, doesn't escalate mid-loop
- Remove QA as separate role — mechanical gates in orchestrate replace it
- Add: "Coordinator invokes skills in sequence: brainstorm → sprint-init → orchestrate → sprint-ops close"

- [ ] **Step 2: Update phases.md**

- Replace 5-phase model with: brainstorm → orchestrate (which contains plan + execute + verify + finish)
- Note that orchestrate is autonomous — human only at init and completion

- [ ] **Step 3: Update quality.md**

- Define mechanical gate: "a check computed by running a command and reading the exit code"
- Add metrics section: what to capture, why it matters
- Remove agent QA role references — gates are automated

- [ ] **Step 4: Update failure.md**

- Replace escalation model with: retry → tighten brief → block → skip → continue
- Remove "escalate to operator" from failure paths
- Add: "The loop always terminates on its own"

- [ ] **Step 5: Skim models.md and conventions.md**

- Fix any references to old escalation model
- Update file structure in conventions.md to include PRODUCT.md and STATE.json

- [ ] **Step 6: Commit**

```bash
git add charter/
git commit -m "docs: update charter/ detail files — orchestrate model, mechanical gates"
```

---

## Task 6: Validate — run product-init on agentic-team

**Files:**
- Create: `.team/PRODUCT.md`

- [ ] **Step 1: Run product-init on agentic-team**

Execute the product-init wizard on this repo. Answer based on what we know:
- Vision: framework for self-managing AI agent teams
- Users: developers/operators running AI agents on software projects
- Problem: agents can code but can't self-organize from idea to deliverable
- Success metrics: a project can go from "build X" to shipped deliverable with human only at init + completion
- Landscape: OPC (execution quality), superboss (team coordination), superpowers (solo workflow)
- Roadmap: v1 = skills + charter, v2 = OpenClaw plugin, v3 = ClawHub distribution

- [ ] **Step 2: Verify PRODUCT.md looks right**

- [ ] **Step 3: Commit**

```bash
git add .team/PRODUCT.md
git commit -m "chore: add PRODUCT.md — dogfood product-init"
```

---

## Task 7: Update README + close sprint

**Files:**
- Modify: `README.md`
- Modify: `.team/SPRINTS.md`
- Modify: `.team/PROJECT.md`

- [ ] **Step 1: Update README.md**

- Update skill table (11 skills: 8 existing + 3 new)
- Update "how it works" to show full flow: product-init → brainstorm → sprint-init → orchestrate → sprint-ops
- Add "absorbed into orchestrate" note for plan/execute/verify/finish

- [ ] **Step 2: sprint-ops close v1-foundations**

- Capture metrics: commits, PRs, duration
- Mark ✅ Done in SPRINTS.md with version v1.0
- Update PROJECT.md: version v1.0, clear active sprint

- [ ] **Step 3: Tag v1.0**

```bash
git tag v1.0
git push origin main --tags
```

- [ ] **Step 4: Commit**

```bash
git add README.md .team/
git commit -m "chore: close v1-foundations → v1.0"
```

---

## Summary

| Task | Files | Est. |
|------|-------|------|
| 1 — product-init | 1 create | 10 min |
| 2 — product-ops | 1 create | 10 min |
| 3 — brainstorm | 1 create | 15 min |
| 4 — CHARTER.md rewrite | 1 modify | 15 min |
| 5 — charter/ updates | 4-6 modify | 15 min |
| 6 — Validate (product-init dogfood) | 1 create | 5 min |
| 7 — README + close sprint | 3 modify + tag | 10 min |
| **Total** | **~13 files** | **~80 min** |
