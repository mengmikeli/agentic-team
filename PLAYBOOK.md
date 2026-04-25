# PLAYBOOK.md — Platform Recipes

Operational cookbook for the `agt` CLI. The CHARTER says what to do; this says how.

Items marked **[default]** are the standard approach. **[optional]** are supported alternatives. **[if configured]** require setup first.

---

## agt CLI

### Command Reference

| Command | Purpose |
|---------|---------|
| `agt init` | Interactive project setup — creates `.team/` structure, writes PRODUCT.md |
| `agt brainstorm [idea]` | Interactive session that produces a SPEC for operator approval |
| `agt run [description]` | Dispatch agents and run the execution loop |
| `agt run --daemon` | Run the execution loop in the background |
| `agt run --review` | Enable agent-based review step after each task |
| `agt status` | Cross-project dashboard; shows running features and daemon state |
| `agt board [feature]` | Task board view for a specific feature |
| `agt metrics` | Token usage and cost stats |
| `agt stop [feature]` | Pause execution of a running feature |
| `agt stop --daemon` | Stop the background daemon |
| `agt log [feature]` | Execution history for a feature |
| `agt review [path\|desc]` | Trigger a review pass on code changes or files |
| `agt audit` | Cross-project health check |
| `agt dashboard [port]` | Launch local web dashboard (default port: 3847) |
| `agt doctor` | Diagnose environment setup issues |
| `agt version` | Show installed version |

### Starting a feature

```bash
# Option A — brainstorm first (recommended for new features)
agt brainstorm "add user authentication"
# Review the generated SPEC, then:
agt run "add user authentication"

# Option B — run directly with a description
agt run "fix the login redirect bug"

# Option C — run with review enabled
agt run "add user authentication" --review

# Option D — background daemon (non-blocking)
agt run "add user authentication" --daemon
agt status          # check progress
agt stop --daemon   # stop when done
```

### Checking progress

```bash
agt status          # all features + daemon state
agt board           # task board for current feature
agt log             # execution history
```

### Stopping and resuming

```bash
agt stop            # pause current feature
agt stop --daemon   # stop background daemon (feature state preserved)
agt run             # resume where it left off
```

---

## Standard Sprint Workflow

The end-to-end sequence from idea to shipped deliverable:

### 1. Brainstorm
```bash
agt brainstorm "your feature idea"
```
- Interactive session produces a SPEC with scope, acceptance criteria, and task breakdown
- **Operator approves** the SPEC before execution starts — this is the primary human checkpoint
- Adjust scope/criteria before approving

### 2. Run
```bash
agt run "feature description"
```
- Dispatches builder agents per task
- Runs quality gate (`npm test` or project-configured command) after each task
- Automatically selects flow tier based on description and task count (see Flow Selection below)

### 3. Monitor (optional)
```bash
agt status          # check overall progress
agt board           # inspect task-level detail
agt log             # view execution log
```

### 4. Review failures
- Gate failures are surfaced in `agt status` and `agt log`
- Blocked tasks do not block the sprint — the loop continues with other tasks
- Critical failures stop the feature and request operator input

### 5. Ship
```bash
gh pr create        # create PR when feature completes
gh pr merge --squash
```
- See the GitHub and Deploy sections below for standard procedures

---

## Flow Selection

Flows control how much verification runs after each task. Selected automatically, or override with `--flow <name>`.

| Flow | Phases | When auto-selected |
|------|--------|--------------------|
| `light-review` | implement → gate | Default for small, well-scoped tasks (< 3 tasks, no integration keywords) |
| `build-verify` | implement → gate → review | 3–5 tasks, or description includes: review, audit, integration, API, auth |
| `full-stack` | brainstorm → implement → gate → multi-role review | 6+ tasks, or description includes: architecture, refactor, migration, redesign |

**Multi-role review** (full-stack only) dispatches three reviewers in parallel:
- `security` — vulnerabilities, input validation, safe defaults
- `architect` — structure, patterns, modularity, maintainability
- `devil's-advocate` — edge cases, hidden risks, assumptions

Override auto-selection:
```bash
agt run "description" --flow full-stack
agt run "description" --flow light-review
```

---

## Quality Gates

Each task must pass the project quality gate before the loop moves on. The gate command is configured in `.team/PROJECT.md` (defaults to `npm test`).

**Gate outcomes:**
- **Pass** — task complete, move to next task
- **Fail** — task flagged, builder retries up to configured attempt limit
- **Critical fail** — feature paused, operator notified

**Handling failures:**
- View gate output: `agt log [feature]`
- Blocked tasks are skipped after max retries — the sprint continues
- Fix a specific task manually, then `agt run` to resume

---

## GitHub

### Branch protection
**[default]** Require 1 approving review before merge.
- `gh pr merge --admin` bypasses protection — use only with operator present
- Direct push to main shows "Bypassed rule violations" warning

