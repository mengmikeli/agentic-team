#!/usr/bin/env node

// at — CLI for autonomous AI agent teams
// Usage: at <command> [args]

import { cmdInit } from "./lib/init.mjs";
import { cmdRun } from "./lib/run.mjs";
import { cmdStatus } from "./lib/status.mjs";
import { cmdBoard } from "./lib/board.mjs";
import { cmdMetrics } from "./lib/metrics.mjs";
import { cmdStop } from "./lib/stop.mjs";
import { cmdLog } from "./lib/log.mjs";
import { cmdReview } from "./lib/review.mjs";
import { cmdAudit } from "./lib/audit-cmd.mjs";
import { cmdBrainstorm } from "./lib/brainstorm-cmd.mjs";
import { daemonStart, daemonStop, daemonStatus } from "./lib/daemon.mjs";
import { cmdDoctor } from "./lib/doctor.mjs";
import { cmdCronTick, cmdCronSetup } from "./lib/cron.mjs";
import { cmdReport } from "./lib/report.mjs";

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
switch (command) {
  case "init":    cmdInit(args);    break;
  case "run":
    if (args.includes("--daemon")) {
      daemonStart(args, process.cwd());
    } else {
      await cmdRun(args);
    }
    break;
  case "status": {
    const ds = daemonStatus(process.cwd());
    if (ds.running) {
      const { c } = await import("./lib/util.mjs");
      console.log(`\n${c.green}⚡ Daemon running${c.reset} (PID ${ds.pid}, started ${ds.startedAt})`);
    }
    cmdStatus(args);
    break;
  }
  case "board":   cmdBoard(args);   break;
  case "metrics": cmdMetrics(args); break;
  case "stop":
  case "pause":
    if (args.includes("--daemon") || args.length === 0) {
      daemonStop(process.cwd());
      if (args.includes("--daemon")) break;
    }
    cmdStop(args);
    break;
  case "log":     cmdLog(args);     break;
  case "finalize": {
    const { cmdFinalize } = await import("./lib/finalize.mjs");
    const featureName = args[0];
    if (!featureName) {
      console.log("Usage: agt finalize <feature-name>");
      console.log("  Marks a feature as completed and closes all its GitHub issues.");
      console.log("  Use after killing a run that was functionally complete.");
      break;
    }
    const dir = join(process.cwd(), ".team", "features", featureName);
    cmdFinalize(["--dir", dir]);
    break;
  }
  case "review":  await cmdReview(args);  break;
  case "audit":   await cmdAudit(args);   break;
  case "brainstorm": await cmdBrainstorm(args); break;
  case "doctor":  cmdDoctor(args);  break;

  case "cron-tick":  await cmdCronTick(args);  break;
  case "cron-setup": cmdCronSetup(args); break;

  case "report": cmdReport(args); break;

  case "help": {
    const sub = args[0];
    const helps = {
      init: {
        usage: "agt init",
        description: "Interactively set up a new agentic project. Creates the .team/ directory with PRODUCT.md, PROJECT.md, and AGENTS.md.",
        flags: [],
        examples: ["agt init"],
      },
      run: {
        usage: "agt run [description] [flags]",
        description: "Start the autonomous execution loop. Picks up the next task from .team/ or runs the given description as a one-off feature.",
        flags: [
          "--daemon          Run execution in the background",
          "--review          Enable agent-based review step after execution",
          "--dry-run         Show planned tasks without executing them",
        ],
        prerequisites: [
          "Your GitHub project board must have two columns added manually before using the outer loop:",
          "  • Pending Approval — items waiting for human review (move here to request approval)",
          "  • Ready            — items approved and cleared to execute",
          "Record each column's Option ID in .team/PROJECT.md under the Tracking section:",
          "  - Pending Approval Option ID: <your-option-id>",
          "  - Ready Option ID: <your-option-id>",
        ],
        examples: [
          "agt run",
          "agt run \"add dark mode toggle\"",
          "agt run --daemon",
          "agt run --review",
          "agt run \"fix login bug\" --dry-run",
        ],
      },
      status: {
        usage: "agt status",
        description: "Show a cross-project dashboard of all features and their current state. Also shows daemon status if running.",
        flags: [],
        examples: ["agt status"],
      },
      board: {
        usage: "agt board [feature]",
        description: "Show the task board for a feature. Lists tasks with their status, node type, and handshake verdicts.",
        flags: [],
        examples: ["agt board", "agt board my-feature-slug"],
      },
      metrics: {
        usage: "agt metrics [--sprint <name>]",
        description: "Show token usage, cost statistics, and sprint analytics. The Sprint section displays cycle time (median + p90), failure rate, gate pass rate, flow template usage, and re-plan rate for the active or most recently completed sprint.",
        flags: [
          "--sprint <name>   Show analytics for a specific named sprint",
        ],
        examples: ["agt metrics", "agt metrics --sprint s3-hardening"],
      },
      stop: {
        usage: "agt stop [feature] [--daemon]",
        description: "Pause execution for a feature or stop the background daemon.",
        flags: [
          "--daemon    Stop the background daemon process",
        ],
        examples: ["agt stop", "agt stop my-feature-slug", "agt stop --daemon"],
      },
      log: {
        usage: "agt log [feature]",
        description: "Show the execution history for a feature, including task runs, gate results, and transitions.",
        flags: [],
        examples: ["agt log", "agt log my-feature-slug"],
      },
      review: {
        usage: "agt review [path|description]",
        description: "Dispatch an agent-based code review for recent git changes or specified files.",
        flags: [],
        examples: ["agt review", "agt review src/auth.mjs", "agt review \"check the login changes\""],
      },
      audit: {
        usage: "agt audit",
        description: "Run a cross-project health check. Validates .team/ structure, required files, and reports stuck or unhealthy features.",
        flags: [],
        examples: ["agt audit"],
      },
      brainstorm: {
        usage: "agt brainstorm [idea]",
        description: "Start an interactive brainstorm session with an agent to explore and refine feature ideas.",
        flags: [],
        examples: ["agt brainstorm", "agt brainstorm \"better onboarding flow\""],
      },
      dashboard: {
        usage: "agt dashboard [port]",
        description: "Launch the web dashboard for monitoring features. Serves the UI on the given port (default: 3847).",
        flags: [],
        examples: ["agt dashboard", "agt dashboard 4000"],
      },
      doctor: {
        usage: "agt doctor",
        description: "Run a health check for your local setup. Checks for required tools, configuration, and agent connectivity.",
        flags: [],
        examples: ["agt doctor"],
      },
      "cron-tick": {
        usage: "agt cron-tick",
        description: "Query the GitHub Project board and dispatch the first 'Ready' issue to the autonomous execution loop. Uses an advisory lock to prevent concurrent runs. Intended to be invoked by a cron job (see 'agt cron-setup').",
        flags: [],
        examples: ["agt cron-tick"],
      },
      "cron-setup": {
        usage: "agt cron-setup [--interval <minutes>]",
        description: "Print a crontab entry for scheduling 'agt cron-tick' at a given interval.",
        flags: [
          "--interval <n>   Run every N minutes (default: 30)",
        ],
        examples: ["agt cron-setup", "agt cron-setup --interval 15"],
      },
      report: {
        usage: "agt report <feature> [--output md]",
        description: "Print a readable execution report for a feature. Shows status, task summary, gate results, blocked tasks, and recommendations. Reads from STATE.json in .team/features/<feature>/.",
        flags: [
          "--output md   Write report to REPORT.md in the feature directory instead of stdout",
        ],
        examples: ["agt report my-feature", "agt report my-feature --output md"],
      },
      version: {
        usage: "agt version",
        description: "Print the installed agt version.",
        flags: [],
        examples: ["agt version", "agt -v", "agt --version"],
      },
    };

    if (sub && helps[sub]) {
      const h = helps[sub];
      console.log(`\nUsage: ${h.usage}\n`);
      console.log(`  ${h.description}\n`);
      if (h.flags.length) {
        console.log("Flags:");
        h.flags.forEach(f => console.log(`  ${f}`));
        console.log();
      }
      if (h.prerequisites && h.prerequisites.length) {
        console.log("Prerequisites:");
        h.prerequisites.forEach(p => console.log(`  ${p}`));
        console.log();
      }
      console.log("Examples:");
      h.examples.forEach(e => console.log(`  ${e}`));
      console.log();
    } else if (sub) {
      console.log(`Unknown command: ${sub}`);
      console.log("Run 'agt help' to see available commands.");
      process.exit(1);
    } else {
      // General help — fall through to default listing
      console.log("⚡ agt — CLI for autonomous AI agent teams\n");
      console.log("Usage: agt <command> [args]\n");
      console.log("Commands:");
      console.log("  init                     Set up a new project");
      console.log("  run [description]        Start autonomous loop");
      console.log("  run --daemon             Run in background");
      console.log("  run --review             Enable agent-based review step");
      console.log("  review [path|desc]       Review code changes or files");
      console.log("  audit                    Cross-project health check");
      console.log("  brainstorm [idea]        Interactive brainstorm session");
      console.log("  status                   Cross-project dashboard + daemon status");
      console.log("  board [feature]          Task board view");
      console.log("  metrics                  Token usage and cost stats");
      console.log("  stop [feature]           Pause execution");
      console.log("  stop --daemon            Stop background daemon");
      console.log("  log [feature]            Execution history");
      console.log("  dashboard [port]         Web dashboard (default: 3847)");
      console.log("  doctor                   Health check for setup");
      console.log("  version                  Show version");
      console.log("  cron-tick                Dispatch next Ready board item");
      console.log("  cron-setup [--interval]  Print crontab entry for cron-tick");
      console.log("  report <feature>         Execution report for a feature");
      console.log();
      console.log("Run 'agt help <command>' for detailed usage, flags, and examples.");
      console.log();
      console.log("Harness (enforcement layer):");
      console.log("  Use 'agt-harness' for init, gate, transition, notify, finalize, metrics");
    }
    break;
  }

  case "dashboard": {
    const port = args.find(a => /^\d+$/.test(a)) || "3847";
    const { createServer } = await import("http");
    const fs = await import("fs");
    const { join, extname, sep } = await import("path");
    const { fileURLToPath } = await import("url");

    const __dirname = join(fileURLToPath(import.meta.url), "..");
    const dashDir = join(__dirname, "..", "dashboard-ui", "dist");

    const mimeTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".svg": "image/svg+xml",
    };

    const { homedir } = await import("os");
    const { spawnSync } = await import("child_process");
    const home = homedir();

    function expandTilde(p) {
      return p && p.startsWith("~/") ? join(home, p.slice(2)) : p;
    }

    const allowOrigin = `http://localhost:${port}`;

    function jsonRes(res, data, code = 200) {
      res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": allowOrigin });
      res.end(JSON.stringify(data));
    }

    function parseProjectsTable(content) {
      const projects = [];
      for (const line of content.split("\n")) {
        if (!line.startsWith("|") || line.includes("---")) continue;
        const cols = line.split("|").map(c => c.trim()).filter(Boolean);
        if (cols.length < 5 || /project/i.test(cols[0].replace(/\*/g, ""))) continue;
        const name = cols[0].replace(/\*\*/g, "");
        const rawPath = cols[1].replace(/`/g, "");
        const path = expandTilde(rawPath);
        const repoMatch = cols[2].match(/\[([^\]]+)\]\(([^)]+)\)/);
        const repo = repoMatch ? { name: repoMatch[1], url: repoMatch[2] } : { name: cols[2], url: "" };
        const version = cols[3].replace(/—/g, "").trim() || null;
        const status = cols[4];
        const featuresDir = join(path, ".team", "features");
        let totalFeatures = 0, activeFeatures = 0, completedFeatures = 0;
        if (fs.existsSync(featuresDir)) {
          try {
            for (const d of fs.readdirSync(featuresDir, { withFileTypes: true })) {
              if (!d.isDirectory()) continue;
              totalFeatures++;
              const sp = join(featuresDir, d.name, "STATE.json");
              if (fs.existsSync(sp)) {
                try {
                  const st = JSON.parse(fs.readFileSync(sp, "utf8")).status;
                  if (st === "completed") completedFeatures++;
                  else if (st === "active" || st === "executing") activeFeatures++;
                } catch {}
              }
            }
          } catch {}
        }
        projects.push({ name, path, rawPath, repo, version, status, hasTeam: fs.existsSync(join(path, ".team")), totalFeatures, activeFeatures, completedFeatures });
      }
      return projects;
    }

    // Check if agt run is actively executing for a specific project path
    function isAgtRunning(projectPath) {
      try {
        const result = spawnSync("pgrep", ["-f", "agt.mjs run"], { encoding: "utf8", timeout: 2000, stdio: ["pipe", "pipe", "pipe"] });
        if (result.status !== 0 || !result.stdout.trim()) return false;
        const dashboardPid = String(process.pid);
        const pids = result.stdout.trim().split("\n").filter(p => p !== dashboardPid);
        if (pids.length === 0) return false;

        // Check each PID: must be alive (not zombie) AND working in this project's directory
        const resolvedProject = fs.realpathSync(projectPath);
        for (const pid of pids) {
          try {
            const ps = spawnSync("ps", ["-p", pid.trim(), "-o", "state="], { encoding: "utf8", timeout: 1000, stdio: ["pipe", "pipe", "pipe"] });
            const state = (ps.stdout || "").trim();
            if (state.startsWith("Z") || state.startsWith("T")) continue;

            // Check process CWD to scope to this project
            const lsof = spawnSync("lsof", ["-p", pid.trim(), "-Fn"], { encoding: "utf8", timeout: 2000, stdio: ["pipe", "pipe", "pipe"] });
            const cwdMatch = (lsof.stdout || "").match(/^n(.+)$/m);
            if (cwdMatch) {
              try {
                const procCwd = fs.realpathSync(cwdMatch[1]);
                if (procCwd === resolvedProject || procCwd.startsWith(resolvedProject + "/")) {
                  return true;
                }
              } catch {}
            }

            // Fallback: check loop-status.json timestamp (written by this project's run)
            const loopStatus = join(projectPath, ".team", ".loop-status.json");
            if (fs.existsSync(loopStatus)) {
              try {
                const ls = JSON.parse(fs.readFileSync(loopStatus, "utf8"));
                if (ls.updatedAt && (Date.now() - new Date(ls.updatedAt).getTime()) < 300000) {
                  return true; // loop status updated in last 5 min
                }
              } catch {}
            }
          } catch { continue; }
        }
        return false;
      } catch { return false; }
    }

    // Secondary check: has any feature file been modified in the last 10 min?
    function hasRecentActivity(projectPath) {
      const featDir = join(projectPath, ".team", "features");
      if (!fs.existsSync(featDir)) return false;
      const cutoff = Date.now() - 10 * 60 * 1000;
      try {
        for (const d of fs.readdirSync(featDir, { withFileTypes: true })) {
          if (!d.isDirectory()) continue;
          for (const f of ["STATE.json", "progress.md"]) {
            const p = join(featDir, d.name, f);
            if (fs.existsSync(p)) {
              const mt = fs.statSync(p).mtimeMs;
              if (mt > cutoff) return true;
            }
          }
        }
      } catch {}
      return false;
    }

    function readFeatures(projectPath) {
      const featDir = join(projectPath, ".team", "features");
      if (!fs.existsSync(featDir)) return [];
      const agtRunning = isAgtRunning(projectPath); // scoped to this project
      
      // Clear stale loop status if no agt process is running
      if (!agtRunning) {
        const loopStatusPath = join(projectPath, ".team", ".loop-status.json");
        if (fs.existsSync(loopStatusPath)) {
          try {
            const ls = JSON.parse(fs.readFileSync(loopStatusPath, "utf8"));
            if (ls.phase && ls.phase !== "idle" && ls.phase !== "checkpoint" && ls.phase !== "blocked") {
              fs.writeFileSync(loopStatusPath, JSON.stringify({ phase: "idle", updatedAt: new Date().toISOString() }, null, 2) + "\n");
            }
          } catch {}
        }
      } // activity check removed — caused false pauses during brainstorm
      try {
        return fs.readdirSync(featDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => {
            const fdir = join(featDir, d.name);
            const sp = join(fdir, "STATE.json");
            let state = null;
            try { state = fs.existsSync(sp) ? JSON.parse(fs.readFileSync(sp, "utf8")) : null; } catch {}
            const stat = fs.existsSync(sp) ? fs.statSync(sp) : null;
            const progPath = join(fdir, "progress.md");
            const hasProgress = fs.existsSync(progPath);
            const hasPause = fs.existsSync(join(fdir, ".pause"));

            let status = state?.status || "unknown";
            let tasks = state?.tasks || [];
            let dirty = false;

            // Read progress.md for ground truth
            let hasSummary = false, passes = 0, summaryBlocked = 0;
            if (hasProgress) {
              try {
                const prog = fs.readFileSync(progPath, "utf8");
                hasSummary = prog.includes("Run Summary");
                passes = (prog.match(/\u2705 PASS/g) || []).length;
                const bm = prog.match(/Tasks: \d+\/\d+ done, (\d+) blocked/);
                if (bm) summaryBlocked = parseInt(bm[1]);
              } catch {}
            }

            if (state) {
              // Rule 1: Run Summary exists = feature completed
              if (hasSummary && status !== "completed") {
                status = "completed";
                if (!state.completedAt) state.completedAt = new Date().toISOString();
                dirty = true;
              }

              // Rule 2: .pause file = paused
              if (hasPause && ["active", "executing"].includes(status)) {
                status = "paused";
                dirty = true;
                try { fs.unlinkSync(join(fdir, ".pause")); } catch {}
              }

              // Rule 3: executing but no agt process = stale = paused
              if (["active", "executing"].includes(status) && !agtRunning) {
                status = "paused";
                state._stale_reason = "no agt run process detected";
                dirty = true;
              }

              // Rule 4: sync task pass count
              let curPassed = tasks.filter(t => t.status === "passed").length;
              if (passes > curPassed) {
                for (const t of tasks) {
                  if (t.status === "pending" && curPassed < passes) {
                    t.status = "passed"; curPassed++; dirty = true;
                  }
                }
              }

              // Rule 5: completed + blocked count = mark remaining as blocked
              if (status === "completed" && summaryBlocked > 0) {
                for (const t of tasks) {
                  if (["pending", "in-progress"].includes(t.status)) { t.status = "blocked"; dirty = true; }
                }
              }

              // Rule 6: paused = reset in-progress to pending
              if (status === "paused") {
                for (const t of tasks) {
                  if (t.status === "in-progress") { t.status = "pending"; dirty = true; }
                }
              }

              // Write back to disk if anything changed
              if (dirty) {
                state.status = status;
                state.tasks = tasks;
                state._reconciled_at = new Date().toISOString();
                try { fs.writeFileSync(sp, JSON.stringify(state, null, 2) + "\n"); } catch {}
              }
            }

            return {
              name: d.name,
              status,
              tasks,
              gates: state?.gates || [],
              feature: state?.feature || d.name,
              createdAt: state?.createdAt || null,
              _runStartedAt: state?._runStartedAt || null,
              completedAt: state?.completedAt || null,
              _last_modified: stat ? stat.mtime.toISOString() : null,
              hasSpec: fs.existsSync(join(fdir, "SPEC.md")),
              hasProgress,
              transitionCount: state?.transitionCount || 0,
              tokenUsage: state?.tokenUsage ?? null,
            };
          });
      } catch { return []; }
    }

    function parseSprints(content) {
      const sprints = [];
      for (const line of content.split("\n")) {
        if (!line.startsWith("|") || line.includes("---")) continue;
        const cols = line.split("|").map(c => c.trim()).filter(Boolean);
        if (cols.length < 5 || /sprint/i.test(cols[0])) continue;
        sprints.push({ name: cols[0], status: cols[1], version: cols[2], dates: cols[3], commits: cols[4], model: cols[5] || "" });
      }
      return sprints;
    }

    function parseProduct(content) {
      const result = {};
      let current = null;
      for (const line of content.split("\n")) {
        const h = line.match(/^##\s+(.+)/);
        if (h) { current = h[1].toLowerCase(); result[current] = []; }
        else if (current) result[current].push(line);
      }
      for (const k of Object.keys(result)) result[k] = result[k].join("\n").trim();
      return result;
    }

    function loadTokenData(fs, join, home, days = 7) {
      const pewDir = join(home, ".config", "pew");
      const queuePath = join(pewDir, "queue.jsonl");
      if (!fs.existsSync(queuePath)) return { available: false };

      try {
        const lines = fs.readFileSync(queuePath, "utf8").trim().split("\n").filter(Boolean);
        const records = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

        const now = new Date();
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - days);
        cutoff.setHours(0, 0, 0, 0);
        const recent = records.filter((r) => new Date(r.hour_start) >= cutoff);

        // Summary
        let input = 0, cached = 0, output = 0, reasoning = 0, total = 0;
        for (const r of recent) {
          input += r.input_tokens || 0;
          cached += r.cached_input_tokens || 0;
          output += r.output_tokens || 0;
          reasoning += r.reasoning_output_tokens || 0;
          total += r.total_tokens || 0;
        }

        // Daily aggregation
        const dailyMap = new Map();
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          dailyMap.set(key, { date: key, total: 0, input: 0, output: 0, cached: 0 });
        }
        for (const r of recent) {
          const key = new Date(r.hour_start).toISOString().slice(0, 10);
          if (dailyMap.has(key)) {
            const d = dailyMap.get(key);
            d.total += r.total_tokens || 0;
            d.input += r.input_tokens || 0;
            d.output += r.output_tokens || 0;
            d.cached += r.cached_input_tokens || 0;
          }
        }

        // Model breakdown
        const modelMap = new Map();
        for (const r of recent) {
          const m = r.model || "unknown";
          if (!modelMap.has(m)) modelMap.set(m, { model: m, total: 0, input: 0, output: 0 });
          const entry = modelMap.get(m);
          entry.total += r.total_tokens || 0;
          entry.input += r.input_tokens || 0;
          entry.output += r.output_tokens || 0;
        }
        const models = [...modelMap.values()].sort((a, b) => b.total - a.total);

        // Source breakdown (by AI tool/client, e.g. claude-code, openclaw)
        const sourceMap = new Map();
        for (const r of recent) {
          const s = r.source || "unknown";
          if (!sourceMap.has(s)) sourceMap.set(s, { source: s, total: 0, input: 0, output: 0 });
          const entry = sourceMap.get(s);
          entry.total += r.total_tokens || 0;
          entry.input += r.input_tokens || 0;
          entry.output += r.output_tokens || 0;
        }
        const sources = [...sourceMap.values()].sort((a, b) => b.total - a.total);

        return {
          available: true,
          summary: { input, cached, output, reasoning, total },
          daily: [...dailyMap.values()],
          models,
          sources,
        };
      } catch {
        return { available: false };
      }
    }

    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      const pathname = url.pathname;

      if (pathname.startsWith("/api/")) {
        try {
          if (pathname === "/api/projects") {
            const p = join(home, "clawd", "PROJECTS.md");
            if (!fs.existsSync(p)) return jsonRes(res, []);
            return jsonRes(res, parseProjectsTable(fs.readFileSync(p, "utf8")));
          }
          if (pathname === "/api/features") {
            const pp = expandTilde(url.searchParams.get("path") || process.cwd());
            const rebuild = url.searchParams.get("rebuild") === "true";
            if (rebuild) {
              // Rebuild cache from GitHub for all features
              import("./lib/state-sync.mjs").then(({ rebuildFromGitHub }) => {
                const featDir = join(pp, ".team", "features");
                if (fs.existsSync(featDir)) {
                  for (const d of fs.readdirSync(featDir, { withFileTypes: true })) {
                    if (d.isDirectory()) rebuildFromGitHub(join(featDir, d.name));
                  }
                }
              }).catch(() => {});
            }
            return jsonRes(res, readFeatures(pp));
          }
          if (pathname === "/api/loop-status") {
            const pp = expandTilde(url.searchParams.get("path") || process.cwd());
            const statusPath = join(pp, ".team", ".loop-status.json");
            if (fs.existsSync(statusPath)) {
              try { return jsonRes(res, JSON.parse(fs.readFileSync(statusPath, "utf8"))); } catch {}
            }
            return jsonRes(res, { phase: "idle" });
          }
          if (pathname === "/api/analytics") {
            const pp = expandTilde(url.searchParams.get("path") || process.cwd());
            const featDir = join(pp, ".team", "features");
            if (!fs.existsSync(featDir)) return jsonRes(res, { features: [] });
            const features = [];
            let totalPasses = 0, totalReviewFails = 0, totalGateFails = 0, totalReplans = 0, totalCost = 0, totalReviewCost = 0;
            for (const d of fs.readdirSync(featDir, { withFileTypes: true })) {
              if (!d.isDirectory()) continue;
              const progPath = join(featDir, d.name, "progress.md");
              if (!fs.existsSync(progPath)) continue;
              const prog = fs.readFileSync(progPath, "utf8");
              const passes = (prog.match(/✅ PASS/g) || []).length;
              const reviewFails = (prog.match(/Review FAIL/g) || []).length;
              const gateFails = (prog.match(/Gate exit code: [^0]/g) || []).length;
              const replans = (prog.match(/Re-plan/g) || []).length;
              const costMatch = prog.match(/Cost: \$([\.\d]+)/);
              const cost = costMatch ? parseFloat(costMatch[1]) : 0;
              const reviewMatch = prog.match(/review \$([\.\d]+)/);
              const reviewCost = reviewMatch ? parseFloat(reviewMatch[1]) : 0;
              const total = passes + reviewFails + gateFails;
              const failRate = total > 0 ? Math.round((reviewFails + gateFails) / total * 100) : 0;
              const spPath = join(featDir, d.name, "STATE.json");
              let status = "unknown";
              try { status = JSON.parse(fs.readFileSync(spPath, "utf8")).status || "unknown"; } catch {}
              features.push({ name: d.name, status, passes, reviewFails, gateFails, replans, failRate, cost, reviewCost });
              totalPasses += passes; totalReviewFails += reviewFails; totalGateFails += gateFails; totalReplans += replans; totalCost += cost; totalReviewCost += reviewCost;
            }
            const totalAttempts = totalPasses + totalReviewFails + totalGateFails;
            return jsonRes(res, {
              features,
              totals: {
                passes: totalPasses, reviewFails: totalReviewFails, gateFails: totalGateFails,
                replans: totalReplans, cost: totalCost, reviewCost: totalReviewCost,
                failRate: totalAttempts > 0 ? Math.round((totalReviewFails + totalGateFails) / totalAttempts * 100) : 0,
                reviewPct: totalCost > 0 ? Math.round(totalReviewCost / totalCost * 100) : 0,
              }
            });
          }
          if (pathname === "/api/sprints") {
            const pp = expandTilde(url.searchParams.get("path") || process.cwd());
            const sp = join(pp, ".team", "SPRINTS.md");
            if (!fs.existsSync(sp)) return jsonRes(res, { sprints: [], raw: "" });
            const c = fs.readFileSync(sp, "utf8");
            return jsonRes(res, { sprints: parseSprints(c), raw: c });
          }
          if (pathname === "/api/state") {
            const fd = expandTilde(url.searchParams.get("path") || "");
            const sp = join(fd, "STATE.json");
            if (!fs.existsSync(sp)) return jsonRes(res, null);
            return jsonRes(res, JSON.parse(fs.readFileSync(sp, "utf8")));
          }
          if (pathname === "/api/product") {
            const pp = expandTilde(url.searchParams.get("path") || process.cwd());
            const pm = join(pp, ".team", "PRODUCT.md");
            if (!fs.existsSync(pm)) return jsonRes(res, {});
            return jsonRes(res, parseProduct(fs.readFileSync(pm, "utf8")));
          }
          if (pathname === "/api/issues") {
            const cwd = expandTilde(url.searchParams.get("path") || process.cwd());
            try {
              const r = spawnSync("gh", ["issue", "list", "--state", "open", "--json", "number,title,labels,state", "--limit", "50"], { encoding: "utf8", timeout: 10000, cwd });
              // Get repo URL
              let repoUrl = null;
              try {
                const rr = spawnSync("gh", ["repo", "view", "--json", "url", "-q", ".url"], { encoding: "utf8", timeout: 5000, cwd });
                if (rr.status === 0 && rr.stdout) repoUrl = rr.stdout.trim();
              } catch {}
              if (r.status === 0 && r.stdout) return jsonRes(res, { issues: JSON.parse(r.stdout), repoUrl });
            } catch {}
            return jsonRes(res, { issues: [], repoUrl: null });
          }
          if (pathname === "/api/backlog") {
            const pp = expandTilde(url.searchParams.get("path") || process.cwd());
            const backlog = [];
            // Read backlog from PRODUCT.md roadmap (uncompleted items)
            const productPath = join(pp, ".team", "PRODUCT.md");
            if (fs.existsSync(productPath)) {
              const content = fs.readFileSync(productPath, "utf8");
              const roadmapMatch = content.match(/## Roadmap\n([\s\S]*?)(?=\n##|$)/);
              if (roadmapMatch) {
                for (const m of roadmapMatch[1].matchAll(/^\d+\.\s*\*\*(.+?)\*\*\s*[-—]\s*(.+)$/gm)) {
                  if (!/✅\s*done/i.test(m[2])) {
                    backlog.push({ source: "roadmap", title: m[1], description: m[2] });
                  }
                }
              }
            }
            // Read backlog from sprints/backlog/ directory
            const backlogDir = join(pp, ".team", "sprints", "backlog");
            if (fs.existsSync(backlogDir)) {
              try {
                for (const f of fs.readdirSync(backlogDir)) {
                  if (!f.endsWith(".md")) continue;
                  const content = fs.readFileSync(join(backlogDir, f), "utf8");
                  const title = content.match(/^#\s+(.+)/m)?.[1] || f.replace(".md", "");
                  const desc = content.split("\n").filter(l => l.trim() && !l.startsWith("#")).slice(0, 2).join(" ").slice(0, 200);
                  backlog.push({ source: "backlog", title, description: desc, file: f });
                }
              } catch {}
            }
            return jsonRes(res, backlog);
          }
          if (pathname === "/api/tokens") {
            const daysParam = parseInt(url.searchParams.get("days") || "7", 10);
            const validDays = [1, 7, 28].includes(daysParam) ? daysParam : 7;
            return jsonRes(res, loadTokenData(fs, join, home, validDays));
          }
          if (pathname === "/api/tokens/sync" && req.method === "POST") {
            try {
              const result = spawnSync("pew", ["sync"], { encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] });
              const pending = (result.stdout || "").match(/(\d+)\s*record/i);
              return jsonRes(res, {
                ok: result.status === 0,
                message: result.status === 0 ? "Sync complete" : "Sync failed",
                records: pending ? parseInt(pending[1]) : null,
                output: (result.stdout || "").trim().slice(0, 500),
              });
            } catch (err) {
              return jsonRes(res, { ok: false, message: err.message }, 500);
            }
          }
          if (pathname === "/api/events") {
            const pp = expandTilde(url.searchParams.get("path") || process.cwd());
            const streamPath = join(pp, ".team", ".notify-stream");

            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
              "Access-Control-Allow-Origin": allowOrigin,
            });
            res.write("retry: 3000\n\n");
            res.write(": connected\n\n");

            let lastSize = fs.existsSync(streamPath) ? fs.statSync(streamPath).size : 0;

            const poll = setInterval(() => {
              if (!fs.existsSync(streamPath)) return;
              try {
                const stat = fs.statSync(streamPath);
                if (stat.size <= lastSize) return;
                const buf = Buffer.alloc(stat.size - lastSize);
                const fd = fs.openSync(streamPath, "r");
                fs.readSync(fd, buf, 0, buf.length, lastSize);
                fs.closeSync(fd);
                lastSize = stat.size;
                for (const line of buf.toString("utf8").split("\n").filter(Boolean)) {
                  try { res.write(`data: ${line}\n\n`); } catch {}
                }
              } catch {}
            }, 500);

            const heartbeat = setInterval(() => {
              try { res.write(": heartbeat\n\n"); } catch {}
            }, 15000);

            req.on("close", () => {
              clearInterval(poll);
              clearInterval(heartbeat);
            });
            return;
          }
          // Fallback: raw .team/ files
          const teamDir = join(process.cwd(), ".team");
          const rawApiPath = pathname.slice("/api/".length);
          const filePath = join(teamDir, rawApiPath);
          if (!filePath.startsWith(teamDir + sep)) return jsonRes(res, { error: "not found" }, 404);
          if (fs.existsSync(filePath)) {
            res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "text/plain", "Access-Control-Allow-Origin": allowOrigin });
            return res.end(fs.readFileSync(filePath, "utf8"));
          }
          return jsonRes(res, { error: "not found" }, 404);
        } catch (err) {
          return jsonRes(res, { error: err.message }, 500);
        }
      }

      // Static files
      let filePath = pathname === "/" ? "/index.html" : pathname;
      filePath = join(dashDir, filePath);
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "text/plain" });
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(fs.readFileSync(join(dashDir, "index.html")));
      }
    });

    server.listen(parseInt(port), () => {
      console.log(`\n⚡ Dashboard running at http://localhost:${port}\n`);
    });
    break;
  }

  case "version":
  case "--version":
  case "-v":
    try {
      const { readFileSync } = await import("fs");
      const { join, dirname } = await import("path");
      const { fileURLToPath } = await import("url");
      const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      console.log(pkg.version);
    } catch {
      console.log("unknown");
    }
    break;

  default:
    if (command) {
      console.log(`Unknown command: ${command}`);
      console.log("Run 'agt help' to see available commands.");
      process.exit(1);
    }
    console.log("⚡ agt — CLI for autonomous AI agent teams\n");
    console.log("Usage: agt <command> [args]\n");
    console.log("Commands:");
    console.log("  init                     Set up a new project");
    console.log("  run [description]        Start autonomous loop");
    console.log("  run --daemon             Run in background");
    console.log("  run --review             Enable agent-based review step");
    console.log("  review [path|desc]       Review code changes or files");
    console.log("  audit                    Cross-project health check");
    console.log("  brainstorm [idea]        Interactive brainstorm session");
    console.log("  status                   Cross-project dashboard + daemon status");
    console.log("  board [feature]          Task board view");
    console.log("  metrics                  Token usage and cost stats");
    console.log("  stop [feature]           Pause execution");
    console.log("  stop --daemon            Stop background daemon");
    console.log("  log [feature]            Execution history");
    console.log("  dashboard [port]         Web dashboard (default: 3847)");
    console.log("  doctor                   Health check for setup");
    console.log("  version                  Show version");
    console.log("  cron-tick                Dispatch next Ready board item");
    console.log("  cron-setup [--interval]  Print crontab entry for cron-tick");
    console.log("  report <feature>         Execution report for a feature");
    console.log();
    console.log("Run 'agt help <command>' for detailed usage, flags, and examples.");
    console.log();
    console.log("Harness (enforcement layer):");
    console.log("  Use 'agt-harness' for init, gate, transition, notify, finalize, metrics");
    break;
}
}
main().catch(err => { console.error(err); process.exit(1); });

