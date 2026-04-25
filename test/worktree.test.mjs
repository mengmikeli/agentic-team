// Tests for git worktree helpers in bin/lib/run.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, existsSync, mkdtempSync, readFileSync, realpathSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";

import { slugToBranch, createWorktreeIfNeeded, removeWorktree, runGateInline, dispatchToAgent } from "../bin/lib/run.mjs";

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

  beforeEach(() => {
    tmpDir = join(tmpdir(), `worktree-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("calls execFileSync with correct git worktree add arguments when directory does not exist", () => {
    const calls = [];
    const mockExec = (cmd, args, opts) => calls.push({ cmd, args, opts });

    const result = createWorktreeIfNeeded("new-slug", tmpDir, mockExec);

    const expectedPath = join(tmpDir, ".team", "worktrees", "new-slug");
    assert.equal(result, expectedPath);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].cmd, "git");
    assert.deepEqual(calls[0].args, ["worktree", "add", expectedPath, "-B", "feature/new-slug"]);
    assert.equal(calls[0].opts.cwd, tmpDir);
    assert.equal(calls[0].opts.stdio, "pipe");
  });

  it("reuses existing worktree without calling execFileSync (crash recovery)", () => {
    const slug = "existing-feature";
    const worktreePath = join(tmpDir, ".team", "worktrees", slug);
    mkdirSync(worktreePath, { recursive: true });

    const calls = [];
    const mockExec = (cmd, args, opts) => calls.push({ cmd, args, opts });

    const result = createWorktreeIfNeeded(slug, tmpDir, mockExec);
    assert.equal(result, worktreePath);
    assert.equal(calls.length, 0, "should not call execFileSync when worktree already exists");
    assert.ok(existsSync(result));
  });

  it("computed path uses .team/worktrees/{slug}", () => {
    const slug = "my-feature";
    const expected = join(tmpDir, ".team", "worktrees", slug);
    mkdirSync(expected, { recursive: true });

    const result = createWorktreeIfNeeded(slug, tmpDir);
    assert.equal(result, expected);
  });

  it("uses -B flag (not -b) so re-runs with existing branch name succeed", () => {
    const calls = [];
    const mockExec = (cmd, args, opts) => calls.push({ cmd, args, opts });

    createWorktreeIfNeeded("re-run-slug", tmpDir, mockExec);

    assert.equal(calls.length, 1);
    assert.ok(calls[0].args.includes("-B"), "must use -B to force-create-or-reset the branch");
    assert.ok(!calls[0].args.includes("-b"), "must not use -b which would fail if branch already exists");
  });

  it("calls git worktree add with -B when directory absent but branch may exist (re-run scenario)", () => {
    // Simulate: removeWorktree deleted the directory but not the branch.
    // The directory is gone so existsSync returns false. We expect -B to be used.
    const calls = [];
    const mockExec = (cmd, args) => calls.push(args);
    const slug = "previously-run-feature";
    // Confirm the directory does NOT exist
    const worktreePath = join(tmpDir, ".team", "worktrees", slug);
    assert.ok(!existsSync(worktreePath), "pre-condition: directory must not exist");

    createWorktreeIfNeeded(slug, tmpDir, mockExec);

    assert.equal(calls.length, 1);
    const branchFlagIdx = calls[0].indexOf("-B");
    assert.ok(branchFlagIdx !== -1, "-B must be present in git worktree add args for re-run scenario");
  });

  it("branch name is feature/{slugToBranch(slug)}", () => {
    const calls = [];
    const mockExec = (cmd, args) => calls.push(args);

    createWorktreeIfNeeded("my_slug", tmpDir, mockExec);

    assert.equal(calls.length, 1);
    const branchArg = calls[0][calls[0].length - 1];
    assert.equal(branchArg, "feature/my-slug");
  });
});

// ── removeWorktree ───────────────────────────────────────────────

describe("removeWorktree", () => {
  it("does not throw if git worktree remove fails (already gone)", () => {
    assert.doesNotThrow(() => {
      removeWorktree("/nonexistent/path/xyz", "/tmp");
    });
  });

  it("calls execFileSync with correct git worktree remove --force arguments", () => {
    const calls = [];
    const mockExec = (cmd, args, opts) => calls.push({ cmd, args, opts });

    removeWorktree("/some/worktree", "/main/repo", mockExec);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].cmd, "git");
    assert.deepEqual(calls[0].args, ["worktree", "remove", "--force", "/some/worktree"]);
    assert.equal(calls[0].opts.cwd, "/main/repo");
    assert.equal(calls[0].opts.stdio, "pipe");
  });

  it("lifecycle: removeWorktree is called on completion (mock-based)", () => {
    let removeCalled = false;
    const mockExec = () => { removeCalled = true; };
    removeWorktree("/path/to/worktree", "/main", mockExec);
    assert.ok(removeCalled, "removeWorktree should invoke execFn to remove the worktree");
  });

  it("lifecycle: removeWorktree swallows errors (blocked/already-gone path)", () => {
    const mockExec = () => { throw new Error("worktree not found"); };
    assert.doesNotThrow(() => removeWorktree("/gone/path", "/main", mockExec));
  });
});

// ── removeWorktree real-git integration ─────────────────────────

describe("removeWorktree real-git lifecycle", () => {
  let repoDir;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), "wt-real-git-"));
    execFileSync("git", ["init", "-q", "-b", "main", repoDir], { stdio: "pipe" });
    execFileSync("git", ["-C", repoDir, "config", "user.email", "t@t"], { stdio: "pipe" });
    execFileSync("git", ["-C", repoDir, "config", "user.name", "t"], { stdio: "pipe" });
    execFileSync("git", ["-C", repoDir, "commit", "--allow-empty", "-q", "-m", "init"], { stdio: "pipe" });
  });

  afterEach(() => {
    try { rmSync(repoDir, { recursive: true, force: true }); } catch {}
  });

  it("after createWorktreeIfNeeded + removeWorktree, `git worktree list` does not show the path", () => {
    const slug = "remove-me";
    const wtPath = createWorktreeIfNeeded(slug, repoDir);

    // Sanity: worktree list shows it
    let list = execFileSync("git", ["-C", repoDir, "worktree", "list"], { encoding: "utf8" });
    const realWtPath = realpathSync(wtPath);
    assert.ok(list.includes(realWtPath) || list.includes(wtPath), `precondition: ${wtPath} should appear in:\n${list}`);

    removeWorktree(wtPath, repoDir);

    // Directory gone
    assert.ok(!existsSync(wtPath), "worktree directory should be deleted");

    // Tracking entry gone
    list = execFileSync("git", ["-C", repoDir, "worktree", "list"], { encoding: "utf8" });
    assert.ok(!list.includes(wtPath), `worktree list should no longer contain ${wtPath}:\n${list}`);
    assert.ok(!list.includes(realWtPath), `worktree list should no longer contain ${realWtPath}:\n${list}`);
  });
});

// ── runGateInline cwd injection ───────────────────────────────────

describe("runGateInline cwd injection", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "gate-cwd-test-"));
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("uses the provided cwd, not process.cwd()", () => {
    // Run `pwd` — on POSIX its stdout will be the cwd. On Windows, `cd` does the same.
    const cmd = process.platform === "win32" ? "cd" : "pwd";
    const result = runGateInline(cmd, tmpDir, null, tmpDir);
    const realTmpDir = realpathSync(tmpDir);
    assert.equal(
      result.stdout.trim(),
      realTmpDir,
      `Expected stdout to equal cwd ${realTmpDir}, got: ${result.stdout}`
    );
  });

  it("returns PASS verdict when command succeeds", () => {
    const result = runGateInline("node --version", tmpDir, null, tmpDir);
    assert.equal(result.verdict, "PASS");
  });

  it("returns FAIL verdict when command fails", () => {
    const result = runGateInline("node -e 'process.exit(1)'", tmpDir, null, tmpDir);
    assert.equal(result.verdict, "FAIL");
  });
});

// ── slugToBranch normalization ───────────────────────────────────

describe("slugToBranch normalization", () => {
  it("produces feature/{slug} branch name format", () => {
    const slug = "my-feature";
    const expectedBranch = "feature/" + slugToBranch(slug);
    assert.equal(expectedBranch, "feature/my-feature");
  });

  it("normalizes underscores in branch name", () => {
    const slug = "my_feature_test";
    const branch = "feature/" + slugToBranch(slug);
    assert.equal(branch, "feature/my-feature-test");
  });
});

// ── _runSingleFeature → runGateInline wiring ─────────────────────

describe("_runSingleFeature wiring", () => {
  it("passes worktreePath as cwd to runGateInline (source assertion)", () => {
    const src = readFileSync(new URL("../bin/lib/run.mjs", import.meta.url), "utf8");
    // Verify the call site passes `cwd` (the worktree path) as the 4th argument
    assert.ok(
      /runGateInline\(\s*gateCmd\s*,\s*featureDir\s*,\s*task\.id\s*,\s*cwd\s*\)/.test(src),
      "run.mjs must call runGateInline(gateCmd, featureDir, task.id, cwd) — cwd is the injected worktree path"
    );
  });
});


describe("required-cwd contract (no implicit fallback)", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "required-cwd-test-"));
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("runGateInline throws when cwd is omitted", () => {
    assert.throws(
      () => runGateInline("node --version", tmpDir, null),
      /cwd is required/
    );
  });

  it("runGateInline throws when cwd is undefined explicitly", () => {
    assert.throws(
      () => runGateInline("node --version", tmpDir, null, undefined),
      /cwd is required/
    );
  });

  it("dispatchToAgent throws when cwd is omitted", () => {
    const mockSpawn = () => ({ status: 0, stdout: "", stderr: "" });
    assert.throws(
      () => dispatchToAgent("claude", "brief", undefined, mockSpawn),
      /cwd is required/
    );
  });
});


describe("dispatchToAgent cwd injection", () => {
  it("forwards worktreePath as cwd to spawnSync for claude agent", () => {
    const calls = [];
    const mockSpawn = (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
      return { status: 0, stdout: '{"result":"ok"}', stderr: "" };
    };

    const worktreePath = "/some/worktree/path";
    dispatchToAgent("claude", "do the thing", worktreePath, mockSpawn);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.cwd, worktreePath, "spawnSync must receive worktreePath as cwd");
  });

  it("forwards worktreePath as cwd to spawnSync for codex agent", () => {
    const calls = [];
    const mockSpawn = (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
      return { status: 0, stdout: "done", stderr: "" };
    };

    const worktreePath = "/another/worktree";
    dispatchToAgent("codex", "do the thing", worktreePath, mockSpawn);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.cwd, worktreePath, "spawnSync must receive worktreePath as cwd");
  });

  it("cwd is distinct from process.cwd() when worktreePath differs", () => {
    const calls = [];
    const mockSpawn = (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
      return { status: 0, stdout: '{"result":""}', stderr: "" };
    };

    const worktreePath = "/worktrees/my-feature";
    assert.notEqual(worktreePath, process.cwd(), "test precondition: worktreePath must differ from cwd");
    dispatchToAgent("claude", "brief", worktreePath, mockSpawn);

    assert.equal(calls[0].opts.cwd, worktreePath);
    assert.notEqual(calls[0].opts.cwd, process.cwd());
  });
});