### PR previews
**[if configured]** `rossjrw/pr-preview-action`:
- Each PR deploys to `{pages-url}/pr/pr-{N}/`
- Separate localStorage from staging (different base path)
- Auto-deploys on push, auto-cleans on merge/close

**Setup (one-time per repo):**
1. Enable GitHub Pages on `gh-pages` branch
2. Add workflow using `rossjrw/pr-preview-action`
3. Set `BASE_PATH` in build config for subpath routing

**If preview didn't update:** Check GitHub Actions tab for failed runs. Re-run failed job. If persistent, push an empty commit to trigger rebuild.

### Git in worktrees
- `gh` CLI needs `--repo owner/repo` flag (no `.git/config` remote)
- Or set `GH_REPO` env var
- **If `gh` commands fail with "no remotes found":** Add `--repo` flag

### Releases
```bash
gh release create v{X.Y} --title "v{X.Y} — {Title}" --notes "{notes}"
```

---

## Git Worktrees

Each feature run executes in an isolated git worktree so agent file changes stay
on a dedicated branch and cannot interfere with `main` or with other features
running in parallel.

### Layout

```
<repo>/
  .team/
    worktrees/
      <slug>/          ← isolated working tree (e.g. "my-feature")
        ...            ← full repo checkout on branch feature/<slug>
```

- **Slug** — derived from the feature name: lowercased, spaces/underscores → `-`,
  non-alphanumeric characters stripped, capped at 72 characters.
- **Branch** — `feature/<slug>` (uses `-B` so re-running resets the branch to HEAD).
- **Lifetime** — created by `agt run` before dispatching agents, removed on clean
  completion; **preserved on failure** so the next `agt run` can pick up where it
  left off.

### Inspect

```bash
# List all worktrees (main + any active feature worktrees)
git worktree list

# Show git log inside a specific worktree
git -C .team/worktrees/<slug> log --oneline -10

# Check uncommitted changes in a preserved worktree
git -C .team/worktrees/<slug> status
```

### Manual cleanup

If `agt run` crashed and left a worktree behind, or you want to discard a
partially-built feature:

```bash
# 1. Remove the worktree directory and its git registration
git worktree remove --force .team/worktrees/<slug>

# 2. (Optional) Delete the branch if you do not need the commits
git branch -d feature/<slug>    # safe delete — fails if unmerged
git branch -D feature/<slug>    # force delete
```

> **Tip:** `agt run` automatically reuses an existing `.team/worktrees/<slug>` on
> re-invocation — manual pruning is only needed when you want a clean slate or to
> free disk space.

### Prune stale git registrations

After an abnormal exit, git may retain admin entries pointing to deleted
directories. Clean them up with:

```bash
git worktree prune
```

---

## Deploy

Three environments, each with a distinct purpose:
- **PR preview** — per-PR validation before merge (see GitHub > PR previews above)
- **Staging** — post-merge validation from main
- **Production** — final deploy target, user-facing

### Staging
**[default]** GitHub Pages — auto from main:
- Uses `peaceiris/actions-gh-pages@v4`
- URL: `{username}.github.io/{repo}/`
- **If staging deploy fails:** Check Actions tab. Common cause: GitHub 500 on gh-pages push (transient, re-run).

### Production
Configure per project in `.team/PROJECT.md`. Common options:

**Cloudflare Pages** [manual]:
```bash
wrangler pages deploy build --project-name={name}
```
- Custom domain in Cloudflare dashboard
- Good for: edge caching, global CDN, custom domains

**Vercel** [auto or manual]:
```bash
vercel --prod
```
- Auto-deploys from main if connected
- Good for: zero-config, built-in preview deploys

**Which to use:** Check `.team/PROJECT.md` for this project's deploy method. Don't guess.

### Deploy checklist
1. All tests pass
2. Build succeeds locally
3. Staging verified
4. Operator approves
5. Deploy to production
6. Verify production URL
7. Tag release

---

## Common Recipes

### Start a new sprint
1. `agt brainstorm "idea"` → review + approve SPEC
2. `agt run "feature description"`
3. Monitor with `agt status` / `agt board`
4. PR → merge → deploy

### Quick fix
```bash
agt run "fix the specific bug"   # light-review auto-selected for small tasks
```

### Full feature with multi-role review
```bash
agt run "redesign authentication flow" --flow full-stack
```

### Background execution
```bash
agt run "big feature" --daemon
# do other work
agt status         # check progress
agt stop --daemon  # stop when done
```

### Ship to production
1. Merge PR: `gh pr merge --squash`
2. Wait for staging deploy (watch Actions tab)
3. Verify staging
4. Deploy production (see `.team/PROJECT.md` for method)
5. Verify production
6. Tag: `gh release create v{X.Y}`
