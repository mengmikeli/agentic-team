// Tests for the extension system (extension-loader, extension-runner, extension-registry)
// Focuses on: promptAppend hook being appended to the agent brief before dispatchToAgent()

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHook, isCircuitBroken, resetCircuitBreakers } from "../bin/lib/extension-runner.mjs";
import { fireExtension, resetRegistry, setExtensions } from "../bin/lib/extension-registry.mjs";
import { loadExtensions } from "../bin/lib/extension-loader.mjs";
import { runExecuteRunCommands } from "../bin/lib/run.mjs";

// ── extension-runner tests ──────────────────────────────────────────────────

describe("runHook", () => {
  beforeEach(() => {
    resetCircuitBreakers();
  });

  it("calls hook and returns result", async () => {
    const ext = {
      name: "test-ext",
      hooks: {
        promptAppend: async ({ prompt }) => ({ append: "extra context" }),
      },
    };
    const result = await runHook(ext, "promptAppend", { prompt: "hello" });
    assert.deepEqual(result, { append: "extra context" });
  });

  it("returns null when hook function is missing", async () => {
    const ext = { name: "test-ext", hooks: {} };
    const result = await runHook(ext, "promptAppend", {});
    assert.equal(result, null);
  });

  it("returns null and records failure when hook throws", async () => {
    const ext = {
      name: "bad-ext",
      hooks: {
        promptAppend: async () => { throw new Error("oops"); },
      },
    };
    const result = await runHook(ext, "promptAppend", {});
    assert.equal(result, null);
  });

  it("circuit-breaks after 3 consecutive failures", async () => {
    let calls = 0;
    const ext = {
      name: "flaky-ext",
      hooks: {
        promptAppend: async () => { calls++; throw new Error("fail"); },
      },
    };
    // 3 failures to trip the breaker
    await runHook(ext, "promptAppend", {});
    await runHook(ext, "promptAppend", {});
    await runHook(ext, "promptAppend", {});

    assert.ok(isCircuitBroken("flaky-ext"), "should be circuit-broken after 3 failures");

    // 4th call should be skipped by circuit breaker
    const result = await runHook(ext, "promptAppend", {});
    assert.equal(result, null);
    assert.equal(calls, 3, "hook should not be called after circuit breaks");
  });

  it("resetCircuitBreakers clears failure counts", async () => {
    const ext = {
      name: "resettable-ext",
      hooks: {
        promptAppend: async () => { throw new Error("fail"); },
      },
    };
    await runHook(ext, "promptAppend", {});
    await runHook(ext, "promptAppend", {});
    await runHook(ext, "promptAppend", {});
    assert.ok(isCircuitBroken("resettable-ext"));

    resetCircuitBreakers();
    assert.ok(!isCircuitBroken("resettable-ext"));
  });
});

// ── extension-registry tests ────────────────────────────────────────────────

