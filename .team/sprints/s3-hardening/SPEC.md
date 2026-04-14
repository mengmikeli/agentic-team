# Sprint: s3-hardening

## Goal
Close every competitive gap identified from OPC, superboss, and pew analysis. Make the framework production-grade and validate end-to-end on a real coding project (LISSA).

## Scope
1. Gate runner — standard quality gate script template, invoked by orchestrate
2. Durable autonomous loop — oscillation detection, session resumption, tick budgets
3. Issue tracking integration — GitHub Issues + Project board, local fallback
4. Role separation enforcement — builder ≠ evaluator as structural rule
5. Document lifecycle — sprint dirs as lifecycle, linked from SPRINTS.md
6. Role templates — specialist prompts (PM, architect, security, devil's advocate, tester)
7. pew integration — concrete token tracking in sprint-ops close
8. Proactive notification protocol — concrete events + delivery mechanism in orchestrate
9. **Validation on LISSA** — full chain on a real backlog item with real tests + quality gates

## Out of scope
- Playbook revision (v1.1)
- ClawHub packaging (v1.2)
- OpenClaw plugin (v2.0)

## Execution model
Subagent swarm — sequential, well-specified tasks.

## Done when
- [ ] Gate runner template exists and is referenced by project-init + orchestrate
- [ ] Orchestrate handles oscillation detection + session resumption + tick budgets
- [ ] Issue tracking works (GitHub Issues or local TRACKER.md)
- [ ] Role separation enforced in orchestrate (dispatcher ≠ evaluator)
- [ ] Document lifecycle documented in conventions.md
- [ ] Role templates exist in roles/ and agent-init offers them
- [ ] sprint-ops close reads pew data when available
- [ ] Orchestrate has concrete notification protocol with defined events
- [ ] **Full chain validated on LISSA: brainstorm → orchestrate → quality gates → PR → human review**
