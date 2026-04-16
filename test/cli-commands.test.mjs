// Tests for new CLI commands: review, audit, brainstorm
// and smart entry flow in run.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const atPath = join(__dirname, "..", "bin", "at.mjs");

function createTmpDir() {
  const dir = join(tmpdir(), `cli-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function runAgt(args, cwd, opts = {}) {
  try {
    const result = execFileSync("node", [atPath, ...args], {
      encoding: "utf8",
      cwd,
      timeout: opts.timeout || 10000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    });
    return { ok: true, stdout: result, stderr: "" };
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout?.toString() || "",
      stderr: err.stderr?.toString() || "",
      exitCode: err.status,
    };
  }
}

// ── Help text tests ─────────────────────────────────────────────

describe("CLI help text", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("shows review command in help", () => {
    const result = runAgt(["help"], tmpDir);
    assert.ok(result.stdout.includes("review"), "help should mention review command");
  });

  it("shows audit command in help", () => {
    const result = runAgt(["help"], tmpDir);
    assert.ok(result.stdout.includes("audit"), "help should mention audit command");
  });

  it("shows brainstorm command in help", () => {
    const result = runAgt(["help"], tmpDir);
    assert.ok(result.stdout.includes("brainstorm"), "help should mention brainstorm command");
  });

  it("help text includes all three new commands with descriptions", () => {
    const result = runAgt(["help"], tmpDir);
    assert.ok(result.stdout.includes("review"), "should show review");
    assert.ok(result.stdout.includes("audit"), "should show audit");
    assert.ok(result.stdout.includes("brainstorm"), "should show brainstorm");
    assert.ok(result.stdout.includes("health check") || result.stdout.includes("Cross-project"), "should describe audit");
    assert.ok(result.stdout.includes("brainstorm session") || result.stdout.includes("Interactive"), "should describe brainstorm");
  });
});

// ── Review command tests ────────────────────────────────────────

describe("agt review", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("handles review gracefully (with or without agent)", () => {
    const result = runAgt(["review"], tmpDir, { timeout: 15000 });
    const output = result.stdout + result.stderr;
    // Should either find an agent and proceed, or report no agent
    assert.ok(
      output.includes("review") || output.includes("Review") || output.includes("agent") || output.includes("No"),
      "should produce review-related output"
    );
  });

  it("prints review header", () => {
    const result = runAgt(["review"], tmpDir, { timeout: 15000 });
    const output = result.stdout + result.stderr;
    assert.ok(
      output.includes("review") || output.includes("Review") || output.includes("agent"),
      "should show review-related output"
    );
  });
});

// ── Audit command tests ─────────────────────────────────────────

describe("agt audit", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("runs audit and reports missing .team/", () => {
    const result = runAgt(["audit"], tmpDir);
    const output = result.stdout;
    assert.ok(output.includes("audit") || output.includes("Audit") || output.includes("agt audit"),
      "should show audit header");
    assert.ok(output.includes("missing") || output.includes("❌"),
      "should report .team/ as missing");
  });

  it("runs audit with .team/ present and reports structure", () => {
    // Create minimal .team structure
    mkdirSync(join(tmpDir, ".team", "features"), { recursive: true });
    writeFileSync(join(tmpDir, ".team", "PRODUCT.md"), "# Test\n## Vision\ntest\n## Roadmap\n");
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"), "# Test — Project\n");
    writeFileSync(join(tmpDir, ".team", "AGENTS.md"), "# Test — Agents\n");

    const result = runAgt(["audit"], tmpDir);
    const output = result.stdout;
    assert.ok(output.includes("✅") || output.includes("present"),
      "should show successful checks");
    assert.ok(output.includes("PRODUCT.md") || output.includes("PROJECT.md"),
      "should check for required files");
  });

  it("detects missing required files", () => {
    mkdirSync(join(tmpDir, ".team"), { recursive: true });
    writeFileSync(join(tmpDir, ".team", "PRODUCT.md"), "# Test\n");
    // PROJECT.md and AGENTS.md are missing

    const result = runAgt(["audit"], tmpDir);
    const output = result.stdout;
    assert.ok(output.includes("missing") || output.includes("❌"),
      "should report missing files");
  });

  it("reports feature with issues", () => {
    mkdirSync(join(tmpDir, ".team", "features", "stuck-feature"), { recursive: true });
    writeFileSync(join(tmpDir, ".team", "PRODUCT.md"), "# Test\n");
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"), "# Test\n");
    writeFileSync(join(tmpDir, ".team", "AGENTS.md"), "# Test\n");

    // Create a feature stuck in executing with old timestamp
    const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    writeFileSync(
      join(tmpDir, ".team", "features", "stuck-feature", "STATE.json"),
      JSON.stringify({
        version: "2.0",
        feature: "stuck-feature",
        status: "executing",
        _written_by: "at-harness",
        _last_modified: staleDate,
        _write_nonce: "test123",
      })
    );

    const result = runAgt(["audit"], tmpDir);
    const output = result.stdout;
    assert.ok(output.includes("issue") || output.includes("⚠") || output.includes("Stuck"),
      "should report stuck feature");
  });

  it("shows summary line", () => {
    const result = runAgt(["audit"], tmpDir);
    const output = result.stdout;
    assert.ok(
      output.includes("═") || output.includes("issue") || output.includes("clear"),
      "should show summary"
    );
  });
});

// ── Brainstorm command tests ────────────────────────────────────

describe("agt brainstorm", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
    // brainstorm writes to .team/ so create it
    mkdirSync(join(tmpDir, ".team"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("prints brainstorm header with idea", () => {
    // With an idea, it should try agent-based brainstorm (which will succeed or fail fast)
    const result = runAgt(["brainstorm", "test-idea"], tmpDir, { timeout: 20000 });
    const output = result.stdout + result.stderr;
    assert.ok(
      output.includes("brainstorm") || output.includes("Brainstorm"),
      "should show brainstorm header"
    );
  });
});

// ── Smart entry flow tests ──────────────────────────────────────

describe("smart entry flow (agt run no args)", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("agt run with explicit description still works with .team/", () => {
    // Create .team structure
    mkdirSync(join(tmpDir, ".team", "features"), { recursive: true });
    writeFileSync(join(tmpDir, ".team", "PRODUCT.md"), "# Test\n## Vision\ntest\n## Roadmap\n1. **test** — test\n");
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"), "# Test\n## Quality Gate\n```sh\necho pass\n```\n");
    writeFileSync(join(tmpDir, ".team", "AGENTS.md"), "# Test\n");

    // Run with description (should enter single-feature mode, not smart entry)
    const result = runAgt(["run", "test-feature", "--dry-run"], tmpDir, { timeout: 15000 });
    const output = result.stdout;
    assert.ok(
      output.includes("test-feature") || output.includes("agt run") || output.includes("Feature"),
      "should start single-feature run"
    );
  });

  it("agt run with --dry-run shows tasks without executing", () => {
    mkdirSync(join(tmpDir, ".team", "features"), { recursive: true });
    writeFileSync(join(tmpDir, ".team", "PRODUCT.md"), "# Test\n## Vision\ntest\n## Roadmap\n1. **test** — test\n");
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"), "# Test\n");
    writeFileSync(join(tmpDir, ".team", "AGENTS.md"), "# Test\n");

    const result = runAgt(["run", "small fix", "--dry-run"], tmpDir, { timeout: 15000 });
    const output = result.stdout;
    assert.ok(
      output.includes("DRY RUN") || output.includes("Dry run") || output.includes("dry run"),
      "should indicate dry run mode"
    );
  });
});

// ── Audit module unit tests ─────────────────────────────────────

describe("audit-cmd module", () => {
  it("can be imported without errors", async () => {
    const mod = await import("../bin/lib/audit-cmd.mjs");
    assert.ok(typeof mod.cmdAudit === "function", "should export cmdAudit");
  });
});

// ── Review module unit tests ────────────────────────────────────

describe("review module", () => {
  it("can be imported without errors", async () => {
    const mod = await import("../bin/lib/review.mjs");
    assert.ok(typeof mod.cmdReview === "function", "should export cmdReview");
  });
});

// ── Brainstorm module unit tests ────────────────────────────────

describe("brainstorm-cmd module", () => {
  it("can be imported without errors", async () => {
    const mod = await import("../bin/lib/brainstorm-cmd.mjs");
    assert.ok(typeof mod.cmdBrainstorm === "function", "should export cmdBrainstorm");
  });
});