describe("fireExtension — promptAppend", () => {
  beforeEach(() => {
    resetRegistry();
    resetCircuitBreakers();
  });

  it("returns empty array when no extensions registered", async () => {
    setExtensions([]);
    const results = await fireExtension("promptAppend", { prompt: "hello" });
    assert.deepEqual(results, []);
  });

  it("returns results from extensions that declare the capability", async () => {
    setExtensions([
      {
        name: "ext-a",
        version: "1.0.0",
        capabilities: ["promptAppend"],
        hooks: {
          promptAppend: async () => ({ append: "appended text" }),
        },
      },
    ]);
    const results = await fireExtension("promptAppend", { prompt: "base" });
    assert.equal(results.length, 1);
    assert.deepEqual(results[0], { append: "appended text" });
  });

  it("skips extensions that do not declare the capability", async () => {
    setExtensions([
      {
        name: "ext-other",
        version: "1.0.0",
        capabilities: ["verdictAppend"],
        hooks: {
          promptAppend: async () => ({ append: "should not appear" }),
        },
      },
    ]);
    const results = await fireExtension("promptAppend", { prompt: "base" });
    assert.deepEqual(results, []);
  });

  it("collects results from multiple extensions", async () => {
    setExtensions([
      {
        name: "ext-1",
        version: "1.0.0",
        capabilities: ["promptAppend"],
        hooks: { promptAppend: async () => ({ append: "first" }) },
      },
      {
        name: "ext-2",
        version: "1.0.0",
        capabilities: ["promptAppend"],
        hooks: { promptAppend: async () => ({ append: "second" }) },
      },
    ]);
    const results = await fireExtension("promptAppend", { prompt: "base" });
    assert.equal(results.length, 2);
    assert.deepEqual(results[0], { append: "first" });
    assert.deepEqual(results[1], { append: "second" });
  });

  it("skips null results (failed/timeout hooks)", async () => {
    setExtensions([
      {
        name: "broken-ext",
        version: "1.0.0",
        capabilities: ["promptAppend"],
        hooks: { promptAppend: async () => { throw new Error("boom"); } },
      },
      {
        name: "ok-ext",
        version: "1.0.0",
        capabilities: ["promptAppend"],
        hooks: { promptAppend: async () => ({ append: "ok" }) },
      },
    ]);
    const results = await fireExtension("promptAppend", { prompt: "base" });
    assert.equal(results.length, 1);
    assert.deepEqual(results[0], { append: "ok" });
  });

  it("skips undefined results from hooks", async () => {
    setExtensions([
      {
        name: "undefined-ext",
        version: "1.0.0",
        capabilities: ["promptAppend"],
        hooks: { promptAppend: async () => undefined },
      },
      {
        name: "ok-ext",
        version: "1.0.0",
        capabilities: ["promptAppend"],
        hooks: { promptAppend: async () => ({ append: "present" }) },
      },
    ]);
    const results = await fireExtension("promptAppend", { prompt: "base" });
    assert.equal(results.length, 1);
    assert.deepEqual(results[0], { append: "present" });
  });

  it("passes prompt and taskId in payload", async () => {
    let captured;
    setExtensions([
      {
        name: "capture-ext",
        version: "1.0.0",
        capabilities: ["promptAppend"],
        hooks: {
          promptAppend: async (payload) => {
            captured = payload;
            return { append: "" };
          },
        },
      },
    ]);
    await fireExtension("promptAppend", { prompt: "test prompt", taskId: "task-1", phase: "build" });
    assert.equal(captured.prompt, "test prompt");
    assert.equal(captured.taskId, "task-1");
    assert.equal(captured.phase, "build");
  });
});

// ── Brief append integration ────────────────────────────────────────────────

