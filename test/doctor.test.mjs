// Tests for agt doctor command
// Tests individual check functions with mocked filesystem and execSync.

import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Import check functions
import {
  checkNodeVersion,
  checkGhCli,
  checkCodingAgent,
  checkPew,
  checkTeamDir,
  checkTeamFile,
  checkQualityGate,
  checkProjectBoard,
} from "../bin/lib/doctor.mjs";

// ── Helpers ─────────────────────────────────────────────────────

function makeTmpDir() {
  const dir = join(tmpdir(), `agt-doctor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanTmpDir(dir) {
  if (dir && existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Mock execSync that returns configured responses or throws
function createMockExec(responses = {}) {
  return (cmd, opts) => {
    for (const [pattern, handler] of Object.entries(responses)) {
      if (cmd.includes(pattern)) {
        if (handler instanceof Error) throw handler;
        if (typeof handler === "function") return handler(cmd, opts);
        return Buffer.from(handler);
      }
    }
    throw new Error(`Command not found: ${cmd}`);
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe("doctor: checkNodeVersion", () => {
  it("passes on current Node.js (≥18)", () => {
    const result = checkNodeVersion();
    const major = parseInt(process.version.replace(/^v/, ""), 10);
    assert.equal(result.status, major >= 18 ? "pass" : "fail");
    assert.ok(result.message.includes("Node.js"));
  });
});

describe("doctor: checkGhCli", () => {
  it("passes when gh is installed and authenticated", () => {
    const mock = createMockExec({
      "gh --version": "gh version 2.50.0 (2024-05-13)\n",
      "gh auth status": "Logged in to github.com as testuser",
    });
    const result = checkGhCli(mock);
    assert.equal(result.status, "pass");
    assert.ok(result.message.includes("v2.50.0"));
    assert.ok(result.message.includes("testuser"));
  });

  it("warns when gh is installed but not authenticated", () => {
    const mock = createMockExec({
      "gh --version": "gh version 2.50.0 (2024-05-13)\n",
      "gh auth status": new Error("not logged in"),
    });
    const result = checkGhCli(mock);
    assert.equal(result.status, "warn");
    assert.ok(result.message.includes("not authenticated"));
  });

  it("fails when gh is not installed", () => {
    const mock = createMockExec({});
    const result = checkGhCli(mock);
    assert.equal(result.status, "fail");
    assert.ok(result.message.includes("not installed"));
  });
});

describe("doctor: checkCodingAgent", () => {
  it("passes when claude is available", () => {
    const mock = createMockExec({
      "which claude": "/usr/local/bin/claude\n",
    });
    const result = checkCodingAgent(mock);
    assert.equal(result.status, "pass");
    assert.ok(result.message.includes("claude"));
  });

  it("passes when codex is available (no claude)", () => {
    const mock = createMockExec({
      "which codex": "/usr/local/bin/codex\n",
    });
    const result = checkCodingAgent(mock);
    assert.equal(result.status, "pass");
    assert.ok(result.message.includes("codex"));
  });

  it("fails when neither is available", () => {
    const mock = createMockExec({});
    const result = checkCodingAgent(mock);
    assert.equal(result.status, "fail");
    assert.ok(result.message.includes("No coding agent"));
  });
});

describe("doctor: checkPew", () => {
  it("passes when pew is available", () => {
    const mock = createMockExec({
      "which pew": "/usr/local/bin/pew\n",
    });
    const result = checkPew(mock);
    assert.equal(result.status, "pass");
  });

  it("warns (not fails) when pew is missing", () => {
    const mock = createMockExec({});
    const result = checkPew(mock);
    assert.equal(result.status, "warn");
    assert.ok(result.message.includes("token tracking disabled"));
  });
});

describe("doctor: checkTeamDir", () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanTmpDir(tmpDir); });

  it("passes when .team/ exists", () => {
    mkdirSync(join(tmpDir, ".team"));
    const result = checkTeamDir(tmpDir);
    assert.equal(result.status, "pass");
  });

  it("fails when .team/ is missing", () => {
    const result = checkTeamDir(tmpDir);
    assert.equal(result.status, "fail");
    assert.ok(result.message.includes("missing"));
  });
});

describe("doctor: checkTeamFile", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, ".team"), { recursive: true });
  });
  afterEach(() => { cleanTmpDir(tmpDir); });

  it("passes when file exists", () => {
    writeFileSync(join(tmpDir, ".team", "PRODUCT.md"), "# Product");
    const result = checkTeamFile("PRODUCT.md", true, tmpDir);
    assert.equal(result.status, "pass");
  });

  it("fails for required file when missing", () => {
    const result = checkTeamFile("PRODUCT.md", true, tmpDir);
    assert.equal(result.status, "fail");
  });

  it("warns for optional file when missing", () => {
    const result = checkTeamFile("AGENTS.md", false, tmpDir);
    assert.equal(result.status, "warn");
  });
});

describe("doctor: checkQualityGate", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, ".team"), { recursive: true });
  });
  afterEach(() => { cleanTmpDir(tmpDir); });

  it("passes when Quality Gate section has a code block", () => {
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"),
      "# Project\n\n## Quality Gate\n\n```bash\nnpm test\n```\n\n## Other\n");
    const result = checkQualityGate(tmpDir);
    assert.equal(result.status, "pass");
  });

  it("fails when Quality Gate section exists but no code block", () => {
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"),
      "# Project\n\n## Quality Gate\n\nRun tests manually.\n\n## Other\n");
    const result = checkQualityGate(tmpDir);
    assert.equal(result.status, "fail");
    assert.ok(result.message.includes("no code block"));
  });

  it("fails when no Quality Gate section", () => {
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"),
      "# Project\n\n## Stack\n\nNode.js\n");
    const result = checkQualityGate(tmpDir);
    assert.equal(result.status, "fail");
  });

  it("fails when PROJECT.md is missing", () => {
    const result = checkQualityGate(tmpDir);
    assert.equal(result.status, "fail");
    assert.ok(result.message.includes("PROJECT.md missing"));
  });
});

describe("doctor: checkProjectBoard", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    mkdirSync(join(tmpDir, ".team"), { recursive: true });
  });
  afterEach(() => { cleanTmpDir(tmpDir); });

  it("warns when Tracking section has a URL but no field IDs", () => {
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"),
      "# Project\n\n## Tracking\n\nhttps://github.com/orgs/mengmikeli/projects/1\n");
    const result = checkProjectBoard(tmpDir);
    assert.equal(result.status, "warn");
    assert.ok(result.message.includes("field IDs not set"), `Got: ${result.message}`);
  });

  it("passes when Tracking section has a URL and all required field IDs", () => {
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"),
      "# Project\n\n## Tracking\n\nhttps://github.com/orgs/mengmikeli/projects/1\n- Status Field ID: field-1\n- Todo Option ID: opt-1\n- In Progress Option ID: opt-2\n- Done Option ID: opt-3\n- Ready Option ID: opt-ready\n");
    const result = checkProjectBoard(tmpDir);
    assert.equal(result.status, "pass");
  });

  it("fails when Tracking section has no URL", () => {
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"),
      "# Project\n\n## Tracking\n\nUse the board.\n");
    const result = checkProjectBoard(tmpDir);
    assert.equal(result.status, "fail");
    assert.ok(result.message.includes("no URL"));
  });

  it("fails when no Tracking section", () => {
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"),
      "# Project\n\n## Stack\n\nNode.js\n");
    const result = checkProjectBoard(tmpDir);
    assert.equal(result.status, "fail");
  });

  it("fails when PROJECT.md is missing", () => {
    const result = checkProjectBoard(tmpDir);
    assert.equal(result.status, "fail");
  });
});
