# Competitive Analysis: OPC vs Superboss vs agentic-team
_April 23, 2026_

## Executive Summary

**OPC leads in sophistication** with its digraph-based execution engine, autonomous loop capabilities, and mechanical quality gates. Its extension system and runbook replay functionality are unmatched. **Superboss leads in team orchestration** with sophisticated Discord-based multi-agent coordination and document-driven development. **Agentic-team is behind both** but has a cleaner modular architecture and strong testing foundation.

Key recommendations: Agentic-team should steal OPC's mechanical gates and autonomous loop architecture, Superboss's document-driven development workflow, and build proper crash recovery with atomic state writes.

## Feature Matrix

| Feature | OPC | Superboss | agentic-team |
|---------|-----|-----------|--------------|
| **Core Architecture** | Digraph-based flow engine | Discord team orchestration | CLI + harness pattern |
| **Quality Gates** | Mechanical (code-enforced) | Mixed (human + reviews) | Basic mechanical |
| **Outer Loop** | Autonomous with runbooks | Manager-driven via GitHub Project | Basic daemon (stub) |
| **Extension System** | Full capability-routed hooks | Skill-based modular | None |
| **Runbooks/Replay** | Native with matching | None | None |
| **Agent Dispatch** | Subagents + Claude Code | @-mentions in Discord | Subprocess exec |
| **State Management** | Atomic writes + nonces | Channel memory + tracking | JSON with file locks |
| **Recovery/Failure** | Circuit breakers + oscillation detection | Retry limits + escalation | Basic retry logic |
| **Testing** | 84 test files + compound defense | None | 17 tests |
| **Token Tracking** | No | No | Via pew integration |

## Deep Dive: OPC (The Technical Leader)

### Architecture

OPC uses a **digraph-based execution engine** that's fundamentally more sophisticated than the others:

```
Task → Flow Selection → Node Execution → Gate Verdict → Route Next
                              ↑                              ↓
                              └──────── ITERATE/FAIL ────────┘
```

- **Typed nodes**: Each node has a specific type (discussion, build, review, execute, gate) with distinct protocols
- **Mechanical routing**: Verdicts are computed by `opc-harness synthesize` - any red = FAIL, any yellow = ITERATE, all green = PASS
- **Flow templates**: JSON-defined directed graphs with sophisticated cycle limits and oscillation detection
- **External flow files**: Allows other skills to define custom workflows via `--flow-file`

### New Since Last Analysis (v0.8)

The April 2026 update (~35K lines) represents a massive evolution:

**Compound Evaluation Quality Gate (D2)**: 11-layer substance check on every evaluation:
- Thin content detection
- Missing code references
- Low uniqueness scoring
- Fabricated references
- Aspirational claims detection
- Change scope coverage verification
- ≥3 layers tripped → hard FAIL (not just warning)

**Extension System**: Third-party capability-routed extensions with:
- Sandboxed hooks (timeout + circuit breakers)
- Four hook types: `promptAppend`, `verdictAppend`, `executeRun`, `artifactEmit`
- Capability matching: extensions declare what they provide, nodes declare what they need
- No fork/rebuild required - extensions live in `~/.opc/extensions/`

**Runbooks**: Reusable task recipes that match incoming tasks and provide unit decomposition:
- Pattern matching with regex + keyword scoring
- Flow template + tier + units specification
- Eliminates repeated task decomposition
- Auto-matches at loop initialization

**Autonomous Loop**: 8-16 hour unattended execution with:
- Durable cron scheduling (survives process restart)
- Code-enforced guardrails (write nonce, atomic writes, plan integrity, review independence)
- External validator integration (pre-commit hooks, test suites, CI pipelines)
- Oscillation detection and tick limits

**Iteration Escalation (D3)**: Persistent eval warnings across ≥2 iterations auto-escalate to FAIL - no more infinite loops of shallow reviews.

### Key Innovations

1. **Separation of concerns**: The agent doing work never evaluates it
2. **Mechanical over judgment**: All verdicts computed by tools, not LLM opinions
3. **Zero trust architecture**: 29 test suites verify tamper detection, atomic writes, review independence
4. **Capability-based extensions**: Clean plugin architecture that can't break the core
5. **Formal contracts**: Stable CLI interface for external skills to depend on
6. **External validator integration**: Git hooks and CI become part of the quality architecture

