---

## Findings

🟡 `bin/lib/run.mjs:109-120` — `runGateInline` writes a proper gate handshake with real test output, then the `harness("gate", "--cmd", "echo gate-recorded", ...)` call overwrites it with a placeholder. Stored `handshake.json` says `"Gate command: echo gate-recorded"` and `artifacts/test-output.txt` contains only `"gate-recorded"` — not the actual test output. Pre-existing issue, unrelated to this feature's changes; add to backlog.

🔵 `test/handshake.test.mjs:395` — `REQUIRED_FIELDS_COUNT` constant is defined at the bottom of the file but referenced inside a `describe` callback at line 91. Works due to module evaluation order, but placing constants at the top is conventional.

---

**Verdict: PASS**

The core fix is correct and verified:
- `run.mjs:833` — `basePath: taskDir` → `basePath: cwd` directly eliminates the "artifacts not found" warning for builder handshakes
- Gate handshake validation keeps `basePath: taskDir` (correct — gate artifacts are task-dir-relative)
- Builder brief updated with explicit project-relative path instruction (`run.mjs:339`)
- Tests added covering both builder and gate artifact resolution patterns (lines 266–314 in `handshake.test.mjs`), all passing
