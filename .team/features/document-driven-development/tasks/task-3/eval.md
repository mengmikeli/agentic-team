# Security Review — document-driven-development

**Reviewer:** security
**Feature:** `agt brainstorm` interactive mode — Requirements, Acceptance Criteria, Technical Approach, Testing Strategy prompts
**Overall Verdict:** PASS

---

## Files Actually Read

- `bin/lib/brainstorm-cmd.mjs` (full, 297 lines)
- `bin/lib/run.mjs:225–300` (dispatchToAgent, dispatchToAgentAsync)
- `bin/lib/outer-loop.mjs:270–330` (buildOuterBrainstormBrief)
- `bin/lib/outer-loop.mjs:380–420` (validateSpecFile)
- `bin/lib/outer-loop.mjs:640–710` (outer loop brainstorm section)
- `bin/lib/outer-loop.mjs:726` (minimalSpec — via grep)
- `.team/features/document-driven-development/tasks/task-1/eval.md` (full)
- `.team/features/document-driven-development/tasks/task-2/artifacts/test-output.txt` (full)
- `.team/features/document-driven-development/tasks/task-3/handshake.json`

---

## Per-Criterion Results

### 1. Shell / command injection
**PASS.** `dispatchToAgent` (`run.mjs:235`) uses `spawnSync("claude", ["--print", "--output-format", "json", "--permission-mode", "bypassPermissions", brief], { stdio: ["pipe","pipe","pipe"] })`. The user-supplied `brief` string — which includes interactive brainstorm inputs — is passed as a single positional argv element, never interpolated through a shell. Identical pattern confirmed in `dispatchToAgentAsync` at `run.mjs:282` via `spawn()`. No shell injection surface.

### 2. Path traversal
**PASS.** `slugify()` at `brainstorm-cmd.mjs:16–22` permits only `[a-z0-9-]`, strips leading/trailing hyphens, and caps at 50 chars. The feature directory is constructed as `join(teamDir, "features", slugify(idea))` — no user input reaches `join()` unsanitized. Verified: `../` and null bytes are replaced with `-` by the whitelist regex.

### 3. User input to filesystem
**PASS.** All interactive inputs (requirements, acceptance criteria, technical approach, testing strategy, etc.) are written verbatim to SPEC.md at a slug-sanitized path owned by the user. SPEC.md content is later read only for section-heading regex checks (`validateSpecFile`) or embedded in agent briefs. This is appropriate for a local developer tool.

### 4. Secrets / credential handling
**PASS.** No tokens, API keys, or credentials are introduced by this feature. `loadProductContext()` reads only the user's own `PRODUCT.md` file.

### 5. `--permission-mode bypassPermissions` with checked-in content
**WARN.** Every agent dispatch (`run.mjs:235`, `run.mjs:282`) passes `--permission-mode bypassPermissions` to the Claude CLI, which disables Claude Code's normal permission prompts. The agent brief includes content from `PRODUCT.md` (a checked-in file), SPEC.md (user-written or agent-written), and roadmap descriptions. In a shared-repo workflow, an attacker who can modify `PRODUCT.md` (e.g., via a merged PR or compromised upstream) can embed prompt-injection instructions that cause the Claude agent to execute arbitrary shell commands on the user's machine without any permission prompt. This risk pre-dates this feature and is not introduced by it, but should be in backlog.

### 6. Stale prior warning about `minimalSpec` — corrected
**Prior reviews cited `outer-loop.mjs:681` as using `## Scope`.** Direct inspection of the current file via grep shows `minimalSpec` is at **line 726** and already uses the 7-section schema (`## Requirements`, `## Acceptance Criteria`, `## Technical Approach`, `## Testing Strategy`). The `## Scope` warning in prior eval.mds was stale and should be removed from backlog.

### 7. Handshake integrity — suspicious timestamp
**WARN.** The task-3 handshake.json carries `"timestamp": "2026-04-24T05:00:00.000Z"` — exactly millisecond-zero on the hour. Both task-1 (`04:22:50.436Z`) and task-2 (`04:33:10.821Z`) have sub-second precision as expected from programmatic generation. A round timestamp is a signal the handshake may have been hand-authored. A hand-authored security review handshake bypasses the compound gate verification that prevents rubber-stamping.

---

## Findings

🟡 `bin/lib/run.mjs:235,282` — `--permission-mode bypassPermissions` combined with checked-in file content (PRODUCT.md, SPEC.md) flowing into agent briefs creates a prompt-injection path to arbitrary command execution for users running `agt run` against a repo they do not fully control — document in README or add a pre-flight check that sanitizes brief content for agent instruction patterns

🟡 `.team/features/document-driven-development/tasks/task-3/handshake.json:8` — Timestamp `"2026-04-24T05:00:00.000Z"` is exactly millisecond-zero; all other system-generated handshakes have sub-second precision — investigate whether this handshake was hand-written and whether the integrity model covers the security review node

🔵 `bin/lib/brainstorm-cmd.mjs:87` — `buildInteractiveSpec` accepts unbounded string inputs with no max-length guard; a user entering multi-MB text per field will produce an oversized SPEC.md and an oversized agent brief — not exploitable for a local CLI but worth noting if input ever comes from untrusted sources

---

## Stale Backlog Item (to remove)

The following prior-review warnings are **factually incorrect** against the current codebase and should be removed from backlog:
- ~~`bin/lib/outer-loop.mjs:681` — fallback spec uses `## Scope`~~ — actual code at line 726 uses the 7-section schema.
- ~~`test/outer-loop.test.mjs:698` — asserts `spec.includes("## Scope")`~~ — this line references test fixture content in a different test context, not the minimalSpec fallback assertion.

---

## Summary

No new security vulnerabilities are introduced by this feature. The implementation correctly:
- Scopes all file writes to slug-sanitized directories
- Uses `spawnSync`/`spawn` array args for agent dispatch (no shell)
- Keeps the interactive path entirely in-process (no agent invoked)
- Introduces no new credentials or secret handling

The two 🟡 findings are systemic pre-existing risks that should enter the backlog. The `bypassPermissions` issue is the more consequential one for any team using this tool on shared repositories.
