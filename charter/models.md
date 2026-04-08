# Execution Models

## Subagent Swarm

The coordinator dispatches one subagent at a time. Each gets an exact task description with file paths, code examples, and success criteria. Sequential execution on a single branch.

**Use when:**
- Tasks have sequential dependencies
- Architecture refactor or migration
- Need to ship in hours, not days
- Spec is clear and tasks are mechanical
- Operator is available for quick decisions

**How it works:**
1. Coordinator writes spec + plan with bite-sized tasks
2. Dispatches subagent for Task 1
3. Subagent implements, tests, commits, reports
4. Coordinator reviews, dispatches Task 2
5. Repeat until done
6. QA agent verifies, operator tests on device
7. Ship

**Characteristics:**
- One branch, all commits sequential
- ~2-10 minutes per task
- Coordinator maintains full context
- No cross-agent coordination overhead
- Subagents are disposable — bad output gets discarded, not debugged

## Multi-Agent Team

Each agent owns a branch and a Discord channel. They work semi-independently with PR-based integration.

**Use when:**
- Tasks are independent and can parallelize
- Work is creative, exploratory, or subjective
- Specialized knowledge matters (one agent knows audio, another knows viz)
- Work spans multiple days or sessions
- Operator may be away

**How it works:**
1. Coordinator assigns each agent a branch + channel + spec
2. Agents work independently, post updates in their channel
3. PRs opened when work is ready
4. QA verifies each PR
5. Coordinator manages merge order
6. Operator approves final integration

**Shared foundation rule:** When multiple agents need to touch shared code (data model, core utilities), the coordinator drives shared changes via subagent swarm FIRST and merges to main. Agents then rebase their feature branches. Shared work ships before parallel work branches off.

## Hybrid

Coordinator drives the critical path via subagents. Team agents handle parallel side-quests. Use when there's a clear critical path plus independent feature work.

**Critical rule:** Dispatch parallel work FIRST, before starting the sequential track. The parallel agent needs the longest runway. If you start sequential first, you'll get into the dispatch rhythm and forget the parallel work until it's too late.

## Direct Edit

Coordinator makes changes directly without dispatching anyone. Use for one-line fixes during QA, CSS tweaks, rapid iteration cycles.

## Decision Signals

| Signal | Points toward |
|--------|--------------|
| Tasks depend on each other | Subagent swarm |
| Spec is stable and detailed | Subagent swarm |
| Need to ship today | Subagent swarm |
| Operator is available now | Subagent swarm |
| Tasks are independent | Multi-agent |
| Spec is loose / exploratory | Multi-agent |
| Work spans days | Multi-agent |
| Merge conflicts would be expensive | Subagent swarm |
| Hidden context required (domain knowledge) | Multi-agent (specialist) |
| Operator will be away | Multi-agent (bounded autonomy) |

When in doubt: **brainstorm first**, then the spec clarity will make the model obvious.
