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

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
switch (command) {
  case "init":    cmdInit(args);    break;
  case "run":     await cmdRun(args);     break;
  case "status":  cmdStatus(args);  break;
  case "board":   cmdBoard(args);   break;
  case "metrics": cmdMetrics(args); break;
  case "stop":    cmdStop(args);    break;
  case "log":     cmdLog(args);     break;

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
    console.log("⚡ at — CLI for autonomous AI agent teams\n");
    console.log("Commands:");
    console.log("  init                     Set up a new project");
    console.log("  run [description]        Start autonomous loop (phase 2)");
    console.log("  status                   Cross-project dashboard");
    console.log("  board [feature]          Task board view");
    console.log("  metrics                  Token usage and cost stats");
    console.log("  stop [feature]           Pause execution");
    console.log("  log [feature]            Execution history");
    console.log("  dashboard [port]         Web dashboard (default: 3847)");
    console.log("  version                  Show version");
    console.log();
    console.log("Harness (enforcement layer):");
    console.log("  Use 'agt-harness' for init, gate, transition, notify, finalize, metrics");
    break;
}
}
main().catch(err => { console.error(err); process.exit(1); });

