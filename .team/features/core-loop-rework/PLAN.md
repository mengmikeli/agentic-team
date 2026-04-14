# Core Loop Rework — Implementation Plan

**Goal:** Transform agt run from "dispatch + exit code" to a protocol-based execution engine with structured handshakes, evidence requirements, typed steps, and validation — matching OPC's rigor.

**Principle:** Every step produces a contract. The next step reads it. The harness validates it. Nobody can skip steps or fake results.

---

## Architecture Change

Before:
```
dispatch agent → run npm test → check exit code → done
```

After:
```
dispatch builder (typed brief)
  → builder writes handshake.json (status, artifacts, summary)
  → agt-harness validate (schema, evidence exists)
  → run quality gate (npm test, capture output as artifact)
  → dispatch reviewer (with context brief + builder handshake)
  → reviewer writes eval.md (structured findings)
  → agt-harness synthesize (count severities, compute verdict)
  → agt-harness transition (route based on verdict)
  → progress.md updated
  → next task or retry with previous eval context
```

## File Structure Per Feature

```
.team/features/{name}/
├── STATE.json              — harness-managed execution state
├── SPEC.md                 — what to build
├── progress.md             — running human-readable log
├── backlog.md              — tracked warnings
└── tasks/
    └── {task-id}/
        ├── handshake.json  — builder's structured output
        ├── eval.md         — reviewer's evaluation
        └── artifacts/      — evidence files
            ├── test-output.txt
            ├── build-output.txt
            └── gate-result.json
```

---

## Task 1: Handshake Protocol

**Files:**
- Create: `bin/lib/handshake.mjs`
- Modify: `bin/at-harness.mjs` — add `validate` command

The contract between steps:

```json
{
  "taskId": "task-1",
  "nodeType": "build|review|gate",
  "runId": "run_1",
  "status": "completed|failed|blocked",
  "verdict": "PASS|FAIL|ITERATE|null",
  "summary": "what was done, 2-3 sentences",
  "timestamp": "ISO8601",
  "artifacts": [
    { "type": "code|test-result|cli-output|evaluation", "path": "relative/path" }
  ],
  "findings": { "critical": 0, "warning": 0, "suggestion": 0 }
}
```

Validation rules:
- Required fields: taskId, nodeType, status, summary, timestamp, artifacts
- If nodeType=build: must have at least one code artifact
- If nodeType=gate: must have test-result or cli-output artifact
- If nodeType=review: must have evaluation artifact
- If findings.critical > 0, verdict cannot be PASS
- All artifact paths must point to existing files

- [ ] Create handshake schema + validation in handshake.mjs
- [ ] Add `agt-harness validate --file <handshake.json>` command
- [ ] Tests for schema validation (valid, missing fields, bad artifact paths, findings/verdict mismatch)
- [ ] Commit

---

## Task 2: Evidence-Based Gate Runner

**Files:**
- Modify: `bin/lib/gate.mjs`
- Modify: `bin/lib/run.mjs`

Gate must produce artifacts, not just exit codes:

- [ ] Gate captures stdout → writes to `tasks/{id}/artifacts/test-output.txt`
- [ ] Gate captures stderr → writes to `tasks/{id}/artifacts/gate-stderr.txt`
- [ ] Gate writes its own handshake.json with verdict + artifacts
- [ ] `agt-harness validate` checks gate handshake before accepting result
- [ ] run.mjs creates task directory structure before dispatch
- [ ] Commit

---

## Task 3: Typed Step Protocols — Builder Brief

**Files:**
- Modify: `bin/lib/run.mjs` — builder dispatch
- Modify: `bin/lib/flows.mjs` — brief builders

Builder brief must require:
- [ ] Anti-rationalization table in every builder brief ("you're tempted to say X → do this instead")
- [ ] Require builder to write handshake.json (not just "do the work")
- [ ] Handshake must include artifacts list (files created/modified)
- [ ] Include verification requirement: "run the tests, paste the output"
- [ ] Three modes: Build (first pass), Fix (after FAIL), Polish (after ITERATE)
- [ ] Commit

---

## Task 4: Typed Step Protocols — Reviewer Brief

**Files:**
- Modify: `bin/lib/flows.mjs` — review brief

Reviewer brief must require:
- [ ] Read builder's handshake (what was claimed)
- [ ] Verify claims against evidence (check artifacts exist, read test output)
- [ ] Structured findings with severity emoji (🔴🟡🔵) + file:line + fix
- [ ] Anti-rationalization: "if you can't reproduce it, it FAILS"
- [ ] Write eval.md to task artifacts dir
- [ ] Commit

---

## Task 5: Context Briefs

**Files:**
- Create: `bin/lib/context.mjs`
- Modify: `bin/lib/run.mjs`

Before dispatching reviewers, build a context brief:
- [ ] Read SPEC.md (design intent)
- [ ] Read git log -10 (recent context)
- [ ] Read project conventions (from PROJECT.md or CLAUDE.md if exists)
- [ ] Read known TODOs/limitations
- [ ] Inject into reviewer brief so they review against intent, not assumptions
- [ ] Commit

---

## Task 6: Quality Tiers

**Files:**
- Create: `bin/lib/tiers.mjs`
- Modify: `bin/lib/run.mjs`

Three tiers with concrete checklists:
- [ ] functional — correctness only (CLI, API, backend)
- [ ] polished — professional craft (typography, responsive, error states)
- [ ] delightful — memorable experience (animations, onboarding, performance budgets)
- [ ] Auto-select from task description (keywords) or `--tier` flag
- [ ] Tier baseline injected into builder AND reviewer briefs
- [ ] Reviewer must verify tier checklist items with evidence
- [ ] Commit

---

## Task 7: Progress Log

**Files:**
- Modify: `bin/lib/run.mjs`

Running human-readable log per feature:
- [ ] Create `progress.md` in feature dir at start
- [ ] Append after each task: what was done, verdict, duration
- [ ] Include builder summary + reviewer findings
- [ ] Next task's builder reads progress.md for context
- [ ] Commit

---

## Task 8: Wire It All Together

**Files:**
- Modify: `bin/lib/run.mjs` — main execution loop

Integrate everything into the core loop:
- [ ] Create task dirs before dispatch
- [ ] Builder writes handshake → harness validates → gate with artifacts → reviewer with context → synthesize → route
- [ ] On retry: include previous eval.md in builder brief (Fix mode, not Build mode)
- [ ] Update progress.md at each step
- [ ] Verify full chain: build → validate → gate → review → synthesize → transition
- [ ] Commit

---

## Task 9: Test the Reworked Loop

- [ ] Run `agt run "add a LICENSE file"` on agentic-team
- [ ] Verify: task dir created with handshake.json + artifacts + eval.md
- [ ] Verify: harness validates handshake
- [ ] Verify: gate output captured as artifact
- [ ] Verify: progress.md written
- [ ] Verify: review findings parsed mechanically
- [ ] Fix anything that breaks
- [ ] Commit

---

## Summary

| Task | What | Est. |
|------|------|------|
| 1 | Handshake protocol + validate | 15 min |
| 2 | Evidence-based gate | 10 min |
| 3 | Builder brief (typed, anti-rationalization) | 10 min |
| 4 | Reviewer brief (structured, verify claims) | 10 min |
| 5 | Context briefs | 10 min |
| 6 | Quality tiers | 15 min |
| 7 | Progress log | 5 min |
| 8 | Wire together | 15 min |
| 9 | Test | 10 min |
| **Total** | | **~100 min** |
