// report.mjs — agt report <feature>
// Prints a readable execution report for a feature from STATE.json

import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { readState } from "./util.mjs";

export function buildReport(state) {
  const lines = [];
  const feature = state.feature || "unknown";
  const status = state.status || "unknown";
  const tasks = state.tasks || [];
  const gates = state.gates || [];

  // Section 1: Header
  const isComplete = status === "completed";
  let duration = "N/A";
  if (state.createdAt) {
    const startMs = new Date(state.createdAt).getTime();
    const endIso = state.completedAt || state._last_modified;
    const endMs = endIso ? new Date(endIso).getTime() : Date.now();
    const mins = Math.round((endMs - startMs) / 60000);
    if (mins < 60) {
      duration = `${mins}m`;
    } else {
      const hours = Math.floor(mins / 60);
      const rem = mins % 60;
      duration = rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
    }
  }
  const statusLabel = isComplete ? "completed" : "Run in progress";
  lines.push(`# Execution Report: ${feature}`);
  lines.push(`Status: ${statusLabel}  |  Duration: ${duration}  |  Tasks: ${tasks.length}`);
  if (state.createdAt) lines.push(`Started: ${state.createdAt}`);
  if (state.completedAt) lines.push(`Completed: ${state.completedAt}`);
  lines.push("");

  // Section 2: Task Summary
  lines.push("## Task Summary");
  lines.push("| Task | Status | Attempts | Gate Verdict |");
  lines.push("|------|--------|----------|--------------|");
  for (const task of tasks) {
    const taskGates = gates.filter(g => g.taskId === task.id);
    const lastVerdict = taskGates.length > 0 ? taskGates[taskGates.length - 1].verdict : "—";
    lines.push(`| ${task.id} | ${task.status} | ${task.attempts ?? 0} | ${lastVerdict} |`);
  }
  lines.push("");

  // Section 3: Cost Breakdown
  lines.push("## Cost Breakdown");
  const passGates = gates.filter(g => g.verdict === "PASS").length;
  const failGates = gates.filter(g => g.verdict === "FAIL").length;
  const totalCostUsd = state.tokenUsage?.total?.costUsd;
  const totalCost = totalCostUsd != null
    ? `$${totalCostUsd.toFixed(4)}`
    : `N/A (see \`agt metrics\`)`;
  const byPhase = state.tokenUsage?.byPhase;
  const perPhase = byPhase
    ? Object.entries(byPhase).map(([k, v]) => `${k}: $${v.costUsd?.toFixed(4) ?? "N/A"}`).join(", ")
    : `N/A (see \`agt metrics\`)`;
  lines.push(`  Total cost (USD):         ${totalCost}`);
  lines.push(`  Dispatches (transitions): ${state.transitionCount ?? 0}`);
  lines.push(`  Gate runs:                ${gates.length}  (${passGates} pass / ${failGates} fail)`);
  lines.push(`  Per-phase split:          ${perPhase}`);
  lines.push("");

  // Section 4: Blocked / Failed Tasks
  const problem = tasks.filter(t => t.status === "blocked" || t.status === "failed");
  if (problem.length > 0) {
    lines.push("## Blocked / Failed Tasks");
    for (const task of problem) {
      lines.push(`  [${(task.status || "unknown").toUpperCase()}] ${task.id}: ${task.title || "(no title)"}`);
      if (task.lastReason) lines.push(`    Reason: ${task.lastReason}`);
    }
    lines.push("");
  }

  // Section 5: Recommendations
  const recs = [];
  const highAttempts = tasks.filter(t => (t.attempts ?? 0) >= 3);
  for (const t of highAttempts) {
    recs.push(`Consider simplifying task ${t.id} (${t.attempts} attempts)`);
  }
  const gateWarnings = tasks.filter(t => t.gateWarningHistory && t.gateWarningHistory.length > 0);
  for (const t of gateWarnings) {
    const layers = t.gateWarningHistory.flatMap(e => e.layers || []);
    const unique = [...new Set(layers)];
    recs.push(`Task ${t.id} has repeated gate warnings: ${unique.join(", ")}`);
  }
  if (problem.length > 0 && problem.length === tasks.length) {
    recs.push("Feature is stalled — all tasks are blocked or failed");
  } else if (problem.length > 0) {
    recs.push(`${problem.length} task(s) need attention before feature can complete`);
  }
  if (failGates > 0 && passGates === 0) {
    recs.push("No gate passes recorded — review quality gate command");
  }
  if (recs.length > 0) {
    lines.push("## Recommendations");
    for (const rec of recs) lines.push(`  \u2022 ${rec}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * agt report <feature>
 *
 * Reads STATE.json for the given feature and prints a structured report to stdout.
 * With --output md, writes REPORT.md to the feature directory instead.
 *
 * @param {string[]} args - CLI args; positional <feature> + optional --output md
 * @param {object}   deps - Injectable dependencies for testing
 */
export function cmdReport(args = [], deps = {}) {
  const featureName = args.find(a => !a.startsWith("-"));
  const outputMdIdx = args.indexOf("--output");
  const outputMd = outputMdIdx !== -1 && args[outputMdIdx + 1] === "md";

  const {
    readState: _readState = readState,
    existsSync: _existsSync = existsSync,
    writeFileSync: _writeFileSync = writeFileSync,
    stdout: _stdout = process.stdout,
    exit: _exit = (code) => process.exit(code),
    cwd: _cwd = () => process.cwd(),
  } = deps;

  if (!featureName) {
    _stdout.write("Usage: agt report <feature>\n");
    _exit(1);
    return;
  }

  const featureDir = join(_cwd(), ".team", "features", featureName);

  if (!_existsSync(featureDir)) {
    _stdout.write(`report: feature directory not found: ${featureDir}\n`);
    _exit(1);
    return;
  }

  const state = _readState(featureDir);
  if (!state) {
    _stdout.write(`report: STATE.json not found in ${featureDir}\n`);
    _exit(1);
    return;
  }

  const report = buildReport(state);

  if (outputMd) {
    const outPath = join(featureDir, "REPORT.md");
    _writeFileSync(outPath, report + "\n");
    _stdout.write(`report: written to ${outPath}\n`);
  } else {
    _stdout.write(report + "\n");
  }
}
