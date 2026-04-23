// Outer product loop for `agt run` (no args).
// Implements the product-level orchestration cycle:
//   PRIORITIZE → BRAINSTORM → EXECUTE → REVIEW OUTCOME → NEXT
//
// The inner loop (_runSingleFeature) handles task-level execution.
// The outer loop handles product-level orchestration.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { c, readState, writeState, atomicWriteSync, WRITER_SIG } from "./util.mjs";
import {
  createIssue as ghCreateIssue,
  addToProject as ghAddToProject,
  setProjectItemStatus as ghSetProjectItemStatus,
  getProjectItemStatus as ghGetProjectItemStatus,
  getIssueUrl as ghGetIssueUrl,
} from "./github.mjs";

// ── Approval gate helpers ────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get or create the project-level approval signing key.
 * Stored at teamDir/.approval-secret (outside any feature directory).
 * Generated once on first use and persisted across process restarts.
 */
export function getOrCreateApprovalSigningKey(teamDir) {
  const keyPath = join(teamDir, ".approval-secret");
  if (existsSync(keyPath)) {
    try {
      const key = readFileSync(keyPath, "utf8").trim();
      if (key.length >= 32) return key;
    } catch { /* fall through to generate */ }
  }
  const key = randomBytes(32).toString("hex");
  mkdirSync(teamDir, { recursive: true });
  writeFileSync(keyPath, key, { mode: 0o600 });
  return key;
}

/** Read approval sidecar (approval.json) — separate from STATE.json to avoid crash-recovery false triggers. */
export function readApprovalState(featureDir, signingKey = WRITER_SIG) {
  const approvalPath = join(featureDir, "approval.json");
  if (!existsSync(approvalPath)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(approvalPath, "utf8"));
  } catch {
    console.warn(`  ⚠ approval.json exists but could not be parsed — treating as corrupt (will not re-create issue).`);
    return { corrupt: true };
  }
  const { _integrity, _last_modified, ...dataFields } = parsed;
  if (!_integrity) {
    console.warn(`  ⚠ approval.json has no valid integrity signature (_integrity missing) — treating as corrupt to prevent gate bypass.`);
    return { corrupt: true };
  }
  try {
    const canonicalPayload = JSON.stringify(dataFields);
    const expectedHmac = createHmac("sha256", signingKey).update(canonicalPayload).digest("hex");
    const actualBuf = Buffer.from(_integrity, "hex");
    const expectedBuf = Buffer.from(expectedHmac, "hex");
    if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
      console.warn(`  ⚠ approval.json has no valid integrity signature (_integrity mismatch) — treating as corrupt to prevent gate bypass.`);
      return { corrupt: true };
    }
  } catch {
    console.warn(`  ⚠ approval.json integrity check failed — treating as corrupt to prevent gate bypass.`);
    return { corrupt: true };
  }
  return parsed;
}

/** Write approval sidecar atomically to prevent corrupt file on crash. */
function writeApprovalState(featureDir, data, signingKey = WRITER_SIG) {
  mkdirSync(featureDir, { recursive: true });
  const canonicalPayload = JSON.stringify(data);
  const integrity = createHmac("sha256", signingKey).update(canonicalPayload).digest("hex");
  const signed = { ...data, _integrity: integrity, _last_modified: new Date().toISOString() };
  atomicWriteSync(join(featureDir, "approval.json"), JSON.stringify(signed, null, 2));
}

