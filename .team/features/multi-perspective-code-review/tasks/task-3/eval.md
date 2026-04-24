## Parallel Review Findings

### [security]
---

**Findings:**

🟡 bin/lib/flows.mjs:15 — `role` is passed to `resolve()` with no allowlist; `role = "../secret"` traverses outside `roles/`; add `if (!ALLOWED_ROLES.includes(role)) return null` before path construction

🟡 bin/lib/flows.mjs:15 — `loadRoleFile("devil's-advocate")` opens `roles/devil's-advocate.md` but file on disk is `roles/devil-advocate.md` (hyphen only); role file content is silently not injected; normalize slug with `role.replace(/[^a-z0-9-]/g, "-")` before building path

### [architect]
---

**Findings:**

🟡 `bin/lib/flows.mjs:15` — `devil's-advocate` slug contains an apostrophe; `resolve(..., "devil's-advocate.md")` never matches the file `roles/devil-advocate.md` on disk; normalize slug to kebab-case before path resolution, or rename the role key consistently to `"devil-advocate"` everywhere

🟡 `test/flows.test.mjs:131` — all `buildReviewBrief` role tests check keywords present in both the role file AND the `getRoleFocus()` fallback; if `loadRoleFile` were deleted the tests

### [devil's-advocate]
---

## Findings

🔴 `bin/lib/flows.mjs:15` — `loadRoleFile("devil's-advocate")` tries to open `roles/devil's-advocate.md` which does not exist; the actual file is `roles/devil-advocate.md` (hyphen-only). Silent ENOENT swallow means the full role brief (Anti-Patterns, Expertise, Identity sections) is never injected for this role. Fix: rename the file to match the key, or normalize the key to `"devil-advocate"`.

🟡 `test/flows.test.mjs:131` — No test checks for content that is **unique** to the 