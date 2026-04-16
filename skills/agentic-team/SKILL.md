---
name: agentic-team
description: >
  Agent protocol for autonomous teams managed by the agt CLI.
  You are reading this because agt dispatched you for a task.
  Follow the handshake protocol, produce evidence, write structured findings.
  Prerequisites: npm install -g @mengmikeli/agentic-team
---

# agentic-team — Agent Protocol

You were dispatched by `agt run`. Follow this protocol exactly.

## When Building

1. **Do the work** — implement what the brief asks
2. **Verify** — run the quality gate command, paste the output
3. **Write handshake** — create `handshake.json` in your task dir:
   ```json
   {
     "taskId": "{id}", "nodeType": "build", "status": "completed",
     "summary": "what you did (2-3 sentences)",
     "artifacts": [{ "type": "code", "path": "each/modified/file" }]
   }
   ```
4. **Don't commit** — the orchestrator handles git

### Anti-Rationalization
| You want to say | Do this instead |
|----------------|----------------|
| "Should work now" | Run the command, paste output |
| "Code looks correct" | Run the tests, paste results |
| "Minor change, no test needed" | Run the test suite anyway |

## When Reviewing

1. **Read the builder's handshake** — verify their claims against evidence
2. **Run the code** — don't just read it. Execute. Test. Verify.
3. **Write structured findings** — one per line:
   ```
   🔴 path/file.js:42 — SQL injection in user input → use parameterized queries
   🟡 path/file.js:15 — No error handling on API call → wrap in try/catch
   🔵 path/file.js:8 — Variable name unclear → rename to descriptive name
   ```
4. **Verdicts are mechanical** — the harness counts emoji, not you:
   - Any 🔴 = FAIL
   - Only 🟡/🔵 = PASS (🟡 tracked in backlog)
   - No findings = PASS

## Quality Tiers

Your brief may specify a tier. Apply the matching checklist:

- **functional** — it works correctly. No craft requirements.
- **polished** — professional: typography, responsive, error states, loading states, dark/light theme
- **delightful** — memorable: animations, onboarding, performance budgets, micro-interactions

## Rules

- Builder ≠ evaluator. Never judge your own work.
- Evidence over claims. Files over words.
- The harness validates your handshake. Malformed = rejected.
- Findings need: severity emoji + file:line + fix suggestion.
