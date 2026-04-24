# Security Review — document-driven-development

**Reviewer:** security
**Feature:** `agt brainstorm` interactive mode — Requirements, Acceptance Criteria, Technical Approach, Testing Strategy prompts
**Overall Verdict:** PASS

---

## Files Actually Read

- `bin/lib/brainstorm-cmd.mjs` (full file)
- `bin/lib/outer-loop.mjs` (lines 280–315, 385–415, 640–700)
- `bin/lib/run.mjs` (lines 225–290 — `dispatchToAgent` impl)
- `templates/SPEC.md` (full file)
- `test/outer-loop.test.mjs` (grep: `## Scope` occurrences)
- `.team/features/document-driven-development/tasks/task-2/artifacts/test-output.txt` (full)

---

## Per-Criterion Results

### 1. Shell / command injection
**PASS.** `dispatchToAgent` uses `spawnSync` with an argument array (`["--print", ..., brief]`), not a shell string. User-supplied content from the interactive brainstorm (requirements, acceptance criteria, technical approach, testing strategy) is embedded in the `brief` string but passed as a single argv element — never interpolated through a shell. No injection surface exists.

Evidence: `bin/lib/run.mjs:235` — `spawnSync("claude", [..., brief], { stdio: ["pipe","pipe","pipe"] })`.

Note: the interactive mode (`interactiveBrainstorm`) does **not** invoke the agent at all. It writes directly to SPEC.md. The agent path is unreachable from the new interactive prompts.

### 2. Path traversal
**PASS.** Feature directory is constructed as `join(teamDir, "features", slugify(idea))`. `slugify()` at `bin/lib/brainstorm-cmd.mjs:16` permits only `a-z0-9-` and caps at 50 chars — `../`, null bytes, and Unicode traversal attempts are all stripped. Verified: `slugify("../../etc/passwd")` → `"etc-passwd"` (no dot-dot, no slash).

### 3. User input to filesystem
**PASS.** All interactive inputs (problem, users, constraints, requirements, acceptanceCriteria, notScope, technicalApproach, testingStrategy, criteria) are written verbatim into SPEC.md at a user-controlled path they own. No execution of spec content occurs downstream. This is appropriate for a local developer tool.

### 4. Secrets / credential handling
**PASS.** No credentials, tokens, or keys are introduced by this feature. The only external file read is `PRODUCT.md` via `loadProductContext()`, which is the user's own project file.

### 5. Existing backlog item — fallback spec (NOT a new issue)
The fallback minimal spec at `bin/lib/outer-loop.mjs:681` uses `## Scope` instead of `## Requirements` and omits the four new sections. This was flagged in the prior review (task-1) and is a **correctness bug, not a security vulnerability**. It is already in backlog. Not blocking from a security standpoint.

---

## Findings

🟡 `bin/lib/outer-loop.mjs:681` — Fallback minimal spec uses `## Scope` (stale); `validateSpecFile` will mark any spec produced via this path as invalid once schema enforcement lands — align to seven-section schema (backlog carry-forward from task-1)

🟡 `test/outer-loop.test.mjs:698` — Asserts `spec.includes("## Scope")` on fallback; will continue to lock in the stale section name — fix in tandem with the fallback code (backlog carry-forward from task-1)

🔵 `bin/lib/brainstorm-cmd.mjs:87` — `buildInteractiveSpec` accepts unbounded string inputs (no max-length guard); a user entering multi-MB text per field will produce an oversized SPEC.md. Not exploitable for a local CLI tool, but worth noting if the tool ever gains network input paths.

---

## Summary

No new security vulnerabilities introduced by this feature. The implementation correctly:
- Scopes file writes to a slug-sanitized directory
- Uses `spawnSync` array args (no shell) for agent dispatch
- Keeps the interactive path entirely in-process (no agent invoked)

The two 🟡 findings are carry-forwards from the prior review (task-1) and already in backlog. Merge is safe from a security perspective.
