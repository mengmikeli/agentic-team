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
const atPath = join(__dirname, "..", "bin", "agt.mjs");

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

  it("agt run with no SPEC.md exits non-zero and points at agt brainstorm", () => {
    mkdirSync(join(tmpDir, ".team", "features"), { recursive: true });
    writeFileSync(join(tmpDir, ".team", "PRODUCT.md"), "# Test\n## Vision\ntest\n## Roadmap\n1. **test** — test\n");
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"), "# Test\n");
    writeFileSync(join(tmpDir, ".team", "AGENTS.md"), "# Test\n");

    const result = runAgt(["run", "my-feature"], tmpDir, { timeout: 15000 });
    assert.equal(result.ok, false, "should exit non-zero");
    assert.equal(result.exitCode, 1, `should exit with code 1, got: ${result.exitCode}`);
    const output = result.stdout + result.stderr;
    assert.ok(output.includes("SPEC.md"), `output should name SPEC.md, got: ${output}`);
    assert.ok(
      output.includes("agt brainstorm my-feature"),
      `output should mention "agt brainstorm my-feature", got: ${output}`
    );
    assert.equal(
      existsSync(join(tmpDir, ".team", "features", "my-feature", "SPEC.md")),
      false,
      "should not auto-create SPEC.md"
    );
  });

  it("agt run with SPEC.md missing required sections exits non-zero, lists them, and does not modify file", () => {
    mkdirSync(join(tmpDir, ".team", "features", "my-feature"), { recursive: true });
    writeFileSync(join(tmpDir, ".team", "PRODUCT.md"), "# Test\n## Vision\ntest\n## Roadmap\n1. **test** — test\n");
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"), "# Test\n");
    writeFileSync(join(tmpDir, ".team", "AGENTS.md"), "# Test\n");

    // Spec has only Goal and Requirements — missing Acceptance Criteria, Technical Approach, Testing Strategy, Out of Scope, Done When
    const partialSpec = "# Feature: my-feature\n\n## Goal\nDo a thing.\n\n## Requirements\n- one\n";
    const specPath = join(tmpDir, ".team", "features", "my-feature", "SPEC.md");
    writeFileSync(specPath, partialSpec);
    const before = readFileSync(specPath, "utf8");

    const result = runAgt(["run", "my-feature"], tmpDir, { timeout: 15000 });
    assert.equal(result.ok, false, "should exit non-zero");
    assert.equal(result.exitCode, 1, `should exit with code 1, got: ${result.exitCode}`);
    const output = result.stdout + result.stderr;
    assert.ok(output.includes("missing required section"), `should mention missing sections, got: ${output}`);
    for (const s of ["Acceptance Criteria", "Technical Approach", "Testing Strategy", "Out of Scope", "Done When"]) {
      assert.ok(output.includes(s), `should list missing section "${s}", got: ${output}`);
    }
    // Negative assertion: present sections must NOT appear in the missing list
    // (guards against an inverted filter passing the positive checks above).
    const missingBlock = output.split("missing required section")[1] || "";
    assert.ok(!/^\s*-\s+Goal\b/m.test(missingBlock), `should not list "Goal" as missing, got: ${output}`);
    assert.ok(!/^\s*-\s+Requirements\b/m.test(missingBlock), `should not list "Requirements" as missing, got: ${output}`);
    // File must be unchanged
    const after = readFileSync(specPath, "utf8");
    assert.equal(after, before, "SPEC.md must not be modified");
    // No tasks should have been planned/run — no STATE.json with tasks
    const statePath = join(tmpDir, ".team", "features", "my-feature", "STATE.json");
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      assert.ok(!state.tasks || state.tasks.length === 0, "should not plan tasks when spec is incomplete");
    }
  });

  it("agt run with complete SPEC.md proceeds past the section gate", () => {
    mkdirSync(join(tmpDir, ".team", "features", "good-feature"), { recursive: true });
    writeFileSync(join(tmpDir, ".team", "PRODUCT.md"), "# Test\n## Vision\ntest\n## Roadmap\n1. **test** — test\n");
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"), "# Test\n## Quality Gate\n```sh\necho pass\n```\n");
    writeFileSync(join(tmpDir, ".team", "AGENTS.md"), "# Test\n");

    const fullSpec = [
      "# Feature: good-feature",
      "",
      "## Goal", "Do a thing.",
      "## Requirements", "- one",
      "## Acceptance Criteria", "- [ ] a",
      "## Technical Approach", "approach",
      "## Testing Strategy", "tests",
      "## Out of Scope", "- nothing",
      "## Done When", "- [ ] done",
      "",
    ].join("\n");
    writeFileSync(join(tmpDir, ".team", "features", "good-feature", "SPEC.md"), fullSpec);

    const result = runAgt(["run", "good-feature", "--dry-run"], tmpDir, { timeout: 15000 });
    const output = result.stdout + result.stderr;
    assert.ok(
      !output.includes("missing required section"),
      `should not flag missing sections, got: ${output}`
    );
  });
});


