# Agentic Team Project Memory

## Project Overview
- TypeScript/Node.js CLI project at `/Users/mikeli/Github/agentic-team`
- Test runner: `node --test test/*.test.mjs`
- Package: `@mengmikeli/agentic-team@2.0.0`

## Key Structure
- `test/*.test.mjs` — test files
- Feature state tracked in STATE.json files
- CLI harness for managing feature workflows (init, transition, gate, notify, finalize, metrics)

## Test Suite (22 tests, all passing as of v1.0)
- at-harness: init, transition, gate, notify, finalize, metrics, tamper detection
- github integration: ghAvailable, createIssue, closeIssue, commentIssue

## Current State
- Branch: main
- v1.0 foundations complete and passing
