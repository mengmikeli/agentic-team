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
    if (args.includes("--daemon") || args.length === 0) {
      daemonStop(process.cwd());
      if (args.includes("--daemon")) break;
    }
    cmdStop(args);
    break;
  case "log":     cmdLog(args);     break;
  case "review":  await cmdReview(args);  break;
  case "audit":   await cmdAudit(args);   break;
  case "brainstorm": await cmdBrainstorm(args); break;
  case "doctor":  cmdDoctor(args);  break;

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

    function readFeatures(projectPath) {
      const featDir = join(projectPath, ".team", "features");
      if (!fs.existsSync(featDir)) return [];
      try {
        return fs.readdirSync(featDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => {
            const sp = join(featDir, d.name, "STATE.json");
            const state = fs.existsSync(sp) ? JSON.parse(fs.readFileSync(sp, "utf8")) : null;
            const stat = fs.existsSync(sp) ? fs.statSync(sp) : null;
            return {
              name: d.name,
              status: state?.status || "unknown",
              tasks: state?.tasks || [],
              gates: state?.gates || [],
              feature: state?.feature || d.name,
              createdAt: state?.createdAt || null,
              completedAt: state?.completedAt || null,
              _last_modified: stat ? stat.mtime.toISOString() : null,
              hasSpec: fs.existsSync(join(featDir, d.name, "SPEC.md")),
              hasProgress: fs.existsSync(join(featDir, d.name, "progress.md")),
              transitionCount: state?.transitionCount || 0,
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
            return jsonRes(res, readFeatures(pp));
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
              if (r.status === 0 && r.stdout) return jsonRes(res, JSON.parse(r.stdout));
            } catch {}
            return jsonRes(res, []);
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
    console.log();
    console.log("Run 'agt help <command>' for detailed usage, flags, and examples.");
    console.log();
    console.log("Harness (enforcement layer):");
    console.log("  Use 'agt-harness' for init, gate, transition, notify, finalize, metrics");
    break;
}
}
main().catch(err => { console.error(err); process.exit(1); });

