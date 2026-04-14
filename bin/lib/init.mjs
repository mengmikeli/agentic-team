// at init — interactive project setup
// Combines product-init + project-init + agent-init into one flow.

import { createInterface } from "readline";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { atomicWriteSync, c } from "./util.mjs";

export function cmdInit(args) {
  const dir = args[0] || ".";

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  (async () => {
    console.log(`\n${c.bold}${c.cyan}⚡ agentic-team init${c.reset}\n`);
    console.log(`${c.dim}Setting up a new project for autonomous agent teams.${c.reset}\n`);

    // Product layer
    console.log(`${c.bold}── Product ──${c.reset}`);
    const name = await ask(`${c.cyan}Project name: ${c.reset}`) || "my-project";
    const vision = await ask(`${c.cyan}Vision (one sentence): ${c.reset}`) || "Build something great";
    const users = await ask(`${c.cyan}Target users: ${c.reset}`) || "Developers";

    // Project layer
    console.log(`\n${c.bold}── Project ──${c.reset}`);
    const stack = await ask(`${c.cyan}Tech stack (e.g., Node.js, Python): ${c.reset}`) || "Node.js";
    const repo = await ask(`${c.cyan}GitHub repo (owner/name): ${c.reset}`) || "";
    const gateCmd = await ask(`${c.cyan}Quality gate command (e.g., npm test): ${c.reset}`) || "npm test";

    // Agent layer
    console.log(`\n${c.bold}── Team ──${c.reset}`);
    const model = await ask(`${c.cyan}Primary model (e.g., claude-sonnet-4-20250514): ${c.reset}`) || "claude-sonnet-4-20250514";
    const notifyChannel = await ask(`${c.cyan}Notification channel (discord/stdout): ${c.reset}`) || "stdout";

    rl.close();

    // Scaffold .team/
    const teamDir = join(dir, ".team");
    mkdirSync(join(teamDir, "features"), { recursive: true });

    // PRODUCT.md
    const productMd = `# ${name} — Product

## Vision
${vision}

## Users
${users}

## Roadmap
- [ ] Initial release

## Success Metrics
- Feature delivery rate
- Quality gate pass rate
`;
    atomicWriteSync(join(teamDir, "PRODUCT.md"), productMd);

    // PROJECT.md
    const projectMd = `# ${name} — Project

## Stack
${stack}

## Repository
${repo || "Not configured"}

## Quality Gate
\`\`\`sh
${gateCmd}
\`\`\`

## Notifications
Channel: ${notifyChannel}

## Model
${model}
`;
    atomicWriteSync(join(teamDir, "PROJECT.md"), projectMd);

    // AGENTS.md
    const agentsMd = `# ${name} — Agents

## Coordinator
- Role: orchestrate features, dispatch tasks, enforce quality
- Model: ${model}

## Implementer
- Role: execute tasks, write code, run tests
- Model: ${model}

## Reviewer
- Role: code review, quality assessment
- Model: ${model}
`;
    atomicWriteSync(join(teamDir, "AGENTS.md"), agentsMd);

    // HISTORY.md
    const historyMd = `# ${name} — Feature History

| Feature | Status | Duration | Tasks | Gate Pass Rate |
|---------|--------|----------|-------|----------------|
`;
    atomicWriteSync(join(teamDir, "HISTORY.md"), historyMd);

    console.log(`\n${c.green}${c.bold}✓ Project initialized${c.reset}`);
    console.log(`${c.dim}  Created .team/ with PRODUCT.md, PROJECT.md, AGENTS.md, HISTORY.md${c.reset}`);
    console.log(`\n${c.cyan}Next steps:${c.reset}`);
    console.log(`  1. ${c.bold}at run "build feature X"${c.reset} — start autonomous loop`);
    console.log(`  2. ${c.bold}at status${c.reset} — see project dashboard`);
    console.log(`  3. ${c.bold}at board${c.reset} — view task board\n`);
  })();
}
