# Feature: Runbook System

## Goal
Store reusable task decompositions (runbooks) and replay them when incoming feature descriptions match known patterns, eliminating redundant agent planning for recurring task types.

## Scope

### Runbook storage
- `.team/runbooks/` directory holds runbook files in JSON format
- Each runbook has: `name`, `description`, `patterns` (array of regex strings), `keywords` (array of strings for scoring), and `tasks` (array of task objects with `title` and `description`)
- Ship 2–3 built-in runbooks as bundled defaults (e.g., "add-npm-package", "add-cli-command", "add-test-suite") that are copied to `.team/runbooks/` on first use if none exist

### Pattern matching
- `matchRunbook(featureDescription, specContent)` scores each runbook: +2 per regex match, +1 per keyword hit
- Returns the highest-scoring runbook if its score exceeds a minimum threshold (default: 2), otherwise returns null
- Matching runs against the feature description and SPEC.md content concatenated

### Integration with task planning
- `planTasks()` in `run.mjs` calls `matchRunbook()` before falling back to spec-parsing
- When a runbook matches, its task list is used verbatim as the initial task plan
- A `[runbook: <name>]` annotation is logged to `progress.md` when a runbook is applied

### CLI commands
- `agt runbook list` — prints all available runbooks with their name, description, and patterns
- `agt runbook add <feature-slug>` — reads a completed feature's task titles from its STATE.json and writes a new runbook file to `.team/runbooks/`, prompting the user for name, description, and patterns
- `agt runbook show <name>` — prints the full runbook definition (patterns, keywords, tasks)

### Tests
- Unit tests for `matchRunbook()` covering: exact regex match, keyword scoring, threshold enforcement, no-match case, and tie-breaking (highest score wins)
- Integration test: when a spec matches a built-in runbook, the tasks injected into STATE.json match the runbook's task list

## Out of Scope
- Visual or interactive runbook editor
- Cloud-synced or shared runbook library
- Runbook versioning or change history
- Automatic runbook generation from LLM output
- Extension hooks (separate roadmap item #22)
- Runbook chaining or conditional branching
- Dynamic variable substitution within runbook task descriptions
- Runbook priority/ordering beyond score-based selection
- `agt runbook delete` or `agt runbook edit` commands

## Done When
- [ ] `.team/runbooks/` directory is created by `agt init` (or lazily on first `agt run`)
- [ ] At least 2 built-in runbooks ship as defaults and are present after init
- [ ] `matchRunbook(description, spec)` returns the correct runbook for a description that matches a built-in pattern, and `null` when no pattern matches
- [ ] `planTasks()` uses runbook tasks when `matchRunbook` returns a non-null result, confirmed by unit test
- [ ] `progress.md` contains a `[runbook: <name>]` line when a runbook is applied to a feature run
- [ ] `agt runbook list` prints all runbooks in `.team/runbooks/` with name, description, and patterns
- [ ] `agt runbook add <feature-slug>` creates a valid runbook JSON file from a completed feature's task titles
- [ ] `agt runbook show <name>` prints the full runbook definition
- [ ] All new code has passing unit tests; existing test suite remains green
