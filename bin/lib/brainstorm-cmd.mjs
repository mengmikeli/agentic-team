// agt brainstorm — interactive brainstorm session
// Explores an idea, asks clarifying questions, writes SPEC.md when done.

import { createInterface } from "readline";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { c } from "./util.mjs";
import { findAgent, dispatchToAgent } from "./run.mjs";

// ── Helpers ─────────────────────────────────────────────────────

function askLine(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function loadProductContext(cwd) {
  const productPath = join(cwd, ".team", "PRODUCT.md");
  if (existsSync(productPath)) {
    try {
      return readFileSync(productPath, "utf8");
    } catch {}
  }
  return null;
}

// ── Agent-based brainstorm ──────────────────────────────────────

function buildBrainstormBrief(idea, productContext, cwd) {
  const productSection = productContext
    ? `## Product Context\n${productContext.slice(0, 3000)}\n`
    : "";

  return `You are brainstorming a feature idea. Explore it thoroughly and produce a SPEC.md.

## Idea
${idea}

${productSection}
## Working Directory
${cwd}

## Your Task
1. Analyze the idea from multiple angles
2. Consider technical approaches with trade-offs
3. Identify the minimal viable scope
4. Define clear done-when criteria

## Required Output
Write your analysis and then produce a complete SPEC.md in this format:

\`\`\`markdown
# Feature: {name}

## Goal
{One clear sentence describing the outcome}

## Scope
{Concrete list of what's included}

## Out of Scope
{Explicit list of what's excluded}

## Approach
{Technical approach with trade-offs discussed}

## Done When
- [ ] {Concrete, verifiable criterion}
- [ ] {Concrete, verifiable criterion}
\`\`\`

Output the spec content between SPEC_START and SPEC_END markers:
SPEC_START
{your spec content}
SPEC_END`;
}

// ── Interactive brainstorm (no agent) ───────────────────────────

async function interactiveBrainstorm(idea, productContext) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => askLine(rl, q);

  console.log(`\n${c.bold}── Brainstorming: ${idea || "new idea"} ──${c.reset}\n`);

  if (productContext) {
    console.log(`${c.dim}Product context loaded from PRODUCT.md${c.reset}\n`);
  }

  // Step 1: Clarify the idea
  if (!idea) {
    idea = await ask(`${c.cyan}What do you want to build? ${c.reset}`);
    if (!idea.trim()) {
      rl.close();
      return null;
    }
  }

  console.log(`\n${c.dim}Let me ask a few questions to shape this...${c.reset}\n`);

  // Step 2: Clarifying questions
  const problem = await ask(`${c.cyan}What problem does this solve? ${c.reset}`);
  const users = await ask(`${c.cyan}Who is this for? ${c.reset}`);
  const constraints = await ask(`${c.cyan}Any constraints or requirements? ${c.reset}`);
  const notScope = await ask(`${c.cyan}What's explicitly out of scope? ${c.reset}`);

  // Step 3: Approaches
  console.log(`\n${c.bold}── Approaches ──${c.reset}\n`);
  console.log(`${c.dim}Let me suggest some approaches. Enter your thoughts on each.${c.reset}\n`);

  const approach1 = await ask(`${c.cyan}Option A — Simple/minimal approach. What comes to mind? ${c.reset}`);
  const approach2 = await ask(`${c.cyan}Option B — Robust/scalable approach. Thoughts? ${c.reset}`);
  const preferred = await ask(`${c.cyan}Which approach do you prefer? (a/b/other): ${c.reset}`);

  // Step 4: Done criteria
  console.log(`\n${c.bold}── Done When ──${c.reset}`);
  console.log(`${c.dim}Enter done criteria one per line. Empty line to finish.${c.reset}\n`);

  const criteria = [];
  let idx = 1;
  while (true) {
    const criterion = await ask(`${c.cyan}  ${idx}. ${c.reset}`);
    if (!criterion.trim()) break;
    criteria.push(criterion.trim());
    idx++;
  }

  rl.close();

  if (criteria.length === 0) {
    criteria.push("Feature implemented and working");
    criteria.push("Quality gate passes");
  }

  // Build spec
  const featureName = slugify(idea);
  const approachText = preferred.toLowerCase().startsWith("a")
    ? (approach1 || "Minimal approach")
    : preferred.toLowerCase().startsWith("b")
    ? (approach2 || "Robust approach")
    : (preferred || approach1 || "TBD");

  const spec = `# Feature: ${idea}

## Goal
${problem || idea}

## Users
${users || "TBD"}

## Scope
- ${idea}
${constraints ? `- Constraints: ${constraints}` : ""}

## Out of Scope
${notScope ? `- ${notScope}` : "- TBD"}

## Approach
${approachText}

### Trade-offs
- Option A (simple): ${approach1 || "N/A"}
- Option B (robust): ${approach2 || "N/A"}
- Selected: ${preferred || "TBD"}

## Done When
${criteria.map(c => `- [ ] ${c}`).join("\n")}
`;

  return { name: featureName, spec };
}

// ── Main command ────────────────────────────────────────────────

export async function cmdBrainstorm(args) {
  const cwd = process.cwd();
  const idea = args.filter(a => !a.startsWith("-")).join(" ").trim();

  console.log(`\n${c.bold}${c.cyan}⚡ agt brainstorm${c.reset}\n`);

  const productContext = loadProductContext(cwd);
  const agent = findAgent();

  let result;

  if (agent && idea) {
    // Agent-based brainstorm
    console.log(`${c.bold}Agent:${c.reset}    ${c.green}${agent}${c.reset}`);
    console.log(`${c.bold}Idea:${c.reset}     ${idea}\n`);

    const brief = buildBrainstormBrief(idea, productContext, cwd);
    console.log(`${c.dim}Brainstorming with ${agent}...${c.reset}\n`);
    const agentResult = dispatchToAgent(agent, brief, cwd);

    if (!agentResult.ok) {
      console.log(`${c.red}Brainstorm failed: ${agentResult.error}${c.reset}`);
      process.exit(1);
    }

    // Extract spec from agent output
    const output = agentResult.output || "";
    const specMatch = output.match(/SPEC_START\n([\s\S]*?)\nSPEC_END/);
    const specContent = specMatch ? specMatch[1].trim() : output;

    const featureName = slugify(idea);
    result = { name: featureName, spec: specContent };
  } else {
    // Interactive brainstorm (no agent or no idea)
    if (!agent) {
      console.log(`${c.dim}No coding agent found — running interactive brainstorm.${c.reset}\n`);
    }
    result = await interactiveBrainstorm(idea, productContext);
  }

  if (!result) {
    console.log(`${c.yellow}Brainstorm cancelled.${c.reset}`);
    return;
  }

  // Write SPEC.md
  const teamDir = join(cwd, ".team");
  const featureDir = join(teamDir, "features", result.name);
  mkdirSync(featureDir, { recursive: true });
  const specPath = join(featureDir, "SPEC.md");
  writeFileSync(specPath, result.spec);

  console.log(`\n${"═".repeat(50)}`);
  console.log(`${c.green}${c.bold}✓ SPEC.md written${c.reset}`);
  console.log(`  ${c.dim}${specPath}${c.reset}`);
  console.log(`${"═".repeat(50)}\n`);

  console.log(`${c.cyan}Next steps:${c.reset}`);
  console.log(`  ${c.bold}agt run "${result.name}"${c.reset} — implement this feature`);
  console.log(`  ${c.bold}agt review${c.reset} — review changes after implementation\n`);
}
