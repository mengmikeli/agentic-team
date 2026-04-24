## Parallel Review Findings

### [security]
---

**Findings:**

🟡 `bin/lib/outer-loop.mjs:60` — `readApprovalState` defaults to `signingKey = WRITER_SIG` ("at-harness" literal); any call site omitting the key silently accepts approval files HMAC-signed with a well-known public constant — remove the default or replace with `null` to force explicit key passing

🔵 `bin/lib/review.mjs:19` — `execSync` uses `shell: true` on static git commands; unnecessary and creates a latent injection surface if interpolation is ever added — switch to arra

### [architect]
**Verdict: PASS**

---

**Findings:**

🟡 `bin/lib/flows.mjs:132` — `getRoleFocus()` hardcodes one-liner role descriptions; the rich Expertise/Anti-Patterns content in `roles/*.md` is never read at runtime. Updating a role file has no effect on dispatched review prompts. Wire in or explicitly document that role files are reference-only.

🟡 `roles/pm.md:1` — Byte-for-byte duplicate of `roles/product.md`. `PARALLEL_REVIEW_ROLES` (line 147) uses `"product"`, not `"pm"`, making this file dead. Dele

### [devil's-advocate]
**Verdict: PASS**

Files I read: `handshake.json`, `STATE.json`, `roles/architect.md`, `roles/engineer.md`, `roles/product.md`, `roles/tester.md`, `roles/security.md`, `roles/simplicity.md`, `roles/pm.md`, `roles/devil-advocate.md`, `bin/lib/flows.mjs:132-147`, `test/flows.test.mjs:159-216`, `artifacts/test-output.txt`

---

**Findings:**

🟡 roles/pm.md:1 — Dead duplicate of `roles/product.md`; `getRoleFocus()` still handles the `"pm"` key (flows.mjs:140), so when task-3 wires in role-file inje