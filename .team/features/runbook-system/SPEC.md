# Feature: Runbook System

## Goal
Store reusable task decompositions as YAML runbooks in `.team/runbooks/` and automatically inject matching task lists at planning time, eliminating repeated brainstorm work for known feature patterns.

## Requirements

- Runbooks are YAML files in `.team/runbooks/` with a regex pattern, keyword list, description, and ordered task list.
- Matching runs in `planTasks()` before brainstorm: score each runbook against the feature description by regex match + keyword frequency, select the highest-scoring match above a threshold.
- When a runbook matches, its task list is used directly (formatted as `- [ ] {task}` items) instead of calling the brainstorm agent.
- `agt run --runbook <name>` forces a specific runbook by filename slug, bypassing scoring.
- If no runbook matches (or `--runbook` names an unknown file), fall through to the existing brainstorm agent behavior — no behavior change for unmatched features.
- Ship at least 3 built-in example runbooks covering common agentic-team patterns (e.g., add-cli-command, add-github-integration, add-test-suite).
- Runbook match and task injection are logged to stdout so the user can see which runbook was selected.
- Runbooks are composable: a task entry may reference another runbook by `include: <name>` to embed its task list inline (one level deep only — no recursive includes).

## Acceptance Criteria

- [ ] A `.team/runbooks/add-cli-command.yml` runbook exists with a valid schema and at least 4 tasks.
- [ ] A `.team/runbooks/add-github-integration.yml` runbook exists with a valid schema and at least 4 tasks.
- [ ] A `.team/runbooks/add-test-suite.yml` runbook exists with a valid schema and at least 4 tasks.
- [ ] `matchRunbook(description, runbooksDir)` returns the best-matching runbook or `null` when score is below threshold.
- [ ] Regex match in a runbook correctly narrows candidate set before keyword scoring.
- [ ] `planTasks()` uses runbook tasks when a match is found, falling through to brainstorm when no match.
- [ ] `agt run --runbook add-cli-command` forces that runbook regardless of feature description.
- [ ] `agt run --runbook nonexistent` logs a warning and falls through to brainstorm.
- [ ] Console output identifies the matched runbook name and score before task dispatch begins.
- [ ] `include:` in a task entry is resolved one level deep and inline tasks are inserted at that position.
- [ ] Unit tests cover: exact regex match, keyword-only match, no-match fallthrough, `--runbook` override, unknown runbook fallthrough, `include:` resolution.
- [ ] Existing tests pass without modification (no regression).

## Technical Approach

### Runbook Schema (YAML)

```yaml
# .team/runbooks/add-cli-command.yml
name: add-cli-command
description: Add a new subcommand to the agt CLI
pattern: "add.*cli.*command|new.*agt.*command|implement.*agt\\s+\\w+"   # regex tested against feature description (case-insensitive)
keywords:
  - cli: 3       # keyword → weight
  - command: 2
  - subcommand: 3
  - agt: 2
threshold: 4     # minimum total score to trigger (regex match OR keyword score >= threshold)
tasks:
  - Add argument parsing and --help text for the new command in bin/lib/commands/
  - Implement core command logic with error handling and exit codes
  - Wire command into main CLI entry point (bin/agt.mjs)
  - Write unit tests covering flag parsing, happy path, and error cases
  - Update PLAYBOOK.md with usage examples for the new command
```

### New Module: `bin/lib/runbooks.mjs`

Exports:
- `loadRunbooks(runbooksDir)` — reads all `.yml` files, parses and validates schema, returns `RunbookDef[]`
- `matchRunbook(description, runbooks)` — scores each runbook, returns `{ runbook, score }` or `null`
- `resolveRunbookTasks(runbook, allRunbooks)` — expands `include:` entries one level deep, returns `string[]`
- `scoreRunbook(description, runbook)` — pure function: regex test + keyword sum → numeric score

### Changes to `bin/lib/run.mjs`

In `planTasks(description, spec, opts)`:
1. Load runbooks from `.team/runbooks/` (or `opts.runbooksDir` for tests).
2. If `opts.runbook` is set, find by name, warn + fall through if not found.
3. Otherwise call `matchRunbook()`.
4. If match found: log `[runbook] matched: {name} (score {n})`, return `resolveRunbookTasks()` result as task array.
5. Else: existing brainstorm / checkbox-parse path unchanged.

### Scoring Algorithm

```
score = 0
if description matches runbook.pattern (case-insensitive regex): score += 5
for each keyword in runbook.keywords:
  occurrences = count of keyword in description (case-insensitive)
  score += occurrences × weight
trigger if score >= runbook.threshold
```

Tie-break: highest score wins; ties broken by file name alphabetically.

### File Layout

```
.team/runbooks/
  add-cli-command.yml
  add-github-integration.yml
  add-test-suite.yml
bin/lib/runbooks.mjs      ← new module
bin/lib/run.mjs           ← planTasks() modified
test/runbooks.test.mjs    ← new test file
```

## Testing Strategy

- **Unit tests** (`test/runbooks.test.mjs`): `loadRunbooks`, `scoreRunbook`, `matchRunbook`, `resolveRunbookTasks`. Use fixture YAML files in `test/fixtures/runbooks/`. No file I/O beyond fixtures.
- **Integration smoke test**: Run `planTasks()` with a description that matches `add-cli-command` runbook; assert tasks array starts with the runbook's first task and no brainstorm agent is called.
- **Regression**: Run full test suite (`npm test`) and confirm no existing tests break.
- Manual: `agt run --runbook add-cli-command` on a scratch feature, confirm tasks list printed matches the YAML, agent dispatched with those tasks.

## Out of Scope

- Auto-generating new runbooks from past execution data (learning system).
- Remote runbook registry or npm-distributed runbooks.
- Runbook versioning or migration tooling.
- Recursive (multi-level) `include:` resolution.
- Merging runbook tasks with brainstorm output (runbook replaces, not augments).
- Extension system hooks for runbooks (deferred per roadmap).
- Runbook editor or validation CLI command (`agt runbook validate`).

## Done When

- [ ] `test/runbooks.test.mjs` passes with ≥11 cases covering all acceptance criteria scenarios.
- [ ] 3 built-in runbooks exist in `.team/runbooks/` with valid schema and ≥4 tasks each.
- [ ] `planTasks()` in `run.mjs` uses runbook tasks on match and falls through correctly on no-match.
- [ ] `agt run --runbook <name>` flag parsed and wired to `planTasks()`.
- [ ] Full test suite (`npm test`) passes with no regressions.
- [ ] Console output names the matched runbook before task execution begins.
