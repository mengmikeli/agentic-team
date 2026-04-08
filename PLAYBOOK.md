# PLAYBOOK.md — Platform Recipes

Operational cookbook for OpenClaw + Discord + GitHub. The CHARTER says what to do; this says how.

Items marked **[default]** are the standard approach. **[optional]** are supported alternatives. **[if configured]** require setup first.

---

## OpenClaw

### File access
- **[default]** Use `read` tool for files — no approval needed, fastest path
- **[fallback]** Use `exec` for shell commands — requires operator approval, typically ~30s overhead
- **[tip]** Chain multiple shell commands into one `exec` to reduce approval count
- **[tip]** Use `edit` for surgical file changes — no approval needed

### Subagent dispatch
**[default]** for scoped implementation tasks:
```
sessions_spawn:
  runtime: "subagent"
  mode: "run"
  cwd: /path/to/project
  label: task-name
  task: |
    {full task brief — see charter/conventions.md#handoff-templates}
```
- Subagent inherits workspace but NOT session context
- **[default]** Use `sessions_yield` after dispatch — don't poll with `sessions_list`
- Completion arrives as push event

**When to use subagent vs ACP vs direct:**
| Situation | Use |
|-----------|-----|
| Scoped task with clear spec (2-10 min) | `sessions_spawn(runtime=subagent)` |
| Thread-bound coding session in Discord | `sessions_spawn(runtime=acp)` |
| One-line fix, CSS tweak | `edit` tool directly |
| Need to explore/iterate interactively | ACP session or coordinator direct |

### ACP (Claude Code / Codex)
**[if configured]** For persistent coding sessions:
```
sessions_spawn:
  runtime: "acp"
  thread: true
  mode: "session"
  agentId: {agent-id}
```
- Requires `acp.defaultAgent` or explicit `agentId`
- Good for interactive coding in Discord threads

### Shell approval friction
**Problem:** Every `exec` needs operator approval. This is the #1 speed bottleneck.

**Mitigations:**
- Prefer `read`/`edit` tools over shell when possible
- Chain commands: `build && commit && push` as one approval
- Request `allow-always` for safe patterns (test, build, lint)
- Approvals typically time out after ~2 min — retry if needed, don't assume denied

**If operator doesn't approve:** Continue with non-shell alternatives. Use `read` to inspect, `edit` to change, note the blocked command for when operator returns.

### Multi-agent setup
**[if configured]** Each agent needs:
- Own OpenClaw agent config (`~/.openclaw/agents/{name}/config.yaml`)
- Own Discord bot token
- `requireMention: true` recommended (agents respond only when pinged)

**Single-agent alternative:** One agent can serve multiple roles using subagent dispatch. Multi-agent config is only needed for persistent team agents with Discord presence.

### Heartbeats
**[optional]** For periodic monitoring:
- Configure in OpenClaw config
- `HEARTBEAT.md` checked each poll
- Good for: stall detection, channel check-ins, inbox monitoring
- Not for: sprint execution (use subagents instead)

---

## Discord

### Pinging agents
- **[required]** Use `<@BOT_ID>` format — @name doesn't trigger a response
- Bot IDs stored in TOOLS.md per project
- **If ping doesn't work:** Verify bot is online, check `requireMention` config

### Channel management
**[default]** One channel per sprint:
```
message:
  action: channel-create
  channel: discord
  guildId: {guild_id}
  name: {sprint-name}
  topic: {description + branch + spec link}
```

**Channel lifecycle:**
1. Create on sprint start → pin overview
2. Post updates during sprint
3. Post "shipped" summary on completion
4. Archive after retro

**If channel creation fails:** Use an existing channel or operator DM. Don't block on channel setup.

**Reactions:** Use for lightweight acknowledgment without a full message (✅ done, 👀 reviewing, 🔥 nice work). Keeps channels scannable.

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
1. Brainstorm with operator → write SPEC.md
2. Write PLAN.md
3. Create `.team/sprints/{name}/` directory (if not already created during brainstorm)
4. Create Discord channel
5. Pin overview in channel
6. Start executing

### Quick QA cycle
1. Push fix to branch
2. Wait for PR preview redeploy (~1-2 min)
3. Ping QA agent: `<@BOT_ID>` + preview URL + checklist
4. Or operator tests on real device
5. **If QA agent unavailable:** Coordinator runs headless checks manually, operator handles device testing

### Ship to production
1. Merge PR: `gh pr merge --squash`
2. Wait for staging deploy (watch Actions tab)
3. Verify staging
4. Deploy production (see `.team/PROJECT.md` for method)
5. Verify production
6. Tag: `gh release create v{X.Y}`
7. Post in sprint channel: "🚀 shipped"
8. **If staging deploy fails:** Re-run action. Don't deploy to production from a failed staging.
