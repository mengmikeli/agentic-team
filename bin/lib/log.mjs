// at log — execution history from STATE.json

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { c, readState, relativeTime } from "./util.mjs";

export function cmdLog(args) {
  const dir = args[0] || ".";
  const featureName = args.find(a => !a.startsWith("-"));
  const teamDir = join(dir, ".team");
  const featuresDir = join(teamDir, "features");

  if (!existsSync(featuresDir)) {
    console.log(`${c.dim}No features directory.${c.reset}`);
    return;
  }

  // If feature specified, show that one; otherwise show all
  const featureNames = featureName
    ? [featureName]
    : readdirSync(featuresDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

  console.log(`\n${c.bold}${c.cyan}📜 Execution Log${c.reset}\n`);

  for (const name of featureNames) {
    const state = readState(join(featuresDir, name));
    if (!state) continue;

    console.log(`${c.bold}${name}${c.reset}  ${c.dim}(${state.status})${c.reset}`);

    const history = state.transitionHistory || [];
    if (history.length === 0) {
      console.log(`  ${c.dim}No transitions recorded.${c.reset}\n`);
      continue;
    }

    for (const entry of history) {
      const icon = getTransitionIcon(entry.status);
      const time = relativeTime(entry.timestamp);
      const reason = entry.reason ? ` — ${entry.reason}` : "";
      console.log(
        `  ${c.dim}${time}${c.reset}  ${icon} ${c.bold}${entry.taskId}${c.reset} ` +
        `${entry.from} → ${entry.status}${reason}`
      );
    }

    // Show gates
    const gates = state.gates || [];
    if (gates.length > 0) {
      console.log(`\n  ${c.dim}Gates:${c.reset}`);
      for (const gate of gates) {
        const verdictColor = gate.verdict === "PASS" ? c.green : c.red;
        const time = relativeTime(gate.timestamp);
        console.log(
          `  ${c.dim}${time}${c.reset}  ${verdictColor}${gate.verdict}${c.reset} ` +
          `${c.dim}${gate.command}${c.reset}` +
          (gate.taskId ? ` (${gate.taskId})` : "")
        );
      }
    }

    console.log();
  }
}

function getTransitionIcon(status) {
  switch (status) {
    case "in-progress": return "🔄";
    case "passed":      return "✅";
    case "failed":      return "❌";
    case "blocked":     return "🚫";
    case "skipped":     return "⏭️";
    default:            return "·";
  }
}