describe("promptAppend brief integration", () => {
  beforeEach(() => {
    resetRegistry();
    resetCircuitBreakers();
  });

  it("appended string is concatenated to the brief", async () => {
    setExtensions([
      {
        name: "inject-ext",
        version: "1.0.0",
        capabilities: ["promptAppend"],
        hooks: { promptAppend: async () => ({ append: "## Extra\nDo this too." }) },
      },
    ]);

    const baseBrief = "## Task\nBuild something.";
    let effectiveBrief = baseBrief;

    const appendResults = await fireExtension("promptAppend", { prompt: baseBrief, taskId: "task-1", phase: "build" });
    for (const r of appendResults) {
      if (r && typeof r.append === "string" && r.append.trim()) {
        effectiveBrief += "\n\n" + r.append.trim();
      }
    }

    assert.ok(effectiveBrief.startsWith(baseBrief), "should start with original brief");
    assert.ok(effectiveBrief.includes("## Extra"), "should contain appended content");
    assert.ok(effectiveBrief.includes("Do this too."), "should contain appended detail");
  });

  it("empty append strings are ignored", async () => {
    setExtensions([
      {
        name: "empty-ext",
        version: "1.0.0",
        capabilities: ["promptAppend"],
        hooks: { promptAppend: async () => ({ append: "   " }) },
      },
    ]);

    const baseBrief = "original";
    let effectiveBrief = baseBrief;

    const appendResults = await fireExtension("promptAppend", { prompt: baseBrief, taskId: "task-1", phase: "build" });
    for (const r of appendResults) {
      if (r && typeof r.append === "string" && r.append.trim()) {
        effectiveBrief += "\n\n" + r.append.trim();
      }
    }

    assert.equal(effectiveBrief, baseBrief, "empty append should not modify brief");
  });

  it("non-string append values are ignored", async () => {
    setExtensions([
      {
        name: "bad-append-ext",
        version: "1.0.0",
        capabilities: ["promptAppend"],
        hooks: { promptAppend: async () => ({ append: 42 }) },
      },
    ]);

    const baseBrief = "original";
    let effectiveBrief = baseBrief;

    const appendResults = await fireExtension("promptAppend", { prompt: baseBrief, taskId: "task-1", phase: "build" });
    for (const r of appendResults) {
      if (r && typeof r.append === "string" && r.append.trim()) {
        effectiveBrief += "\n\n" + r.append.trim();
      }
    }

    assert.equal(effectiveBrief, baseBrief, "non-string append should not modify brief");
  });
});

// ── verdictAppend integration ───────────────────────────────────────────────

