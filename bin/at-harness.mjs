#!/usr/bin/env node

// at-harness — Enforcement layer for autonomous agent teams
// All output is JSON to stdout. Errors to stderr.

import { cmdHarnessInit } from "./lib/harness-init.mjs";
import { cmdGate } from "./lib/gate.mjs";
import { cmdTransition } from "./lib/transition.mjs";
import { cmdNotify } from "./lib/notify.mjs";
import { cmdFinalize } from "./lib/finalize.mjs";
import { cmdHarnessMetrics } from "./lib/harness-metrics.mjs";

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case "init":       cmdHarnessInit(args);    break;
  case "gate":       cmdGate(args);           break;
  case "transition": cmdTransition(args);     break;
  case "notify":     cmdNotify(args);         break;
  case "finalize":   cmdFinalize(args);       break;
  case "metrics":    cmdHarnessMetrics(args);  break;
  default:
    console.log("at-harness — Enforcement layer for autonomous agent teams");
    console.log();
    console.log("Commands:");
    console.log("  init       --feature <name> [--dir <path>]          Create feature state");
    console.log("  gate       --cmd <command> --dir <path> [--task <id>]");
    console.log("                                                      Run quality check, write verdict");
    console.log("  transition --task <id> --status <status> --dir <path> [--reason <text>]");
    console.log("                                                      Validate + execute state change");
    console.log("  notify     --event <type> --msg <message> [--channel <target>]");
    console.log("                                                      Dispatch progress notification");
    console.log("  finalize   --dir <path> [--strict]                  Validate chain, mark complete");
    console.log("  metrics    --dir <path>                             Compute feature metrics");
    console.log();
    console.log("All output is JSON to stdout. Errors go to stderr.");
    console.log("State is tamper-detected via nonce signatures.");
    break;
}
