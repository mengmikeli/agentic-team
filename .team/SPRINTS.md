# Sprint History — agentic-team

| Sprint | Status | Version | Dates | Commits | Model |
|--------|--------|---------|-------|---------|-------|
| v1-foundations | ✅ Done | v1.0 | Apr 1–14 | 22 | Coordinator + operator |
| s2-readme-v1 | ✅ Done | v1.0 | Apr 14 | 3 | Subagent swarm |
| s3-hardening | ✅ Done | v2.1 | Apr 14–18 | 101 | Subagent swarm + agt run |

## s3-hardening Summary

Transformed agentic-team from a markdown framework to a real CLI product.

**What shipped:**
- `agt` CLI: init, run, status, board, metrics, stop, log, dashboard, review, audit, brainstorm, doctor (12 commands)
- `agt-harness`: init, gate, transition, validate, synthesize, finalize, notify (7 commands)
- Protocol-based core loop: handshake contracts, evidence artifacts, typed briefs, anti-rationalization
- Outer product loop: prioritize → brainstorm → execute → review outcome → next
- Quality tiers (functional/polished/delightful), flow selection (light/build-verify/full-stack)
- Mechanical verdict system (synthesize: emoji counting, not LLM judgment)
- GitHub Issues + Project board integration with status updates
- Web dashboard (static HTML/JS)
- Smart entry flow (adapts to project state, bootstraps what's missing)
- Cross-platform (tested macOS + Windows)
- 12 skills → 1 consolidated agent protocol
- 279 tests, 27 lib modules, 109 total commits

**Competitive parity:** Matched or exceeded OPC and superboss on every identified gap.

**Metrics:**
- 101 commits in 4 days
- 279 tests
- 6 features delivered via `agt run` itself (dogfooded)
