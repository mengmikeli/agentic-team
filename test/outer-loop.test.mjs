// Tests for bin/lib/outer-loop.mjs — outer product loop
// Uses Node.js built-in test runner (node --test)

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  buildPrioritizeBrief,
  buildOuterBrainstormBrief,
  buildOutcomeReviewBrief,
  parsePriorityOutput,
  validateSpecFile,
  markRoadmapItemDone,
  getCompletedFeatures,
  slugify,
  parseRoadmap,
  outerLoop,
  createApprovalIssue,
  waitForApproval,
} from "../bin/lib/outer-loop.mjs";

// ── Test fixtures ───────────────────────────────────────────────

const SAMPLE_PRODUCT_MD = `# agentic-team — Product Definition

## Vision
A framework for AI agent teams to self-manage software projects.

## Users
Developers running AI coding agents.

## Problem
AI agents can write code but can't self-organize.

## Success Metrics
1. **Idea → deliverable with human only at init + completion.**
2. **Teams adopt it for >1 sprint.**

## Roadmap
1. **v1.0 — Foundations** — Core skills and CLI. ✅ Done
2. **v2.0 — CLI product** — agt run, harness, GitHub. ✅ Done
3. **Flow templates** — Add flow selection to agt run based on task complexity.
4. **Parallel reviewers** — Dispatch 2-5 role-specific reviewers simultaneously.
5. **Backlog enforcement** — Track warnings in backlog.md, gate on documented warnings.
`;

