// at board — task board view for current/active feature

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { c, readState, relativeTime } from "./util.mjs";

export function cmdBoard(args) {
  const dir = args[0] || ".";
  const teamDir = join(dir, ".team");
  const featureName = args.find(a => !a.startsWith("-")) && args[0] !== dir ? args[0] : null;

  if (!existsSync(teamDir)) {
    console.log(`${c.red}No .team/ directory found.${c.reset}`);
    process.exit(1);
  }

  const featuresDir = join(teamDir, "features");
  if (!existsSync(featuresDir)) {
    console.log(`${c.dim}No features directory.${c.reset}`);
    return;
  }

  // Find active feature or specified one
  let state = null;
  let name = featureName;

  if (featureName) {
    state = readState(join(featuresDir, featureName));
  } else {
    // Find most recent active feature
    try {
      const dirs = readdirSync(featuresDir, { withFileTypes: true })
        .filter(d => d.isDirectory());
      for (const d of dirs) {
        const s = readState(join(featuresDir, d.name));
        if (s && s.status === "active") {
          state = s;
          name = d.name;
          break;
        }
      }
      // Fallback: most recently modified
      if (!state) {
        for (const d of dirs) {
          const s = readState(join(featuresDir, d.name));
          if (s) {
            if (!state || (s._last_modified > state._last_modified)) {
              state = s;
              name = d.name;
            }
          }
        }
      }
    } catch { /* empty */ }
  }

  if (!state) {
    console.log(`${c.dim}No features with state found.${c.reset}`);
    return;
  }

  const tasks = state.tasks || [];

  // Header
  console.log();
  console.log(`${c.bold}${c.cyan}📋 ${name}${c.reset}  ${statusBadge(state.status)}`);
  console.log(`${c.dim}${"─".repeat(60)}${c.reset}`);

  if (tasks.length === 0) {
    console.log(`\n${c.dim}  No tasks yet.${c.reset}\n`);
    return;
  }

  // Group by status
  const groups = {
    "in-progress": tasks.filter(t => t.status === "in-progress"),
    "pending":     tasks.filter(t => t.status === "pending"),
    "passed":      tasks.filter(t => t.status === "passed"),
    "failed":      tasks.filter(t => t.status === "failed"),
    "blocked":     tasks.filter(t => t.status === "blocked"),
    "skipped":     tasks.filter(t => t.status === "skipped"),
  };

  for (const [status, items] of Object.entries(groups)) {
    if (items.length === 0) continue;

    const icon = getStatusIcon(status);
    const color = getStatusColor(status);
    console.log(`\n  ${color}${c.bold}${icon} ${status.toUpperCase()} (${items.length})${c.reset}`);

    for (const task of items) {
      const retries = task.retries ? ` ${c.yellow}(${task.retries} retries)${c.reset}` : "";
      const gate = task.lastGate ? ` ${c.dim}[gate: ${task.lastGate.verdict}]${c.reset}` : "";
      const updated = task.lastTransition ? ` ${c.dim}${relativeTime(task.lastTransition)}${c.reset}` : "";
      console.log(`    ${color}${icon}${c.reset} ${task.id}${retries}${gate}${updated}`);
      if (task.description) {
        console.log(`      ${c.dim}${task.description}${c.reset}`);
      }
      if (task.lastReason) {
        console.log(`      ${c.dim}reason: ${task.lastReason}${c.reset}`);
      }
    }
  }

  console.log();
}

function statusBadge(status) {
  switch (status) {
    case "active":    return `${c.bgGreen}${c.bold} ACTIVE ${c.reset}`;
    case "completed": return `${c.bgBlue}${c.bold} DONE ${c.reset}`;
    case "paused":    return `${c.bgYellow}${c.bold} PAUSED ${c.reset}`;
    default:          return `${c.dim}${status}${c.reset}`;
  }
}

function getStatusIcon(status) {
  switch (status) {
    case "in-progress": return "🔄";
    case "pending":     return "⏳";
    case "passed":      return "✅";
    case "failed":      return "❌";
    case "blocked":     return "🚫";
    case "skipped":     return "⏭️";
    default:            return "·";
  }
}

function getStatusColor(status) {
  switch (status) {
    case "in-progress": return c.blue;
    case "pending":     return c.dim;
    case "passed":      return c.green;
    case "failed":      return c.red;
    case "blocked":     return c.red;
    case "skipped":     return c.yellow;
    default:            return c.white;
  }
}
