// Tests for bin/lib/context.mjs — context briefs for reviewer dispatch
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import { buildContextBrief } from "../bin/lib/context.mjs";

describe("buildContextBrief", () => {
  it("returns fallback when no context files exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"));
    const featureDir = join(dir, "features", "test");
    mkdirSync(featureDir, { recursive: true });

    const brief = buildContextBrief(featureDir, dir);
    assert.ok(brief.includes("Context"));
  });

  it("includes SPEC.md content when present", () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"));
    const featureDir = join(dir, "features", "test");
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(join(featureDir, "SPEC.md"), "# Feature Spec\n\nBuild a cool thing.");

    const brief = buildContextBrief(featureDir, dir);
    assert.ok(brief.includes("Design Intent"));
    assert.ok(brief.includes("Build a cool thing"));
  });

  it("includes project conventions from PROJECT.md", () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"));
    const featureDir = join(dir, "features", "test");
    const teamDir = join(dir, ".team");
    mkdirSync(featureDir, { recursive: true });
    mkdirSync(teamDir, { recursive: true });
    writeFileSync(join(teamDir, "PROJECT.md"), "# Project\n\n## Quality Gate\n```bash\nnpm test\n```\n\n## Stack\nNode.js + SvelteKit\n");

    const brief = buildContextBrief(featureDir, dir);
    assert.ok(brief.includes("Project Conventions") || brief.includes("Quality Gate") || brief.includes("npm test"));
  });

  it("includes backlog as known issues", () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"));
    const featureDir = join(dir, "features", "test");
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(join(featureDir, "backlog.md"), "# Backlog\n\n- [ ] warn: deprecated API usage\n");

    const brief = buildContextBrief(featureDir, dir);
    assert.ok(brief.includes("Known Issues"));
    assert.ok(brief.includes("deprecated API"));
  });

  it("includes progress.md as known issues", () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"));
    const featureDir = join(dir, "features", "test");
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(join(featureDir, "progress.md"), "# Progress\n\n## Task 1\n- Completed with warnings\n");

    const brief = buildContextBrief(featureDir, dir);
    assert.ok(brief.includes("Known Issues"));
    assert.ok(brief.includes("Completed with warnings"));
  });

  it("includes git log when in a git repo", () => {
    // Use the agentic-team repo itself as cwd
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"));
    const featureDir = join(dir, "features", "test");
    mkdirSync(featureDir, { recursive: true });

    // Initialize a git repo with a commit
    try {
      execSync("git init && git commit --allow-empty -m 'test commit'", {
        cwd: dir, shell: true, stdio: "pipe",
      });
    } catch { return; } // skip if git not available

    const brief = buildContextBrief(featureDir, dir);
    assert.ok(brief.includes("Git History") || brief.includes("test commit"));
  });

  it("combines multiple context sources", () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"));
    const featureDir = join(dir, "features", "test");
    const teamDir = join(dir, ".team");
    mkdirSync(featureDir, { recursive: true });
    mkdirSync(teamDir, { recursive: true });

    writeFileSync(join(featureDir, "SPEC.md"), "# Spec\nDo the thing.");
    writeFileSync(join(featureDir, "backlog.md"), "# Backlog\n- [ ] warn: old issue");
    writeFileSync(join(teamDir, "PROJECT.md"), "# Project\n## Stack\nRust + WASM");

    const brief = buildContextBrief(featureDir, dir);
    assert.ok(brief.includes("Context Brief"));
    assert.ok(brief.includes("Design Intent"));
    assert.ok(brief.includes("Known Issues"));
  });

  it("truncates long SPEC.md content", () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"));
    const featureDir = join(dir, "features", "test");
    mkdirSync(featureDir, { recursive: true });
    writeFileSync(join(featureDir, "SPEC.md"), "# Spec\n" + "x".repeat(5000));

    const brief = buildContextBrief(featureDir, dir);
    assert.ok(brief.length < 5000); // Should be truncated
  });
});
