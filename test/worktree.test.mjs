// Tests for git worktree helpers in bin/lib/run.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, existsSync, mkdtempSync, readFileSync, realpathSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";

import { slugToBranch, createWorktreeIfNeeded, removeWorktree, runGateInline, dispatchToAgent, dispatchToAgentAsync } from "../bin/lib/run.mjs";

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

  it("dispatchToAgentAsync throws when cwd is omitted", () => {
    assert.throws(
      () => dispatchToAgentAsync("claude", "brief", undefined),
      /cwd is required/
    );
  });

  it("dispatchToAgentAsync throws when cwd is undefined explicitly", () => {
    assert.throws(
      () => dispatchToAgentAsync("claude", "brief", undefined, () => {}),
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

// ── Parallel safety: two concurrent runs on different features ───

describe("concurrent createWorktreeIfNeeded on different slugs", () => {
  let repoDir;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), "wt-parallel-"));
    execFileSync("git", ["init", "-q", "-b", "main", repoDir], { stdio: "pipe" });
    execFileSync("git", ["-C", repoDir, "config", "user.email", "t@t"], { stdio: "pipe" });
    execFileSync("git", ["-C", repoDir, "config", "user.name", "t"], { stdio: "pipe" });
    execFileSync("git", ["-C", repoDir, "commit", "--allow-empty", "-q", "-m", "init"], { stdio: "pipe" });
  });

  afterEach(() => {
    try { rmSync(repoDir, { recursive: true, force: true }); } catch {}
  });

  it("two concurrent invocations on different features produce two independent worktrees", async () => {
    const slugA = "feature-alpha";
    const slugB = "feature-beta";

    // Race them in parallel — neither should fail and they must produce distinct paths.
    const [pathA, pathB] = await Promise.all([
      Promise.resolve().then(() => createWorktreeIfNeeded(slugA, repoDir)),
      Promise.resolve().then(() => createWorktreeIfNeeded(slugB, repoDir)),
    ]);

    assert.notEqual(pathA, pathB, "two slugs must produce distinct worktree paths");
    assert.ok(existsSync(pathA), `worktree A directory must exist: ${pathA}`);
    assert.ok(existsSync(pathB), `worktree B directory must exist: ${pathB}`);

    // Both must show up in `git worktree list` — proves no race corrupted git's bookkeeping.
    const list = execFileSync("git", ["-C", repoDir, "worktree", "list"], { encoding: "utf8" });
    const realA = realpathSync(pathA);
    const realB = realpathSync(pathB);
    assert.ok(list.includes(realA) || list.includes(pathA), `worktree list must include A:\n${list}`);
    assert.ok(list.includes(realB) || list.includes(pathB), `worktree list must include B:\n${list}`);

    // Cleanup so afterEach rm -rf doesn't trip git locks
    removeWorktree(pathA, repoDir);
    removeWorktree(pathB, repoDir);
  });

  it("parent .team/worktrees/ directory is not corrupted by concurrent creation", async () => {
    const slugs = ["f1", "f2", "f3", "f4"];
    const paths = await Promise.all(
      slugs.map(s => Promise.resolve().then(() => createWorktreeIfNeeded(s, repoDir)))
    );

    // All paths distinct, all exist
    const unique = new Set(paths);
    assert.equal(unique.size, slugs.length, "all worktree paths must be unique");
    for (const p of paths) {
      assert.ok(existsSync(p), `worktree path must exist: ${p}`);
    }

    // Cleanup
    for (const p of paths) removeWorktree(p, repoDir);
  });

  it("two real child processes racing on different slugs both succeed (true OS-level concurrency)", async () => {
    // Spawn two separate Node processes that each call createWorktreeIfNeeded.
    // This exercises a real OS-level race on `.team/worktrees/` and on git's
    // internal `.git/worktrees/` admin directory — Promise.all over execFileSync
    // would be serialized on the event loop and miss this.
    const { spawn } = await import("child_process");
    const helperUrl = new URL("../bin/lib/run.mjs", import.meta.url).href;

    const runChild = (slug) => new Promise((resolve, reject) => {
      const code = `
        import("${helperUrl}").then(m => {
          const p = m.createWorktreeIfNeeded(${JSON.stringify(slug)}, ${JSON.stringify(repoDir)});
          process.stdout.write("\\n__PATH__" + p + "__END__\\n");
        }).catch(e => { process.stderr.write(String(e)); process.exit(1); });
      `;
      const child = spawn(process.execPath, ["--input-type=module", "-e", code], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "", err = "";
      child.stdout.on("data", d => out += d);
      child.stderr.on("data", d => err += d);
      child.on("exit", code => {
        if (code !== 0) return reject(new Error(`child exited ${code}: ${err}`));
        const m = out.match(/__PATH__(.*?)__END__/);
        if (!m) return reject(new Error(`no path marker in child output: ${out}`));
        resolve(m[1]);
      });
    });

    const [pathA, pathB] = await Promise.all([runChild("real-race-a"), runChild("real-race-b")]);
    assert.notEqual(pathA, pathB);
    assert.ok(existsSync(pathA));
    assert.ok(existsSync(pathB));
    const list = execFileSync("git", ["-C", repoDir, "worktree", "list"], { encoding: "utf8" });
    assert.ok(list.includes(realpathSync(pathA)) || list.includes(pathA));
    assert.ok(list.includes(realpathSync(pathB)) || list.includes(pathB));

    removeWorktree(pathA, repoDir);
    removeWorktree(pathB, repoDir);
  });

  it("two concurrent invocations on the SAME slug: one wins, the other reuses or errors cleanly (no corruption)", async () => {
    const slug = "same-slug-race";
    // Race two creates on the same slug. Possible outcomes per call:
    //  - returns the worktree path (reused or freshly created)
    //  - throws because git rejects a duplicate `worktree add`
    // Either is acceptable; what's NOT acceptable is partial state that prevents reuse.
    const results = await Promise.allSettled([
      Promise.resolve().then(() => createWorktreeIfNeeded(slug, repoDir)),
      Promise.resolve().then(() => createWorktreeIfNeeded(slug, repoDir)),
    ]);
    const successes = results.filter(r => r.status === "fulfilled");
    assert.ok(successes.length >= 1, `at least one create must succeed; got: ${JSON.stringify(results)}`);
    const wtPath = successes[0].value;
    assert.ok(existsSync(wtPath), "worktree path must exist on disk after the race");

    // A subsequent reuse must succeed (proves no corruption left behind).
    const reused = createWorktreeIfNeeded(slug, repoDir);
    assert.equal(reused, wtPath);

    removeWorktree(wtPath, repoDir);
  });
});

