# agentic-team v1-foundations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete agentic-team framework AND prove it works end-to-end — from "build X" to shipped deliverable with autonomous agent execution.

**Architecture:** Build remaining skills, update charter, then run the full chain on a real deliverable (agentic-team's own PRODUCT.md + remaining gaps). The plan isn't done when skills exist — it's done when the chain has produced a real shipped result.

**Success criteria:** The orchestrate skill autonomously plans tasks, dispatches agents, runs quality gates, reports progress, and produces a PR — with human only at spec approval and final review.

---

## Phase A: Complete the Skill Set

### Task 1: Build product-init

**Files:**
- Create: `skills/product-init/SKILL.md`

**Reference:** `skills/project-init/SKILL.md` (wizard pattern), `skills/agent-init/SKILL.md` (question flow)

- [ ] **Step 1:** Write skill file. YAML triggers: "define product", "product vision", "who are we building for". Body: discover (infer from repo, then ask one question at a time: what it does, who it's for, what problem, success metrics, landscape, roadmap) → scaffold PRODUCT.md → commit → offer next steps.
- [ ] **Step 2:** Verify consistency with project-init/agent-init patterns.
- [ ] **Step 3:** Commit: `feat: add product-init skill`

### Task 2: Build product-ops

**Files:**
- Create: `skills/product-ops/SKILL.md`

**Reference:** `skills/project-ops/SKILL.md`, `skills/sprint-ops/SKILL.md` (ops patterns)

- [ ] **Step 1:** Write skill file. Operations: Prioritize (rank backlog by PRODUCT.md goals), Validate (compare sprint outcomes to success metrics), Maintain (update PRODUCT.md as vision evolves).
- [ ] **Step 2:** Verify consistency with other ops skills.
- [ ] **Step 3:** Commit: `feat: add product-ops skill`

### Task 3: Build brainstorm

**Files:**
- Create: `skills/brainstorm/SKILL.md`

**Reference:** `~/.agents/skills/brainstorming/SKILL.md` (superpowers — adapt, don't copy), `skills/orchestrate/SKILL.md` (what brainstorm feeds into)

- [ ] **Step 1:** Write skill file. Port superpowers pattern: load context (PRODUCT.md + AGENTS.md + SPRINTS.md) → scope check → clarifying questions (one at a time) → propose 2-3 approaches → present design → write SPEC.md → user reviews → invoke sprint-init. Hard gate: no implementation until spec approved.
- [ ] **Step 2:** Verify SPEC.md output format matches sprint-init expectations. Confirm chain: brainstorm → sprint-init → orchestrate.
- [ ] **Step 3:** Commit: `feat: add brainstorm skill`

---

## Phase B: Update Charter

### Task 4: Rewrite CHARTER.md

**Files:**
- Modify: `CHARTER.md`

**Reference:** All skills (for alignment), current charter (for structure)

- [ ] **Step 1:** Rewrite. Sections: Layers (product→project→agent→sprint), Roles (operator + coordinator + implementers, no separate QA), Workflow (human defines direction → brainstorm → orchestrate autonomous → human verifies), Execution Models (keep signal table), Quality (mechanical gates), Failure (retry→block→skip, no escalation), Communication (proactive push), Metrics (sprint close), Files (.team/ structure incl PRODUCT.md + STATE.json), Principles (updated).
- [ ] **Step 2:** Verify no contradictions with orchestrate, brainstorm, sprint-ops skills.
- [ ] **Step 3:** Commit: `docs: rewrite CHARTER.md`

### Task 5: Update charter/ detail files

**Files:**
- Modify: `charter/roles.md`, `charter/phases.md`, `charter/quality.md`, `charter/failure.md`
- Skim: `charter/models.md`, `charter/conventions.md`

- [ ] **Step 1:** roles.md — coordinator drives orchestrate, no mid-loop escalation, QA is mechanical gates not a role.
- [ ] **Step 2:** phases.md — orchestrate absorbs plan/execute/QA/ship into autonomous loop.
- [ ] **Step 3:** quality.md — define mechanical gate (exit code check), add metrics.
- [ ] **Step 4:** failure.md — retry → block → skip → continue. Loop always terminates.
- [ ] **Step 5:** Skim models.md, conventions.md — fix stale references, add PRODUCT.md and STATE.json to file structure.
- [ ] **Step 6:** Commit: `docs: update charter/ detail files`

---

## Phase C: End-to-End Validation

This is the real test. Use the framework to produce a real deliverable on agentic-team itself.

### Task 6: Run product-init on agentic-team

**Files:**
- Create: `.team/PRODUCT.md`

- [ ] **Step 1:** Execute product-init. Produce PRODUCT.md for agentic-team: vision (self-managing agent teams), users (developers running AI agents), problem (agents can code but can't self-organize), success metrics (idea → deliverable with human only at init + completion), landscape (OPC, superboss, superpowers), roadmap.
- [ ] **Step 2:** Verify PRODUCT.md is complete and useful.
- [ ] **Step 3:** Commit: `chore: add PRODUCT.md — dogfood product-init`

### Task 7: Run brainstorm → sprint-init → orchestrate

This is the keystone validation. Pick a real deliverable and run the full autonomous chain.

**The deliverable:** The README needs to be rewritten to reflect the final framework (11 skills, four-layer model, autonomous execution, full workflow). This is small enough to complete in one cycle but real enough to test the chain.

- [ ] **Step 1: Brainstorm** — Run brainstorm skill on "rewrite README for v1.0 launch." Load PRODUCT.md for context. Produce SPEC.md with: goal, scope (what the README should cover), done-when criteria.

- [ ] **Step 2: sprint-init** — Create sprint `s2-readme-v1` from the SPEC. Update SPRINTS.md + PROJECT.md. Create GitHub Issue for the task.

- [ ] **Step 3: Orchestrate** — Let orchestrate take over:
  - Plans the task(s) — may be 1 task (rewrite README) or multiple (rewrite + update cross-references)
  - Dispatches agent/subagent to do the work
  - Runs quality gate: does the README render? Does it cover all 11 skills? Does it describe the workflow?
  - If gate passes → PR
  - If gate fails → retry with feedback
  - Pushes progress updates to channel
  - Writes STATE.json

- [ ] **Step 4: Human review** — Mike reviews the PR. Either:
  - Accept → merge, sprint-ops close with metrics, tag
  - Not complete → new loop (fix specific issues)

- [ ] **Step 5: Capture learnings** — Document what worked and what broke:
  - Did orchestrate dispatch correctly?
  - Did quality gates catch real issues?
  - Did state persist properly?
  - Did progress updates arrive proactively?
  - What needs fixing in which skill?

### Task 8: Fix gaps found during validation

**Files:** Whatever broke.

- [ ] **Step 1:** Review learnings from Task 7 Step 5.
- [ ] **Step 2:** Fix skill files that need adjusting.
- [ ] **Step 3:** Commit fixes.

---

## Phase D: Close

### Task 9: Close v1-foundations

- [ ] **Step 1:** sprint-ops close v1-foundations — capture metrics (commits, PRs, duration, days since Apr 1).
- [ ] **Step 2:** Update SPRINTS.md — mark ✅ Done, version v1.0.
- [ ] **Step 3:** Update PROJECT.md — version v1.0, clear active sprint.
- [ ] **Step 4:** Tag: `git tag v1.0 && git push origin main --tags`
- [ ] **Step 5:** Commit: `chore: close v1-foundations → v1.0`

---

## Summary

| Task | Phase | What | Est. |
|------|-------|------|------|
| 1 — product-init | A | Build skill | 10 min |
| 2 — product-ops | A | Build skill | 10 min |
| 3 — brainstorm | A | Build skill | 15 min |
| 4 — CHARTER.md | B | Rewrite | 15 min |
| 5 — charter/ files | B | Targeted updates | 15 min |
| 6 — product-init dogfood | C | Run on agentic-team | 5 min |
| 7 — **Full chain test** | C | brainstorm → orchestrate → ship | 30 min |
| 8 — Fix gaps | C | Whatever broke | 15 min |
| 9 — Close sprint | D | Metrics, tag v1.0 | 10 min |
| **Total** | | | **~125 min** |

## Done When

- [ ] All 11 skills built and committed
- [ ] CHARTER.md reflects four-layer model + orchestrate
- [ ] charter/ detail files updated
- [ ] PRODUCT.md exists for agentic-team (dogfood)
- [ ] **Full chain validated: brainstorm → sprint-init → orchestrate → quality gate → PR → human review**
- [ ] Gaps found during validation are fixed
- [ ] SPRINTS.md shows v1-foundations ✅ Done with metrics
- [ ] README reflects final framework
- [ ] v1.0 tagged
