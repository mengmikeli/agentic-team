// Tests for bin/lib/handshake.mjs — handshake protocol validation
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { writeFileSync, mkdirSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { validateHandshake, createHandshake } from "../bin/lib/handshake.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const harnessPath = join(__dirname, "..", "bin", "agt-harness.mjs");

function harnessJSON(...args) {
  const out = execFileSync("node", [harnessPath, ...args], {
    encoding: "utf8",
    timeout: 10000,
  });
  const lines = out.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return JSON.parse(lines[i]); } catch {}
  }
  return JSON.parse(out.trim());
}

// ── createHandshake ─────────────────────────────────────────────

describe("createHandshake", () => {
  it("fills in defaults for minimal input", () => {
    const hs = createHandshake({ taskId: "task-1", summary: "Did the thing" });
    assert.equal(hs.taskId, "task-1");
    assert.equal(hs.nodeType, "build");
    assert.equal(hs.runId, "run_1");
    assert.equal(hs.status, "completed");
    assert.equal(hs.verdict, null);
    assert.equal(hs.summary, "Did the thing");
    assert.ok(hs.timestamp);
    assert.deepEqual(hs.artifacts, []);
    assert.deepEqual(hs.findings, { critical: 0, warning: 0, suggestion: 0 });
  });

  it("preserves explicit fields", () => {
    const hs = createHandshake({
      taskId: "task-3",
      nodeType: "review",
      verdict: "FAIL",
      status: "completed",
      summary: "Bad code",
      findings: { critical: 2, warning: 0, suggestion: 1 },
    });
    assert.equal(hs.nodeType, "review");
    assert.equal(hs.verdict, "FAIL");
    assert.equal(hs.findings.critical, 2);
  });
});

// ── validateHandshake ───────────────────────────────────────────

describe("validateHandshake", () => {
  function validBuild() {
    return {
      taskId: "task-1",
      nodeType: "build",
      runId: "run_1",
      status: "completed",
      verdict: null,
      summary: "Built the feature",
      timestamp: new Date().toISOString(),
      artifacts: [{ type: "code", path: "src/foo.mjs" }],
      findings: { critical: 0, warning: 0, suggestion: 0 },
    };
  }

  it("accepts a valid build handshake", () => {
    const result = validateHandshake(validBuild());
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it("rejects null input", () => {
    const result = validateHandshake(null);
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes("non-null object"));
  });

  it("rejects missing required fields", () => {
    const result = validateHandshake({});
    assert.equal(result.valid, false);
    assert.ok(result.errors.length >= REQUIRED_FIELDS_COUNT);
  });

  it("rejects invalid nodeType", () => {
    const hs = validBuild();
    hs.nodeType = "banana";
    const result = validateHandshake(hs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("invalid nodeType")));
  });

  it("rejects invalid status", () => {
    const hs = validBuild();
    hs.status = "yolo";
    const result = validateHandshake(hs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("invalid status")));
  });

  it("rejects invalid verdict", () => {
    const hs = validBuild();
    hs.verdict = "MAYBE";
    const result = validateHandshake(hs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("invalid verdict")));
  });

  it("accepts null and undefined verdict", () => {
    const hs1 = validBuild(); hs1.verdict = null;
    assert.equal(validateHandshake(hs1).valid, true);

    const hs2 = validBuild(); delete hs2.verdict;
    assert.equal(validateHandshake(hs2).valid, true);
  });

  it("rejects empty summary", () => {
    const hs = validBuild();
    hs.summary = "   ";
    const result = validateHandshake(hs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("summary")));
  });

  it("rejects invalid timestamp", () => {
    const hs = validBuild();
    hs.timestamp = "not-a-date";
    const result = validateHandshake(hs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("timestamp")));
  });

  it("rejects non-array artifacts", () => {
    const hs = validBuild();
    hs.artifacts = "not-array";
    const result = validateHandshake(hs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("array")));
  });

  it("rejects artifact with invalid type", () => {
    const hs = validBuild();
    hs.artifacts = [{ type: "magic", path: "foo.txt" }];
    const result = validateHandshake(hs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("invalid type")));
  });

  it("rejects artifact with missing path", () => {
    const hs = validBuild();
    hs.artifacts = [{ type: "code" }];
    const result = validateHandshake(hs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("path")));
  });

  // Node-type artifact requirements
  it("rejects build without code artifact", () => {
    const hs = validBuild();
    hs.artifacts = [{ type: "test-result", path: "test.txt" }];
    const result = validateHandshake(hs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("code")));
  });

  it("rejects gate without test-result or cli-output artifact", () => {
    const hs = validBuild();
    hs.nodeType = "gate";
    hs.artifacts = [{ type: "code", path: "foo.mjs" }];
    const result = validateHandshake(hs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("test-result or cli-output")));
  });

  it("accepts gate with test-result artifact", () => {
    const hs = validBuild();
    hs.nodeType = "gate";
    hs.artifacts = [{ type: "test-result", path: "test-output.txt" }];
    assert.equal(validateHandshake(hs).valid, true);
  });

  it("accepts gate with cli-output artifact", () => {
    const hs = validBuild();
    hs.nodeType = "gate";
    hs.artifacts = [{ type: "cli-output", path: "output.txt" }];
    assert.equal(validateHandshake(hs).valid, true);
  });

  it("rejects review without evaluation artifact", () => {
    const hs = validBuild();
    hs.nodeType = "review";
    hs.artifacts = [{ type: "code", path: "foo.mjs" }];
    const result = validateHandshake(hs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("evaluation")));
  });

  it("accepts review with evaluation artifact", () => {
    const hs = validBuild();
    hs.nodeType = "review";
    hs.artifacts = [{ type: "evaluation", path: "eval.md" }];
    assert.equal(validateHandshake(hs).valid, true);
  });

  // Findings/verdict consistency
  it("rejects PASS verdict with critical findings", () => {
    const hs = validBuild();
    hs.verdict = "PASS";
    hs.findings = { critical: 1, warning: 0, suggestion: 0 };
    const result = validateHandshake(hs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("verdict cannot be PASS")));
  });

  it("accepts FAIL verdict with critical findings", () => {
    const hs = validBuild();
    hs.verdict = "FAIL";
    hs.findings = { critical: 1, warning: 0, suggestion: 0 };
    assert.equal(validateHandshake(hs).valid, true);
  });

  it("accepts PASS verdict with zero critical findings", () => {
    const hs = validBuild();
    hs.verdict = "PASS";
    hs.findings = { critical: 0, warning: 2, suggestion: 5 };
    assert.equal(validateHandshake(hs).valid, true);
  });

  // File existence check with basePath
  it("rejects when artifact file does not exist (basePath given)", () => {
    const dir = mkdtempSync(join(tmpdir(), "hs-test-"));
    const hs = validBuild();
    hs.artifacts = [{ type: "code", path: "nonexistent.mjs" }];
    const result = validateHandshake(hs, { basePath: dir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("file not found")));
  });

  it("accepts when artifact file exists (basePath given)", () => {
    const dir = mkdtempSync(join(tmpdir(), "hs-test-"));
    writeFileSync(join(dir, "real-file.mjs"), "// code");
    const hs = validBuild();
    hs.artifacts = [{ type: "code", path: "real-file.mjs" }];
    const result = validateHandshake(hs, { basePath: dir });
    assert.equal(result.valid, true);
  });

  it("skips file existence check when no basePath", () => {
    const hs = validBuild();
    hs.artifacts = [{ type: "code", path: "definitely-not-real.mjs" }];
    const result = validateHandshake(hs); // no basePath
    assert.equal(result.valid, true);
  });
});

