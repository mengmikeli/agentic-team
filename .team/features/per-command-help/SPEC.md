# Feature: Per-Command Help

## Goal
`agt help <command>` prints detailed usage, flags, and examples for any `agt` command so users don't need to read source code to understand how to use the CLI.

## Scope
- Add a `help` command to `agt.mjs` that dispatches on a subcommand argument
- `agt help` (no subcommand) continues to show the existing flat command list
- `agt help <command>` outputs for that command:
  - One-line description
  - Usage synopsis (e.g., `agt run [description] [flags]`)
  - All supported flags with types and defaults
  - At least one concrete example
- Commands to cover: `init`, `run`, `review`, `audit`, `brainstorm`, `status`, `board`, `metrics`, `stop`, `log`, `dashboard`, `doctor`, `version`
- `agt help` on an unknown command prints an error and exits non-zero

## Out of Scope
- `agt-harness help <command>` — separate binary, separate feature
- `--help` flags on individual commands (e.g., `agt run --help`)
- Auto-generating help text from code introspection
- Man pages or external documentation
- Interactive/paged help output

## Done When
- [ ] `agt help` (no args) prints the flat command list as before
- [ ] `agt help <command>` prints description, synopsis, flags, and at least one example for every command listed in Scope
- [ ] `agt help unknown-command` prints an error message and exits with code 1
- [ ] Help text for `run` documents `--daemon`, `--review`, `--continuous`, and `--flow` flags
- [ ] Help text for `stop` documents `--daemon` flag
- [ ] Help text for `init` documents `--dir` and any other flags
- [ ] No existing command behavior is changed
