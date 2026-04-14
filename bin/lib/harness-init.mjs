// at-harness init — create feature state in .team/features/{name}/STATE.json

import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import {
  getFlag, hasFlag, writeState, generateNonce, WRITER_SIG,
} from "./util.mjs";

export function cmdHarnessInit(args) {
  const feature = getFlag(args, "feature");
  const dir = getFlag(args, "dir", ".team");
  const force = hasFlag(args, "force");

  if (!feature) {
    console.error("Usage: at-harness init --feature <name> [--dir <path>]");
    process.exit(1);
  }

  const featureDir = join(dir, "features", feature);
  const statePath = join(featureDir, "STATE.json");

  if (existsSync(statePath) && !force) {
    console.log(JSON.stringify({
      created: false,
      error: `STATE.json already exists for feature '${feature}' (use --force to overwrite)`,
    }));
    return;
  }

  mkdirSync(featureDir, { recursive: true });

  const state = {
    version: "2.0",
    feature,
    status: "active",
    tasks: [],
    gates: [],
    transitionCount: 0,
    transitionHistory: [],
    createdAt: new Date().toISOString(),
  };

  writeState(featureDir, state);

  console.log(JSON.stringify({
    created: true,
    feature,
    dir: featureDir,
  }));
}