describe("verdictAppend integration", () => {
  beforeEach(() => {
    resetRegistry();
    resetCircuitBreakers();
  });

  it("returns findings array from extension", async () => {
    setExtensions([
      {
        name: "verdict-ext",
        version: "1.0.0",
        capabilities: ["verdictAppend"],
        hooks: {
          verdictAppend: async () => ({
            findings: [{ severity: "warning", text: "🟡 ext.mjs:1 — extension warning message" }],
          }),
        },
      },
    ]);
    const results = await fireExtension("verdictAppend", { findings: [], phase: "review" });
    assert.equal(results.length, 1);
    assert.ok(Array.isArray(results[0].findings));
    assert.equal(results[0].findings[0].severity, "warning");
  });

  it("merging extension findings affects computeVerdict output", async () => {
    const { computeVerdict } = await import("../bin/lib/synthesize.mjs");
    setExtensions([
      {
        name: "critical-ext",
        version: "1.0.0",
        capabilities: ["verdictAppend"],
        hooks: {
          verdictAppend: async () => ({
            findings: [{ severity: "critical", text: "🔴 ext.mjs:1 — critical issue from extension" }],
          }),
        },
      },
    ]);

    const basefindings = [{ severity: "suggestion", text: "🔵 foo.mjs:1 — minor note" }];
    let allFindings = [...basefindings];

    const extResults = await fireExtension("verdictAppend", { findings: basefindings, phase: "review" });
    for (const r of extResults) {
      if (r && Array.isArray(r.findings)) {
        for (const f of r.findings) {
          if (f && typeof f.severity === "string" && typeof f.text === "string") {
            allFindings = [...allFindings, f];
          }
        }
      }
    }

    // Without extension: PASS; with extension critical finding: FAIL
    assert.equal(computeVerdict(basefindings).verdict, "PASS");
    assert.equal(computeVerdict(allFindings).verdict, "FAIL");
    assert.equal(allFindings.length, 2);
  });

  it("ignores extension results with non-array findings", async () => {
    setExtensions([
      {
        name: "bad-ext",
        version: "1.0.0",
        capabilities: ["verdictAppend"],
        hooks: {
          verdictAppend: async () => ({ findings: "not-an-array" }),
        },
      },
    ]);

    const results = await fireExtension("verdictAppend", { findings: [], phase: "review" });
    let merged = [];
    for (const r of results) {
      if (r && Array.isArray(r.findings)) {
        merged = [...merged, ...r.findings];
      }
    }
    assert.deepEqual(merged, []);
  });

  it("skips individual findings with missing severity or text", async () => {
    setExtensions([
      {
        name: "partial-ext",
        version: "1.0.0",
        capabilities: ["verdictAppend"],
        hooks: {
          verdictAppend: async () => ({
            findings: [
              { severity: "warning" },             // missing text
              { text: "🟡 foo.mjs:1 — text only" }, // missing severity
              { severity: "warning", text: "🟡 foo.mjs:2 — valid finding here" },
            ],
          }),
        },
      },
    ]);

    const results = await fireExtension("verdictAppend", { findings: [], phase: "review" });
    let merged = [];
    for (const r of results) {
      if (r && Array.isArray(r.findings)) {
        for (const f of r.findings) {
          if (f && typeof f.severity === "string" && typeof f.text === "string") {
            merged.push(f);
          }
        }
      }
    }
    // Only the valid finding passes through
    assert.equal(merged.length, 1);
    assert.equal(merged[0].text, "🟡 foo.mjs:2 — valid finding here");
  });

  it("passes current findings and phase in payload", async () => {
    let captured;
    setExtensions([
      {
        name: "capture-ext",
        version: "1.0.0",
        capabilities: ["verdictAppend"],
        hooks: {
          verdictAppend: async (payload) => {
            captured = payload;
            return { findings: [] };
          },
        },
      },
    ]);

    const inputFindings = [{ severity: "warning", text: "🟡 a.mjs:1 — something" }];
    await fireExtension("verdictAppend", { findings: inputFindings, phase: "review" });
    assert.ok(Array.isArray(captured.findings));
    assert.equal(captured.findings.length, 1);
    assert.equal(captured.phase, "review");
  });

  it("cmdSynthesize merges verdictAppend extension findings into final verdict (integration)", async () => {
    const { cmdSynthesize } = await import("../bin/lib/synthesize.mjs");

    setExtensions([
      {
        name: "integration-ext",
        version: "1.0.0",
        capabilities: ["verdictAppend"],
        hooks: {
          verdictAppend: async () => ({
            findings: [{ severity: "critical", text: "🔴 synthesize.mjs:1 — critical injected by extension" }],
          }),
        },
      },
    ]);

    // Review text with only a suggestion — would PASS without extension
    const tmpFile = join(tmpdir(), `synth-test-${Date.now()}.txt`);
    await writeFile(tmpFile, "🔵 synthesize.mjs:1 — minor style suggestion only");

    let output;
    const origLog = console.log;
    console.log = (str) => { output = str; };
    const origExitCode = process.exitCode;

    try {
      await cmdSynthesize(["--input", tmpFile]);
    } finally {
      console.log = origLog;
      process.exitCode = origExitCode;
      await rm(tmpFile, { force: true });
    }

    const result = JSON.parse(output);
    // Without extension: only suggestion -> PASS
    // With extension critical finding: FAIL
    assert.equal(result.verdict, "FAIL");
    assert.ok(result.critical >= 1, "should have at least 1 critical from extension");
    assert.ok(
      result.findings.some(f => f.text.includes("critical injected by extension")),
      "extension finding should appear in output findings"
    );
  });
});

// ── executeRun hook tests ───────────────────────────────────────────────────

