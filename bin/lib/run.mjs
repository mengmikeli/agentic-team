// at run — autonomous loop (phase 2 stub)
// For now: print the plan and explain what orchestrate would do.

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { c } from "./util.mjs";

export function cmdRun(args) {
  const description = args.filter(a => !a.startsWith("-")).join(" ");
  const dir = ".";
  const teamDir = join(dir, ".team");

  if (!existsSync(teamDir)) {
    console.log(`${c.red}No .team/ directory found.${c.reset} Run ${c.bold}at init${c.reset} first.`);
    process.exit(1);
  }

  console.log(`\n${c.bold}${c.cyan}⚡ at run${c.reset}\n`);

  if (description) {
    console.log(`${c.bold}Feature:${c.reset} ${description}\n`);
  }

  console.log(`${c.bold}Execution plan:${c.reset}\n`);

  const steps = [
    { step: 1, name: "brainstorm",   desc: "Explore requirements, produce SPEC.md" },
    { step: 2, name: "harness init", desc: "Create feature state (at-harness init)" },
    { step: 3, name: "plan tasks",   desc: "Break spec into concrete tasks" },
    { step: 4, name: "dispatch",     desc: "Assign tasks to subagents" },
    { step: 5, name: "gate",         desc: "Run quality checks (at-harness gate)" },
    { step: 6, name: "transition",   desc: "Validate state changes (at-harness transition)" },
    { step: 7, name: "notify",       desc: "Push progress updates" },
    { step: 8, name: "finalize",     desc: "Validate chain, mark complete (at-harness finalize)" },
    { step: 9, name: "PR",           desc: "Open pull request for human review" },
  ];

  for (const s of steps) {
    console.log(`  ${c.cyan}${s.step}.${c.reset} ${c.bold}${s.name}${c.reset}`);
    console.log(`     ${c.dim}${s.desc}${c.reset}`);
  }

  console.log(`\n${c.yellow}${c.bold}⚠ Phase 2:${c.reset} ${c.yellow}Full autonomous loop not yet implemented.${c.reset}`);
  console.log(`${c.dim}The harness commands (gate, transition, finalize) are ready.`);
  console.log(`The orchestrate skill calls them. Full CLI automation coming in v2.1.${c.reset}`);

  // Show what's available
  console.log(`\n${c.bold}Available now:${c.reset}`);
  console.log(`  ${c.green}✓${c.reset} at-harness init     — create feature state`);
  console.log(`  ${c.green}✓${c.reset} at-harness gate     — run quality checks`);
  console.log(`  ${c.green}✓${c.reset} at-harness transition — validate state changes`);
  console.log(`  ${c.green}✓${c.reset} at-harness notify   — push progress events`);
  console.log(`  ${c.green}✓${c.reset} at-harness finalize — validate + complete`);
  console.log(`  ${c.green}✓${c.reset} at status           — project dashboard`);
  console.log(`  ${c.green}✓${c.reset} at board            — task board`);
  console.log(`  ${c.green}✓${c.reset} at metrics          — usage stats`);

  // If there's a gate command configured, show it
  try {
    const projectMd = readFileSync(join(teamDir, "PROJECT.md"), "utf8");
    const gateMatch = projectMd.match(/```sh\n(.+?)\n```/s);
    if (gateMatch) {
      console.log(`\n${c.bold}Configured gate:${c.reset} ${c.cyan}${gateMatch[1].trim()}${c.reset}`);
    }
  } catch { /* no project config */ }

  console.log();
}
