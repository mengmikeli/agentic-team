# Feature: Runbook System

## Goal
Let users define reusable task-decomposition recipes that are automatically applied when a new feature's description matches a known pattern, eliminating repeated agent-driven planning for common work sequences.

## Requirements

- Runbooks are stored as JSON files in `.team/runbooks/`. Each file contains: `name`, `description`, `patterns` (regex strings), `keywords` (strings for scoring), and `tasks` (array of `{ title }` objects).
- `matchRunbook(featureDescription, specContent)` scores runbooks: +2 per regex match on the concatenated description + spec, +1 per keyword hit. Returns the highest-scoring runbook if score ≥ threshold (default: 2), otherwise `null`.
- `planTasks()` in `bin/lib/run.mjs` calls `matchRunbook()` before spec-checklist parsing and before the single-task fallback. A SPEC.md checklist takes precedence over runbook matches.
- When a runbook matches, its task list is used verbatim as the initial task plan, and a `[runbook: <name>]` line is appended to `progress.md`.
- STATE.json includes a top-level `runbook: { name, score }` field when a runbook was applied.
- At least two built-in example runbooks ship in `.team/runbooks/examples/` (e.g., `add-cli-command`, `add-test-suite`) and are available immediately after install without any `agt init` step.
- `agt runbook list` prints all runbooks found in `.team/runbooks/` (recursively) with name, description, and patterns.
- `agt runbook show <name>` prints the full runbook definition.
- `agt runbook add <feature-slug>` reads a completed feature's task titles from its STATE.json and writes a new runbook file to `.team/runbooks/`, prompting for name, description, and keyword patterns — turning lived executions into reusable recipes.
- `agt run` logs `[runbook] matched: <name> (score: <n>)` or `[runbook] no match` to stdout at plan time.

## Acceptance Criteria

- [ ] Runbooks in `.team/runbooks/**/*.json` are loaded automatically when `planTasks()` is called.
- [ ] A feature whose description matches a runbook (score ≥ threshold) gets the runbook's task list when no SPEC.md checklist exists.
- [ ] A SPEC.md with a checklist always wins over a runbook match.
- [ ] STATE.json includes `runbook: { name, score }` when a runbook was applied; field is absent otherwise.
- [ ] `progress.md` contains a `[runbook: <name>]` line when a runbook is applied.
- [ ] `agt run` prints `[runbook] matched: <name>` or `[runbook] no match` at startup.
- [ ] `agt runbook list` prints all runbooks in `.team/runbooks/` with name, description, and patterns.
- [ ] `agt runbook show <name>` prints the full runbook definition.
- [ ] `agt runbook add <feature-slug>` creates a valid runbook JSON from a completed feature's task titles.
- [ ] Two example runbooks ship in `.team/runbooks/examples/`.
- [ ] All new unit and integration tests pass; `npm test` remains green.

## Technical Approach

### Runbook file format (`.team/runbooks/add-cli-command.json`)
```json
{
  "name": "add-cli-command",
  "description": "New agt CLI sub-command with help text and tests",
  "patterns": ["add.*command", "new.*cli", "implement.*subcommand"],
  "keywords": ["command", "cli", "subcommand", "agt"],
  "tasks": [
    { "title": "Define command interface and flag schema" },
    { "title": "Implement command handler in bin/" },
    { "title": "Wire command into CLI entry point" },
    { "title": "Write unit tests for command logic" },
    { "title": "Add help text and usage examples" }
  ]
}
```

### New module: `bin/lib/runbooks.mjs`
- `loadRunbooks(dir)` — glob `.team/runbooks/**/*.json`, parse each, return array. Silently skip malformed files (log warning).
- `matchRunbook(runbooks, description, specContent)` — for each runbook: sum +2 for each pattern (regex tested on `description + " " + specContent`), +1 per keyword present (case-insensitive). Return `{ runbook, score }` for highest scorer above threshold, or `null`.
- `runbookToTasks(runbook)` — map `runbook.tasks` to `[{ id: "task-N", title, status: "pending", attempts: 0 }]`.

### Changes to existing files
- `bin/lib/run.mjs` — `planTasks(description, spec, slug)`: after SPEC.md checklist parse (which wins if found), call `matchRunbook()` before single-task fallback. Pass matched runbook info through so `runbook` field is written to STATE.json.
- `bin/lib/harness-init.mjs` — add optional `runbook` field to STATE.json schema.
- `bin/agt.mjs` — add `runbook` sub-command routing to `list`, `show`, `add`.

### `agt runbook add` flow
1. Read `STATE.json` for `<feature-slug>` to get completed task titles.
2. Prompt user for: runbook name, description, regex patterns, keywords.
3. Write `.team/runbooks/<name>.json`.

## Testing Strategy

- **Unit tests** (`test/runbooks.test.mjs`):
  - `loadRunbooks` parses valid files, ignores malformed, returns `[]` for missing dir.
  - `matchRunbook` scores correctly for regex hits, keyword hits, and combined; returns `null` below threshold; returns highest scorer when multiple match.
  - `runbookToTasks` produces correct task schema.
- **Integration test** (`test/runbook-integration.test.mjs`):
  - `planTasks` uses runbook when no SPEC.md checklist present and description matches.
  - `planTasks` ignores runbook when SPEC.md checklist exists.
  - STATE.json has `runbook` field after runbook-matched run.
  - `progress.md` contains `[runbook: <name>]` after runbook-matched run.
- **Manual checks**:
  - `agt runbook list` with example runbooks installed shows correct output.
  - `agt runbook show add-cli-command` prints full definition.
  - `agt run` on a description matching an example runbook; verify dashboard task list matches runbook template.

## Out of Scope

- Visual or interactive runbook editor.
- Cloud-synced or shared runbook registry.
- Runbook versioning or change history.
- Automatic runbook generation from LLM output.
- Extension hooks (separate roadmap item #22).
- Runbook chaining, composition, or conditional branching.
- Dynamic variable substitution within runbook task titles.
- `agt runbook delete` or `agt runbook edit` commands.
- YAML format (JSON only in v1 to keep the parser dependency-free).
- Per-task brief overrides inside runbooks (task titles only, not agent instructions).

## Done When

- [ ] `loadRunbooks`, `matchRunbook`, `runbookToTasks` implemented and tested in `bin/lib/runbooks.mjs`.
- [ ] `planTasks()` uses runbook match when no SPEC.md checklist is present, confirmed by unit test.
- [ ] STATE.json includes `runbook: { name, score }` when a runbook matched.
- [ ] `progress.md` contains `[runbook: <name>]` line when runbook was applied.
- [ ] `agt run` prints `[runbook] matched: <name>` or `[runbook] no match` at startup.
- [ ] `agt runbook list`, `agt runbook show`, `agt runbook add` commands work end-to-end.
- [ ] Two example runbooks ship in `.team/runbooks/examples/`.
- [ ] All new unit and integration tests pass; `npm test` green.
