// Tests for createApprovalIssue and waitForApproval in bin/lib/outer-loop.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createHmac } from "crypto";
import { createApprovalIssue, waitForApproval, readApprovalState, getOrCreateApprovalSigningKey, isStructurallyComplete } from "../bin/lib/outer-loop.mjs";

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

    let setStatusCallCount = 0;
    const deps = {
      createIssue: () => 99,
      addToProject: () => null,
      setProjectItemStatus: () => { setStatusCallCount++; return true; },
    };

    const result = await createApprovalIssue(featureDir, "my-feature", specPath, 5, deps);

    assert.equal(result, 99);
    const approval = JSON.parse(readFileSync(join(featureDir, "approval.json"), "utf8"));
    assert.equal(approval.issueNumber, 99);
    assert.equal(approval.status, "pending");
    assert.equal(setStatusCallCount, 0, "setProjectItemStatus should NOT be called when addToProject returns null");
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

// ── readApprovalState ────────────────────────────────────────────

describe("readApprovalState", () => {
  it("returns null when approval.json does not exist", () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    const result = readApprovalState(featureDir);
    assert.equal(result, null);
  });

  it("returns parsed object when approval.json is valid JSON with correct signature", () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    const data = { issueNumber: 42, status: "pending" };
    const integrity = createHmac("sha256", "at-harness").update(JSON.stringify(data)).digest("hex");
    writeFileSync(join(featureDir, "approval.json"), JSON.stringify({ ...data, _integrity: integrity }));
    const result = readApprovalState(featureDir);
    assert.equal(result.issueNumber, 42);
    assert.equal(result.status, "pending");
  });

  it("returns { corrupt: true } when approval.json is valid JSON but missing _integrity signature", () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    writeFileSync(join(featureDir, "approval.json"), JSON.stringify({ issueNumber: 42, status: "approved" }));
    const result = readApprovalState(featureDir);
    assert.deepEqual(result, { corrupt: true });
  });

  it("returns { corrupt: true } when approval.json contains invalid JSON", () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    writeFileSync(join(featureDir, "approval.json"), "{ not valid json !!!");
    const result = readApprovalState(featureDir);
    assert.deepEqual(result, { corrupt: true });
  });

  it("corrupt state does not expose issueNumber (so outer loop skips create branch)", () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    writeFileSync(join(featureDir, "approval.json"), "CORRUPTED");
    const state = readApprovalState(featureDir);
    // approvalIssueNumber = state?.issueNumber ?? null => null
    // but state.corrupt === true, so create branch is skipped
    assert.equal(state?.issueNumber ?? null, null, "issueNumber should be null for corrupt state");
    assert.equal(state?.corrupt, true, "corrupt flag should be set");
  });
});

// ── waitForApproval ─────────────────────────────────────────────