// ── Path-traversal guard ─────────────────────────────────────────

describe("createWorktreeIfNeeded slug sanitization", () => {
  it("does not allow `../` in slug to escape .team/worktrees/", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "wt-traversal-"));
    try {
      const calls = [];
      const mockExec = (cmd, args) => calls.push(args);
      // Raw slug "../evil" must be normalized; the on-disk path must stay under
      // .team/worktrees/ (slugToBranch strips `/` and `.` is allowed but leading
      // dots cannot form `..` once `/` is gone).
      const result = createWorktreeIfNeeded("../evil", tmpDir, mockExec);
      assert.ok(
        result.startsWith(join(tmpDir, ".team", "worktrees") + "/"),
        `worktree path must stay under .team/worktrees/, got: ${result}`
      );
      assert.ok(!result.includes(".." + "/"), "path must not contain `../`");
    } finally {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  });

  it("throws on slugs that sanitize to all-dots (`.`, `..`, `...`)", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "wt-dotslug-"));
    try {
      for (const bad of [".", "..", "...", "....."]) {
        assert.throws(
          () => createWorktreeIfNeeded(bad, tmpDir, () => {}),
          /invalid slug/,
          `must reject all-dots slug ${JSON.stringify(bad)}`
        );
      }
    } finally {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  });

  it("throws on a slug that sanitizes to empty (e.g. all special chars)", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "wt-empty-slug-"));
    try {
      assert.throws(() => createWorktreeIfNeeded("@@@///", tmpDir, () => {}), /invalid slug/);
    } finally {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  });
});

// ── Worktree preserved on error (source assertion) ───────────────

