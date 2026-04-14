# agentic-team — Project Config

## What
Framework for running self-managing AI agent teams on software projects. Four layers — product (why/what), project (where), agent (who), sprint (when/how) — with an autonomous execution engine that drives sprints from approved spec to deliverable without human intervention.

## Stack
Markdown + SKILL.md (AgentSkills format)

## Repo
[mengmikeli/agentic-team](https://github.com/mengmikeli/agentic-team) (public)

## Current Version
v0.1

## Active Sprint
v1-foundations

## Skills (8 built, 3 planned)

### Built ✅
| Skill | Layer | Purpose |
|-------|-------|---------|
| project-init | Project | Scaffold .team/ + README via interactive wizard |
| project-ops | Project | Maintain PROJECT.md, detect drift, metrics |
| agent-init | Agent | Set up team roles via interactive wizard |
| agent-ops | Agent | Adjust roles, efficiency review, retro input |
| sprint-init | Sprint | Start sprint with tracking |
| sprint-ops | Sprint | Close (with metrics), update, pause, status |
| orchestrate | Execution | Autonomous loop: plan → dispatch → gate → finish |
| audit | Cross-cutting | Cross-layer health check + cost anomalies |

### Planned
| Skill | Layer | Purpose |
|-------|-------|---------|
| product-init | Product | Vision, users, goals, success metrics |
| product-ops | Product | Roadmap, prioritize backlog, validate outcomes |
| brainstorm | Implementation | Explore idea → approved spec (pre-orchestrate) |

### Absorbed into orchestrate
| Original | Now handled by |
|----------|---------------|
| plan | orchestrate (planning phase) |
| execute | orchestrate (dispatch loop) |
| verify | orchestrate (mechanical gates) |
| finish | orchestrate (completion phase) |

## Other Deliverables
- CHARTER.md — methodology (compact overview + charter/ detailed reference)
- PLAYBOOK.md — platform recipes (OpenClaw + Discord + GitHub)
- templates/ — reference templates for .team/ files
