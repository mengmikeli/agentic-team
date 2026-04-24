// agt stop / agt pause — graceful pause for running features
// Writes a .pause signal file that the inner loop checks between tasks.
// Also directly pauses features with status "active" or "executing".

import { existsSync, readdirSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { c, readState, writeState, lockFile } from "./util.mjs";

/**
 * Pause signal file — the inner loop checks for this between tasks.
 * This avoids killing the process; the loop finishes its current task
 * and exits cleanly.
 */
function writePauseSignal(featureDir) {
  const signalPath = join(featureDir, ".pause");
  writeFileSync(signalPath, JSON.stringify({
    requestedAt: new Date().toISOString(),
    pid: process.pid,
  }) + "\n");
}

export function hasPauseSignal(featureDir) {
  return existsSync(join(featureDir, ".pause"));
}

export function clearPauseSignal(featureDir) {
  try {
    unlinkSync(join(featureDir, ".pause"));
  } catch { /* best effort */ }
}

export function cmdStop(args) {
  const dir = args.find(a => !a.startsWith("-")) || ".";
  const teamDir = join(dir, ".team");
  const featuresDir = join(teamDir, "features");

  if (!existsSync(featuresDir)) {
    console.log(`${c.dim}No features directory.${c.reset}`);
    return;
  }

  // Find all executing or active features
  const featureDirs = readdirSync(featuresDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let paused = 0;

  for (const name of featureDirs) {
    const featureDir = join(featuresDir, name);
    const state = readState(featureDir);
    if (!state) continue;
    if (!["active", "executing"].includes(state.status)) continue;

    // Write pause signal for the inner loop to pick up
    writePauseSignal(featureDir);

    // Also update state directly
    const statePath = join(featureDir, "STATE.json");
    const lock = lockFile(statePath, { command: "stop" });
    if (!lock.acquired) {
      console.log(`${c.yellow}⚠ Could not lock ${name} — signal written, will pause after current task${c.reset}`);
      paused++;
      continue;
    }

    try {
      const freshState = readState(featureDir);
      if (!freshState || !["active", "executing"].includes(freshState.status)) continue;

      freshState.status = "paused";
      freshState.pausedAt = new Date().toISOString();
      freshState._pause_reason = "agt stop";
      writeState(featureDir, freshState);
      paused++;
      console.log(`${c.yellow}⏸ Paused: ${name}${c.reset}`);
    } finally {
      lock.release();
    }
  }

  if (paused === 0) {
    console.log(`${c.dim}No running features to pause.${c.reset}`);
  } else {
    console.log(`\n${c.green}${paused} feature(s) paused.${c.reset}`);
    console.log(`Current task will finish, then the run exits cleanly.`);
    console.log(`Resume with ${c.bold}agt run${c.reset}`);
  }
}