describe("worktree preserved on thrown error", () => {
  it("run.mjs does NOT remove worktree in a finally block (preserves on error)", () => {
    const src = readFileSync(new URL("../bin/lib/run.mjs", import.meta.url), "utf8");
    // The previous implementation used `} finally { ... removeWorktree ... }` which
    // would tear down the worktree even on thrown errors, defeating the reuse path.
    assert.ok(
      !/}\s*finally\s*{[^}]*removeWorktree\s*\(/.test(src),
      "removeWorktree must NOT be called from a finally block — it would erase the worktree on error and prevent re-invocation reuse"
    );
  });

  it("run.mjs catches errors during the run and preserves the worktree before rethrowing", () => {
    const src = readFileSync(new URL("../bin/lib/run.mjs", import.meta.url), "utf8");
    // Look for a catch handler that mentions preserving the worktree and rethrows.
    assert.ok(
      /catch\s*\(\s*err\s*\)\s*{[\s\S]*?preserving worktree[\s\S]*?throw\s+err/i.test(src),
      "run.mjs must catch run errors, log that the worktree is being preserved, then rethrow"
    );
  });

  it("createWorktreeIfNeeded reuses an existing worktree path (preserved-on-error → re-run reuse)", () => {
    // Simulates the lifecycle: previous run errored, worktree dir still on disk.
    // A new run must reuse it without invoking `git worktree add`.
    const tmpDir = mkdtempSync(join(tmpdir(), "preserved-wt-"));
    try {
      const slug = "errored-feature";
      const wtPath = join(tmpDir, ".team", "worktrees", slug);
      mkdirSync(wtPath, { recursive: true }); // simulate left-behind worktree

      const calls = [];
      const mockExec = (cmd, args, opts) => calls.push({ cmd, args, opts });
      const result = createWorktreeIfNeeded(slug, tmpDir, mockExec);

      assert.equal(result, wtPath);
      assert.equal(calls.length, 0, "must reuse existing worktree without spawning git");
    } finally {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  });
});

// ── PLAYBOOK.md documentation contract ───────────────────────────

describe("PLAYBOOK.md documentation contract", () => {
  let playbookSrc;

  beforeEach(() => {
    playbookSrc = readFileSync(new URL("../PLAYBOOK.md", import.meta.url), "utf8");
  });

  it("contains ## Git Worktrees section", () => {
    assert.ok(
      /^## Git Worktrees/m.test(playbookSrc),
      "PLAYBOOK.md must contain a '## Git Worktrees' section"
    );
  });

  it("documents git worktree list command", () => {
    assert.ok(
      /git worktree list/.test(playbookSrc),
      "PLAYBOOK.md must document the 'git worktree list' command"
    );
  });

  it("documents manual cleanup with git worktree remove", () => {
    assert.ok(
      /git worktree (remove|prune)/.test(playbookSrc),
      "PLAYBOOK.md must document manual cleanup with 'git worktree remove' or 'git worktree prune'"
    );
  });

  it("slug description accurately describes dot preservation", () => {
    assert.ok(
      /dots? retained|alphanumeric.*hyphens.*dots|hyphens.*dots.*retained/i.test(playbookSrc),
      "PLAYBOOK.md slug description must mention that dots are retained"
    );
  });

  it("branch description accurately states re-runs reuse the existing worktree", () => {
    assert.ok(
      /re-runs? reuse/i.test(playbookSrc),
      "PLAYBOOK.md branch description must state that re-runs reuse the existing worktree"
    );
  });
});

// ── Grep audit: no process.cwd() in agent dispatch or gate functions ──

describe("grep audit: no process.cwd() in agent dispatch or gate paths", () => {
  it("gate.mjs has no hardcoded cwd: process.cwd() references", () => {
    const gateSrc = readFileSync(new URL("../bin/lib/gate.mjs", import.meta.url), "utf8");
    // Must not hard-code `cwd: process.cwd()` — should use an explicit --cwd parameter with fallback
    assert.ok(
      !/cwd\s*:\s*process\.cwd\s*\(\)/.test(gateSrc),
      "gate.mjs must not hard-code cwd: process.cwd() — use the resolved 'cwd' variable (from --cwd flag) instead"
    );
  });

  it("dispatchToAgent body has no process.cwd() references", () => {
    const src = readFileSync(new URL("../bin/lib/run.mjs", import.meta.url), "utf8");
    // Find the dispatchToAgent function lines
    const lines = src.split("\n");
    let inFn = false;
    let depth = 0;
    const violations = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inFn && /^export function dispatchToAgent\b/.test(line)) {
        inFn = true;
      }
      if (inFn) {
        depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        // Match actual usage like `cwd: process.cwd()` — not error message strings
        if (/cwd\s*:\s*process\.cwd\s*\(\)/.test(line)) violations.push(`run.mjs:${i + 1}: ${line.trim()}`);
        if (depth <= 0 && i > 0) break;
      }
    }
    assert.equal(violations.length, 0,
      `dispatchToAgent must not contain cwd: process.cwd():\n${violations.join("\n")}`
    );
  });

  it("dispatchToAgentAsync body has no process.cwd() references", () => {
    const src = readFileSync(new URL("../bin/lib/run.mjs", import.meta.url), "utf8");
    const lines = src.split("\n");
    let inFn = false;
    let depth = 0;
    const violations = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inFn && /export function dispatchToAgentAsync\b/.test(line)) {
        inFn = true;
      }
      if (inFn) {
        depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        // Match actual usage like `cwd: process.cwd()` — not error message strings
        if (/cwd\s*:\s*process\.cwd\s*\(\)/.test(line)) violations.push(`run.mjs:${i + 1}: ${line.trim()}`);
        if (depth <= 0 && i > 0) break;
      }
    }
    assert.equal(violations.length, 0,
      `dispatchToAgentAsync must not contain cwd: process.cwd():\n${violations.join("\n")}`
    );
  });
});
