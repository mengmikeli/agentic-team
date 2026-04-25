// Tests that .team/runbooks/add-github-integration.yml exists with a valid schema
// and contains at least 4 tasks.
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "..");
const runbookPath = join(projectRoot, ".team", "runbooks", "add-github-integration.yml");

describe("add-github-integration.yml runbook", () => {
  it("file exists at .team/runbooks/add-github-integration.yml", () => {
    assert.ok(existsSync(runbookPath), `Runbook file not found: ${runbookPath}`);
  });

  it("contains required top-level fields", () => {
    const content = readFileSync(runbookPath, "utf8");
    assert.match(content, /^id:/m, "must have 'id' field");
    assert.match(content, /^name:/m, "must have 'name' field");
    assert.match(content, /^patterns:/m, "must have 'patterns' field");
    assert.match(content, /^minScore:/m, "must have 'minScore' field");
    assert.match(content, /^tasks:/m, "must have 'tasks' field");
    assert.match(content, /^flow:/m, "must have 'flow' field");
  });

  it("has at least 4 tasks", () => {
    const content = readFileSync(runbookPath, "utf8");
    const taskTitles = content.match(/^\s+- title:/gm) || [];
    assert.ok(
      taskTitles.length >= 4,
      `runbook must have at least 4 tasks, found ${taskTitles.length}`
    );
  });

  it("id matches filename without extension", () => {
    const content = readFileSync(runbookPath, "utf8");
    assert.match(content, /^id:\s*add-github-integration$/m, "id must be 'add-github-integration'");
  });

  it("each pattern has type, value, and weight", () => {
    const content = readFileSync(runbookPath, "utf8");
    assert.match(content, /type:\s*(regex|keyword)/, "patterns must have a 'type' field");
    assert.match(content, /value:\s*"[^"]+"/, "patterns must have a 'value' field");
    assert.match(content, /weight:\s*\d+(\.\d+)?/, "patterns must have a 'weight' field");
  });
});
