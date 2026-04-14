// Outer product loop for `agt run` (no args).
// Implements the product-level orchestration cycle:
//   PRIORITIZE → BRAINSTORM → EXECUTE → REVIEW OUTCOME → NEXT
//
// The inner loop (_runSingleFeature) handles task-level execution.
// The outer loop handles product-level orchestration.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { c, readState } from "./util.mjs";

// ── Brief builders ──────────────────────────────────────────────

/**
 * Build a brief for the PRIORITIZE step.
 * Agent reads PRODUCT.md and completed features, picks the highest-impact next item.
 *
 * @param {string} productContent - Full PRODUCT.md content
 * @param {string[]} completedFeatures - Names of completed features
 * @param {string} cwd - Working directory
 * @returns {string}
 */
export function buildPrioritizeBrief(productContent, completedFeatures, cwd) {
  const completedList = completedFeatures.length > 0
    ? completedFeatures.map(f => `- ${f}`).join("\n")
    : "None yet.";

  return `You are a product manager. Your job is to pick the single highest-impact next item from the roadmap.

## Product Definition
${productContent}

## Completed Features
${completedList}

## Working Directory
${cwd}

## Your Task
1. Read the product vision, goals, and success metrics above
2. Look at the roadmap — identify items NOT marked as ✅ Done
3. Consider what's already been completed
4. Pick the single highest-impact next item
5. Explain your reasoning: why this one, why now, what it enables

## Required Output Format
You MUST include these exact lines in your output:

PRIORITY: {item name exactly as it appears in the roadmap}
REASONING: {one paragraph explaining why this item is highest impact}

Example:
PRIORITY: Flow templates
REASONING: Flow templates enable the orchestrator to select the right execution strategy per task, which directly improves execution quality and is a prerequisite for parallel reviewers.

Do NOT write any code. Do NOT modify any files. Just analyze and output your recommendation.`;
}

/**
 * Build a brief for the BRAINSTORM step.
 * Agent explores a feature before implementation and writes SPEC.md.
 *
 * @param {string} productContent - Full PRODUCT.md content
 * @param {string[]} completedFeatures - Names of completed features
 * @param {string} priorityItem - The selected priority item description
 * @param {string} featureName - Slugified feature name
 * @param {string} cwd - Working directory
 * @returns {string}
 */
export function buildOuterBrainstormBrief(productContent, completedFeatures, priorityItem, featureName, cwd) {
  const completedList = completedFeatures.length > 0
    ? completedFeatures.map(f => `- ${f}`).join("\n")
    : "None yet.";

  return `You are exploring a feature before implementation. Your job is to define exactly what this feature needs to do, then write a SPEC.md.

## Product Context
${productContent}

## Completed Features
${completedList}

## Feature to Explore
${priorityItem}

## Working Directory
${cwd}

## Your Task
Think through these questions:
1. What exactly does this feature need to do?
2. What's the minimal scope that delivers value?
3. What's explicitly out of scope?
4. What are the done-when criteria (concrete, verifiable)?

Then write a SPEC.md file to: .team/features/${featureName}/SPEC.md

The SPEC.md MUST have these sections:
\`\`\`markdown
# Feature: {name}

## Goal
{One clear sentence describing the outcome}

## Scope
{Concrete list of what's included}

## Out of Scope
{Explicit list of what's excluded}

## Done When
- [ ] {Concrete, verifiable criterion}
- [ ] {Concrete, verifiable criterion}
\`\`\`

Create the directory if it doesn't exist. Do NOT implement the feature — only write the spec.`;
}

/**
 * Build a brief for the REVIEW OUTCOME step.
 * Agent evaluates whether a shipped feature moved the product toward its goals.
 *
 * @param {string} featureName - Name of the completed feature
 * @param {string} productContent - Full PRODUCT.md content
 * @param {string} progressContent - Content of the feature's progress.md
 * @param {string} cwd - Working directory
 * @returns {string}
 */