describe("fireExtension — executeRun", () => {
  beforeEach(() => {
    resetRegistry();
    resetCircuitBreakers();
  });

  it("returns command and required fields from extension", async () => {
    setExtensions([
      {
        name: "run-ext",
        version: "1.0.0",
        capabilities: ["executeRun"],
        hooks: {
          executeRun: async () => ({ command: "echo hello", required: true }),
        },
      },
    ]);
    const results = await fireExtension("executeRun", { taskId: "task-1", cwd: process.cwd() });
    assert.equal(results.length, 1);
    assert.equal(results[0].command, "echo hello");
    assert.equal(results[0].required, true);
  });

  it("passes taskId and cwd in payload", async () => {
    let captured;
    setExtensions([
      {
        name: "capture-ext",
        version: "1.0.0",
        capabilities: ["executeRun"],
        hooks: {
          executeRun: async (payload) => { captured = payload; return { command: "echo test" }; },
        },
      },
    ]);
    await fireExtension("executeRun", { taskId: "task-3", cwd: "/tmp" });
    assert.equal(captured.taskId, "task-3");
    assert.equal(captured.cwd, "/tmp");
  });

  it("skips extensions without executeRun capability", async () => {
    setExtensions([
      {
        name: "other-ext",
        version: "1.0.0",
        capabilities: ["promptAppend"],
        hooks: {
          executeRun: async () => ({ command: "should not run" }),
        },
      },
    ]);
    const results = await fireExtension("executeRun", { taskId: "task-1", cwd: process.cwd() });
    assert.deepEqual(results, []);
  });

  it("returns empty array when no executeRun extensions registered", async () => {
    setExtensions([]);
    const results = await fireExtension("executeRun", { taskId: "task-1", cwd: process.cwd() });
    assert.deepEqual(results, []);
  });
});

// ── executeRun spawn, artifact, and failure detection ───────────────────────

describe("executeRun — spawn, artifact, and failure detection", () => {
  it("stores stdout as cli-output artifact when command runs", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const artDir = join(tmpdir(), `ext-art-${Date.now()}`);
    await mkdir(artDir, { recursive: true });
    try {
      runExecuteRunCommands([{ command: "echo cli-output-test" }], artDir, process.cwd());
      const slug = "echo-cli-output-test";
      const outFile = join(artDir, `ext-run-${slug}.txt`);
      assert.ok(existsSync(outFile), "artifact file should be created");
      const content = readFileSync(outFile, "utf8");
      assert.ok(content.includes("cli-output-test"), "stdout should appear in artifact");
      assert.ok(content.includes("Exit code: 0"), "exit code 0 should appear in artifact");
    } finally {
      await rm(artDir, { recursive: true, force: true });
    }
  });

  it("stores stderr in artifact when command writes to stderr", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const artDir = join(tmpdir(), `ext-art-${Date.now()}`);
    await mkdir(artDir, { recursive: true });
    try {
      runExecuteRunCommands([{ command: "echo stderr-content >&2; exit 1" }], artDir, process.cwd());
      const slug = "echo-stderr-content-2-exit";
      const outFile = join(artDir, `ext-run-${slug}.txt`);
      assert.ok(existsSync(outFile), "artifact file should be created");
      const content = readFileSync(outFile, "utf8");
      assert.ok(content.includes("stderr-content"), "stderr should appear in artifact");
      assert.ok(content.includes("Exit code: 1"), "non-zero exit should appear in artifact");
    } finally {
      await rm(artDir, { recursive: true, force: true });
    }
  });

  it("command runs in the provided cwd", async () => {
    const { mkdtempSync } = await import("node:fs");
    const artDir = join(tmpdir(), `ext-art-cwd-${Date.now()}`);
    await mkdir(artDir, { recursive: true });
    const cwdDir = mkdtempSync(join(tmpdir(), "ext-cwd-"));
    try {
      const result = runExecuteRunCommands([{ command: "pwd" }], artDir, cwdDir);
      assert.ok(!result.failed, "pwd command should not fail");
      const { readFileSync, readdirSync } = await import("node:fs");
      const files = readdirSync(artDir);
      assert.ok(files.length > 0, "at least one artifact file should be written");
      const content = readFileSync(join(artDir, files[0]), "utf8");
      assert.ok(content.includes(cwdDir), `artifact stdout should contain the cwd path (${cwdDir})`);
    } finally {
      await rm(artDir, { recursive: true, force: true });
      await rm(cwdDir, { recursive: true, force: true });
    }
  });

  it("non-zero exit with required: true sets failed via runExecuteRunCommands", async () => {
    const artDir = join(tmpdir(), `ext-art-fail-${Date.now()}`);
    await mkdir(artDir, { recursive: true });
    try {
      const result = runExecuteRunCommands(
        [{ command: "exit 1", required: true }],
        artDir,
        process.cwd(),
      );
      assert.ok(result.failed, "required=true + non-zero exit must set failed");
      assert.ok(typeof result.lastFailure === "string" && result.lastFailure.length > 0, "lastFailure should be set");
    } finally {
      await rm(artDir, { recursive: true, force: true });
    }
  });

  it("non-zero exit with required: false does not set failed via runExecuteRunCommands", async () => {
    const artDir = join(tmpdir(), `ext-art-nofail-${Date.now()}`);
    await mkdir(artDir, { recursive: true });
    try {
      const result = runExecuteRunCommands(
        [{ command: "exit 1", required: false }],
        artDir,
        process.cwd(),
      );
      assert.ok(!result.failed, "required=false must not set failed");
    } finally {
      await rm(artDir, { recursive: true, force: true });
    }
  });

  it("zero exit does not set failed even with required: true via runExecuteRunCommands", async () => {
    const artDir = join(tmpdir(), `ext-art-zero-${Date.now()}`);
    await mkdir(artDir, { recursive: true });
    try {
      const result = runExecuteRunCommands(
        [{ command: "echo ok", required: true }],
        artDir,
        process.cwd(),
      );
      assert.ok(!result.failed, "exit 0 must never set failed");
    } finally {
      await rm(artDir, { recursive: true, force: true });
    }
  });

  it("missing required field defaults to non-blocking via runExecuteRunCommands", async () => {
    const artDir = join(tmpdir(), `ext-art-nofield-${Date.now()}`);
    await mkdir(artDir, { recursive: true });
    try {
      const result = runExecuteRunCommands(
        [{ command: "exit 1" }],
        artDir,
        process.cwd(),
      );
      assert.ok(!result.failed, "missing required field must not block task");
    } finally {
      await rm(artDir, { recursive: true, force: true });
    }
  });
});

