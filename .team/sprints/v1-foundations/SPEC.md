# agentic-team v1-foundations Completion Spec

> **For implementation:** Use orchestrate skill or subagent-driven-development to implement this plan task-by-task.

**Goal:** Complete the agentic-team framework — build remaining skills, update charter, validate by self-dogfooding.

**Architecture:** Three new skills (product-init, product-ops, brainstorm) complete the four-layer model. Charter rewritten to reflect orchestrate-driven execution. Validated by using the framework to build itself.

---

## Phase A: Build Skills

### A1: product-init

**Files:**
- Create: `skills/product-init/SKILL.md`

Interactive wizard that produces `.team/PRODUCT.md`:
- What is this product, who is it for, what problem does it solve
- Success metrics (how do we know it's working)
- Competitive context (what else exists, why this is different)
- Infer from repo/README where possible, confirm rather than ask
- One question at a time, multiple choice when possible
- Output: `.team/PRODUCT.md` with sections: Vision, Users, Problems, Success Metrics, Competitive Context, Roadmap (ordered backlog)
- If PRODUCT.md exists, offer to audit via product-ops instead
- After scaffolding, offer next steps: agent-init or sprint-init

### A2: product-ops

**Files:**
- Create: `skills/product-ops/SKILL.md`

Ongoing product maintenance:
- **Prioritize**: review backlog, rank by impact vs effort against PRODUCT.md goals, recommend next sprint
- **Validate**: after sprint close, check outcomes against success metrics — did the sprint move the product toward its goals?
- **Maintain**: update PRODUCT.md when vision/users/goals evolve, keep roadmap current
- **Connect**: link sprint results back to product goals in retro/close

### A3: brainstorm

**Files:**
- Create: `skills/brainstorm/SKILL.md`

Ported from superpowers brainstorming pattern, adapted for teams:
- One question at a time, propose 2-3 approaches with trade-offs, incremental validation
- Reads PRODUCT.md for product context (what are we building toward?)
- Reads AGENTS.md for team context (what roles do we have?)
- Scope check: if idea is too large for one sprint, help decompose into sub-sprints
- Output: SPEC.md in `.team/sprints/{id}/` — feeds sprint-init → orchestrate
- Process: explore context → clarifying questions → propose approaches → present design → write SPEC.md → user reviews
- No visual companion for v1
- No subagent spec-reviewer for v1
- Terminal state: invoke sprint-init

---

## Phase B: Charter Revision

### B1: CHARTER.md rewrite

**Files:**
- Modify: `CHARTER.md`

Rewrite compact charter to reflect current framework:
- Four-layer model (product → project → agent → sprint)
- Skill-driven workflow (init/ops pattern + orchestrate)
- Orchestrate-driven execution (human only at init + completion)
- Mechanical quality gates (exit codes, not LLM judgment)
- Metrics at sprint close
- "Mark blocked and skip" replaces "escalate to operator"
- Proactive communication (push status, never wait to be asked)
- Reference skill names explicitly (product-init, brainstorm, orchestrate, etc.)

### B2: charter/ targeted updates

**Files:**
- Modify: `charter/roles.md` — coordinator drives orchestrate, no mid-loop escalation
- Modify: `charter/phases.md` — orchestrate absorbs plan/execute/QA/ship into autonomous loop
- Modify: `charter/quality.md` — add mechanical gate definition, metrics
- Modify: `charter/failure.md` — retry → block → skip, no mid-loop escalation
- Skim: `charter/models.md`, `charter/conventions.md` — light fixes if needed

---

## Phase C: Validation

### C1: Run product-init on agentic-team

- Execute product-init on this repo
- Produce `.team/PRODUCT.md` for agentic-team itself
- Verify the skill works end-to-end

### C2: Brainstorm any remaining gaps

- Execute brainstorm skill on any issues found during C1
- Produce SPEC.md if there's work to do
- Or confirm framework is complete

### C3: Run orchestrate (if C2 produced work)

- sprint-init → orchestrate → sprint-ops close
- Capture any gaps in the orchestrate flow
- Fix in-flight

### C4: Fix gaps found during validation

- Update skills based on real usage
- Commit fixes

---

## Phase D: Close

### D1: sprint-ops close v1-foundations

- Capture metrics (commits, PRs, duration)
- Write shipped summary
- Update SPRINTS.md + PROJECT.md

### D2: Update README

- Final skill inventory
- Updated "how it works" section
- Getting started instructions

### D3: Tag v1.0

- `git tag v1.0`
- Push tag

---

## Out of Scope

- Playbook revision (deferred to post-validation)
- ClawHub packaging (after v1 validated)
- OpenClaw plugin code (v2)

## Done When

- [ ] product-init skill built
- [ ] product-ops skill built
- [ ] brainstorm skill built
- [ ] CHARTER.md rewritten for current framework
- [ ] charter/ files updated where they conflict
- [ ] Validation: product-init run on agentic-team
- [ ] Validation: at least one full brainstorm → sprint cycle completed
- [ ] README updated with final skill set
- [ ] v1.0 tagged
