// Integration tests for the core loop rework
// Tests the full chain: handshake → validate → gate artifacts → review eval
// Uses Node.js built-in test runner (node --test)

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { validateHandshake, createHandshake } from "../bin/lib/handshake.mjs";
import { buildContextBrief } from "../bin/lib/context.mjs";
import { selectTier, formatTierBaseline } from "../bin/lib/tiers.mjs";
import { parseFindings, computeVerdict } from "../bin/lib/synthesize.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const harnessPath = join(__dirname, "..", "bin", "agt-harness.mjs");
const testDir = join(__dirname, ".integration-workspace");

function harness(...args) {
  return execFileSync("node", [harnessPath, ...args], {
    encoding: "utf8",
    cwd: testDir,
    timeout: 10000,
  });
}

function harnessJSON(...args) {
  const out = harness(...args);
  const lines = out.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return JSON.parse(lines[i]); } catch {}
  }
  return JSON.parse(out.trim());
}

describe("core loop integration", () => {
  before(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("full chain: init → build → validate → gate → review → synthesize", () => {
    const featureName = "integration-test";
    let featureDir;

    it("initializes feature via harness", () => {
      const result = harnessJSON("init", "--feature", featureName, "--dir", ".");
      assert.equal(result.created, true);
      featureDir = join(testDir, "features", featureName);
      assert.ok(existsSync(featureDir));
    });

    it("creates task directory structure", () => {
      const taskDir = join(featureDir, "tasks", "task-1");
      const artifactsDir = join(taskDir, "artifacts");
      mkdirSync(artifactsDir, { recursive: true });
      assert.ok(existsSync(artifactsDir));
    });

    it("builder writes valid handshake.json", () => {
      const taskDir = join(featureDir, "tasks", "task-1");

      // Simulate builder creating a file and writing handshake
      writeFileSync(join(taskDir, "artifacts", "main.mjs"), "// new code\nconsole.log('hello');\n");

      const hs = createHandshake({
        taskId: "task-1",
        nodeType: "build",
        status: "completed",
        summary: "Added main.mjs with hello world output",
        artifacts: [{ type: "code", path: "artifacts/main.mjs" }],
      });

      writeFileSync(join(taskDir, "handshake.json"), JSON.stringify(hs, null, 2));

      // Validate via library
      const result = validateHandshake(hs, { basePath: taskDir });
      assert.equal(result.valid, true, `Validation errors: ${result.errors.join(", ")}`);
    });

    it("validates handshake via CLI", () => {
      const taskDir = join(featureDir, "tasks", "task-1");
      const result = harnessJSON("validate", "--file", join(taskDir, "handshake.json"));
      assert.equal(result.ok, true);
      assert.equal(result.valid, true);
    });

    it("gate captures evidence artifacts", () => {
      const taskDir = join(featureDir, "tasks", "task-1");
      const result = harnessJSON(
        "gate", "--cmd", "echo 'all tests passed'",
        "--dir", join("features", featureName),
        "--task", "task-1",
      );
      assert.equal(result.ok, true);
      assert.equal(result.verdict, "PASS");

      // Check artifacts were written
      assert.ok(existsSync(join(taskDir, "artifacts", "test-output.txt")));
      const testOutput = readFileSync(join(taskDir, "artifacts", "test-output.txt"), "utf8");
      assert.ok(testOutput.includes("all tests passed"));

      // Check gate handshake was written
      const gateHSPath = join(taskDir, "handshake.json");
      assert.ok(existsSync(gateHSPath));
      const gateHS = JSON.parse(readFileSync(gateHSPath, "utf8"));
      assert.equal(gateHS.nodeType, "gate");
      assert.equal(gateHS.verdict, "PASS");
    });

    it("gate handshake validates correctly", () => {
      const taskDir = join(featureDir, "tasks", "task-1");
      const gateHS = JSON.parse(readFileSync(join(taskDir, "handshake.json"), "utf8"));
      const result = validateHandshake(gateHS, { basePath: taskDir });
      assert.equal(result.valid, true, `Validation errors: ${result.errors.join(", ")}`);
    });

    it("reviewer writes eval.md", () => {
      const taskDir = join(featureDir, "tasks", "task-1");
      // Simulate reviewer output
      const evalContent = `# Evaluation: task-1

## Verdict: PASS

## Findings
🔵 artifacts/main.mjs:2 — Consider using template literals for consistency

## Summary
Code is correct and functional. Minor style suggestion only.`;

      writeFileSync(join(taskDir, "eval.md"), evalContent);
      assert.ok(existsSync(join(taskDir, "eval.md")));
    });

    it("synthesizes review findings mechanically", () => {
      const taskDir = join(featureDir, "tasks", "task-1");
      const evalContent = readFileSync(join(taskDir, "eval.md"), "utf8");
      const findings = parseFindings(evalContent);
      const synth = computeVerdict(findings);

      assert.equal(synth.verdict, "PASS");
      assert.equal(synth.critical, 0);
      assert.equal(synth.suggestion, 1);
      assert.equal(synth.backlog, false);
    });

    it("context brief includes spec and known issues", () => {
      writeFileSync(join(featureDir, "SPEC.md"), "# Test Feature\nBuild a hello world CLI.");
      writeFileSync(join(featureDir, "backlog.md"), "# Backlog\n- [ ] warn: no error handling");

      const brief = buildContextBrief(featureDir, testDir);
      assert.ok(brief.includes("Design Intent"));
      assert.ok(brief.includes("hello world"));
      assert.ok(brief.includes("Known Issues"));
      assert.ok(brief.includes("no error handling"));
    });

    it("tier baseline integrates with build brief", () => {
      const tier = selectTier(null, "build a dashboard ui");
      assert.equal(tier.name, "polished");

      const baseline = formatTierBaseline(tier);
      assert.ok(baseline.includes("typography"));
      assert.ok(baseline.includes("responsive"));
      assert.ok(baseline.includes("Baseline Checklist"));
    });
  });

  describe("failing gate creates proper artifacts", () => {
    it("captures stderr and writes FAIL handshake", () => {
      const featureDir = join(testDir, "features", "fail-test");
      mkdirSync(featureDir, { recursive: true });

      // Init state
      const state = {
        version: "2.0",
        feature: "fail-test",
        status: "active",
        tasks: [{ id: "task-f1", status: "in-progress" }],
        gates: [],
        transitionCount: 0,
        transitionHistory: [],
        _written_by: "at-harness",
        _last_modified: new Date().toISOString(),
        _write_nonce: "test1234test1234",
      };
      writeFileSync(join(featureDir, "STATE.json"), JSON.stringify(state, null, 2));

      const result = harnessJSON(
        "gate", "--cmd", "echo 'error: something broke' >&2; exit 1",
        "--dir", join("features", "fail-test"),
        "--task", "task-f1",
      );

      assert.equal(result.verdict, "FAIL");
      assert.equal(result.exitCode, 1);

      // Check artifacts
      const taskDir = join(featureDir, "tasks", "task-f1");
      assert.ok(existsSync(join(taskDir, "artifacts", "gate-stderr.txt")));
      const stderr = readFileSync(join(taskDir, "artifacts", "gate-stderr.txt"), "utf8");
      assert.ok(stderr.includes("something broke"));

      // Check gate handshake
      const gateHS = JSON.parse(readFileSync(join(taskDir, "handshake.json"), "utf8"));
      assert.equal(gateHS.verdict, "FAIL");
      assert.equal(gateHS.status, "failed");
      assert.ok(gateHS.artifacts.some(a => a.type === "cli-output"));
    });
  });

  describe("finalize closes approval issue", () => {
    it("finalize marks state completed and reports issuesClosed when approvalIssueNumber is set", () => {
      const featureDir = join(testDir, "features", "finalize-test");
      mkdirSync(featureDir, { recursive: true });

      const state = {
        version: "2.0",
        feature: "finalize-test",
        status: "active",
        approvalIssueNumber: 999,
        tasks: [
          { id: "task-1", status: "passed", lastGate: { verdict: "PASS" } },
          { id: "task-2", status: "skipped" },
        ],
        gates: [],
        transitionCount: 0,
        transitionHistory: [],
        _written_by: "at-harness",
        _last_modified: new Date().toISOString(),
        _write_nonce: "finalize0test0a1b2",
      };
      writeFileSync(join(featureDir, "STATE.json"), JSON.stringify(state, null, 2));

      const result = harnessJSON("finalize", "--dir", join("features", "finalize-test"));

      assert.equal(result.finalized, true);
      assert.equal(result.feature, "finalize-test");
      assert.ok(typeof result.issuesClosed === "number");

      // Verify STATE.json was updated to completed
      const finalState = JSON.parse(readFileSync(join(featureDir, "STATE.json"), "utf8"));
      assert.equal(finalState.status, "completed");
      assert.ok(finalState.completedAt);
      assert.ok(finalState.summary);
      assert.equal(finalState.summary.tasks, 2);
      assert.equal(finalState.summary.passed, 1);
      assert.equal(finalState.summary.skipped, 1);
    });

    it("finalize is idempotent — reports already finalized on second call", () => {
      const result = harnessJSON("finalize", "--dir", join("features", "finalize-test"));
      assert.equal(result.finalized, true);
      assert.equal(result.note, "already finalized");
    });

    it("finalize rejects when tasks are not in terminal status", () => {
      const featureDir = join(testDir, "features", "finalize-reject");
      mkdirSync(featureDir, { recursive: true });

      const state = {
        version: "2.0",
        feature: "finalize-reject",
        status: "active",
        approvalIssueNumber: 42,
        tasks: [{ id: "task-1", status: "in-progress" }],
        gates: [],
        transitionCount: 0,
        transitionHistory: [],
        _written_by: "at-harness",
        _last_modified: new Date().toISOString(),
        _write_nonce: "finalize0reject0nonce",
      };
      writeFileSync(join(featureDir, "STATE.json"), JSON.stringify(state, null, 2));

      const result = harnessJSON("finalize", "--dir", join("features", "finalize-reject"));
      assert.equal(result.finalized, false);
      assert.ok(Array.isArray(result.errors));
      assert.ok(result.errors.some(e => e.includes("task-1")));
    });
  });

  describe("handshake findings/verdict contract enforcement", () => {
    it("rejects PASS with critical findings in full chain", () => {
      const hs = createHandshake({
        taskId: "task-bad",
        nodeType: "build",
        verdict: "PASS",
        status: "completed",
        summary: "Claimed success but has critical issues",
        artifacts: [{ type: "code", path: "fake.mjs" }],
        findings: { critical: 2, warning: 0, suggestion: 0 },
      });

      const result = validateHandshake(hs);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes("verdict cannot be PASS")));
    });
  });
});