// ── loadExtensions tests ────────────────────────────────────────────────────

describe("loadExtensions", () => {
  let tmpDir;
  let extDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ext-test-"));
    extDir = join(tmpDir, ".team", "extensions");
    await mkdir(extDir, { recursive: true });
  });

  // Use afterEach-style cleanup via try/finally in each test (node:test lacks afterEach with async)

  it("loads a valid extension from directory", async () => {
    const extPath = join(extDir, "my-ext.mjs");
    await writeFile(extPath, `
export default {
  name: "my-ext",
  version: "1.0.0",
  capabilities: ["promptAppend"],
  hooks: { promptAppend: async () => ({ append: "hello" }) },
};
`);
    try {
      const exts = await loadExtensions(tmpDir);
      assert.equal(exts.length, 1);
      assert.equal(exts[0].name, "my-ext");
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("skips extension with invalid manifest (missing hooks)", async () => {
    const extPath = join(extDir, "bad-ext.mjs");
    await writeFile(extPath, `
export default {
  name: "bad-ext",
  version: "1.0.0",
  capabilities: ["promptAppend"],
  // hooks missing
};
`);
    try {
      const exts = await loadExtensions(tmpDir);
      assert.equal(exts.length, 0);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("skips extension that throws on import", async () => {
    const extPath = join(extDir, "throw-ext.mjs");
    await writeFile(extPath, `throw new Error("import failed");`);
    try {
      const exts = await loadExtensions(tmpDir);
      assert.equal(exts.length, 0);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns empty array when directory does not exist", async () => {
    await rm(tmpDir, { recursive: true, force: true });
    const exts = await loadExtensions(tmpDir);
    assert.deepEqual(exts, []);
  });
});