describe("waitForApproval", () => {
  it("prints issue URL before pausing when getIssueUrl returns a URL", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    try {
      const deps = {
        getProjectItemStatus: () => "Ready",
        getIssueUrl: (n) => `https://github.com/owner/repo/issues/${n}`,
        sleep: () => Promise.resolve(),
      };

      await waitForApproval(42, featureDir, 10, () => false, deps);
    } finally {
      console.log = origLog;
    }

    const combined = logs.join("\n");
    assert.ok(
      combined.includes("https://github.com/owner/repo/issues/42"),
      `Expected URL in output, got: ${combined}`
    );
  });

  it("prints 'Waiting for approval (issue #N)...' before pausing", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    try {
      const deps = {
        getProjectItemStatus: () => "Ready",
        getIssueUrl: () => null,
        sleep: () => Promise.resolve(),
      };

      await waitForApproval(42, featureDir, 10, () => false, deps);
    } finally {
      console.log = origLog;
    }

    const combined = logs.join("\n");
    assert.ok(
      combined.includes("Waiting for approval (issue #42)"),
      `Expected waiting message in output, got: ${combined}`
    );
  });

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

  it("uses APPROVAL_POLL_INTERVAL env var as sleep interval", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    const origEnv = process.env.APPROVAL_POLL_INTERVAL;

    const sleepArgs = [];
    const deps = {
      getProjectItemStatus: () => "Ready",
      getIssueUrl: () => null,
      sleep: (ms) => { sleepArgs.push(ms); return Promise.resolve(); },
    };

    // First poll returns "Ready" immediately (no sleep needed), but we need a
    // second poll scenario. Let's test with 2 polls where first is "Pending".
    let pollCount = 0;
    deps.getProjectItemStatus = () => {
      pollCount++;
      return pollCount >= 2 ? "Ready" : "Pending Approval";
    };

    try {
      process.env.APPROVAL_POLL_INTERVAL = "5000";
      await waitForApproval(42, featureDir, 10, () => false, deps);
    } finally {
      if (origEnv === undefined) {
        delete process.env.APPROVAL_POLL_INTERVAL;
      } else {
        process.env.APPROVAL_POLL_INTERVAL = origEnv;
      }
    }

    assert.ok(sleepArgs.length >= 1, "sleep should have been called at least once");
    assert.equal(sleepArgs[0], 5000, `Expected sleep(5000), got sleep(${sleepArgs[0]})`);
  });

  it("defaults to 30000ms sleep when APPROVAL_POLL_INTERVAL is not set", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    const origEnv = process.env.APPROVAL_POLL_INTERVAL;

    const sleepArgs = [];
    let pollCount = 0;
    const deps = {
      getProjectItemStatus: () => {
        pollCount++;
        return pollCount >= 2 ? "Ready" : "Pending Approval";
      },
      getIssueUrl: () => null,
      sleep: (ms) => { sleepArgs.push(ms); return Promise.resolve(); },
    };

    try {
      delete process.env.APPROVAL_POLL_INTERVAL;
      await waitForApproval(42, featureDir, 10, () => false, deps);
    } finally {
      if (origEnv !== undefined) {
        process.env.APPROVAL_POLL_INTERVAL = origEnv;
      }
    }

    assert.ok(sleepArgs.length >= 1, "sleep should have been called at least once");
    assert.equal(sleepArgs[0], 30000, `Expected default sleep(30000), got sleep(${sleepArgs[0]})`);
  });

  it("uses 30000ms default when APPROVAL_POLL_INTERVAL is invalid", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));
    const origEnv = process.env.APPROVAL_POLL_INTERVAL;

    const sleepArgs = [];
    let pollCount = 0;
    const deps = {
      getProjectItemStatus: () => {
        pollCount++;
        return pollCount >= 2 ? "Ready" : "Pending Approval";
      },
      getIssueUrl: () => null,
      sleep: (ms) => { sleepArgs.push(ms); return Promise.resolve(); },
    };

    try {
      process.env.APPROVAL_POLL_INTERVAL = "not-a-number";
      await waitForApproval(42, featureDir, 10, () => false, deps);
    } finally {
      if (origEnv === undefined) {
        delete process.env.APPROVAL_POLL_INTERVAL;
      } else {
        process.env.APPROVAL_POLL_INTERVAL = origEnv;
      }
    }

    assert.ok(sleepArgs.length >= 1, "sleep should have been called at least once");
    assert.equal(sleepArgs[0], 30000, `Expected default sleep(30000) for invalid env var, got sleep(${sleepArgs[0]})`);
  });

  it("prints elapsed time in each poll log message", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "approval-test-"));

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    try {
      const deps = {
        getProjectItemStatus: () => "Ready",
        getIssueUrl: () => null,
        sleep: () => Promise.resolve(),
      };

      await waitForApproval(42, featureDir, 10, () => false, deps);
    } finally {
      console.log = origLog;
    }

    const combined = logs.join("\n");
    assert.ok(
      /\d+s elapsed/.test(combined),
      `Expected "Xs elapsed" in poll output, got: ${combined}`
    );
  });
});

