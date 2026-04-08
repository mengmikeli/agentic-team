# agentic-team

A framework for running self-managing AI agent teams on software projects. Provides a charter (methodology), playbook (platform recipes), and workflow skills that guide agents from project setup through sprint completion.

Built for teams using [OpenClaw](https://openclaw.ai) + Discord + GitHub. Framework-agnostic for the code being built.

## What's in the box

- **Charter** — roles, execution models, workflow phases, quality gates, and principles. The compact version (`CHARTER.md`) is always loaded; detailed breakdowns live in `charter/`.
- **Playbook** — operational recipes for OpenClaw, Discord, and GitHub (`PLAYBOOK.md`).
- **Skills** — interactive workflow skills that guide agents through project and sprint lifecycle:

| Skill | Purpose |
|-------|---------|
| `project-init` | Scaffold a new project (interactive wizard) |
| `project-ops` | Maintain project config, detect drift |
| `agent-init` | Set up agent roles and team structure |
| `agent-ops` | Adjust roles, review effectiveness |
| `sprint-init` | Start a new sprint with proper tracking |
| `sprint-ops` | Close, update, pause sprints; reconcile tracking |

- **Templates** — reference templates for `.team/` files (PROJECT.md, AGENTS.md, SPRINTS.md, SPEC.md, PLAN.md, RETRO.md).

## How it works

1. **`project-init`** — asks about your project and scaffolds `.team/` with tailored config
2. **`agent-init`** — asks about your team and generates roles
3. **`sprint-init`** — starts a sprint with spec, tracking, and execution model
4. Agents follow the charter during implementation
5. **`sprint-ops`** keeps tracking in sync as work ships

The framework dogfoods itself — this repo's own `.team/` directory is managed by its own skills.

## Project structure

```
.team/              — this project's own tracking (dogfood)
charter/            — detailed methodology reference
skills/             — workflow skills (AgentSkills format)
templates/          — reference templates for .team/ files
CHARTER.md          — compact charter (always loaded)
PLAYBOOK.md         — platform operational recipes
```

## Getting started

Copy the `skills/` directory into your agent's skill path, or install individual skills. Then run `project-init` on your repo to get started.

Full charter and playbook are reference material — agents consult them as needed, guided by the skills.
