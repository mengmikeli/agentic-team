// at metrics — token usage and cost from pew data or git log stats

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { c } from "./util.mjs";

export function cmdMetrics(args) {
  const dir = args[0] || ".";

  console.log(`\n${c.bold}${c.cyan}📊 Metrics${c.reset}\n`);

  // Try pew data first
  const pewDir = join(process.env.HOME || "~", ".config", "pew");
  const hasPew = existsSync(pewDir);

  if (hasPew) {
    showPewMetrics(pewDir);
  } else {
    console.log(`${c.dim}  pew data not found at ~/.config/pew/${c.reset}`);
  }

  // Git log stats
  console.log(`\n${c.bold}  Git Activity${c.reset}`);
  showGitMetrics(dir);

  // Feature metrics from .team/
  const teamDir = join(dir, ".team");
  if (existsSync(join(teamDir, "features"))) {
    console.log(`\n${c.bold}  Feature Summary${c.reset}`);
    showFeatureMetrics(teamDir);
  }

  console.log();
}

function showPewMetrics(pewDir) {
  console.log(`${c.bold}  Token Usage (pew)${c.reset}`);

  try {
    const files = readdirSync(pewDir).filter(f => f.endsWith(".jsonl")).sort().reverse();
    if (files.length === 0) {
      console.log(`  ${c.dim}No pew data files found.${c.reset}`);
      return;
    }

    let totalTokens = 0;
    let totalCost = 0;
    let sessions = 0;
    const modelUsage = {};

    // Read last 7 days of data
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const file of files.slice(0, 7)) {
      try {
        const lines = readFileSync(join(pewDir, file), "utf8").split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.timestamp && new Date(entry.timestamp).getTime() < cutoff) continue;

            const tokens = (entry.inputTokens || 0) + (entry.outputTokens || 0);
            totalTokens += tokens;
            totalCost += entry.cost || 0;
            sessions++;

            const model = entry.model || "unknown";
            if (!modelUsage[model]) modelUsage[model] = { tokens: 0, cost: 0, count: 0 };
            modelUsage[model].tokens += tokens;
            modelUsage[model].cost += entry.cost || 0;
            modelUsage[model].count++;
          } catch { /* skip malformed lines */ }
        }
      } catch { /* skip unreadable files */ }
    }

    console.log(`  ${c.dim}Last 7 days:${c.reset}`);
    console.log(`    Total tokens: ${c.bold}${formatNumber(totalTokens)}${c.reset}`);
    if (totalCost > 0) {
      console.log(`    Total cost:   ${c.bold}$${totalCost.toFixed(2)}${c.reset}`);
    }
    console.log(`    Sessions:     ${c.bold}${sessions}${c.reset}`);

    if (Object.keys(modelUsage).length > 0) {
      console.log(`\n  ${c.dim}By model:${c.reset}`);
      for (const [model, data] of Object.entries(modelUsage).sort((a, b) => b[1].tokens - a[1].tokens)) {
        const costStr = data.cost > 0 ? ` ($${data.cost.toFixed(2)})` : "";
        console.log(`    ${c.cyan}${model}${c.reset}: ${formatNumber(data.tokens)} tokens${costStr} (${data.count} calls)`);
      }
    }

    // Heatmap (contribution graph style)
    showHeatmap(pewDir);
  } catch {
    console.log(`  ${c.dim}Error reading pew data.${c.reset}`);
  }
}

function showHeatmap(pewDir) {
  console.log(`\n  ${c.bold}Activity (last 28 days)${c.reset}`);

  const days = [];
  const now = new Date();
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({ date: dateStr, tokens: 0 });
  }

  // Read pew data
  try {
    const files = readdirSync(pewDir).filter(f => f.endsWith(".jsonl"));
    for (const file of files) {
      try {
        const lines = readFileSync(join(pewDir, file), "utf8").split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (!entry.timestamp) continue;
            const dateStr = new Date(entry.timestamp).toISOString().split("T")[0];
            const day = days.find(d => d.date === dateStr);
            if (day) day.tokens += (entry.inputTokens || 0) + (entry.outputTokens || 0);
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  const maxTokens = Math.max(...days.map(d => d.tokens), 1);
  const blocks = ["░", "▒", "▓", "█"];

  let line = "  ";
  for (const day of days) {
    if (day.tokens === 0) {
      line += `${c.dim}·${c.reset}`;
    } else {
      const level = Math.min(3, Math.floor((day.tokens / maxTokens) * 4));
      line += `${c.green}${blocks[level]}${c.reset}`;
    }
  }
  console.log(line);

  // Labels
  const firstDate = days[0].date.slice(5);
  const lastDate = days[days.length - 1].date.slice(5);
  console.log(`  ${c.dim}${firstDate}${" ".repeat(Math.max(0, 28 - firstDate.length - lastDate.length))}${lastDate}${c.reset}`);
}

function showGitMetrics(dir) {
  try {
    // Commits last 7 days
    const weekCommits = execSync(
      `git -C "${dir}" log --oneline --since="7 days ago" 2>/dev/null | wc -l`,
      { encoding: "utf8", timeout: 5000 }
    ).trim();

    // Commits last 30 days
    const monthCommits = execSync(
      `git -C "${dir}" log --oneline --since="30 days ago" 2>/dev/null | wc -l`,
      { encoding: "utf8", timeout: 5000 }
    ).trim();

    // Lines changed last 7 days
    const diffStat = execSync(
      `git -C "${dir}" diff --shortstat HEAD~${Math.min(parseInt(weekCommits) || 1, 100)} 2>/dev/null || echo "0 files"`,
      { encoding: "utf8", timeout: 5000 }
    ).trim();

    console.log(`  ${c.dim}Last 7 days:${c.reset}  ${c.bold}${weekCommits.trim()}${c.reset} commits`);
    console.log(`  ${c.dim}Last 30 days:${c.reset} ${c.bold}${monthCommits.trim()}${c.reset} commits`);
    if (diffStat) console.log(`  ${c.dim}Diff:${c.reset}         ${diffStat}`);
  } catch {
    console.log(`  ${c.dim}Not a git repository or git not available.${c.reset}`);
  }
}

function showFeatureMetrics(teamDir) {
  const featuresDir = join(teamDir, "features");
  try {
    const dirs = readdirSync(featuresDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    let totalTasks = 0, totalPassed = 0, totalGates = 0, totalGatePassed = 0;

    for (const d of dirs) {
      const statePath = join(featuresDir, d.name, "STATE.json");
      if (!existsSync(statePath)) continue;
      try {
        const state = JSON.parse(readFileSync(statePath, "utf8"));
        const tasks = state.tasks || [];
        totalTasks += tasks.length;
        totalPassed += tasks.filter(t => t.status === "passed").length;
        totalGates += (state.gates || []).length;
        totalGatePassed += (state.gates || []).filter(g => g.verdict === "PASS").length;
      } catch { /* skip */ }
    }

    console.log(`  Features:        ${c.bold}${dirs.length}${c.reset}`);
    console.log(`  Tasks:           ${c.bold}${totalPassed}/${totalTasks}${c.reset} passed`);
    console.log(`  Gate pass rate:  ${c.bold}${totalGates > 0 ? Math.round(totalGatePassed / totalGates * 100) : 0}%${c.reset}`);
  } catch {
    console.log(`  ${c.dim}No feature data.${c.reset}`);
  }
}

function formatNumber(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