// ── getOrCreateApprovalSigningKey ───────────────────────────────

describe("getOrCreateApprovalSigningKey", () => {
  it("generates a new hex key when .approval-secret does not exist", () => {
    const teamDir = mkdtempSync(join(tmpdir(), "signing-key-test-"));
    const key = getOrCreateApprovalSigningKey(teamDir);
    assert.ok(typeof key === "string");
    assert.ok(key.length >= 32, `Expected key length >= 32, got ${key.length}`);
    assert.ok(/^[0-9a-f]+$/.test(key), "Key should be lowercase hex");
  });

  it("writes the key to <teamDir>/.approval-secret", () => {
    const teamDir = mkdtempSync(join(tmpdir(), "signing-key-test-"));
    const key = getOrCreateApprovalSigningKey(teamDir);
    const stored = readFileSync(join(teamDir, ".approval-secret"), "utf8").trim();
    assert.equal(stored, key);
  });

  it("returns the same key on subsequent calls", () => {
    const teamDir = mkdtempSync(join(tmpdir(), "signing-key-test-"));
    const key1 = getOrCreateApprovalSigningKey(teamDir);
    const key2 = getOrCreateApprovalSigningKey(teamDir);
    assert.equal(key1, key2);
  });

  it("generates a fresh key when existing file has short/invalid key", () => {
    const teamDir = mkdtempSync(join(tmpdir(), "signing-key-test-"));
    writeFileSync(join(teamDir, ".approval-secret"), "short");
    const key = getOrCreateApprovalSigningKey(teamDir);
    assert.ok(key.length >= 32, `Expected fresh key, got: ${key}`);
    assert.notEqual(key, "short");
  });

  it("approval.json written with custom signingKey is accepted by readApprovalState with same key", async () => {
    const featureDir = mkdtempSync(join(tmpdir(), "signing-key-test-"));
    const specPath = join(featureDir, "SPEC.md");
    writeFileSync(specPath, "# Feature: test\n\n## Goal\nTest goal\n");

    const customKey = "custom-test-signing-key-1234567890abcdef";
    const deps = {
      createIssue: () => 77,
      addToProject: () => null,
      setProjectItemStatus: () => true,
      signingKey: customKey,
    };

    await createApprovalIssue(featureDir, "my-feature", specPath, null, deps);

    // Reading with the correct custom key should succeed
    const state = readApprovalState(featureDir, customKey);
    assert.equal(state?.issueNumber, 77);
    assert.equal(state?.status, "pending");

    // Reading with a different key should return corrupt
    const stateWrongKey = readApprovalState(featureDir, "wrong-key");
    assert.deepEqual(stateWrongKey, { corrupt: true });
  });
});

// ── isStructurallyComplete ──────────────────────────────────────

describe("isStructurallyComplete", () => {
  it("returns true for a well-formed STATE.json object", () => {
    assert.ok(isStructurallyComplete({ version: "2.0", feature: "x", tasks: [] }));
  });

  it("returns true when tasks has entries", () => {
    assert.ok(isStructurallyComplete({ version: "2.0", tasks: [{ id: "t1" }] }));
  });

  it("returns false for null", () => {
    assert.ok(!isStructurallyComplete(null));
  });

  it("returns false for undefined", () => {
    assert.ok(!isStructurallyComplete(undefined));
  });

  it("returns false for empty object", () => {
    assert.ok(!isStructurallyComplete({}));
  });

  it("returns false when version is missing", () => {
    assert.ok(!isStructurallyComplete({ tasks: [] }));
  });

  it("returns false when version is not a string", () => {
    assert.ok(!isStructurallyComplete({ version: 2, tasks: [] }));
  });

  it("returns false when tasks is missing", () => {
    assert.ok(!isStructurallyComplete({ version: "2.0" }));
  });

  it("returns false when tasks is not an array", () => {
    assert.ok(!isStructurallyComplete({ version: "2.0", tasks: {} }));
  });
});
