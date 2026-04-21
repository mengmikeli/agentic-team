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
        usage: "agt metrics",
        description: "Show token usage and cost statistics for all features in the current project.",
        flags: [],
        examples: ["agt metrics"],
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
    const { join, extname } = await import("path");
    const { fileURLToPath } = await import("url");

    const __dirname = join(fileURLToPath(import.meta.url), "..");
    const dashDir = join(__dirname, "..", "dashboard");

    const mimeTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".svg": "image/svg+xml",
    };

    const server = createServer((req, res) => {
      // API: serve .team/ data
      if (req.url.startsWith("/api/")) {
        const teamDir = join(process.cwd(), ".team");
        const apiPath = req.url.replace("/api/", "");

        if (apiPath === "features") {
          try {
            const featuresDir = join(teamDir, "features");
            if (!fs.existsSync(featuresDir)) {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end("[]");
              return;
            }
            const dirs = fs.readdirSync(featuresDir, { withFileTypes: true })
              .filter(d => d.isDirectory())
              .map(d => {
                const statePath = join(featuresDir, d.name, "STATE.json");
                const state = fs.existsSync(statePath)
                  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
                  : null;
                return { name: d.name, state };
              });
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(JSON.stringify(dirs));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // Serve raw .team/ files
        const filePath = join(teamDir, apiPath);
        if (fs.existsSync(filePath)) {
          res.writeHead(200, {
            "Content-Type": mimeTypes[extname(filePath)] || "text/plain",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(fs.readFileSync(filePath, "utf8"));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "not found" }));
        }
        return;
      }

      // Static files
      let filePath = req.url === "/" ? "/index.html" : req.url;
      filePath = join(dashDir, filePath);
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "text/plain" });
        res.end(fs.readFileSync(filePath));
      } else {
        // SPA fallback
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

