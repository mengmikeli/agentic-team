# Feature: Runbook System

## Goal
Automatically match feature descriptions to reusable YAML task recipes, injecting pre-defined task lists at planning time to skip brainstorm for known patterns.

## Requirements
- Runbooks are YAML files in `.team/runbooks/` with id, name, patterns (regex + keyword with weights), minScore threshold, ordered tasks, and flow selection.
- A new module `bin/lib/runbooks.mjs` provides `loadRunbooks()`, `scoreRunbook()`, `matchRunbook()`, and `resolveRunbookTasks()`.
- Scoring: regex match adds its weight; each keyword occurrence multiplied by its weight; total must meet `minScore` to trigger. Highest score wins; ties broken alphabetically by filename.
- `planTasks()` in `run.mjs` calls `matchRunbook()` before falling through to brainstorm. When matched, runbook tasks are used directly — brainstorm is skipped entirely.
- `agt run --runbook <name>` forces a specific runbook by id, bypassing scoring. Unknown name logs a warning and falls through to brainstorm.
- Console output logs `[runbook] matched: {name} (score {n})` before task dispatch.
- Runbook tasks support `include: <runbook-id>` to inline another runbook's tasks (one level deep, no recursion).
- Ship 3 built-in runbooks: `add-cli-command`, `add-github-integration`, `add-test-suite` (already exist on `feature/runbook-system` branch).
- No behavior change for unmatched features — existing brainstorm/checkbox-parse path is unchanged.

## Acceptance Criteria
- [ ] `bin/lib/runbooks.mjs` exists and exports `loadRunbooks`, `scoreRunbook`, `matchRunbook`, `resolveRunbookTasks`.
- [ ] `loadRunbooks(dir)` reads all `.yml` files from a directory, validates schema (id, name, patterns, minScore, tasks, flow), returns array.
- [ ] `scoreRunbook(description, runbook)` returns a numeric score: regex patterns add their weight on match, keyword patterns add `occurrences × weight`.
- [ ] `matchRunbook(description, runbooks)` returns `{ runbook, score }` for the best match above threshold, or `null`.
- [ ] `resolveRunbookTasks(runbook, allRunbooks)` expands `include:` entries one level deep and returns flat task array.
- [ ] `planTasks()` in `run.mjs` loads runbooks, matches, and uses matched tasks when found.
- [ ] `agt run --runbook add-cli-command` forces that runbook regardless of description.
- [ ] `agt run --runbook nonexistent` logs a warning and falls through to brainstorm.
- [ ] Console output names the matched runbook and score before task execution.
- [ ] 3 built-in runbooks exist in `.team/runbooks/` with valid schema and ≥4 tasks each.
- [ ] Unit tests cover: scoring (regex hit, keyword hit, combined, below threshold), matching (best-of-many, tie-break, no-match), `--runbook` override, unknown runbook fallthrough, `include:` resolution.
- [ ] Full test suite (`npm test`) passes with no regressions.

## Technical Approach

### Runbook Schema (YAML)

```yaml
# .team/runbooks/add-cli-command.yml
id: add-cli-command
name: Add CLI Command
patterns:
  - type: regex
    value: "add.*cli.*command|new.*command"
    weight: 2.0
  - type: keyword
    value: "subcommand"
    weight: 1.0
minScore: 2.5
tasks:
  - title: "Define CLI command signature and options"
    hint: "Specify the command name, arguments, flags, and help text"
  - title: "Implement the command handler function"
    hint: "Write the core logic that executes when the command is invoked"
  # ... more tasks
flow: build-verify
```

### New module: `bin/lib/runbooks.mjs`

```
loadRunbooks(dir)         → RunbookDef[]     — read + validate all .yml files
scoreRunbook(desc, rb)    → number           — pure scoring function
matchRunbook(desc, rbs)   → {runbook, score} | null
resolveRunbookTasks(rb, all) → Task[]        — expand include: entries
```

**Scoring algorithm:**
```
score = 0
for each pattern in runbook.patterns:
  if pattern.type === "regex":
    if description matches pattern.value (case-insensitive): score += pattern.weight
  if pattern.type === "keyword":
    occurrences = count of pattern.value in description (case-insensitive)
    score += occurrences × pattern.weight
trigger if score >= runbook.minScore
```

### Changes to `bin/lib/run.mjs`

In `planTasks(description, spec, opts)`:
1. Load runbooks from `.team/runbooks/`.
2. If `opts.runbook` is set, find by id; warn + fall through if not found.
3. Otherwise call `matchRunbook(description, runbooks)`.
4. If match: log `[runbook] matched: {name} (score {n})`, return tasks as `{ id, title, status, attempts }` array.
5. Else: existing spec-parse / single-task fallback unchanged.

### CLI flag

Parse `--runbook <name>` in `cmdRun()` alongside existing `--flow`, `--tier`, etc.

### File layout

```
bin/lib/runbooks.mjs           ← new module
bin/lib/run.mjs                ← planTasks() modified, --runbook flag
.team/runbooks/                ← 3 built-in YAML files (from feature branch)
test/runbooks.test.mjs         ← new: unit tests for scoring/matching/loading
test/runbook-*.test.mjs        ← existing: YAML schema validation tests
```

## Testing Strategy

- **Unit tests** (`test/runbooks.test.mjs`): Test `loadRunbooks`, `scoreRunbook`, `matchRunbook`, `resolveRunbookTasks` with fixture YAML files in `test/fixtures/runbooks/`. Cover: exact regex match, keyword-only match, combined scoring, below-threshold no-match, best-of-many selection, alphabetical tie-break, `--runbook` override, unknown runbook fallthrough, `include:` expansion, malformed YAML handling.
- **Schema validation tests** (`test/runbook-*.test.mjs`): Already exist on feature branch. Verify each built-in runbook has required fields, ≥4 tasks, and id matching filename.
- **Integration**: `planTasks()` with a matching description returns runbook tasks and skips brainstorm.
- **Regression**: Full `npm test` suite passes.

## Out of Scope
- Auto-generating runbooks from past execution data (learning system).
- Remote runbook registry or npm-distributed runbooks.
- Runbook versioning or migration tooling.
- Recursive (multi-level) `include:` resolution — one level only.
- Merging runbook tasks with brainstorm output — runbook replaces, not augments.
- Extension system hooks for runbooks.
- `agt runbook validate` CLI command.
- Runbook editor UI.

## Done When
- [ ] `bin/lib/runbooks.mjs` exists with `loadRunbooks`, `scoreRunbook`, `matchRunbook`, `resolveRunbookTasks` exports.
- [ ] `planTasks()` in `run.mjs` integrates runbook matching before brainstorm fallback.
- [ ] `agt run --runbook <name>` flag is parsed and wired through.
- [ ] 3 built-in runbooks in `.team/runbooks/` with valid schema and ≥4 tasks each.
- [ ] `test/runbooks.test.mjs` passes with ≥10 cases covering scoring, matching, loading, includes, and CLI override.
- [ ] Full test suite (`npm test`) passes with no regressions.
- [ ] Console output names the matched runbook before task execution begins.
