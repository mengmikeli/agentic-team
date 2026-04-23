## Parallel Review Findings

### [security]
---

## Security Review — crash-recovery-atomic-state-writes

**Verdict: PASS** (2 backlog items)

### Findings

🟡 `bin/lib/harness-init.mjs:21` — `--feature` flag used directly in `path.join()` without sanitization; a value like `../../outside` traverses outside `.team/features/`; validate no `/`, `\`, or `..` segments before path construction

🟡 `bin/lib/harness-init.mjs:59` — `--prev` flag same path-traversal issue; same fix applies

🔵 `bin/lib/util.mjs:57` — if `writeFileSync(tmp, data)` 

### [architect]
---

## Structured Findings

🟡 `bin/lib/util.mjs:55` — `atomicWriteSync` lacks `fsync` before `rename`; add `fs.fsyncSync(fd)` on the tmp file descriptor to flush page cache before renaming, ensuring durability across kernel crashes

🔵 `bin/lib/harness-init.mjs:35` — `if (existsSync(featureDir))` is dead code; `mkdirSync(..., { recursive: true })` at line 32 guarantees the directory exists — remove the guard

🔵 `bin/lib/harness-init.mjs:39` — `console.error` used for normal operational log (o

### [devil's-advocate]
---

## Structured Findings

🟡 bin/lib/run.mjs:512 — `applyCrashRecovery` non-recovery branch writes `status: "executing"` and `tasks` to disk for "paused"/"completed" features silently; tests only assert `recovered: false` return value — add `readState(featureDir).status` assertions post-call to catch the overwrite

🟡 bin/lib/run.mjs:122 — `runGateInline` silently omits the STATE.json gate entry when `lockFile` returns `{ acquired: false }` but returns `{ ok: true }` to callers; the gate ran 