function createTmpDir() {
  const dir = join(tmpdir(), `outer-loop-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── buildPrioritizeBrief ────────────────────────────────────────

describe("buildPrioritizeBrief", () => {
  it("includes product content in the brief", () => {
    const brief = buildPrioritizeBrief(SAMPLE_PRODUCT_MD, [], "/project");
    assert.ok(brief.includes("A framework for AI agent teams"));
    assert.ok(brief.includes("Developers running AI coding agents"));
  });

  it("lists completed features", () => {
    const brief = buildPrioritizeBrief(SAMPLE_PRODUCT_MD, ["flow-templates", "parallel-reviewers"], "/project");
    assert.ok(brief.includes("flow-templates"));
    assert.ok(brief.includes("parallel-reviewers"));
  });

  it("shows 'None yet' when no features completed", () => {
    const brief = buildPrioritizeBrief(SAMPLE_PRODUCT_MD, [], "/project");
    assert.ok(brief.includes("None yet"));
  });

  it("includes working directory", () => {
    const brief = buildPrioritizeBrief(SAMPLE_PRODUCT_MD, [], "/my/project");
    assert.ok(brief.includes("/my/project"));
  });

  it("includes required output format instructions", () => {
    const brief = buildPrioritizeBrief(SAMPLE_PRODUCT_MD, [], "/project");
    assert.ok(brief.includes("PRIORITY:"));
    assert.ok(brief.includes("REASONING:"));
  });

  it("instructs not to write code", () => {
    const brief = buildPrioritizeBrief(SAMPLE_PRODUCT_MD, [], "/project");
    assert.ok(brief.toLowerCase().includes("do not write any code"));
  });
});

// ── buildOuterBrainstormBrief ───────────────────────────────────

describe("buildOuterBrainstormBrief", () => {
  it("includes product context", () => {
    const brief = buildOuterBrainstormBrief(
      SAMPLE_PRODUCT_MD, [], "Flow templates — Add flow selection", "flow-templates", "/project",
    );
    assert.ok(brief.includes("A framework for AI agent teams"));
  });

  it("includes the priority item description", () => {
    const brief = buildOuterBrainstormBrief(
      SAMPLE_PRODUCT_MD, [], "Flow templates — Add flow selection", "flow-templates", "/project",
    );
    assert.ok(brief.includes("Flow templates"));
    assert.ok(brief.includes("flow selection"));
  });

  it("includes completed features", () => {
    const brief = buildOuterBrainstormBrief(
      SAMPLE_PRODUCT_MD, ["foundations", "cli-product"], "New feature", "new-feature", "/project",
    );
    assert.ok(brief.includes("foundations"));
    assert.ok(brief.includes("cli-product"));
  });

  it("includes SPEC.md path with feature name", () => {
    const brief = buildOuterBrainstormBrief(
      SAMPLE_PRODUCT_MD, [], "Feature X", "feature-x", "/project",
    );
    assert.ok(brief.includes(".team/features/feature-x/SPEC.md"));
  });

  it("requires Goal, Scope, Out of Scope, Done When sections", () => {
    const brief = buildOuterBrainstormBrief(
      SAMPLE_PRODUCT_MD, [], "Feature", "feat", "/project",
    );
    assert.ok(brief.includes("## Goal"));
    assert.ok(brief.includes("## Scope"));
    assert.ok(brief.includes("## Out of Scope"));
    assert.ok(brief.includes("## Done When"));
  });

  it("instructs not to implement", () => {
    const brief = buildOuterBrainstormBrief(
      SAMPLE_PRODUCT_MD, [], "Feature", "feat", "/project",
    );
    assert.ok(brief.toLowerCase().includes("do not implement"));
  });
});

// ── buildOutcomeReviewBrief ─────────────────────────────────────

describe("buildOutcomeReviewBrief", () => {
  it("includes feature name", () => {
    const brief = buildOutcomeReviewBrief("flow-templates", SAMPLE_PRODUCT_MD, "Some progress", "/project");
    assert.ok(brief.includes("flow-templates"));
  });

  it("includes product content for metric comparison", () => {
    const brief = buildOutcomeReviewBrief("feat", SAMPLE_PRODUCT_MD, "", "/project");
    assert.ok(brief.includes("Success Metrics") || brief.includes("Idea → deliverable"));
  });

  it("includes progress content", () => {
    const progress = "Task 1: PASS\nTask 2: PASS\n3 tasks completed.";
    const brief = buildOutcomeReviewBrief("feat", SAMPLE_PRODUCT_MD, progress, "/project");
    assert.ok(brief.includes("Task 1: PASS"));
    assert.ok(brief.includes("3 tasks completed"));
  });

  it("handles empty progress gracefully", () => {
    const brief = buildOutcomeReviewBrief("feat", SAMPLE_PRODUCT_MD, "", "/project");
    assert.ok(brief.includes("No progress log available"));
  });

  it("includes OUTCOME output format requirement", () => {
    const brief = buildOutcomeReviewBrief("feat", SAMPLE_PRODUCT_MD, "", "/project");
    assert.ok(brief.includes("OUTCOME:"));
  });

  it("instructs to update PRODUCT.md roadmap", () => {
    const brief = buildOutcomeReviewBrief("feat", SAMPLE_PRODUCT_MD, "", "/project");
    assert.ok(brief.includes("PRODUCT.md"));
    assert.ok(brief.includes("✅ Done"));
  });
});

// ── parsePriorityOutput ─────────────────────────────────────────

describe("parsePriorityOutput", () => {
  it("extracts PRIORITY and REASONING from well-formed output", () => {
    const output = `Let me analyze the roadmap...

PRIORITY: Flow templates
REASONING: Flow templates enable the orchestrator to select execution strategies per task.

This is the highest impact item because...`;

    const result = parsePriorityOutput(output);
    assert.ok(result);
    assert.equal(result.name, "Flow templates");
    assert.ok(result.reasoning.includes("orchestrator"));
  });

  it("handles PRIORITY with no REASONING", () => {
    const output = "PRIORITY: Parallel reviewers\n";
    const result = parsePriorityOutput(output);
    assert.ok(result);
    assert.equal(result.name, "Parallel reviewers");
    assert.equal(result.reasoning, "");
  });

  it("returns null for empty output", () => {
    assert.equal(parsePriorityOutput(""), null);
    assert.equal(parsePriorityOutput(null), null);
    assert.equal(parsePriorityOutput(undefined), null);
  });

  it("returns null when PRIORITY line is missing", () => {
    const output = "I recommend building flow templates next because...";
    assert.equal(parsePriorityOutput(output), null);
  });

  it("returns null when PRIORITY value is empty", () => {
    const output = "PRIORITY:   \nREASONING: Something";
    assert.equal(parsePriorityOutput(output), null);
  });

  it("handles multiline agent output with PRIORITY embedded", () => {
    const output = `After careful analysis of the roadmap, considering what's been completed and what remains:

The v1.0 and v2.0 milestones are done. Looking at what's left:

PRIORITY: Backlog enforcement
REASONING: Without backlog enforcement, warnings accumulate silently and quality degrades over time.

Additional thoughts: this also sets up future work...`;

    const result = parsePriorityOutput(output);
    assert.ok(result);
    assert.equal(result.name, "Backlog enforcement");
    assert.ok(result.reasoning.includes("warnings accumulate"));
  });
});

// ── validateSpecFile ────────────────────────────────────────────

describe("validateSpecFile", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("validates a complete SPEC.md", () => {
    const specPath = join(tmpDir, "SPEC.md");
    writeFileSync(specPath, `# Feature: Test

## Goal
Build something great.

## Scope
- Item 1
- Item 2

## Out of Scope
- Not this

## Done When
- [ ] Tests pass
- [ ] Gate passes
`);

    const result = validateSpecFile(specPath);
    assert.equal(result.valid, true);
    assert.equal(result.sections.length, 4);
    assert.equal(result.missing.length, 0);
  });

  it("detects missing sections", () => {
    const specPath = join(tmpDir, "SPEC.md");
    writeFileSync(specPath, `# Feature: Test

## Goal
Build something.

## Scope
- Item 1
`);

    const result = validateSpecFile(specPath);
    assert.equal(result.valid, false);
    assert.ok(result.missing.includes("Out of Scope"));
    assert.ok(result.missing.includes("Done When"));
    assert.ok(result.sections.includes("Goal"));
    assert.ok(result.sections.includes("Scope"));
  });

  it("returns all missing for non-existent file", () => {
    const result = validateSpecFile(join(tmpDir, "nope.md"));
    assert.equal(result.valid, false);
    assert.equal(result.missing.length, 4);
    assert.equal(result.sections.length, 0);
  });

  it("is case-insensitive for section headings", () => {
    const specPath = join(tmpDir, "SPEC.md");
    writeFileSync(specPath, `# feature

## goal
do stuff

## scope
stuff

## out of scope
none

## done when
- [ ] done
`);

    const result = validateSpecFile(specPath);
    assert.equal(result.valid, true);
  });

  it("handles empty file", () => {
    const specPath = join(tmpDir, "SPEC.md");
    writeFileSync(specPath, "");
    const result = validateSpecFile(specPath);
    assert.equal(result.valid, false);
    assert.equal(result.missing.length, 4);
  });
});

// ── markRoadmapItemDone ─────────────────────────────────────────

describe("markRoadmapItemDone", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("marks an item as done in PRODUCT.md", () => {
    const productPath = join(tmpDir, "PRODUCT.md");
    writeFileSync(productPath, SAMPLE_PRODUCT_MD);

    const updated = markRoadmapItemDone(productPath, "Flow templates");
    assert.equal(updated, true);

    const content = readFileSync(productPath, "utf8");
    assert.ok(content.includes("Flow templates** — Add flow selection to agt run based on task complexity. ✅ Done"));
  });

  it("does not double-mark already done items", () => {
    const productPath = join(tmpDir, "PRODUCT.md");
    writeFileSync(productPath, SAMPLE_PRODUCT_MD);

    // v1.0 is already marked done
    const updated = markRoadmapItemDone(productPath, "v1.0 — Foundations");
    assert.equal(updated, false);
  });

  it("returns false for non-existent file", () => {
    const updated = markRoadmapItemDone(join(tmpDir, "nope.md"), "Something");
    assert.equal(updated, false);
  });

  it("returns false for non-matching item", () => {
    const productPath = join(tmpDir, "PRODUCT.md");
    writeFileSync(productPath, SAMPLE_PRODUCT_MD);

    const updated = markRoadmapItemDone(productPath, "Nonexistent feature");
    assert.equal(updated, false);
  });

  it("is case-insensitive for matching", () => {
    const productPath = join(tmpDir, "PRODUCT.md");
    writeFileSync(productPath, SAMPLE_PRODUCT_MD);

    const updated = markRoadmapItemDone(productPath, "flow templates");
    assert.equal(updated, true);

    const content = readFileSync(productPath, "utf8");
    assert.ok(content.includes("✅ Done"));
  });
});

// ── parseRoadmap ────────────────────────────────────────────────

describe("parseRoadmap", () => {
  it("parses roadmap items with done status", () => {
    const items = parseRoadmap(SAMPLE_PRODUCT_MD);
    assert.ok(items.length >= 5);

    assert.equal(items[0].name, "v1.0 — Foundations");
    assert.equal(items[0].done, true);

    assert.equal(items[1].name, "v2.0 — CLI product");
    assert.equal(items[1].done, true);

    assert.equal(items[2].name, "Flow templates");
    assert.equal(items[2].done, false);
    assert.ok(items[2].description.includes("flow selection"));
  });

  it("returns empty array for content without roadmap", () => {
    const items = parseRoadmap("# Some Doc\n\n## Other Section\nStuff");
    assert.deepEqual(items, []);
  });

  it("returns empty array for empty roadmap section", () => {
    const items = parseRoadmap("## Roadmap\n\n## Next Section");
    assert.deepEqual(items, []);
  });
});

// ── slugify ─────────────────────────────────────────────────────

describe("slugify", () => {
  it("converts spaces and special chars to hyphens", () => {
    assert.equal(slugify("Flow templates"), "flow-templates");
  });

  it("removes leading and trailing hyphens", () => {
    assert.equal(slugify("--hello--"), "hello");
  });

  it("truncates to 50 chars", () => {
    const long = "a".repeat(100);
    assert.equal(slugify(long).length, 50);
  });

  it("handles version numbers", () => {
    assert.equal(slugify("v1.0 — Foundations"), "v1-0-foundations");
  });

  it("collapses multiple special chars", () => {
    assert.equal(slugify("hello   world!!!"), "hello-world");
  });
});

// ── getCompletedFeatures ────────────────────────────────────────

describe("getCompletedFeatures", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when features dir doesn't exist", () => {
    const result = getCompletedFeatures(tmpDir);
    assert.deepEqual(result, []);
  });

  it("returns completed features only", () => {
    const featuresDir = join(tmpDir, "features");
    mkdirSync(join(featuresDir, "done-feature"), { recursive: true });
    mkdirSync(join(featuresDir, "pending-feature"), { recursive: true });

    writeFileSync(join(featuresDir, "done-feature", "STATE.json"), JSON.stringify({
      status: "completed",
      _written_by: "at-harness",
      _last_modified: new Date().toISOString(),
      _write_nonce: "test",
    }));
    writeFileSync(join(featuresDir, "pending-feature", "STATE.json"), JSON.stringify({
      status: "executing",
      _written_by: "at-harness",
      _last_modified: new Date().toISOString(),
      _write_nonce: "test",
    }));

    const result = getCompletedFeatures(tmpDir);
    assert.deepEqual(result, ["done-feature"]);
  });

  it("ignores directories without STATE.json", () => {
    const featuresDir = join(tmpDir, "features");
    mkdirSync(join(featuresDir, "no-state"), { recursive: true });

    const result = getCompletedFeatures(tmpDir);
    assert.deepEqual(result, []);
  });
});

// ── outerLoop (mocked) ─────────────────────────────────────────

/** Approval mock deps — prevent any real gh calls in outerLoop tests. */
const NO_GH_APPROVAL_DEPS = {
  createIssue: () => null,
  addToProject: () => null,
  setProjectItemStatus: () => false,
  getProjectItemStatus: () => null,
  sleep: () => Promise.resolve(),
};

describe("outerLoop", () => {
  let tmpDir;
  let originalCwd;
  let originalExit;

  beforeEach(() => {
    tmpDir = createTmpDir();
    mkdirSync(join(tmpDir, ".team"), { recursive: true });
    writeFileSync(join(tmpDir, ".team", "PRODUCT.md"), SAMPLE_PRODUCT_MD);
    originalCwd = process.cwd;
    process.cwd = () => tmpDir;
    // Prevent process.exit from killing test runner
    originalExit = process.exit;
    process.exit = (code) => { throw new Error(`process.exit(${code})`); };
  });

  afterEach(() => {
    process.cwd = originalCwd;
    process.exit = originalExit;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("runs one full cycle with mocked deps", async () => {
    let prioritizeCalled = false;
    let brainstormCalled = false;
    let executeCalled = false;
    let outcomeCalled = false;
    let dispatchCount = 0;

    const mockDeps = {
      findAgent: () => "claude",
      ...NO_GH_APPROVAL_DEPS,
      dispatchToAgent: (agent, brief, cwd) => {
        dispatchCount++;
        if (dispatchCount === 1) {
          // Prioritize
          prioritizeCalled = true;
          return {
            ok: true,
            output: "PRIORITY: Flow templates\nREASONING: Highest impact on execution quality.",
          };
        }
        if (dispatchCount === 2) {
          // Brainstorm — write SPEC.md
          brainstormCalled = true;
          const featureDir = join(tmpDir, ".team", "features", "flow-templates");
          mkdirSync(featureDir, { recursive: true });
          writeFileSync(join(featureDir, "SPEC.md"), `# Feature: Flow templates

## Goal
Add flow selection to agt run.

## Scope
- Light review
- Build verify
- Full stack

## Out of Scope
- Custom user flows

## Done When
- [ ] Flow selection works
- [ ] Tests pass
`);
          return { ok: true, output: "SPEC.md written." };
        }
        if (dispatchCount === 3) {
          // Outcome review
          outcomeCalled = true;
          return {
            ok: true,
            output: "OUTCOME: Flow templates directly advance autonomous execution by enabling smart flow selection.",
          };
        }
        return { ok: true, output: "" };
      },
      runSingleFeature: async (args, description) => {
        executeCalled = true;
        // Create progress.md for outcome review
        const featureDir = join(tmpDir, ".team", "features", "flow-templates");
        mkdirSync(featureDir, { recursive: true });
        writeFileSync(join(featureDir, "progress.md"), "# Progress\nTask 1: PASS\n");
        return "done";
      },
    };

    const cycles = await outerLoop([], mockDeps);

    assert.ok(prioritizeCalled, "Prioritize should have been called");
    assert.ok(brainstormCalled, "Brainstorm should have been called");
    assert.ok(executeCalled, "Execute should have been called");
    assert.ok(outcomeCalled, "Outcome review should have been called");

    // Verify roadmap was updated
    const product = readFileSync(join(tmpDir, ".team", "PRODUCT.md"), "utf8");
    assert.ok(product.includes("Flow templates") && product.includes("✅ Done"),
      "Roadmap should be updated with ✅ Done");
  });

  it("stops when all roadmap items are exhausted", async () => {
    // Mark all undone items as done already
    const allDoneMd = SAMPLE_PRODUCT_MD
      .replace("Add flow selection to agt run based on task complexity.", "Add flow selection. ✅ Done")
      .replace("Dispatch 2-5 role-specific reviewers simultaneously.", "Dispatch reviewers. ✅ Done")
      .replace("Track warnings in backlog.md, gate on documented warnings.", "Track warnings. ✅ Done");
    writeFileSync(join(tmpDir, ".team", "PRODUCT.md"), allDoneMd);

    let dispatchCount = 0;
    const mockDeps = {
      findAgent: () => "claude",
      ...NO_GH_APPROVAL_DEPS,
      dispatchToAgent: (agent, brief, cwd) => {
        dispatchCount++;
        // Agent can't find any undone items
        return { ok: true, output: "All items are done. No PRIORITY to select." };
      },
      runSingleFeature: async () => "done",
    };

    const cycles = await outerLoop([], mockDeps);
    // Should have stopped after prioritize couldn't find anything
    assert.ok(dispatchCount <= 2, "Should not dispatch many times when roadmap is exhausted");
  });

  it("handles prioritize failure gracefully", async () => {
    const mockDeps = {
      findAgent: () => "claude",
      ...NO_GH_APPROVAL_DEPS,
      dispatchToAgent: () => ({ ok: false, output: "", error: "Agent crashed" }),
      runSingleFeature: async () => "done",
    };

    const cycles = await outerLoop([], mockDeps);
    assert.equal(cycles, 1, "Should stop after failed prioritization");
  });

  it("creates minimal SPEC.md when agent doesn't write one", async () => {
    let dispatchCount = 0;
    const mockDeps = {
      findAgent: () => "claude",
      ...NO_GH_APPROVAL_DEPS,
      dispatchToAgent: (agent, brief, cwd) => {
        dispatchCount++;
        if (dispatchCount === 1) {
          return { ok: true, output: "PRIORITY: Parallel reviewers\nREASONING: Needed for quality." };
        }
        if (dispatchCount === 2) {
          // Brainstorm but don't write SPEC.md
          return { ok: true, output: "Here's my analysis..." };
        }
        if (dispatchCount === 3) {
          return { ok: true, output: "OUTCOME: Good progress." };
        }
        return { ok: true, output: "" };
      },
      runSingleFeature: async (args, desc) => {
        // Create progress.md
        const featureDir = join(tmpDir, ".team", "features", "parallel-reviewers");
        mkdirSync(featureDir, { recursive: true });
        writeFileSync(join(featureDir, "progress.md"), "done\n");
        return "done";
      },
    };

    await outerLoop([], mockDeps);

    // Verify a minimal SPEC.md was created
    const specPath = join(tmpDir, ".team", "features", "parallel-reviewers", "SPEC.md");
    assert.ok(existsSync(specPath), "Minimal SPEC.md should have been created");
    const spec = readFileSync(specPath, "utf8");
    assert.ok(spec.includes("## Goal"));
    assert.ok(spec.includes("## Scope"));
  });

  it("creates approval issue and proceeds after approval", async () => {
    let createIssueCalled = false;
    let executeCalled = false;
    let dispatchCount = 0;

    const mockDeps = {
      findAgent: () => "claude",
      createIssue: (title, body, labels) => { createIssueCalled = true; return 99; },
      addToProject: () => null,
      setProjectItemStatus: () => false,
      getProjectItemStatus: () => "Ready",  // immediately approved
      sleep: () => Promise.resolve(),
      dispatchToAgent: (agent, brief) => {
        dispatchCount++;
        if (dispatchCount === 1) {
          return { ok: true, output: "PRIORITY: Flow templates\nREASONING: test" };
        }
        if (dispatchCount === 2) {
          const featureDir = join(tmpDir, ".team", "features", "flow-templates");
          mkdirSync(featureDir, { recursive: true });
          writeFileSync(join(featureDir, "SPEC.md"), `# Feature: Flow templates\n\n## Goal\nDo stuff.\n\n## Scope\n- stuff\n\n## Out of Scope\n- nothing\n\n## Done When\n- [ ] done\n`);
          return { ok: true, output: "SPEC.md written." };
        }
        return { ok: true, output: "OUTCOME: done." };
      },
      runSingleFeature: async () => {
        executeCalled = true;
        const featureDir = join(tmpDir, ".team", "features", "flow-templates");
        mkdirSync(featureDir, { recursive: true });
        writeFileSync(join(featureDir, "progress.md"), "done\n");
        return "done";
      },
    };

    await outerLoop([], mockDeps);

    assert.ok(createIssueCalled, "createIssue should be called when gh is available");
    assert.ok(executeCalled, "Execute should proceed after approval");

    // Verify approval.json was written with approved status
    const approvalPath = join(tmpDir, ".team", "features", "flow-templates", "approval.json");
    assert.ok(existsSync(approvalPath), "approval.json should exist");
    const approvalData = JSON.parse(readFileSync(approvalPath, "utf8"));
    assert.equal(approvalData.issueNumber, 99);
    assert.equal(approvalData.status, "approved");
  });

  it("re-entry guard: skips issue creation when approval.json already exists", async () => {
    // Pre-seed the signing key so approval.json validation succeeds on re-entry
    const knownKey = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    writeFileSync(join(tmpDir, ".team", ".approval-secret"), knownKey);

    // Pre-create approval.json with existing pending issue (signed with knownKey)
    const featureDir = join(tmpDir, ".team", "features", "flow-templates");
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(join(featureDir, "approval.json"), JSON.stringify({ issueNumber: 77, status: "pending", _written_by: knownKey }));
    writeFileSync(join(featureDir, "SPEC.md"), `# Feature: Flow templates\n\n## Goal\nDo stuff.\n\n## Scope\n- stuff\n\n## Out of Scope\n- nothing\n\n## Done When\n- [ ] done\n`);

    // Create PROJECT.md with a valid project number so waitForApproval is actually invoked
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"), "# Project\nhttps://github.com/users/test/projects/42\n");

    let createIssueCalled = false;
    let executeCalled = false;
    let getStatusCalled = false;
    let dispatchCount = 0;

    const mockDeps = {
      findAgent: () => "claude",
      createIssue: () => { createIssueCalled = true; return 100; },
      addToProject: () => "item-id-123",
      setProjectItemStatus: () => false,
      getProjectItemStatus: () => { getStatusCalled = true; return "Ready"; },  // immediately approved on first poll
      sleep: () => Promise.resolve(),
      dispatchToAgent: (agent, brief) => {
        dispatchCount++;
        if (dispatchCount === 1) {
          return { ok: true, output: "PRIORITY: Flow templates\nREASONING: test" };
        }
        if (dispatchCount === 2) {
          return { ok: true, output: "SPEC.md already exists." };
        }
        return { ok: true, output: "OUTCOME: done." };
      },
      runSingleFeature: async () => {
        executeCalled = true;
        const fd = join(tmpDir, ".team", "features", "flow-templates");
        mkdirSync(fd, { recursive: true });
        writeFileSync(join(fd, "progress.md"), "done\n");
        return "exhausted";
      },
    };

    await outerLoop([], mockDeps);

    assert.equal(createIssueCalled, false, "createIssue should NOT be called when issue already exists");
    assert.ok(getStatusCalled, "getProjectItemStatus should be called to poll approval (resume-polling path exercised)");
    assert.ok(executeCalled, "Execute should proceed after re-entry approval");
  });

  it("skips waitForApproval and proceeds when projectNumber is null", async () => {
    let waitForApprovalCalled = false;
    let executeCalled = false;
    let dispatchCount = 0;

    const mockDeps = {
      findAgent: () => "claude",
      createIssue: () => 99, // issue created successfully
      addToProject: () => null,
      setProjectItemStatus: () => false,
      // getProjectItemStatus would loop forever if called with null projectNumber
      getProjectItemStatus: () => { waitForApprovalCalled = true; return null; },
      sleep: () => { waitForApprovalCalled = true; return Promise.resolve(); },
      dispatchToAgent: (agent, brief) => {
        dispatchCount++;
        if (dispatchCount === 1) {
          return { ok: true, output: "PRIORITY: Flow templates\nREASONING: test" };
        }
        if (dispatchCount === 2) {
          const featureDir = join(tmpDir, ".team", "features", "flow-templates");
          mkdirSync(featureDir, { recursive: true });
          writeFileSync(join(featureDir, "SPEC.md"), `# Feature: Flow templates\n\n## Goal\nDo stuff.\n\n## Scope\n- stuff\n\n## Out of Scope\n- nothing\n\n## Done When\n- [ ] done\n`);
          return { ok: true, output: "SPEC.md written." };
        }
        return { ok: true, output: "OUTCOME: done." };
      },
      runSingleFeature: async () => {
        executeCalled = true;
        const featureDir = join(tmpDir, ".team", "features", "flow-templates");
        mkdirSync(featureDir, { recursive: true });
        writeFileSync(join(featureDir, "progress.md"), "done\n");
        return "done";
      },
    };

    // No PROJECT.md in tmpDir → projectNumber will be null
    await outerLoop([], mockDeps);

    assert.equal(waitForApprovalCalled, false, "Should not poll when projectNumber is null");
    assert.ok(executeCalled, "Execute should proceed even without project board");

    const approvalPath = join(tmpDir, ".team", "features", "flow-templates", "approval.json");
    assert.ok(existsSync(approvalPath), "approval.json should exist");
    const approvalData = JSON.parse(readFileSync(approvalPath, "utf8"));
    assert.equal(approvalData.issueNumber, 99);
    assert.equal(approvalData.status, "approved");
  });

  it("sets approvalStatus: 'approved' in STATE.json when project item moves to Ready", async () => {
    let executeCalled = false;
    let dispatchCount = 0;

    // Pre-create STATE.json for the feature (simulates harness having initialized it)
    const featureDir = join(tmpDir, ".team", "features", "flow-templates");
    mkdirSync(featureDir, { recursive: true });
    const initialState = {
      version: "2.0",
      feature: "flow-templates",
      status: "active",
      tasks: [],
      gates: [],
      transitionCount: 0,
      transitionHistory: [],
      createdAt: new Date().toISOString(),
      _written_by: "at-harness",
      _last_modified: new Date().toISOString(),
      _write_nonce: "test-nonce",
    };
    writeFileSync(join(featureDir, "STATE.json"), JSON.stringify(initialState, null, 2));
    writeFileSync(join(featureDir, "SPEC.md"), `# Feature: Flow templates\n\n## Goal\nDo stuff.\n\n## Scope\n- stuff\n\n## Out of Scope\n- nothing\n\n## Done When\n- [ ] done\n`);

    // Also write PROJECT.md so waitForApproval is actually invoked
    writeFileSync(join(tmpDir, ".team", "PROJECT.md"), "# Project\nhttps://github.com/users/test/projects/42\n");

    const mockDeps = {
      findAgent: () => "claude",
      createIssue: () => 55,
      addToProject: () => "item-id-123",
      setProjectItemStatus: () => true,
      getProjectItemStatus: () => "Ready",  // immediately approved
      getIssueUrl: () => null,
      sleep: () => Promise.resolve(),
      dispatchToAgent: (agent, brief) => {
        dispatchCount++;
        if (dispatchCount === 1) {
          return { ok: true, output: "PRIORITY: Flow templates\nREASONING: test" };
        }
        if (dispatchCount === 2) {
          return { ok: true, output: "SPEC.md already exists." };
        }
        return { ok: true, output: "OUTCOME: done." };
      },
      runSingleFeature: async () => {
        executeCalled = true;
        const fd = join(tmpDir, ".team", "features", "flow-templates");
        writeFileSync(join(fd, "progress.md"), "done\n");
        return "exhausted";
      },
    };

    await outerLoop([], mockDeps);

    assert.ok(executeCalled, "Execute should proceed after approval");

    const stateData = JSON.parse(readFileSync(join(featureDir, "STATE.json"), "utf8"));
    assert.equal(stateData.approvalStatus, "approved",
      "STATE.json should contain approvalStatus: 'approved' after project item moves to Ready");
  });

  it("sets approvalStatus: 'approved' in STATE.json when skipping approval wait (no project board)", async () => {
    let executeCalled = false;
    let dispatchCount = 0;

    // Pre-create STATE.json
    const featureDir = join(tmpDir, ".team", "features", "flow-templates");
    mkdirSync(featureDir, { recursive: true });
    const initialState = {
      version: "2.0",
      feature: "flow-templates",
      status: "active",
      tasks: [],
      gates: [],
      transitionCount: 0,
      transitionHistory: [],
      createdAt: new Date().toISOString(),
      _written_by: "at-harness",
      _last_modified: new Date().toISOString(),
      _write_nonce: "test-nonce-2",
    };
    writeFileSync(join(featureDir, "STATE.json"), JSON.stringify(initialState, null, 2));
    writeFileSync(join(featureDir, "SPEC.md"), `# Feature: Flow templates\n\n## Goal\nDo stuff.\n\n## Scope\n- stuff\n\n## Out of Scope\n- nothing\n\n## Done When\n- [ ] done\n`);

    // No PROJECT.md → projectNumber is null → skips waitForApproval
    const mockDeps = {
      findAgent: () => "claude",
      createIssue: () => 66,
      addToProject: () => null,
      setProjectItemStatus: () => false,
      getProjectItemStatus: () => "Pending Approval",
      sleep: () => Promise.resolve(),
      dispatchToAgent: (agent, brief) => {
        dispatchCount++;
        if (dispatchCount === 1) {
          return { ok: true, output: "PRIORITY: Flow templates\nREASONING: test" };
        }
        if (dispatchCount === 2) {
          return { ok: true, output: "SPEC.md already exists." };
        }
        return { ok: true, output: "OUTCOME: done." };
      },
      runSingleFeature: async () => {
        executeCalled = true;
        const fd = join(tmpDir, ".team", "features", "flow-templates");
        writeFileSync(join(fd, "progress.md"), "done\n");
        return "exhausted";
      },
    };

    await outerLoop([], mockDeps);

    assert.ok(executeCalled, "Execute should proceed when no project board");

    const stateData = JSON.parse(readFileSync(join(featureDir, "STATE.json"), "utf8"));
    assert.equal(stateData.approvalStatus, "approved",
      "STATE.json should contain approvalStatus: 'approved' even when skipping approval wait");
  });

  it("halts without executing when approval.json is corrupt", async () => {
    let executeCalled = false;
    let dispatchCount = 0;

    const mockDeps = {
      findAgent: () => "claude",
      createIssue: () => 99,
      addToProject: () => null,
      setProjectItemStatus: () => false,
      getProjectItemStatus: () => "Pending Approval",
      getIssueUrl: () => null,
      sleep: () => Promise.resolve(),
      dispatchToAgent: (agent, brief) => {
        dispatchCount++;
        if (dispatchCount === 1) {
          return { ok: true, output: "PRIORITY: Flow templates\nREASONING: test" };
        }
        if (dispatchCount === 2) {
          const featureDir = join(tmpDir, ".team", "features", "flow-templates");
          mkdirSync(featureDir, { recursive: true });
          writeFileSync(join(featureDir, "SPEC.md"), `# Feature: Flow templates\n\n## Goal\nDo stuff.\n\n## Scope\n- stuff\n\n## Out of Scope\n- nothing\n\n## Done When\n- [ ] done\n`);
          return { ok: true, output: "SPEC.md written." };
        }
        return { ok: true, output: "OUTCOME: done." };
      },
      runSingleFeature: async () => {
        executeCalled = true;
        return "done";
      },
    };

    // Pre-write a corrupt approval.json for this feature
    const featureDir = join(tmpDir, ".team", "features", "flow-templates");
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(join(featureDir, "approval.json"), "{ invalid json !!!");

    await outerLoop([], mockDeps);

    assert.equal(executeCalled, false, "Execute must NOT run when approval.json is corrupt");
  });
});