describe("agt help <command>", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("agt help run shows usage, flags, and examples", () => {
    const result = runAgt(["help", "run"], tmpDir);
    assert.ok(result.ok, "help run should exit 0");
    assert.ok(result.stdout.includes("Usage:"), "should show Usage:");
    assert.ok(result.stdout.includes("run"), "should mention run command");
    assert.ok(result.stdout.includes("--daemon") || result.stdout.includes("--review"), "should list flags");
    assert.ok(result.stdout.includes("Examples:"), "should show Examples:");
  });

  it("agt help init shows usage and examples", () => {
    const result = runAgt(["help", "init"], tmpDir);
    assert.ok(result.ok, "help init should exit 0");
    assert.ok(result.stdout.includes("Usage:"), "should show Usage:");
    assert.ok(result.stdout.includes("init"), "should mention init command");
    assert.ok(result.stdout.includes("Examples:"), "should show Examples:");
  });

  it("agt help status shows usage and examples", () => {
    const result = runAgt(["help", "status"], tmpDir);
    assert.ok(result.ok, "help status should exit 0");
    assert.ok(result.stdout.includes("Usage:"), "should show Usage:");
    assert.ok(result.stdout.includes("status"), "should mention status command");
    assert.ok(result.stdout.includes("Examples:"), "should show Examples:");
  });

  it("agt help review shows usage and examples", () => {
    const result = runAgt(["help", "review"], tmpDir);
    assert.ok(result.ok, "help review should exit 0");
    assert.ok(result.stdout.includes("Usage:"), "should show Usage:");
    assert.ok(result.stdout.includes("review"), "should mention review command");
    assert.ok(result.stdout.includes("Examples:"), "should show Examples:");
  });

  it("agt help audit shows usage and examples", () => {
    const result = runAgt(["help", "audit"], tmpDir);
    assert.ok(result.ok, "help audit should exit 0");
    assert.ok(result.stdout.includes("Usage:"), "should show Usage:");
    assert.ok(result.stdout.includes("audit"), "should mention audit command");
    assert.ok(result.stdout.includes("Examples:"), "should show Examples:");
  });

  it("agt help brainstorm shows usage and examples", () => {
    const result = runAgt(["help", "brainstorm"], tmpDir);
    assert.ok(result.ok, "help brainstorm should exit 0");
    assert.ok(result.stdout.includes("Usage:"), "should show Usage:");
    assert.ok(result.stdout.includes("brainstorm"), "should mention brainstorm command");
    assert.ok(result.stdout.includes("Examples:"), "should show Examples:");
  });

  it("agt help doctor shows usage and examples", () => {
    const result = runAgt(["help", "doctor"], tmpDir);
    assert.ok(result.ok, "help doctor should exit 0");
    assert.ok(result.stdout.includes("Usage:"), "should show Usage:");
    assert.ok(result.stdout.includes("doctor"), "should mention doctor command");
    assert.ok(result.stdout.includes("Examples:"), "should show Examples:");
  });

  it("agt help cron-tick shows usage and examples", () => {
    const result = runAgt(["help", "cron-tick"], tmpDir);
    assert.ok(result.ok, "help cron-tick should exit 0");
    assert.ok(result.stdout.includes("Usage:"), "should show Usage:");
    assert.ok(result.stdout.includes("cron-tick"), "should mention cron-tick command");
    assert.ok(result.stdout.includes("Examples:"), "should show Examples:");
  });

  it("agt help cron-setup shows usage, flags, and examples", () => {
    const result = runAgt(["help", "cron-setup"], tmpDir);
    assert.ok(result.ok, "help cron-setup should exit 0");
    assert.ok(result.stdout.includes("Usage:"), "should show Usage:");
    assert.ok(result.stdout.includes("cron-setup"), "should mention cron-setup command");
    assert.ok(result.stdout.includes("--interval"), "should list --interval flag");
    assert.ok(result.stdout.includes("Examples:"), "should show Examples:");
  });

  it("agt help <unknown> exits non-zero and shows error", () => {
    const result = runAgt(["help", "nonexistent-command"], tmpDir);
    assert.ok(!result.ok, "should exit non-zero for unknown command");
    assert.ok(
      result.stdout.includes("Unknown") || result.stderr.includes("Unknown"),
      "should report unknown command"
    );
  });

  it("agt help (no subcommand) lists all commands", () => {
    const result = runAgt(["help"], tmpDir);
    assert.ok(result.ok, "help should exit 0");
    assert.ok(result.stdout.includes("init"), "should list init");
    assert.ok(result.stdout.includes("run"), "should list run");
    assert.ok(result.stdout.includes("review"), "should list review");
    assert.ok(result.stdout.includes("audit"), "should list audit");
    assert.ok(result.stdout.includes("brainstorm"), "should list brainstorm");
    assert.ok(
      result.stdout.includes("agt help <command>") || result.stdout.includes("help <command>"),
      "should hint at per-command help"
    );
  });

  it("agt help run mentions 'Pending Approval' and 'Ready' board columns", () => {
    const result = runAgt(["help", "run"], tmpDir);
    assert.ok(result.ok, "help run should exit 0");
    assert.ok(
      result.stdout.includes("Pending Approval"),
      "agt help run should mention 'Pending Approval' column"
    );
    assert.ok(
      result.stdout.includes("Ready"),
      "agt help run should mention 'Ready' column"
    );
  });

  it("agt help run shows Prerequisites section for board setup", () => {
    const result = runAgt(["help", "run"], tmpDir);
    assert.ok(result.ok, "help run should exit 0");
    assert.ok(
      result.stdout.includes("Prerequisites") || result.stdout.includes("project board") || result.stdout.includes("manually"),
      "agt help run should explain board setup is required"
    );
  });
});


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

  it("exports buildInteractiveSpec function", async () => {
    const mod = await import("../bin/lib/brainstorm-cmd.mjs");
    assert.ok(typeof mod.buildInteractiveSpec === "function", "should export buildInteractiveSpec");
  });

  it("buildInteractiveSpec includes Requirements section", async () => {
    const { buildInteractiveSpec } = await import("../bin/lib/brainstorm-cmd.mjs");
    const spec = buildInteractiveSpec({
      idea: "test feature",
      problem: "test problem",
      users: "developers",
      constraints: "none",
      requirements: ["Must be fast", "Must be reliable"],
      acceptanceCriteria: ["Response under 100ms"],
      notScope: "mobile",
      approach1: "simple",
      approach2: "robust",
      preferred: "a",
      technicalApproach: "Use a queue",
      testingStrategy: "Unit tests + integration tests",
      criteria: ["Tests pass"],
    });
    assert.ok(spec.includes("## Requirements"), "spec should include Requirements section");
    assert.ok(spec.includes("Must be fast"), "spec should include requirements content");
    assert.ok(spec.includes("Must be reliable"), "spec should include all requirements");
  });

  it("buildInteractiveSpec includes Acceptance Criteria section", async () => {
    const { buildInteractiveSpec } = await import("../bin/lib/brainstorm-cmd.mjs");
    const spec = buildInteractiveSpec({
      idea: "test feature",
      problem: "test problem",
      users: "developers",
      constraints: "",
      requirements: [],
      acceptanceCriteria: ["Given X, when Y, then Z"],
      notScope: "",
      approach1: "simple",
      approach2: "robust",
      preferred: "b",
      technicalApproach: "",
      testingStrategy: "e2e tests",
      criteria: ["Done"],
    });
    assert.ok(spec.includes("## Acceptance Criteria"), "spec should include Acceptance Criteria section");
    assert.ok(spec.includes("Given X, when Y, then Z"), "spec should include acceptance criteria content");
  });

  it("buildInteractiveSpec includes Technical Approach section", async () => {
    const { buildInteractiveSpec } = await import("../bin/lib/brainstorm-cmd.mjs");
    const spec = buildInteractiveSpec({
      idea: "test feature",
      problem: "test problem",
      users: "developers",
      constraints: "",
      requirements: [],
      acceptanceCriteria: [],
      notScope: "",
      approach1: "simple approach",
      approach2: "robust approach",
      preferred: "a",
      technicalApproach: "Detailed technical plan here",
      testingStrategy: "tests",
      criteria: ["Done"],
    });
    assert.ok(spec.includes("## Technical Approach"), "spec should include Technical Approach section");
    assert.ok(spec.includes("Detailed technical plan here"), "spec should include technical approach content");
  });

  it("buildInteractiveSpec includes Testing Strategy section", async () => {
    const { buildInteractiveSpec } = await import("../bin/lib/brainstorm-cmd.mjs");
    const spec = buildInteractiveSpec({
      idea: "test feature",
      problem: "test problem",
      users: "developers",
      constraints: "",
      requirements: [],
      acceptanceCriteria: [],
      notScope: "",
      approach1: "",
      approach2: "",
      preferred: "",
      technicalApproach: "",
      testingStrategy: "Jest unit tests with 90% coverage",
      criteria: ["Done"],
    });
    assert.ok(spec.includes("## Testing Strategy"), "spec should include Testing Strategy section");
    assert.ok(spec.includes("Jest unit tests with 90% coverage"), "spec should include testing strategy content");
  });

  it("buildInteractiveSpec includes all seven required sections", async () => {
    const { buildInteractiveSpec } = await import("../bin/lib/brainstorm-cmd.mjs");
    const spec = buildInteractiveSpec({
      idea: "my feature",
      problem: "solve X",
      users: "users",
      constraints: "none",
      requirements: ["req1"],
      acceptanceCriteria: ["ac1"],
      notScope: "Y",
      approach1: "A",
      approach2: "B",
      preferred: "a",
      technicalApproach: "use C",
      testingStrategy: "unit tests",
      criteria: ["works"],
    });
    const sections = ["## Goal", "## Requirements", "## Acceptance Criteria", "## Technical Approach", "## Testing Strategy", "## Out of Scope", "## Done When"];
    for (const section of sections) {
      assert.ok(spec.includes(section), `spec should include ${section}`);
    }
  });
});
