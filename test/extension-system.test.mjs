// Tests for the extension system (extension-loader, extension-runner, extension-registry)
// Focuses on: promptAppend hook being appended to the agent brief before dispatchToAgent()

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { runHook, isCircuitBroken, resetCircuitBreakers } from "../bin/lib/extension-runner.mjs";
import { fireExtension, resetRegistry, setExtensions } from "../bin/lib/extension-registry.mjs";

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
