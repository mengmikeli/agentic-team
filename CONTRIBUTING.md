# Contributing to agentic-team

Thanks for your interest in contributing! This guide covers the basics.

## Setup

```bash
git clone https://github.com/mengmikeli/agentic-team.git
cd agentic-team
npm install
```

## Project Structure

- `bin/agt.mjs` — CLI entry point (`agt`)
- `bin/agt-harness.mjs` — harness entry point (`agt-harness`)
- `bin/lib/` — command implementations
- `dashboard/` — static web dashboard (no build step)
- `skills/` — agent playbook (AgentSkills format)
- `roles/` — specialist role templates
- `templates/` — `.team/` file templates
- `test/` — test suite
- `charter/` — methodology reference docs

## Running Tests

```bash
npm test
```

Tests use Node.js built-in test runner (`node --test`). All tests must pass before submitting a PR.

## Making Changes

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Add tests if you're adding new harness commands or modifying state logic.
4. Run `npm test` and ensure all tests pass.
5. Open a pull request against `main`.

## Code Style

- ES modules (`import`/`export`) — the project uses `"type": "module"`.
- CLI output for humans goes to stderr; structured JSON goes to stdout.
- Harness commands must return valid JSON and maintain tamper-detection (nonce signatures).

## State Machine Rules

If you're modifying task transitions, note the enforced rules:

- Allowed transitions: `pending → in-progress → passed/failed`, `failed → in-progress/skipped`, `blocked → in-progress/skipped`
- Max 3 retries per task
- Oscillation detection (A→B→A→B pattern is rejected)
- File locking for concurrent safety

See `bin/lib/transition.mjs` for the full implementation.

## Quality Gates

Gates are mechanical — exit codes, not opinions. If you add a new harness command, ensure it:

- Returns JSON to stdout
- Writes state with nonce signatures via `bin/lib/util.mjs`
- Has test coverage in `test/harness.test.mjs`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