export function buildOutcomeReviewBrief(featureName, productContent, progressContent, cwd) {
  return `Feature "${featureName}" just shipped. Your job is to evaluate the outcome and update the roadmap.

## Product Definition
${productContent}

## Feature Progress Log
${progressContent || "No progress log available."}

## Working Directory
${cwd}

## Your Task
1. Read the PRODUCT.md success metrics above
2. Read the feature's progress log
3. Assess: did this feature move the product closer to its goals?
4. Update PRODUCT.md roadmap to mark this item as ✅ Done
   - Find the roadmap line that matches "${featureName}" and append "✅ Done" to it
   - Write the updated PRODUCT.md to: ${join(cwd, ".team", "PRODUCT.md")}

## Required Output Format
You MUST include this line in your output:

OUTCOME: {one sentence assessment of impact on product goals}

Example:
OUTCOME: This feature directly advances success metric #1 (autonomous execution) by enabling the orchestrator to select execution strategies per task complexity.

Do NOT modify any code files. Only update PRODUCT.md.`;
}

// ── Output parsers ──────────────────────────────────────────────

/**
 * Parse the PRIORITY line from agent output.
 * Returns null if not found.
 *
 * @param {string} output - Raw agent output
 * @returns {{ name: string, reasoning: string } | null}
 */
export function parsePriorityOutput(output) {
  if (!output) return null;

  const priorityMatch = output.match(/^PRIORITY:\s*(.+)$/m);
  if (!priorityMatch) return null;

  const name = priorityMatch[1].trim();
  if (!name) return null;

  const reasoningMatch = output.match(/^REASONING:\s*(.+)$/m);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : "";

  return { name, reasoning };
}

/**
 * Validate that a SPEC.md file has the required sections.
 *
 * @param {string} specPath - Path to the SPEC.md file
 * @returns {{ valid: boolean, sections: string[], missing: string[] }}
 */
export function validateSpecFile(specPath) {
  const required = ["Goal", "Scope", "Out of Scope", "Done When"];

  if (!existsSync(specPath)) {
    return { valid: false, sections: [], missing: required };
  }

  let content;
  try {
    content = readFileSync(specPath, "utf8");
  } catch {
    return { valid: false, sections: [], missing: required };
  }

  const found = [];
  const missing = [];

  for (const section of required) {
    // Match ## Goal, ## Scope, etc. (case-insensitive)
    const pattern = new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "mi");
    if (pattern.test(content)) {
      found.push(section);
    } else {
      missing.push(section);
    }
  }

  return {
    valid: missing.length === 0,
    sections: found,
    missing,
  };
}

/**
 * Mark a roadmap item as done in PRODUCT.md.
 * Finds the item by name and appends "✅ Done" if not already marked.
 *
 * @param {string} productPath - Path to PRODUCT.md
 * @param {string} itemName - Name to match in the roadmap
 * @returns {boolean} Whether an update was made
 */
export function markRoadmapItemDone(productPath, itemName) {
  if (!existsSync(productPath)) return false;

  let content;
  try {
    content = readFileSync(productPath, "utf8");
  } catch {
    return false;
  }

  // Look for the roadmap line containing this item name
  const lines = content.split("\n");
  let updated = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match numbered roadmap items: "3. **Flow templates** — description"
    // Or items containing the name in bold or plain text
    if (line.match(/^\d+\.\s/) && line.toLowerCase().includes(itemName.toLowerCase())) {
      // Already marked?
      if (/✅\s*Done/i.test(line)) continue;
      // Append "✅ Done" before the line ending
      lines[i] = line.trimEnd() + " ✅ Done";
      updated = true;
      break;
    }
  }

  if (updated) {
    writeFileSync(productPath, lines.join("\n"));
  }

  return updated;
}

/**
 * Get list of completed features from the features directory.
 *
 * @param {string} teamDir - Path to .team directory
 * @returns {string[]}
 */
export function getCompletedFeatures(teamDir) {
  const featuresDir = join(teamDir, "features");
  if (!existsSync(featuresDir)) return [];

  const completed = [];
  try {
    const entries = readdirSync(featuresDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const state = readState(join(featuresDir, entry.name));
      if (state && state.status === "completed") {
        completed.push(entry.name);
      }
    }
  } catch {}

  return completed;
}

/**
 * Slugify a roadmap item name into a feature directory name.
 *
 * @param {string} name - Human-readable name
 * @returns {string}
 */
export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/**
 * Parse roadmap items from PRODUCT.md content.
 * Returns all items with their done status.
 *
 * @param {string} productContent - Full PRODUCT.md content
 * @returns {Array<{ name: string, description: string, done: boolean }>}
 */
