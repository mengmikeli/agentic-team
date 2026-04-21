// Sprint analytics — aggregate execution metrics per sprint from STATE.json files

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

const MONTH_MAP = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };

// Parse date range strings like "Apr 1–14", "Apr 14", "Apr 14–18"
export function parseDateRange(dateStr) {
  const m = dateStr.trim().match(/^(\w{3})\s+(\d+)(?:[–\-](\d+))?(?:\s+(\d{4}))?/);
  if (!m) return null;
  const month = MONTH_MAP[m[1]];
  if (!month) return null;
  const year = m[4] ? parseInt(m[4]) : new Date().getFullYear();
  const startDay = parseInt(m[2]);
  const endDay = m[3] ? parseInt(m[3]) : startDay;
  return {
    start: new Date(year, month - 1, startDay, 0, 0, 0, 0),
    end: new Date(year, month - 1, endDay, 23, 59, 59, 999),
  };
}

// Parse SPRINTS.md markdown table into sprint objects
export function parseSprints(sprintsPath) {
  if (!existsSync(sprintsPath)) return [];
  const content = readFileSync(sprintsPath, "utf8");
  const sprints = [];
  for (const line of content.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cols = line.split("|").map(s => s.trim()).filter(Boolean);
    if (cols.length < 4) continue;
    const [name, status, , dates] = cols;
    if (!name || name.includes("Sprint") || name.includes("---") || name.includes("─")) continue;
    const dateRange = parseDateRange(dates || "");
    sprints.push({
      name,
      status: status.includes("Done") || status.includes("✅") ? "done" : "active",
      dates: dateRange,
    });
  }
  return sprints;
}

// Find active sprint or most recently completed sprint
export function findTargetSprint(teamDir) {
  const projectPath = join(teamDir, "PROJECT.md");
  const sprintsPath = join(teamDir, "SPRINTS.md");

  let activeSprintName = null;
  if (existsSync(projectPath)) {
    const content = readFileSync(projectPath, "utf8");
    const m = content.match(/##\s+Active Sprint\s*\n+([^\n]+)/);
    if (m) {
      const val = m[1].trim();
      if (val && val !== "None" && val !== "—" && val !== "-") {
        activeSprintName = val;
      }
    }
  }

  const sprints = parseSprints(sprintsPath);
  if (sprints.length === 0) return null;

  if (activeSprintName) {
    const found = sprints.find(s => s.name === activeSprintName);
    if (found) return { ...found, type: "active" };
  }

  // Most recently completed sprint (by end date)
  const done = sprints.filter(s => s.status === "done" && s.dates);
  if (done.length === 0) return sprints[sprints.length - 1] ? { ...sprints[sprints.length - 1], type: "completed" } : null;
  done.sort((a, b) => b.dates.end - a.dates.end);
  return { ...done[0], type: "completed" };
}

// Load all STATE.json files from .team/features/
function loadFeatureStates(teamDir) {
  const featuresDir = join(teamDir, "features");
  if (!existsSync(featuresDir)) return [];
  const states = [];
  try {
    const dirs = readdirSync(featuresDir, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const dir of dirs) {
      const statePath = join(featuresDir, dir.name, "STATE.json");
      if (!existsSync(statePath)) continue;
      try {
        states.push(JSON.parse(readFileSync(statePath, "utf8")));
      } catch { /* skip malformed */ }
    }
  } catch { /* skip */ }
  return states;
}

// Filter states to those created within the sprint date range
function filterByDateRange(states, dateRange) {
  if (!dateRange) return states;
  return states.filter(s => {
    if (!s.createdAt) return false;
    const created = new Date(s.createdAt);
    return created >= dateRange.start && created <= dateRange.end;
  });
}

// Compute task cycle times in minutes (start: in-progress transition, end: lastGate)
export function computeCycleTime(states) {
  const times = [];
  for (const state of states) {
    const history = state.transitionHistory || [];
    for (const task of state.tasks || []) {
      if (!["passed", "failed", "skipped"].includes(task.status)) continue;
      const started = history.find(t => t.taskId === task.id && t.status === "in-progress");
      if (!started) continue;
      const endTs = task.lastGate?.timestamp || task.lastTransition;
      if (!endTs) continue;
      const ms = new Date(endTs) - new Date(started.timestamp);
      if (ms > 0) times.push(ms / 60000);
    }
  }
  return times;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

// Failure rate: failed terminal tasks / all terminal tasks
export function computeFailureRate(states) {
  let failed = 0, terminal = 0;
  for (const state of states) {
    for (const task of state.tasks || []) {
      if (["passed", "failed", "skipped"].includes(task.status)) {
        terminal++;
        if (task.status === "failed") failed++;
      }
    }
  }
  return terminal === 0 ? null : failed / terminal;
}

// Gate pass rate: PASS gates / total gates
export function computeGatePassRate(states) {
  let pass = 0, total = 0;
  for (const state of states) {
    const gates = state.gates || [];
    total += gates.length;
    pass += gates.filter(g => g.verdict === "PASS").length;
  }
  return total === 0 ? null : pass / total;
}

// Derive flow template from task count (heuristic matching flows.mjs tiers)
function deriveFlow(taskCount) {
  if (taskCount <= 2) return "light";
  if (taskCount <= 4) return "build-verify";
  return "full-stack";
}

// Flow template usage distribution across features
export function computeFlowUsage(states) {
  const counts = { light: 0, "build-verify": 0, "full-stack": 0 };
  for (const state of states) {
    const flow = deriveFlow((state.tasks || []).length);
    counts[flow]++;
  }
  return counts;
}

// Re-plan rate: tasks with replanSource / total tasks
export function computeReplanRate(states) {
  let replanned = 0, total = 0;
  for (const state of states) {
    const tasks = state.tasks || [];
    total += tasks.length;
    replanned += tasks.filter(t => t.replanSource).length;
  }
  return total === 0 ? null : replanned / total;
}

// Main aggregation function — returns sprint analytics object
export function computeSprintMetrics(teamDir) {
  const sprint = findTargetSprint(teamDir);
  const allStates = loadFeatureStates(teamDir);
  const states = sprint?.dates ? filterByDateRange(allStates, sprint.dates) : allStates;

  if (states.length === 0) {
    return { sprint, features: 0, noData: true };
  }

  const cycleTimes = computeCycleTime(states).sort((a, b) => a - b);

  return {
    sprint,
    features: states.length,
    cycleTime: {
      median: percentile(cycleTimes, 50),
      p90: percentile(cycleTimes, 90),
      samples: cycleTimes.length,
    },
    failureRate: computeFailureRate(states),
    gatePassRate: computeGatePassRate(states),
    flowUsage: computeFlowUsage(states),
    replanRate: computeReplanRate(states),
  };
}
