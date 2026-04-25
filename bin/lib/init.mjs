// at init — interactive project setup
// Combines product-init + project-init + agent-init into one flow.

import { createInterface } from "readline";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { atomicWriteSync, c } from "./util.mjs";
import { ghAvailable, createProjectBoard, getProjectFieldIds } from "./github.mjs";

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
    const wantBoard = repo
      ? (await ask(`${c.cyan}Create a GitHub Project board? (yes/no): ${c.reset}`))
      : "no";

    // Agent layer
    console.log(`\n${c.bold}── Team ──${c.reset}`);
    const model = await ask(`${c.cyan}Primary model (e.g., claude-sonnet-4-20250514): ${c.reset}`) || "claude-sonnet-4-20250514";
    const notifyChannel = await ask(`${c.cyan}Notification channel (discord/stdout): ${c.reset}`) || "stdout";

    rl.close();

    // Scaffold .team/
    const teamDir = join(dir, ".team");
    mkdirSync(join(teamDir, "features"), { recursive: true });
    mkdirSync(join(teamDir, "runbooks"), { recursive: true });

    // Create GitHub Project board if requested
    let trackingSection = "";
    if (wantBoard.trim().toLowerCase().startsWith("y") && ghAvailable()) {
      const board = createProjectBoard(`${name} Board`);
      if (board) {
        const fieldIds = getProjectFieldIds(board.number);
        if (fieldIds) {
          const pendingLine = fieldIds.pendingApprovalId ? `- Pending Approval Option ID: ${fieldIds.pendingApprovalId}\n` : "";
          const readyLine = fieldIds.readyId ? `- Ready Option ID: ${fieldIds.readyId}\n` : "";
          trackingSection = `\n## Tracking\n- Project URL: ${board.url}\n- Status Field ID: ${fieldIds.statusFieldId}\n- Todo Option ID: ${fieldIds.todoId}\n- In Progress Option ID: ${fieldIds.inProgressId}\n- Done Option ID: ${fieldIds.doneId}\n${pendingLine}${readyLine}`;
          console.log(`${c.green}✓ GitHub Project board created${c.reset} — ${board.url}`);
        }
      }
    }

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
${trackingSection}`;
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
    console.log(`  3. ${c.bold}at board${c.reset} — view task board`);
    console.log();
    console.log(`${c.yellow}Board setup required (before running agt run):${c.reset}`);
    console.log(`  Add these two columns to your GitHub project board manually:`);
    console.log(`    • ${c.bold}Pending Approval${c.reset} — items waiting for human review`);
    console.log(`    • ${c.bold}Ready${c.reset} — items approved and ready to execute`);
    console.log(`  Then record their Option IDs in .team/PROJECT.md under the Tracking section.`);
    console.log(`  Run ${c.bold}agt help run${c.reset} for details.\n`);
  })();
}
