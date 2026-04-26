## Parallel Review Findings

🔴 [engineer] `test/simplify-pass.test.mjs:156` — `let revParseCount = 0;` declared but never read or used in the `"dispatches agent when code files are changed"` test; the `execFn` at lines 157–163 returns hardcoded values with no reference to this variable — remove the line
[engineer] - The 🔴 is a one-line fix: delete line 156.
[tester] All three run_3 claims confirmed. Prior 🔴 (`callIndex`) and prior 🟡 (guard regex) fully resolved.
🔴 [simplicity veto] test/simplify-pass.test.mjs:156 — `let revParseCount = 0;` declared but never read or incremented; dead variable (copy-paste artifact from adjacent tests that do use call counters); remove it
🟡 [architect] test/simplify-pass.test.mjs:288 — The uncommitted-revert test captures `checkout HEAD` commands but not `git clean -fd`; removing `simplify-pass.mjs:189–193` leaves all 46 tests green — extend test to assert `clean -fd` was called
🟡 [architect] bin/lib/run.mjs:1578 — `phaseOrder` at lines 1578 and 1604 omits `"simplify"` despite `setUsageContext("simplify", null)` at line 1506; simplify-pass token costs silently excluded from per-phase console breakdown and progress log — add `"simplify"` to both arrays
[architect] **Architecture assessment:** The module boundary is clean, coupling strictly one-directional, guard condition correctly implemented and regression-locked, error containment two-layered (module + integration). The two 🟡 items — `git clean -fd` not asserted in tests, and `"simplify"` missing from `phaseOrder` — are genuine gaps that have been carried across multiple review passes without being fixed. Both belong in the backlog. No blockers to merge.
🟡 [engineer] `test/simplify-pass.test.mjs:295` — `revertCmds` mock only captures `checkout HEAD` commands; `git clean -fd` (added at simplify-pass.mjs:189–193 to fix untracked-file revert) is never asserted and can be silently deleted without failing any test — extend capture to `clean -fd` and assert `revertCmds.some(c => c.includes("clean -fd"))`
🟡 [product] `test/simplify-pass.test.mjs:295` — The uncommitted-revert test captures only `checkout HEAD` commands; `git clean -fd` at `simplify-pass.mjs:189` is untracked and unasserted — the fix can be silently deleted without failing any test. Extend `execFn` mock to capture `clean -fd` and add an assertion.
🟡 [product] `bin/lib/run.mjs:1578` — `phaseOrder` still hardcodes `["brainstorm", "build", "review"]`; `"simplify"` absent from both line 1578 (console breakdown) and line 1604 (progress log). Simplify-pass token costs are invisible to operators. File to backlog. *(carried from multiple prior reviews)*
🟡 [product] `bin/lib/simplify-pass.mjs:62` — File paths from `git diff --name-only` embedded in agent prompt without sanitization. Adversarial filenames can inject instructions when agent runs with `bypassPermissions`. File to backlog. *(carried from Security reviews)*
🟡 [tester] test/simplify-pass.test.mjs:288 — "reverts uncommitted changes" test captures `checkout HEAD` commands but never asserts `git clean -fd` was called; deleting `simplify-pass.mjs:189–194` leaves all 46 tests green while silently re-introducing the untracked-file regression — extend `revertCmds` capture to include `clean -fd` and assert it
🟡 [security] `bin/lib/simplify-pass.mjs:62` — File paths from `git diff --name-only` embedded in agent prompt without sanitization; strip control characters and newlines from each filename before embedding (e.g. `f.replace(/[\x00-\x1f\x7f]/g, "").trim()`). Risk is amplified by `--permission-mode bypassPermissions` used at dispatch (run.mjs:290).
[security] **Prompt injection (🟡):** `buildSimplifyBrief` embeds raw file paths from `git diff --name-only` directly into the agent brief. Git does not restrict filenames — they can contain newlines, null bytes, or markdown directives. Since `dispatchToAgent` runs with `--permission-mode bypassPermissions`, injected instructions in a crafted filename execute with full filesystem access. This is low-risk for solo repos, realistic for multi-contributor projects or submodule consumers. Prior security passes independently confirmed this finding twice; it is a known backlog item.
🟡 [simplicity] test/simplify-pass.test.mjs:295 — `revertCmds` only captures `checkout HEAD` commands; the `git clean -fd` step (simplify-pass.mjs:189–193) is never asserted and can be silently deleted without any test failing; extend the capture or add `assert.ok(revertCmds.some(c => c.includes("clean -fd")))`
🔵 [architect] bin/lib/simplify-pass.mjs:90 — Merge-base detection only tries `main` then `master`; repos using `develop`, `trunk`, or a custom primary branch silently skip the pass
🔵 [architect] bin/lib/simplify-pass.mjs:11 — `__dirname_local` suffix `_local` is noise; standard ESM convention is `__dirname`
🔵 [tester] bin/lib/simplify-pass.mjs:90 — `master` fallback branch (main fails → master tried) is untested (carried)
🔵 [tester] bin/lib/simplify-pass.mjs:111 — Pre-dispatch `rev-parse HEAD` failure early-return path untested (carried)
🔵 [tester] test/simplify-pass.test.mjs:23 — `.sh`/`.bash` in `CODE_EXT` have no `isCodeFile` assertions (carried)
🔵 [security] `bin/lib/simplify-pass.mjs:47` — `execSync` with template literals used for six git commands; prefer `execFileSync("git", [...args])` to eliminate the shell-interpolation anti-pattern. Inputs are provably safe (hex SHAs only) but the pattern is worth fixing. Same at lines 92, 142, 151, 173, 179.
🔵 [simplicity] bin/lib/simplify-pass.mjs:11 — `__dirname_local` suffix `_local` is noise; rename to `__dirname` (standard ESM pattern) — carried from run_1
🔵 [simplicity] bin/lib/run.mjs:1578 — `phaseOrder` hardcodes `["brainstorm", "build", "review"]`; add `"simplify"` to both line 1578 and line 1604 — carried from prior reviews

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**