// GitHub Issues integration via gh CLI.
// Gracefully degrades when gh is not available or not authenticated.

import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

function runGh(...args) {
  try {
    const result = spawnSync("gh", args, {
      encoding: "utf8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
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
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Read project board field IDs from the ## Tracking section of PROJECT.md.
 * Accepts an explicit path (for testing); defaults to .team/PROJECT.md in cwd.
 * Returns { statusFieldId, statusOptions } or null if not configured.
 */
export function readTrackingConfig(projectMdPath) {
  try {
    const mdPath = projectMdPath ?? join(process.cwd(), ".team", "PROJECT.md");
    const text = readFileSync(mdPath, "utf8");
    const fieldId = text.match(/Status Field ID:\s*(\S+)/)?.[1] ?? null;
    const todoId = text.match(/Todo Option ID:\s*(\S+)/)?.[1] ?? null;
    const inProgressId = text.match(/In Progress Option ID:\s*(\S+)/)?.[1] ?? null;
    const doneId = text.match(/Done Option ID:\s*(\S+)/)?.[1] ?? null;
    if (!fieldId || !todoId || !inProgressId || !doneId) return null;
    const pendingApprovalId = text.match(/Pending Approval Option ID:\s*(\S+)/)?.[1] ?? null;
    const readyId = text.match(/Ready Option ID:\s*(\S+)/)?.[1] ?? null;
    return {
      statusFieldId: fieldId,
      statusOptions: {
        "todo": todoId,
        "in-progress": inProgressId,
        "done": doneId,
        ...(pendingApprovalId ? { "pending-approval": pendingApprovalId } : {}),
        ...(readyId ? { "ready": readyId } : {}),
      },
    };
  } catch {
    return null;
  }
}

/** Create a GitHub Project board. Returns { url, number } or null on failure. */
export function createProjectBoard(title) {
  const output = runGh("project", "create", "--owner", "@me", "--title", title);
  if (!output) return null;
  const match = output.match(/projects\/(\d+)/);
  if (!match) return null;
  return { url: output.trim(), number: parseInt(match[1]) };
}

/** Get the Status field IDs for a GitHub Project board. Returns tracking config or null. */
export function getProjectFieldIds(projectNumber) {
  const json = runGh("project", "field-list", String(projectNumber), "--owner", "@me", "--format", "json");
  if (!json) return null;
  try {
    const data = JSON.parse(json);
    const statusField = data.fields?.find(f => f.name === "Status" && f.options);
    if (!statusField) return null;
    const todo = statusField.options?.find(o => o.name.toLowerCase() === "todo")?.id ?? null;
    const inProgress = statusField.options?.find(o => o.name.toLowerCase() === "in progress")?.id ?? null;
    const done = statusField.options?.find(o => o.name.toLowerCase() === "done")?.id ?? null;
    if (!statusField.id || !todo || !inProgress || !done) return null;
    return { statusFieldId: statusField.id, todoId: todo, inProgressId: inProgress, doneId: done };
  } catch {
    return null;
  }
}

/**
 * Get the current Status option name for an issue on a GitHub Project board.
 * Returns a string like "Ready", "Pending Approval", etc., or null on failure.
 */
export function getProjectItemStatus(issueNumber, projectNumber) {
  if (!issueNumber || !projectNumber) return null;
  const repoUrl = runGh("repo", "view", "--json", "url", "--jq", ".url");
  if (!repoUrl) return null;
  const issueUrl = `${repoUrl}/issues/${issueNumber}`;
  const itemsJson = runGh("project", "item-list", String(projectNumber), "--owner", "@me", "--format", "json");
  if (!itemsJson) return null;
  try {
    const data = JSON.parse(itemsJson);
    const item = data.items?.find(
      i => i.content?.url === issueUrl || i.content?.number === issueNumber,
    );
    if (!item) return null;
    return item.fieldValues?.find(fv => fv.field?.name === "Status")?.name ?? null;
  } catch {
    return null;
  }
}

/** Get the URL for a GitHub issue by number. Returns the URL string or null. */
export function getIssueUrl(issueNumber) {
  if (!issueNumber) return null;
  return runGh("issue", "view", String(issueNumber), "--json", "url", "--jq", ".url") || null;
}

/** Get the body of a GitHub issue. Returns string (may be "") on success, null on CLI failure. */
export function getIssueBody(number) {
  if (!number) return null;
  const result = runGh("issue", "view", String(number), "--json", "body", "--jq", ".body");
  return result === null ? null : result;
}

/** Edit a GitHub issue body. Returns true on success. */
export function editIssue(number, body) {
  if (!number) return false;
  return runGh("issue", "edit", String(number), "--body", body || "") !== null;
}

/**
 * Mark a checklist item as checked in an issue body.
 * Replaces `- [ ] title (#N)` with `- [x] title (#N)`.
 * Returns the updated body string (unchanged if not found).
 */
export function tickChecklistItem(body, title, issueNumber) {
  if (!body || !title || !issueNumber) return body;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const replacement = `- [x] ${title} (#${issueNumber})`;
  return body.replace(
    new RegExp(`- \\[ \\] ${escaped} \\(#${issueNumber}\\)`),
    () => replacement,
  );
}

/** Build the ## Tasks checklist markdown from a list of tasks. Returns empty string if no tasks have issue numbers. */
export function buildTasksChecklist(tasks) {
  const lines = (tasks || [])
    .filter(t => t.issueNumber)
    .map(t => `- [ ] ${t.title} (#${t.issueNumber})`);
  if (!lines.length) return "";
  return `\n\n## Tasks\n${lines.join("\n")}`;
}

/** Create a GitHub issue. Returns the issue number, or null on failure. */
export function createIssue(title, body, labels = []) {
  if (!title) return null;
  const args = ["issue", "create", "--title", title, "--body", body || ""];
  for (const label of labels) {
    args.push("--label", label);
  }
  const output = runGh(...args);
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
    
    // Read field/option IDs from PROJECT.md Tracking section
    const tracking = readTrackingConfig();
    if (!tracking) return false;
    const optionId = tracking.statusOptions[status];
    if (!optionId) return false;
    
    // Get project node ID
    const projectJson = runGh("project", "view", String(projectNumber), "--owner", "@me", "--format", "json");
    if (!projectJson) return false;
    const project = JSON.parse(projectJson);
    
    return runGh("project", "item-edit",
      "--project-id", project.id,
      "--id", item.id,
      "--field-id", tracking.statusFieldId,
      "--single-select-option-id", optionId
    ) !== null;
  } catch {
    return false;
  }
}
