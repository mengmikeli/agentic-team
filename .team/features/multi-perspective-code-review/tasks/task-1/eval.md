## Parallel Review Findings

### [security]
---

## Security Review Findings

🟡 bin/lib/outer-loop.mjs:60 — `readApprovalState` defaults to `signingKey = WRITER_SIG` ("at-harness" literal); any call site omitting the key silently accepts approval files HMAC-signed with a well-known public constant — remove the default or replace with `null` to force explicit key passing

🔵 bin/lib/review.mjs:19 — `execSync` uses `shell: true` on static git commands; unnecessary and creates a latent injection surface if interpolation is ever added — remo

### [architect]
---

**Findings:**

🟡 `roles/pm.md:1` — Exact duplicate of `roles/product.md`; delete one and align the runtime key in `getRoleFocus()` to prevent content drift

🟡 `bin/lib/flows.mjs:132` — `getRoleFocus()` returns hardcoded one-liners; the rich Expertise/Anti-Patterns content in `roles/*.md` is never read at runtime, making the files documentation-only and creating a dual-maintenance surface

🟡 `bin/lib/flows.mjs:143` — `PARALLEL_REVIEW_ROLES` omits `engineer`, `tester`, `simplicity`, and `p

### [devil's-advocate]
**Findings:**

🔴 `test/flows.test.mjs:162` — `PARALLEL_REVIEW_ROLES.length <= 5` hard-blocks task-2; SPEC requires 6 roles (length=6 fails this assertion). Fix: change bound to `=== 6` or `>= 6` before task-2 lands.

🔴 `test/flows.test.mjs:170` — `includes("devil's-advocate")` will fail when task-2 replaces PARALLEL_REVIEW_ROLES with the six new roles. Fix: remove this assertion.

🟡 `roles/architect.md:1` — No "critical finding triggers" section in any of the six role files. SPEC body says fi