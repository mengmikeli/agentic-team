// at stop — pause execution by writing pause signal to active features

import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { c, readState, writeState, lockFile } from "./util.mjs";

export function cmdStop(args) {
  const dir = args[0] || ".";
  const featureName = args.find(a => !a.startsWith("-"));
  const teamDir = join(dir, ".team");
  const featuresDir = join(teamDir, "features");

  if (!existsSync(featuresDir)) {
    console.log(`${c.dim}No features directory.${c.reset}`);
    return;
  }

  const featureNames = featureName
    ? [featureName]
    : readdirSync(featuresDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

  let paused = 0;

  for (const name of featureNames) {
    const featureDir = join(featuresDir, name);
    const state = readState(featureDir);
    if (!state || state.status !== "active") continue;

    const statePath = join(featureDir, "STATE.json");
    const lock = lockFile(statePath, { command: "stop" });
    if (!lock.acquired) {
      console.log(`${c.yellow}⚠ Could not lock ${name}${c.reset}`);
      continue;
    }

    try {
      const freshState = readState(featureDir);
      if (!freshState || freshState.status !== "active") continue;

      freshState.status = "paused";
      freshState.pausedAt = new Date().toISOString();
      writeState(featureDir, freshState);
      paused++;
      console.log(`${c.yellow}⏸ Paused: ${name}${c.reset}`);
    } finally {
      lock.release();
    }
  }

  if (paused === 0) {
    console.log(`${c.dim}No active features to pause.${c.reset}`);
  } else {
    console.log(`\n${c.green}${paused} feature(s) paused.${c.reset} Run ${c.bold}at run${c.reset} to resume.`);
  }
}
