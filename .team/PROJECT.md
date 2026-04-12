# agentic-team — Project Config

## What
Framework for running self-managing AI agent teams on software projects. Four layers — product (why/what), project (where), agent (who), sprint (when/how) — with interactive skills that guide setup and ongoing maintenance. Builds its own implementation workflow (brainstorm → plan → execute → verify → finish) rather than depending on external skill sets.

## Stack
Markdown + SKILL.md (AgentSkills format)

## Repo
[mengmikeli/agentic-team](https://github.com/mengmikeli/agentic-team) (public)

## Current Version
v0.1

## Active Sprint
v1-foundations

## Skills (7 built, 7 planned)

### Built ✅
| Skill | Layer | Purpose |
|-------|-------|---------|
| project-init | Project | Scaffold .team/ + README via interactive wizard |
| project-ops | Project | Maintain PROJECT.md, detect drift |
| agent-init | Agent | Set up team roles via interactive wizard |
| agent-ops | Agent | Adjust roles, retro input |
| sprint-init | Sprint | Start sprint with tracking |
| sprint-ops | Sprint | Close, update, pause, status |
| audit | Cross-cutting | Cross-layer health check |

### Planned
| Skill | Layer | Purpose |
|-------|-------|---------|
| product-init | Product | Vision, users, goals, success metrics |
| product-ops | Product | Roadmap, prioritize backlog, validate outcomes |
| brainstorm | Implementation | Explore idea → approved spec |
| plan | Implementation | Spec → ordered tasks with agent assignments |
| execute | Implementation | Dispatch tasks, track progress |
| verify | Implementation | Verify work before claiming done |
| finish | Implementation | Merge, tag, sprint-ops close |

## Other Deliverables
- CHARTER.md — methodology (compact overview + charter/ detailed reference)
- PLAYBOOK.md — platform recipes (OpenClaw + Discord + GitHub)
- templates/ — reference templates for .team/ files
