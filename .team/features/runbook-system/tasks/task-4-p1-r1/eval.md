# Engineer Evaluation — runbook-system (task-4-p1-r1)

**Verdict: PASS**

The `loadRunbooks(dir)` implementation and supporting functions are correct, well-structured, and thoroughly tested. 39 tests pass across 10 suites. The module handles failure modes gracefully (nonexistent dir, malformed YAML, missing fields, unsafe regex, directory-named-as-yml). Two yellow issues exist but neither blocks merge — the null-description crash is unreachable from the current call site, and the dead `flow` field is harmless.

---

## Files Actually Read
- `bin/lib/runbooks.mjs` (277 lines — full)
- `test/runbooks.test.mjs` (484 lines — full)
- `test/runbook-dir.test.mjs` (105 lines — full)
- `bin/lib/run.mjs` (lines 415–464: planTasks integration; lines 813–839: CLI flag parsing; lines 905–934: featureDescription assignment)
- `.team/runbooks/add-cli-command.yml`, `add-github-integration.yml`, `add-test-suite.yml` (full)
- `SPEC.md` (full)
- Handshake files: task-1, task-2, task-3, task-4-p1-r1
- Previous eval at task-4-p1-r1/eval.md

## Tests Actually Run
- `node --test test/runbooks.test.mjs test/runbook-dir.test.mjs` — **39 pass, 0 fail**
- `scoreRunbook(null, ...)` — **confirmed crash** at line 213 (`Cannot read properties of null (reading 'toLowerCase')`)
- `scoreRunbook(undefined, ...)` — **confirmed crash** at line 213
- `loadRunbooks(dir)` with subdirectory named `.yml` — **handled gracefully** (caught by try/catch at line 190)
- YAML value `foo #bar` (unquoted) — **stripped to `foo`** (correct YAML behavior, documented inline)

---

## Per-Criterion Results

### 1. Correctness — does the code do what the spec says?
**PASS** — `loadRunbooks(dir)` reads `.yml`/`.yaml` files, validates all 6 schema fields (id, name, patterns, minScore, tasks, flow), filters invalid patterns/tasks per-element, and returns a sorted array. `scoreRunbook` implements the spec's scoring algorithm (regex match adds weight, keyword occurrence × weight). `matchRunbook` selects highest score above minScore with tie-break. `resolveRunbookTasks` expands `include:` one level deep. `selectRunbook` handles forced ID override. All 5 exports verified.

**Logic paths traced:**
- `loadRunbooks` → `readdirSync` catch returns `[]` (line 120–122) ✓
- `loadRunbooks` → filter `.ya?ml` (line 119) ✓
- `loadRunbooks` → 5 validation gates with `continue` (lines 131–150) ✓
- `loadRunbooks` → per-pattern filter + per-task filter (lines 153–180) ✓
- `scoreRunbook` → regex branch with `isSafeRegex` guard (lines 204–209) ✓
- `scoreRunbook` → keyword branch with case-insensitive counting (lines 210–221) ✓
- `matchRunbook` → tie-break by `rb.id` (line 234) — deviates from spec's "by filename" but equivalent when id matches filename ⚠️
- `resolveRunbookTasks` → skips nested includes at depth 1 (line 266) ✓
- `selectRunbook` → forced ID returns `Infinity` score (line 248) ✓

### 2. Code quality — readable, well-named, easy to reason about?
**PASS** — Clean separation of concerns: YAML parser, ReDoS guard, loader, scorer, matcher, selector, resolver. Each function is under 30 lines. Naming is clear and consistent. Helper `stripInlineComment` and `castValue` are appropriately scoped. No unnecessary abstractions.

### 3. Error handling — failure paths handled explicitly and safely?
**PASS with gap** — Graceful handling of: nonexistent directory, unparseable YAML, missing required fields, invalid regex, unsafe regex patterns, missing include references, directory-named-as-yml-file. One gap: `scoreRunbook` crashes on null/undefined description (line 213), but this is unreachable from the current call site (`planTasks` always receives a non-null `featureDescription`).