// ── createApprovalIssue ─────────────────────────────────────────

describe("createApprovalIssue", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes issueNumber and status:pending to approval.json", async () => {
    const featureDir = join(tmpDir, "my-feature");
    const specPath = join(featureDir, "SPEC.md");
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(specPath, "# Spec\n\n## Goal\nDo stuff.");

    const mockDeps = {
      createIssue: (title, body, labels) => {
        assert.equal(title, "[Feature] My Feature");
        assert.ok(labels.includes("awaiting-approval"));
        return 42;
      },
      addToProject: () => "item-id",
      setProjectItemStatus: () => true,
    };

    const result = await createApprovalIssue(featureDir, "My Feature", specPath, null, mockDeps);
    assert.equal(result, 42);

    const approvalData = JSON.parse(readFileSync(join(featureDir, "approval.json"), "utf8"));
    assert.equal(approvalData.issueNumber, 42);
    assert.equal(approvalData.status, "pending");
  });

  it("returns null and does not write approval.json when createIssue fails", async () => {
    const featureDir = join(tmpDir, "my-feature");
    mkdirSync(featureDir, { recursive: true });
    const mockDeps = { createIssue: () => null };

    const result = await createApprovalIssue(featureDir, "My Feature", join(featureDir, "SPEC.md"), null, mockDeps);
    assert.equal(result, null);
    assert.equal(existsSync(join(featureDir, "approval.json")), false);
  });

  it("does not write to STATE.json (no crash-recovery interference)", async () => {
    const featureDir = join(tmpDir, "my-feature");
    const specPath = join(featureDir, "SPEC.md");
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(specPath, "# Spec");

    await createApprovalIssue(featureDir, "My Feature", specPath, null, {
      createIssue: () => 55,
      addToProject: () => null,
      setProjectItemStatus: () => false,
    });

    // STATE.json should not exist (no crash-recovery fields were written there)
    assert.equal(existsSync(join(featureDir, "STATE.json")), false,
      "approval fields must not pollute STATE.json");
  });
});

