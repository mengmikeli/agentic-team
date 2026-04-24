## Parallel Review Findings

### [security]
Now I'll write my security evaluation.

### [architect]
---

**Findings:**

🟡 bin/lib/flows.mjs:156 — `mergeReviewFindings` truncates each role's output to 500 chars; critical findings beyond that limit are silently dropped. Raise limit or document that this output is summary-only, not the authoritative verdict source.

🟡 bin/lib/flows.mjs:147 — `PARALLEL_REVIEW_ROLES` has no canonical link to the `"multi-review"` phase in `FLOWS["full-stack"]`; the connection is implicit and fragile. Embed `roles` inside the flow definition or add an explicit comm

### [devil's-advocate]
---

## Review Findings

Files read: `task-1/handshake.json`, `task-2/handshake.json`, `task-1/artifacts/test-output.txt`, `task-2/artifacts/test-output.txt`, `bin/lib/flows.mjs`, `bin/lib/run.mjs:1145–1175`, `test/flows.test.mjs:155–215`

**Verified**: `flows.mjs:147` confirms `PARALLEL_REVIEW_ROLES = ["architect", "engineer", "product", "tester", "security", "simplicity"]` — exactly 6 roles. 510 tests pass, 0 fail. Core claim is true.

---

🟡 bin/lib/flows.mjs:156 — `mergeReviewFindings` trun