### 4. Performance — any obvious inefficiencies?
**PASS** — `loadRunbooks` is synchronous (appropriate for startup/planning), reads each file once, validates in a single pass. `scoreRunbook` iterates patterns once per call. Keyword counting uses `indexOf` scan (O(n·m) where n=description length, m=keyword length) — efficient for the expected input sizes. No unnecessary allocations. `isSafeRegex` regex is applied once per pattern at load time and again at scoring time (defensive double-check, negligible cost).

---

## Findings

🟡 `bin/lib/runbooks.mjs:213` — `scoreRunbook` crashes on null/undefined description (`description.toLowerCase()` throws TypeError). While unreachable from `planTasks()` today (Mode 1 requires non-empty description, Mode 2 constructs from roadmap), the function is exported and callable directly. Add `if (!description) return 0;` guard at line 201.

🟡 `bin/lib/run.mjs:437` — Runbook `flow` field is loaded (runbooks.mjs:188) and stored in the object but never consumed by `planTasks` or any downstream code. Dead data propagated through 3 functions. Either wire to flow-selection logic or remove from schema to avoid confusion.

🟡 `bin/lib/runbooks.mjs:234` — Tie-break uses `rb.id < best.runbook.id` but SPEC says "ties broken alphabetically by filename". These diverge when id differs from filename (no enforcement exists). Low risk since all 3 built-in runbooks match, but a user-authored runbook could trigger the inconsistency.

🔵 `bin/lib/runbooks.mjs:110` — `isSafeRegex` heuristic catches `(a+)+` class but misses alternation-based ReDoS vectors like `(a|a)+b`. Low risk since runbooks are repo-authored, not user input.

🔵 `bin/lib/runbooks.mjs:80-86` — `stripInlineComment` truncates unquoted values containing ` #` (e.g., regex `foo #bar` becomes `foo`). This is correct YAML behavior but undocumented; could silently corrupt user patterns. Consider adding a note to the built-in runbook examples.

---

## Edge Cases Verified

| Edge case | Covered? | Evidence |
|---|---|---|
| Nonexistent runbooks dir | Yes | test:42, confirmed in test run |
| Empty runbooks dir | Yes | test:47, confirmed in test run |
| Valid YAML with all fields | Yes | test:52, confirmed in test run |
| Multiple files sorted by filename | Yes | test:71, confirmed in test run |
| Missing required fields (id) | Yes | test:82, confirmed in test run |
| Non-YAML files ignored | Yes | test:89, confirmed in test run |
| `.yaml` extension accepted | Yes | test:108, confirmed in test run |
| `flow` field preserved | Yes | test:96, confirmed in test run |
| Regex match with weight | Yes | test:124, confirmed in test run |
| Keyword occurrence counting | Yes | test:138, confirmed in test run |
| Case-insensitive keyword | Yes | test:146, confirmed in test run |
| Combined pattern scoring | Yes | test:153, confirmed in test run |
| Default weight = 1 | Yes | test:163, confirmed in test run |
| Invalid regex skipped | Yes | test:170, confirmed in test run |
| Best match above minScore | Yes | test:195, confirmed in test run |
| No match returns null | Yes | test:202, confirmed in test run |
| Tie-break by id | Yes | test:207, confirmed in test run |
| Empty runbooks → null | Yes | test:214, confirmed in test run |
| Include expansion | Yes | test:237, confirmed in test run |
| Missing include skipped | Yes | test:260, confirmed in test run |
| Nested include stops at 1 level | Yes | test:272, confirmed in test run |
| Forced runbook by id | Yes | test:316, confirmed in test run |
| Unknown forced id → null | Yes | test:323, confirmed in test run |
| ReDoS regex rejected | Yes | test:345, confirmed in test run |
| Inline YAML comments stripped | Yes | test:394, confirmed in test run |
| Per-pattern validation | Yes | test:421, confirmed in test run |
| Per-task validation | Yes | test:444, confirmed in test run |
| All patterns invalid → skip | Yes | test:466, confirmed in test run |
| Directory named `.yml` | Yes | manually verified — caught by try/catch |
| null description | **No** | manually confirmed crash at line 213 |
| undefined description | **No** | manually confirmed crash at line 213 |
| `planTasks` integration | Partial | source-level trace + subprocess test (runbook-dir.test.mjs) |
