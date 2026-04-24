## Parallel Review Findings

### [security]
---

## Security Review Findings

**Verdict: PASS**

Files actually read: `bin/lib/flows.mjs`, `roles/security.md`, all three `handshake.json`, both `test-output.txt` artifacts.

---

🟡 bin/lib/flows.mjs:99 — Gate output is inserted raw inside a triple-backtick fence; if a test emits ` ``` ` it closes the fence early and injects content into the reviewer's prompt. Escape or strip backtick sequences from `gateOutput` before insertion.

🔵 bin/lib/flows.mjs:15 — Slug regex `[^a-z0-9-]` does not p

### [architect]
---

**Verdict: PASS** (no critical findings)

**Findings:**

🟡 bin/lib/flows.mjs:154 — `getRoleFocus()` hardcodes role descriptions inline while `roles/*.md` files exist as the authoritative role definitions; two sources will diverge on any future role edit. Remove `getRoleFocus()` and move the "Review Focus" content into each role's `.md` file.

🟡 roles/product.md:1 — `roles/product.md` and `roles/pm.md` are byte-identical; `PARALLEL_REVIEW_ROLES` dispatches `"product"` while `"pm"` is only 

### [devil's-advocate]
## Verdict: PASS (with backlog items)

---

### Findings

🟡 `test/flows.test.mjs:153` — PM injection test uses `"pm"` but `PARALLEL_REVIEW_ROLES` dispatches `"product"`; add a test for `buildReviewBrief(..., "product")` asserting `roles/product.md` content is present

🟡 `bin/lib/flows.mjs:178` — `mergeReviewFindings` truncates each reviewer to 500 chars; role-file-enriched reviewers write substantially more; raise cap to ≥3000 or remove it — **third time this is flagged**

🟡 `roles/pm.md:1` —