export function parseRoadmap(productContent) {
  const roadmapSection = productContent.match(/## Roadmap\n([\s\S]*?)(?=\n##|$)/);
  if (!roadmapSection) return [];

  const items = [...roadmapSection[1].matchAll(/^\d+\.\s*\*\*(.+?)\*\*\s*[-—]\s*(.+)$/gm)];
  return items.map(m => ({
    name: m[1].trim(),
    description: m[2].trim(),
    done: /✅\s*Done/i.test(m[2]),
  }));
}

// ── Outer loop ──────────────────────────────────────────────────

/**
 * Run the outer product loop.
 * Cycles: PRIORITIZE → BRAINSTORM → EXECUTE → REVIEW OUTCOME → NEXT
 *
 * @param {string[]} args - CLI args
 * @param {object} deps - Injectable dependencies
 * @param {function} deps.findAgent - () => string|null
 * @param {function} deps.dispatchToAgent - (agent, brief, cwd) => { ok, output, error }
 * @param {function} deps.runSingleFeature - (args, description) => Promise<string>
 */
export async function outerLoop(args, deps) {
  const { findAgent, dispatchToAgent, runSingleFeature } = deps;

  const cwd = process.cwd();
  const teamDir = join(cwd, ".team");
  const productPath = join(teamDir, "PRODUCT.md");

  if (!existsSync(productPath)) {
    console.log(`${c.red}No PRODUCT.md found.${c.reset} Create one with vision, goals, and roadmap.`);
    process.exit(1);
  }

  const agent = findAgent();
  if (!agent) {
    console.log(`${c.red}No coding agent found (claude/codex).${c.reset} The outer loop requires an agent for prioritization and brainstorming.`);
    process.exit(1);
  }

  // Graceful SIGINT — finish current step, then stop
  let stopping = false;
  process.on("SIGINT", () => {
    if (stopping) process.exit(1);
    stopping = true;
    console.log(`\n${c.yellow}Stopping after current step completes... (Ctrl+C again to force quit)${c.reset}`);
  });

  let cycle = 0;

  while (!stopping) {
    cycle++;
    const separator = "═".repeat(50);
    console.log(`\n${c.bold}${c.cyan}${separator}${c.reset}`);
    console.log(`${c.bold}${c.cyan}CYCLE ${cycle}${c.reset}`);
    console.log(`${c.bold}${c.cyan}${separator}${c.reset}\n`);

    // Re-read PRODUCT.md each cycle (it may have been updated)
    const productContent = readFileSync(productPath, "utf8");
    const completedFeatures = getCompletedFeatures(teamDir);

    // ── Step 1: PRIORITIZE ──────────────────────────────────────

    console.log(`${c.bold}Prioritizing...${c.reset}`);
    if (stopping) break;

    const prioritizeBrief = buildPrioritizeBrief(productContent, completedFeatures, cwd);
    const prioritizeResult = dispatchToAgent(agent, prioritizeBrief, cwd);

    if (!prioritizeResult.ok) {
      console.log(`  ${c.red}✗ Prioritization failed: ${prioritizeResult.error}${c.reset}`);
      break;
    }

    let priority = parsePriorityOutput(prioritizeResult.output);
    if (!priority) {
      // Fallback: try to find next undone roadmap item
      const roadmap = parseRoadmap(productContent);
      const nextItem = roadmap.find(item => !item.done);
      if (!nextItem) {
        console.log(`\n${c.green}${c.bold}All roadmap items completed!${c.reset}`);
        break;
      }
      console.log(`  ${c.yellow}⚠ Could not parse PRIORITY from agent output. Falling back to next roadmap item.${c.reset}`);
      priority = { name: nextItem.name, reasoning: `Fallback: next undone roadmap item (${nextItem.name})` };
    }

    const featureName = slugify(priority.name);
    console.log(`  ${c.green}→ Selected: "${priority.name}"${c.reset}`);
    if (priority.reasoning) {
      console.log(`  ${c.dim}${priority.reasoning.slice(0, 200)}${c.reset}`);
    }
    console.log();

    if (stopping) break;

    // Check if this feature is already completed
    const featureDir = join(teamDir, "features", featureName);
    const existingState = readState(featureDir);
    if (existingState && existingState.status === "completed") {
      console.log(`  ${c.yellow}⚠ Feature "${featureName}" already completed. Marking roadmap and continuing.${c.reset}`);
      markRoadmapItemDone(productPath, priority.name);
      continue;
    }

    // ── Step 2: BRAINSTORM ──────────────────────────────────────

    // Find the full description from roadmap
    const roadmapItems = parseRoadmap(productContent);
    const matchedItem = roadmapItems.find(item =>
      item.name.toLowerCase() === priority.name.toLowerCase() ||
      slugify(item.name) === featureName
    );
    const priorityDescription = matchedItem
      ? `${matchedItem.name} — ${matchedItem.description}`
      : priority.name;

    console.log(`${c.bold}Brainstorming...${c.reset}`);
    if (stopping) break;

    const brainstormBrief = buildOuterBrainstormBrief(
      productContent, completedFeatures, priorityDescription, featureName, cwd,
    );
    const brainstormResult = dispatchToAgent(agent, brainstormBrief, cwd);

    // Verify SPEC.md was written
    const specPath = join(featureDir, "SPEC.md");
    const specValidation = validateSpecFile(specPath);

    if (specValidation.valid) {
      console.log(`  ${c.green}→ SPEC.md written: ${specValidation.sections.length} sections${c.reset}`);
    } else if (specValidation.sections.length > 0) {
      console.log(`  ${c.yellow}→ SPEC.md partial: has ${specValidation.sections.join(", ")}; missing ${specValidation.missing.join(", ")}${c.reset}`);
    } else {
      // Agent didn't write SPEC.md — create a minimal one from the description
      console.log(`  ${c.yellow}⚠ SPEC.md not written by agent. Creating minimal spec.${c.reset}`);
      mkdirSync(featureDir, { recursive: true });
      const minimalSpec = `# Feature: ${priority.name}\n\n## Goal\n${priorityDescription}\n\n## Scope\n- ${priorityDescription}\n\n## Out of Scope\n- TBD\n\n## Done When\n- [ ] Feature implemented and tests pass\n- [ ] Quality gate passes\n`;
      writeFileSync(specPath, minimalSpec);
    }
    console.log();

    if (stopping) break;

    // ── Step 3: EXECUTE ─────────────────────────────────────────

    console.log(`${c.bold}Executing...${c.reset}`);
    const executeResult = await runSingleFeature(args, priorityDescription);
    console.log();

    if (stopping) break;

    // ── Step 4: REVIEW OUTCOME ──────────────────────────────────

    console.log(`${c.bold}Reviewing outcome...${c.reset}`);

    // Read progress log if available
    const progressPath = join(featureDir, "progress.md");
    const progressContent = existsSync(progressPath)
      ? readFileSync(progressPath, "utf8")
      : "";

    const outcomeBrief = buildOutcomeReviewBrief(featureName, productContent, progressContent, cwd);
    const outcomeResult = dispatchToAgent(agent, outcomeBrief, cwd);

    // Extract OUTCOME line
    const outcomeMatch = outcomeResult.output?.match(/^OUTCOME:\s*(.+)$/m);
    if (outcomeMatch) {
      console.log(`  ${c.green}→ ${outcomeMatch[1].trim()}${c.reset}`);
    }

    // Ensure roadmap is updated (agent may have done it, but double-check)
    const wasMarked = markRoadmapItemDone(productPath, priority.name);
    if (wasMarked) {
      console.log(`  ${c.green}→ Roadmap updated: ✅ Done${c.reset}`);
    } else {
      console.log(`  ${c.dim}→ Roadmap already marked or no matching item${c.reset}`);
    }

    // Append outcome to progress log
    if (existsSync(progressPath)) {
      const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
      const outcomeEntry = `### ${timestamp}\n**Outcome Review**\n${outcomeMatch ? outcomeMatch[1].trim() : "Feature completed."}\nRoadmap status: ${wasMarked ? "marked done" : "already current"}\n\n`;
      const existing = readFileSync(progressPath, "utf8");
      writeFileSync(progressPath, existing + outcomeEntry);
    }

    console.log();

    // ── Cycle complete ──────────────────────────────────────────

    console.log(`${c.green}${c.bold}Cycle ${cycle} complete: "${priority.name}" shipped.${c.reset}`);

    if (executeResult === "exhausted") {
      console.log(`\n${c.green}${c.bold}All roadmap items completed after ${cycle} cycle(s)!${c.reset}`);
      break;
    }
  }

  if (stopping) {
    console.log(`\n${c.yellow}Stopped after ${cycle} cycle(s).${c.reset}`);
  }

  return cycle;
}
