// Tests for createApprovalIssue and waitForApproval in bin/lib/outer-loop.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createApprovalIssue, waitForApproval } from "../bin/lib/outer-loop.mjs";

// ── createApprovalIssue ─────────────────────────────────────────

describe("createApprovalIssue", () => {
  it("writes approval.json with issueNumber and pending status when issue creation succeeds", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    const specPath = join(featureDir, "SPEC.md");
    writeFileSync(specPath, "# Feature: test\n\n## Goal\nTest goal\n");

    const deps = {
      createIssue: (_title, _body, _labels) => 42,
      addToProject: (_issueNum, _projectNum) => "item-id-123",
      setProjectItemStatus: (_issueNum, _projectNum, _status) => true,
    };

    const result = await createApprovalIssue(featureDir, "my-feature", specPath, 10, deps);

    assert.equal(result, 42);
    const approval = JSON.parse(readFileSync(join(featureDir, "approval.json"), "utf8"));
    assert.equal(approval.issueNumber, 42);
    assert.equal(approval.status, "pending");
  });

  it("returns null and does not write approval.json when createIssue fails", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    const specPath = join(featureDir, "SPEC.md");

    const deps = {
      createIssue: () => null,
      addToProject: () => "item-id",
      setProjectItemStatus: () => true,
    };

    const result = await createApprovalIssue(featureDir, "my-feature", specPath, 10, deps);

    assert.equal(result, null);
    assert.throws(
      () => readFileSync(join(featureDir, "approval.json"), "utf8"),
      { code: "ENOENT" },
      "approval.json should not be written on failure"
    );
  });

  it("still writes approval.json when addToProject returns null (board warning only)", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    const specPath = join(featureDir, "SPEC.md");
    writeFileSync(specPath, "# Feature: test\n\n## Goal\nTest goal\n");

    const deps = {
      createIssue: () => 99,
      addToProject: () => null,
      setProjectItemStatus: () => true,
    };

    const result = await createApprovalIssue(featureDir, "my-feature", specPath, 5, deps);

    assert.equal(result, 99);
    const approval = JSON.parse(readFileSync(join(featureDir, "approval.json"), "utf8"));
    assert.equal(approval.issueNumber, 99);
    assert.equal(approval.status, "pending");
  });

  it("skips project board calls when projectNumber is null", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    const specPath = join(featureDir, "SPEC.md");
    writeFileSync(specPath, "# Feature: test\n\n## Goal\nTest goal\n");

    let addToProjectCalled = false;
    const deps = {
      createIssue: () => 7,
      addToProject: () => { addToProjectCalled = true; return "item-id"; },
      setProjectItemStatus: () => true,
    };

    const result = await createApprovalIssue(featureDir, "my-feature", specPath, null, deps);

    assert.equal(result, 7);
    assert.equal(addToProjectCalled, false, "addToProject should not be called when projectNumber is null");
    const approval = JSON.parse(readFileSync(join(featureDir, "approval.json"), "utf8"));
    assert.equal(approval.issueNumber, 7);
  });

  it("reads SPEC.md content and passes it to createIssue as the body", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    const specPath = join(featureDir, "SPEC.md");
    const specContent = "# Feature: test\n\n## Goal\nSpecific goal text here\n";
    writeFileSync(specPath, specContent);

    let capturedBody = null;
    const deps = {
      createIssue: (_title, body, _labels) => { capturedBody = body; return 55; },
      addToProject: () => "item-id",
      setProjectItemStatus: () => true,
    };

    await createApprovalIssue(featureDir, "my-feature", specPath, null, deps);

    assert.equal(capturedBody, specContent);
  });

  it("passes 'awaiting-approval' label to createIssue", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    const specPath = join(featureDir, "SPEC.md");

    let capturedLabels = null;
    const deps = {
      createIssue: (_title, _body, labels) => { capturedLabels = labels; return 1; },
      addToProject: () => "item-id",
      setProjectItemStatus: () => true,
    };

    await createApprovalIssue(featureDir, "test-feature", specPath, null, deps);

    assert.ok(Array.isArray(capturedLabels));
    assert.ok(capturedLabels.includes("awaiting-approval"));
  });

  it("calls setProjectItemStatus with 'pending-approval' status when addToProject succeeds", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    const specPath = join(featureDir, "SPEC.md");
    writeFileSync(specPath, "# Feature: test\n\n## Goal\nTest goal\n");

    let capturedArgs = null;
    const deps = {
      createIssue: () => 42,
      addToProject: () => "item-id-123",
      setProjectItemStatus: (issueNum, projectNum, status) => {
        capturedArgs = { issueNum, projectNum, status };
        return true;
      },
    };

    await createApprovalIssue(featureDir, "my-feature", specPath, 10, deps);

    assert.ok(capturedArgs !== null, "setProjectItemStatus should be called");
    assert.equal(capturedArgs.issueNum, 42);
    assert.equal(capturedArgs.projectNum, 10);
    assert.equal(capturedArgs.status, "pending-approval");
  });
});

// ── waitForApproval ─────────────────────────────────────────────

describe("waitForApproval", () => {
  it("returns 'approved' when getProjectItemStatus returns 'Ready' on first poll", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));

    const deps = {
      getProjectItemStatus: () => "Ready",
      sleep: () => Promise.resolve(),
    };

    const result = await waitForApproval(42, featureDir, 10, () => false, deps);

    assert.equal(result, "approved");
  });

  it("returns 'interrupted' immediately when getStoppingFn returns true before first poll", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));

    let getStatusCalled = false;
    const deps = {
      getProjectItemStatus: () => { getStatusCalled = true; return "Pending Approval"; },
      sleep: () => Promise.resolve(),
    };

    const result = await waitForApproval(42, featureDir, 10, () => true, deps);

    assert.equal(result, "interrupted");
    assert.equal(getStatusCalled, false, "should not poll status when already stopping");
  });

  it("polls multiple times before returning 'approved'", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));

    let pollCount = 0;
    const deps = {
      getProjectItemStatus: () => {
        pollCount++;
        return pollCount >= 3 ? "Ready" : "Pending Approval";
      },
      sleep: () => Promise.resolve(),
    };

    const result = await waitForApproval(42, featureDir, 10, () => false, deps);

    assert.equal(result, "approved");
    assert.ok(pollCount >= 3, `Expected at least 3 polls, got ${pollCount}`);
  });

  it("returns 'interrupted' after sleep when stopping flag becomes true", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));

    let checkCount = 0;
    const deps = {
      getProjectItemStatus: () => "Pending Approval",
      sleep: () => Promise.resolve(),
    };

    // Stop on the second stopping check (after first sleep)
    const getStoppingFn = () => {
      checkCount++;
      return checkCount > 2;
    };

    const result = await waitForApproval(42, featureDir, 10, () => {
      checkCount++;
      return checkCount > 2;
    }, deps);

    assert.equal(result, "interrupted");
  });
});