// ── CLI: agt-harness validate ───────────────────────────────────

describe("agt-harness validate CLI", () => {
  it("validates a correct handshake file", () => {
    const dir = mkdtempSync(join(tmpdir(), "hs-cli-"));
    writeFileSync(join(dir, "code.mjs"), "// code");
    const hs = {
      taskId: "task-1",
      nodeType: "build",
      runId: "run_1",
      status: "completed",
      verdict: null,
      summary: "Built the feature",
      timestamp: new Date().toISOString(),
      artifacts: [{ type: "code", path: "code.mjs" }],
      findings: { critical: 0, warning: 0, suggestion: 0 },
    };
    writeFileSync(join(dir, "handshake.json"), JSON.stringify(hs, null, 2));

    const result = harnessJSON("validate", "--file", join(dir, "handshake.json"));
    assert.equal(result.ok, true);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it("rejects handshake with missing fields via CLI", () => {
    const dir = mkdtempSync(join(tmpdir(), "hs-cli-"));
    writeFileSync(join(dir, "handshake.json"), JSON.stringify({ taskId: "task-1" }));

    const result = harnessJSON("validate", "--file", join(dir, "handshake.json"));
    assert.equal(result.ok, true);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it("rejects handshake with findings/verdict mismatch via CLI", () => {
    const dir = mkdtempSync(join(tmpdir(), "hs-cli-"));
    const hs = {
      taskId: "task-1",
      nodeType: "build",
      runId: "run_1",
      status: "completed",
      verdict: "PASS",
      summary: "Built it",
      timestamp: new Date().toISOString(),
      artifacts: [{ type: "code", path: "foo.mjs" }],
      findings: { critical: 3, warning: 0, suggestion: 0 },
    };
    // Don't create foo.mjs — but also the findings/verdict mismatch should show
    writeFileSync(join(dir, "handshake.json"), JSON.stringify(hs));
    writeFileSync(join(dir, "foo.mjs"), "// code");

    const result = harnessJSON("validate", "--file", join(dir, "handshake.json"));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("verdict cannot be PASS")));
  });

  it("reports file not found for bad path", () => {
    const dir = mkdtempSync(join(tmpdir(), "hs-cli-"));
    const result = harnessJSON("validate", "--file", join(dir, "nope.json"));
    assert.equal(result.ok, false);
    assert.equal(result.valid, false);
  });
});

const REQUIRED_FIELDS_COUNT = 6; // taskId, nodeType, status, summary, timestamp, artifacts