### Weaknesses

1. **Complexity barrier**: High learning curve with extensive protocols and configurations
2. **No built-in token tracking**: Missing cost monitoring
3. **Node.js dependency**: Requires specific runtime environment
4. **Single-flow focus**: Not designed for multi-project orchestration like Superboss
5. **No persistent memory**: Each run starts fresh (though integrates with memex)

## Deep Dive: Superboss (The Team Orchestrator)

### Architecture

Superboss operates as a **Discord-based engineering manager** that orchestrates teams of AI agents:

```
Human Vision → Document-Driven Design → GitHub Issues → Agent Dispatch → Review → Merge
                       ↓                           ↓              ↓
              docs/prd/ structure         Project Board      @-mentions
```

**Core Components:**
- **Document-Driven Development (DDD)**: No code without approved design docs
- **Issue-Driven Task Management**: GitHub Project boards with 6-status lifecycle
- **Team Dispatch**: @-mentions to dev agents in Discord channels
- **Channel-Organized Memory**: Per-channel tracking in `memory/{platform}-{channel-id}/`

### Key Innovations

1. **Proactive Design Partnership**: Manager drives requirements conversation, asks clarifying questions, proposes approaches with trade-offs
2. **Two-Layer Management**: GitHub Project (human-facing) + repo docs (agent-facing) for different audiences
3. **Human Gate Control**: Only humans move items from Backlog → Ready; agents never self-approve
4. **Review via Claude CLI**: Uses `claude --print --permission-mode bypassPermissions` for consistent PR review
5. **Multi-project scaling**: Single manager can handle multiple teams/channels simultaneously
6. **Cross-context persistence**: `docs/` serves as cross-agent, cross-thread, cross-platform context hub

### Strengths

1. **Real team dynamics**: Handles actual multi-agent coordination with conflict resolution
2. **Human workflow integration**: Natural fit with existing GitHub Project + Discord workflows
3. **Scope discipline**: Strong YAGNI enforcement and scope creep prevention
4. **Handoff protocols**: Clear task breakdown with size estimates and dependency mapping
5. **Escalation handling**: Retry limits with human escalation when blocked

### Weaknesses

1. **Platform dependency**: Tightly coupled to Discord + GitHub ecosystem
2. **No quality automation**: Relies heavily on human/agent review rather than mechanical gates
3. **Limited replay capability**: No runbook system for repeated workflows
4. **No crash recovery**: If manager dies mid-task, context is lost
5. **Manual dispatching**: Requires human oversight for task approval and prioritization

## Deep Dive: Supercrew (Secondary Competitor)

### Architecture

Supercrew is a **feature lifecycle management system** with two components:

1. **Claude Code Plugin**: AI-driven feature management in `.supercrew/features/` directories
2. **Kanban App**: Read-only visualization of feature status

**Feature Structure:**
```
.supercrew/features/<id>/
├── meta.yaml    # Status, owner, priority, dates
├── design.md    # Requirements, architecture, constraints  
├── plan.md      # Task breakdown with progress tracking
└── log.md       # Chronological progress entries
```

**Workflow:** `planning → designing → ready → active → blocked → done`

### Strengths

1. **Clean file structure**: Self-contained feature directories
2. **Visual management**: Kanban board for non-technical stakeholders
3. **Skills integration**: Builds on obra/superpowers workflow patterns
4. **Lifecycle tracking**: Clear progression with documented decisions

### Weaknesses

1. **Read-only nature**: Kanban app can't modify feature state
2. **No execution engine**: Just tracking, no automated orchestration  
3. **Limited team support**: Primarily single-agent focused
4. **No quality gates**: Basic workflow without enforcement mechanisms
5. **GitHub dependency**: Requires GitHub OAuth for full functionality

## Deep Dive: agentic-team (Current State)

### Architecture

Agentic-team uses a **CLI + harness pattern** with enforcement layer separation:

```
Human: "Build X" → agt init → agt run → autonomous loop
                                ↓
  agt-harness (enforcement): quality gates + state transitions
                                ↓  
                          Subagent dispatch
```

**Key Files:**
- `.team/PRODUCT.md` - Vision, users, goals
- `.team/PROJECT.md` - Stack, deployment, gate commands  
- `.team/AGENTS.md` - Team roles and conventions
- `.team/features/{name}/STATE.json` - Harness-managed execution state