function readProjectNumber(teamDir) {
  const projectMdPath = join(teamDir, "PROJECT.md");
  if (!existsSync(projectMdPath)) return null;
  try {
    const text = readFileSync(projectMdPath, "utf8");
    const match = text.match(/\/projects\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

/**
 * Create a GitHub approval issue for a feature and record it in STATE.json.
 *
 * @param {string} featureDir - Path to the feature directory
 * @param {string} featureName - Human-readable feature name
 * @param {string} specPath - Path to SPEC.md
 * @param {number|null} projectNumber - GitHub project board number (or null)
 * @param {object} deps - Injectable dependencies for testing
 * @returns {Promise<number|null>} Issue number, or null on failure
 */
export async function createApprovalIssue(featureDir, featureName, specPath, projectNumber, deps = {}) {
  const {
    createIssue = ghCreateIssue,
    addToProject = ghAddToProject,
    setProjectItemStatus = ghSetProjectItemStatus,
    signingKey = WRITER_SIG,
  } = deps;

  const specContent = existsSync(specPath) ? readFileSync(specPath, "utf8") : "";
  const title = `[Feature] ${featureName}`;

  const issueNumber = createIssue(title, specContent, ["awaiting-approval"]);
  if (!issueNumber) return null;

  if (projectNumber) {
    const itemId = addToProject(issueNumber, projectNumber);
    if (!itemId) {
      console.warn(`  ${c.yellow}⚠ Could not add issue #${issueNumber} to project board — approval polling may not work.${c.reset}`);
    } else {
      setProjectItemStatus(issueNumber, projectNumber, "pending-approval");
    }
  }

  mkdirSync(featureDir, { recursive: true });
  writeApprovalState(featureDir, { issueNumber, status: "pending" }, signingKey);

  return issueNumber;
}

/**
 * Poll until the approval issue is moved to "Ready" on the project board,
 * or until the stopping flag is set (SIGINT).
 *
 * @param {number} issueNumber - GitHub issue number to poll
 * @param {string} featureDir - Feature directory (unused currently, kept for future STATE writes)
 * @param {number|null} projectNumber - GitHub project board number
 * @param {function} getStoppingFn - Returns true when the loop should stop
 * @param {object} deps - Injectable dependencies for testing
 * @returns {Promise<"approved"|"interrupted">}
 */
export async function waitForApproval(issueNumber, featureDir, projectNumber, getStoppingFn, deps = {}) {
  const {
    getProjectItemStatus = ghGetProjectItemStatus,
    getIssueUrl = ghGetIssueUrl,
    sleep: sleepFn = sleep,
  } = deps;

  const rawInterval = parseInt(process.env.APPROVAL_POLL_INTERVAL ?? "30000", 10);
  const clamped = isNaN(rawInterval) || rawInterval < 1000 || rawInterval > 3600000;
  if (clamped && process.env.APPROVAL_POLL_INTERVAL !== undefined) {
    console.warn(`  ${c.yellow}⚠ APPROVAL_POLL_INTERVAL=${process.env.APPROVAL_POLL_INTERVAL} is out of range [1000, 3600000] — using default 30s.${c.reset}`);
  }
  const intervalMs = clamped ? 30000 : rawInterval;
  const startTime = Date.now();

  const issueUrl = getIssueUrl(issueNumber);
  if (issueUrl) {
    console.log(`  ${c.cyan}Approval required → ${issueUrl}${c.reset}`);
  }
  console.log(`  ${c.cyan}Waiting for approval (issue #${issueNumber})... (poll every ${intervalMs / 1000}s)${c.reset}`);

  while (true) {
    if (getStoppingFn?.()) return "interrupted";

    const status = getProjectItemStatus(issueNumber, projectNumber);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  ${c.dim}Polling issue #${issueNumber} — status: ${status ?? "unknown"} (${elapsed}s elapsed)${c.reset}`);

    if (status?.trim().toLowerCase() === "ready") return "approved";

    await sleepFn(intervalMs);

    if (getStoppingFn?.()) return "interrupted";
  }
}

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

  const priorityMatch = output.match(/^PRIORITY:[^\S\n]*(.+)$/m);
  if (!priorityMatch) return null;

  const name = priorityMatch[1].trim();
  if (!name) return null;

  const reasoningMatch = output.match(/^REASONING:[^\S\n]*(.+)$/m);
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
 * @param {function} [deps.createIssue] - Injectable gh createIssue (for testing)
 * @param {function} [deps.addToProject] - Injectable gh addToProject (for testing)
 * @param {function} [deps.setProjectItemStatus] - Injectable gh setProjectItemStatus (for testing)
 * @param {function} [deps.getProjectItemStatus] - Injectable gh getProjectItemStatus (for testing)
 * @param {function} [deps.sleep] - Injectable sleep (for testing)
 */
export async function outerLoop(args, deps) {
  const { findAgent, dispatchToAgent, runSingleFeature } = deps;

  const cwd = process.cwd();
  const teamDir = join(cwd, ".team");
  const productPath = join(teamDir, "PRODUCT.md");

  if (!existsSync(productPath)) {
    console.log(`${c.red}No PRODUCT.md found.${c.reset} Run ${c.bold}agt run${c.reset} (no args) to set one up, or create it manually.`);
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

    // ── Step 2.5: APPROVAL GATE ──────────────────────────────────

    // Re-read state (BRAINSTORM may have created/modified the feature dir)
    const signingKey = getOrCreateApprovalSigningKey(teamDir);
    const approvalState = readApprovalState(featureDir, signingKey);
    let approvalIssueNumber = approvalState?.issueNumber ?? null;
    const projectNumber = readProjectNumber(teamDir);

    const approvalDeps = {
      createIssue: deps.createIssue,
      addToProject: deps.addToProject,
      setProjectItemStatus: deps.setProjectItemStatus,
      getProjectItemStatus: deps.getProjectItemStatus,
      getIssueUrl: deps.getIssueUrl,
      sleep: deps.sleep,
      signingKey,
    };

    if (approvalState?.status === "approved") {
      console.log(`  ${c.green}→ Already approved (issue #${approvalIssueNumber})${c.reset}\n`);
      // Ensure approvalStatus is persisted in STATE.json even on re-entry (e.g. crash after approval write but before EXECUTE)
      // Only update STATE.json if it already has structure (avoid creating a minimal file that breaks harness init)
      const existingStateOnReentry = readState(featureDir);
      if (existingStateOnReentry && existingStateOnReentry.approvalStatus !== "approved") {
        writeState(featureDir, { ...existingStateOnReentry, approvalStatus: "approved" });
      }
    } else if (approvalState?.corrupt) {
      console.error(`${c.red}✖ approval.json is corrupt — cannot verify approval status. Halting to prevent unauthorised execution.${c.reset}`);
      console.error(`  Remove or repair ${join(featureDir, "approval.json")} and re-run.`);
      break;
    } else {
      if (!approvalIssueNumber) {
        console.log(`${c.bold}Creating approval issue...${c.reset}`);
        approvalIssueNumber = await createApprovalIssue(
          featureDir, priority.name, specPath, projectNumber, approvalDeps,
        );
        if (approvalIssueNumber) {
          console.log(`  ${c.green}→ Created issue #${approvalIssueNumber}: [Feature] ${priority.name}${c.reset}`);
        } else {
          console.log(`  ${c.yellow}⚠ Could not create approval issue (gh not available). Skipping gate.${c.reset}`);
        }
      } else {
        console.log(`${c.bold}Resuming approval wait for issue #${approvalIssueNumber}...${c.reset}`);
      }

      if (approvalIssueNumber && projectNumber) {
        const approvalResult = await waitForApproval(
          approvalIssueNumber, featureDir, projectNumber, () => stopping, approvalDeps,
        );
        if (approvalResult === "interrupted") {
          console.log(`\n${c.yellow}Interrupted while waiting for approval (issue #${approvalIssueNumber}).${c.reset}`);
          break;
        }
        // Mark approved in approval.json and STATE.json
        writeApprovalState(featureDir, { issueNumber: approvalIssueNumber, status: "approved" }, signingKey);
        const stateOnApproval = readState(featureDir);
        if (stateOnApproval) {
          writeState(featureDir, { ...stateOnApproval, approvalStatus: "approved" });
        }
        console.log(`  ${c.green}→ Approved! Proceeding to execute.${c.reset}`);
      } else if (approvalIssueNumber && !projectNumber) {
        console.log(`  ${c.yellow}⚠ No project board configured — skipping approval wait. Proceeding to execute.${c.reset}`);
        writeApprovalState(featureDir, { issueNumber: approvalIssueNumber, status: "approved" }, signingKey);
        const stateNoBoard = readState(featureDir);
        if (stateNoBoard) {
          writeState(featureDir, { ...stateNoBoard, approvalStatus: "approved" });
        }
      }
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
