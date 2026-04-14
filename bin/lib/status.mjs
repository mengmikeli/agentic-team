// at status — cross-project dashboard in terminal
// Reads .team/ dirs, shows project status with colors.

import { existsSync, readFileSync, readdirSync } from "fs";
import { join, resolve, basename } from "path";
import { c, readState, relativeTime } from "./util.mjs";

export function cmdStatus(args) {
  const dir = args[0] || ".";
  const teamDir = join(dir, ".team");

  if (!existsSync(teamDir)) {
    console.log(`${c.red}No .team/ directory found.${c.reset} Run ${c.bold}at init${c.reset} first.`);
    process.exit(1);
  }

  // Read project info
  const projectName = readProjectName(teamDir);
  const features = readFeatures(teamDir);

  // Header
  console.log();
  console.log(`${c.bold}${c.cyan}⚡ ${projectName}${c.reset}`);
  console.log(`${c.dim}${"─".repeat(50)}${c.reset}`);

  if (features.length === 0) {
    console.log(`\n${c.dim}  No features yet. Run ${c.bold}at run "description"${c.reset}${c.dim} to start.${c.reset}\n`);
    return;
  }

  // Features table
  console.log();
  console.log(`  ${c.bold}${pad("Feature", 24)} ${pad("Status", 12)} ${pad("Tasks", 16)} ${pad("Gates", 10)} ${pad("Updated", 12)}${c.reset}`);
  console.log(`  ${c.dim}${pad("─", 24, "─")} ${pad("─", 12, "─")} ${pad("─", 16, "─")} ${pad("─", 10, "─")} ${pad("─", 12, "─")}${c.reset}`);

  for (const feat of features) {
    const statusColor = getStatusColor(feat.status);
    const tasks = feat.tasks || {};
    const taskStr = `${tasks.passed || 0}/${tasks.total || 0}`;
    const blockedStr = tasks.blocked ? ` ${c.red}(${tasks.blocked} blocked)${c.reset}` : "";
    const gateStr = `${feat.gates?.passed || 0}/${feat.gates?.total || 0}`;
    const updated = feat.lastModified ? relativeTime(feat.lastModified) : "—";

    console.log(
      `  ${pad(feat.name, 24)} ` +
      `${statusColor}${pad(feat.status, 12)}${c.reset} ` +
      `${pad(taskStr, 16)}${blockedStr} ` +
      `${pad(gateStr, 10)} ` +
      `${c.dim}${pad(updated, 12)}${c.reset}`
    );
  }

  // Summary
  const active = features.filter(f => f.status === "active").length;
  const completed = features.filter(f => f.status === "completed").length;
  console.log();
  console.log(`  ${c.dim}${completed} completed · ${active} active · ${features.length} total${c.reset}`);
  console.log();
}

function readProjectName(teamDir) {
  try {
    const projectMd = readFileSync(join(teamDir, "PROJECT.md"), "utf8");
    const match = projectMd.match(/^#\s+(.+?)(?:\s+—|\s*$)/m);
    return match ? match[1] : basename(resolve(teamDir, ".."));
  } catch {
    return basename(resolve(teamDir, ".."));
  }
}

function readFeatures(teamDir) {
  const featuresDir = join(teamDir, "features");
  if (!existsSync(featuresDir)) return [];

  const features = [];
  try {
    const dirs = readdirSync(featuresDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const name of dirs) {
      const state = readState(join(featuresDir, name));
      if (state) {
        features.push({
          name,
          status: state.status || "unknown",
          tasks: {
            total: (state.tasks || []).length,
            passed: (state.tasks || []).filter(t => t.status === "passed").length,
            failed: (state.tasks || []).filter(t => t.status === "failed").length,
            blocked: (state.tasks || []).filter(t => t.status === "blocked").length,
            pending: (state.tasks || []).filter(t => t.status === "pending").length,
          },
          gates: {
            total: (state.gates || []).length,
            passed: (state.gates || []).filter(g => g.verdict === "PASS").length,
          },
          lastModified: state._last_modified,
        });
      } else {
        // Feature with SPEC.md but no STATE.json
        features.push({ name, status: "spec-only", tasks: {}, gates: {}, lastModified: null });
      }
    }
  } catch { /* empty */ }

  return features.sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    return 0;
  });
}

function getStatusColor(status) {
  switch (status) {
    case "active":    return c.green;
    case "completed": return c.cyan;
    case "paused":    return c.yellow;
    case "failed":    return c.red;
    case "spec-only": return c.dim;
    default:          return c.white;
  }
}

function pad(str, len, fill = " ") {
  str = String(str);
  return str.length >= len ? str.slice(0, len) : str + fill.repeat(len - str.length);
}