### Strengths

1. **Clean separation**: CLI for humans, harness for enforcement
2. **Tamper detection**: Nonce signatures prevent state forgery
3. **Testing foundation**: 17 test files covering core functionality
4. **Token tracking**: Integration with pew for cost monitoring
5. **Modular skills**: Clear skill-based architecture
6. **Web dashboard**: Nice visualization of project state

### Gaps (Relative to Competitors)

1. **No mechanical quality gates**: Basic exit code checking vs OPC's compound evaluation
2. **Stub outer loop**: `agt run` currently just prints execution plan
3. **No extension system**: Can't add custom behaviors like OPC
4. **No document-driven development**: Missing Superboss's PRD workflow
5. **Basic state management**: Simple JSON vs OPC's atomic writes + crash recovery
6. **No runbook system**: Every task decomposed from scratch
7. **Limited agent dispatch**: Basic subprocess vs OPC's subagent integration
8. **No oscillation detection**: Missing OPC's cycle limit enforcement
9. **No autonomous scheduling**: No cron/daemon for unattended operation

## Recommendations for agentic-team

### Priority 1: Core Execution Engine

1. **Implement mechanical quality gates** (steal from OPC):
   - Multi-layer substance checking on evaluations
   - Compound evaluation with hard failure thresholds
   - External validator integration (pre-commit hooks, CI, test suites)
   - Gate synthesis: any red = FAIL, any yellow = ITERATE, all green = PASS

2. **Add crash recovery with atomic state writes** (steal from OPC):
   - Replace simple JSON writes with atomic write-then-rename operations
   - Add write nonces for tamper detection (already partially implemented)
   - Implement file locking for concurrent safety
   - JSON crash recovery with structured error handling

3. **Build autonomous loop execution** (current stub → real implementation):
   - Task decomposition engine
   - Durable scheduling (cron-based like OPC)
   - Oscillation detection and cycle limits
   - Tick-based progression with guardrails

### Priority 2: Workflow Enhancement  

4. **Document-Driven Development workflow** (steal from Superboss):
   - PRD template and lifecycle management
   - Requirements → design → approval → breakdown → implementation flow
   - Cross-agent context sharing via structured docs
   - Human approval gates (Backlog → Ready promotion)

5. **Runbook system** (steal from OPC):
   - Pattern-based task matching
   - Reusable decomposition recipes  
   - Flow template + tier + units specification
   - Eliminates repeated planning overhead

6. **Multi-perspective code review** (steal from Teamwork):
   - Parallel review agents with distinct roles
   - Simplicity reviewer with veto power (counter AI over-engineering)
   - Structured finding synthesis with severity ranking
   - Max review rounds with escalation

### Priority 3: Advanced Features

7. **Extension system** (learn from OPC):
   - Capability-routed hooks for custom behaviors
   - Sandboxed execution with timeouts and circuit breakers
   - No rebuild required - dynamic loading from user directories

8. **Enhanced agent dispatch**:
   - Subagent integration like OPC vs current subprocess model
   - Worktree isolation for parallel development
   - Better context passing and result collection

9. **Improved outer loop orchestration**:
   - Multi-project dashboard like Superboss
   - Channel/workspace organization
   - Cross-team coordination capabilities

### Implementation Order

**Phase 1 (Foundation):** Items 1-3 - These fix the core execution engine and make agentic-team competitive with OPC's reliability

**Phase 2 (Workflow):** Items 4-6 - These add the missing workflow sophistication to match Superboss's team coordination

**Phase 3 (Polish):** Items 7-9 - These add advanced features for power users and complex scenarios

### Specific Technical Borrowings

**From OPC's `opc-harness.mjs`:**
- Atomic write pattern with nonce signatures
- Compound evaluation synthesis logic
- Flow state management with cycle detection
- External validator integration patterns

**From Superboss's document structure:**
- PRD template and lifecycle
- Two-layer management (human board + agent docs)  
- Human approval gate patterns
- Task breakdown sizing methodology

**From Teamwork's review system:**
- Multi-agent parallel review dispatch
- Role-based review perspectives
- Simplicity-first review hierarchy
- Review round limits with escalation

The goal: Build an autonomous AI team system that combines OPC's technical sophistication, Superboss's team orchestration wisdom, and agentic-team's clean modular foundation.