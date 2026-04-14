// GitHub Issues integration via gh CLI.
// Gracefully degrades when gh is not available or not authenticated.

import { spawnSync } from "child_process";

function runGh(...args) {
  try {
    const result = spawnSync("gh", args, {
      encoding: "utf8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    if (result.status !== 0) return null;
    return result.stdout.trim();
  } catch {
    return null;
  }
}

/** Check if gh CLI is available and authenticated. */
export function ghAvailable() {
  try {
    const result = spawnSync("gh", ["auth", "status"], {
      encoding: "utf8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/** Create a GitHub issue. Returns the issue number, or null on failure. */
export function createIssue(title, body) {
  if (!title) return null;
  const output = runGh("issue", "create", "--title", title, "--body", body || "");
  if (!output) return null;
  const match = output.match(/\/issues\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/** Close a GitHub issue by number. Returns true on success. */
export function closeIssue(number, comment) {
  if (!number) return false;
  const args = ["issue", "close", String(number)];
  if (comment) args.push("--comment", comment);
  return runGh(...args) !== null;
}

/** Add a comment to a GitHub issue. Returns true on success. */
export function commentIssue(number, body) {
  if (!number || !body) return false;
  return runGh("issue", "comment", String(number), "--body", body) !== null;
}

/** Add an issue to a GitHub Project board. Returns the item ID on success. */
export function addToProject(issueNumber, projectNumber) {
  if (!issueNumber || !projectNumber) return null;
  const repoUrl = runGh("repo", "view", "--json", "url", "--jq", ".url");
  if (!repoUrl) return null;
  const issueUrl = `${repoUrl}/issues/${issueNumber}`;
  const output = runGh("project", "item-add", String(projectNumber), "--owner", "@me", "--url", issueUrl);
  return output || null;
}

/** Move an issue to a status column on the project board. */
export function setProjectItemStatus(issueNumber, projectNumber, status) {
  if (!issueNumber || !projectNumber) return false;
  // Get the item ID for this issue
  const repoUrl = runGh("repo", "view", "--json", "url", "--jq", ".url");
  if (!repoUrl) return false;
  const issueUrl = `${repoUrl}/issues/${issueNumber}`;
  
  // Get project ID and items to find this issue's item ID
  const itemsJson = runGh("project", "item-list", String(projectNumber), "--owner", "@me", "--format", "json");
  if (!itemsJson) return false;
  
  try {
    const data = JSON.parse(itemsJson);
    const item = data.items?.find(i => i.content?.url === issueUrl || i.content?.number === issueNumber);
    if (!item) return false;
    
    // Read field/option IDs from PROJECT.md or use defaults
    // Default GitHub Project status field + option IDs
    const statusFieldId = "PVTSSF_lAHOAEUwvc4BUkmdzhBr2dQ";
    const statusOptions = { "todo": "f75ad846", "in-progress": "47fc9ee4", "done": "98236657" };
    const optionId = statusOptions[status];
    if (!optionId) return false;
    
    // Get project node ID
    const projectJson = runGh("project", "view", String(projectNumber), "--owner", "@me", "--format", "json");
    if (!projectJson) return false;
    const project = JSON.parse(projectJson);
    
    return runGh("project", "item-edit",
      "--project-id", project.id,
      "--id", item.id,
      "--field-id", statusFieldId,
      "--single-select-option-id", optionId
    ) !== null;
  } catch {
    return false;
  }
}
