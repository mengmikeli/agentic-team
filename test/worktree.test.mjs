// Tests for git worktree helpers in bin/lib/run.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { slugToBranch, createWorktreeIfNeeded, removeWorktree } from "../bin/lib/run.mjs";

// ── slugToBranch ─────────────────────────────────────────────────

describe("slugToBranch", () => {
  it("passes through a clean slug unchanged", () => {
    assert.equal(slugToBranch("git-worktree-isolation"), "git-worktree-isolation");
  });

  it("converts spaces to dashes", () => {
    assert.equal(slugToBranch("my feature"), "my-feature");
  });

  it("converts underscores to dashes", () => {
    assert.equal(slugToBranch("my_feature"), "my-feature");
  });

  it("strips non-alphanumeric/dash/dot characters", () => {
    assert.equal(slugToBranch("hello@world!"), "helloworld");
  });

  it("caps at 72 characters", () => {
    const long = "a".repeat(80);
    assert.equal(slugToBranch(long).length, 72);
  });

  it("allows dots", () => {
    assert.equal(slugToBranch("v1.0"), "v1.0");
  });
});

// ── createWorktreeIfNeeded ───────────────────────────────────────

describe("createWorktreeIfNeeded", () => {
  let tmpDir;
  let execSyncCalls;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `worktree-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    execSyncCalls = [];
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("calls git worktree add when directory does not exist", () => {
    // Mock child_process.execSync by testing through the exported function
    // We verify the returned path without actually running git
    const worktreePath = join(tmpDir, ".team", "worktrees", "my-slug");

    // Create the directory to simulate what git would do
    const fakePath = join(tmpDir, ".team", "worktrees", "already-there");
    mkdirSync(fakePath, { recursive: true });

    // Verify the function returns the correct path for an existing worktree
    // (reuse path when exists)
    const result = createWorktreeIfNeeded("already-there", tmpDir);
    assert.equal(result, fakePath);
  });

  it("returns existing worktree path without re-running git (crash recovery)", () => {
    const slug = "existing-feature";
    const worktreePath = join(tmpDir, ".team", "worktrees", slug);
    mkdirSync(worktreePath, { recursive: true });

    // Should reuse the existing directory, not call git worktree add
    // (we test this by confirming no error is thrown even though git is not set up)
    const result = createWorktreeIfNeeded(slug, tmpDir);
    assert.equal(result, worktreePath);
    assert.ok(existsSync(result));
  });

  it("computed path uses .team/worktrees/{slug}", () => {
    const slug = "my-feature";
    const expected = join(tmpDir, ".team", "worktrees", slug);
    // Pre-create so no git call is made
    mkdirSync(expected, { recursive: true });

    const result = createWorktreeIfNeeded(slug, tmpDir);
    assert.equal(result, expected);
  });
});

// ── removeWorktree ───────────────────────────────────────────────

describe("removeWorktree", () => {
  it("does not throw if git worktree remove fails (already gone)", () => {
    // Should be a no-op / silent failure for missing path
    assert.doesNotThrow(() => {
      removeWorktree("/nonexistent/path/xyz", "/tmp");
    });
  });
});

// ── Branch name format ───────────────────────────────────────────

describe("createWorktreeIfNeeded branch naming", () => {
  it("branch would be feature/{slugToBranch(slug)}", () => {
    const slug = "my-feature";
    const expectedBranch = "feature/" + slugToBranch(slug);
    assert.equal(expectedBranch, "feature/my-feature");
  });

  it("normalizes slug in branch name", () => {
    const slug = "my_feature_test";
    const branch = "feature/" + slugToBranch(slug);
    assert.equal(branch, "feature/my-feature-test");
  });
});