// ── waitForApproval ─────────────────────────────────────────────

describe("waitForApproval", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 'approved' immediately when status is already 'Ready'", async () => {
    const mockDeps = {
      getProjectItemStatus: () => "Ready",
      sleep: () => Promise.resolve(),
    };
    const result = await waitForApproval(42, tmpDir, null, () => false, mockDeps);
    assert.equal(result, "approved");
  });

  it("returns 'interrupted' when stopping flag is set before first poll", async () => {
    let pollCount = 0;
    const mockDeps = {
      getProjectItemStatus: () => { pollCount++; return "Pending Approval"; },
      sleep: () => Promise.resolve(),
    };
    const result = await waitForApproval(42, tmpDir, null, () => true, mockDeps);
    assert.equal(result, "interrupted");
    assert.equal(pollCount, 0, "Should not poll when stopping from the start");
  });

  it("polls until status changes to Ready", async () => {
    let pollCount = 0;
    const mockDeps = {
      getProjectItemStatus: () => {
        pollCount++;
        return pollCount >= 3 ? "Ready" : "Pending Approval";
      },
      sleep: () => Promise.resolve(),
    };
    const result = await waitForApproval(42, tmpDir, null, () => false, mockDeps);
    assert.equal(result, "approved");
    assert.ok(pollCount >= 3, "Should have polled at least 3 times");
  });

  it("returns 'interrupted' when stopping flag set after several polls", async () => {
    let pollCount = 0;
    const mockDeps = {
      getProjectItemStatus: () => { pollCount++; return "Pending Approval"; },
      sleep: () => Promise.resolve(),
    };
    // Stop after 2 polls
    const result = await waitForApproval(42, tmpDir, null, () => pollCount >= 2, mockDeps);
    assert.equal(result, "interrupted");
  });
});
