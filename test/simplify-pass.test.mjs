// Tests for bin/lib/simplify-pass.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import {
  isCodeFile,
  getChangedFiles,
  buildSimplifyBrief,
  runSimplifyPass,
} from "../bin/lib/simplify-pass.mjs";

// ── isCodeFile ───────────────────────────────────────────────────

describe("isCodeFile", () => {
  it("accepts .mjs files", () => assert.ok(isCodeFile("bin/lib/run.mjs")));
  it("accepts .js files", () => assert.ok(isCodeFile("src/index.js")));
  it("accepts .ts files", () => assert.ok(isCodeFile("src/app.ts")));
  it("accepts .tsx files", () => assert.ok(isCodeFile("src/App.tsx")));
  it("accepts .py files", () => assert.ok(isCodeFile("lib/util.py")));
  it("accepts .go files", () => assert.ok(isCodeFile("cmd/main.go")));
  it("accepts .rs files", () => assert.ok(isCodeFile("src/lib.rs")));

  it("rejects .md files", () => assert.ok(!isCodeFile("README.md")));
  it("rejects .json files", () => assert.ok(!isCodeFile("package.json")));
  it("rejects .yaml files", () => assert.ok(!isCodeFile("config.yaml")));
  it("rejects .txt files", () => assert.ok(!isCodeFile("notes.txt")));

  it("rejects package-lock.json", () => assert.ok(!isCodeFile("package-lock.json")));
  it("rejects yarn.lock", () => assert.ok(!isCodeFile("yarn.lock")));
  it("rejects pnpm-lock.yaml (no code ext match anyway)", () => assert.ok(!isCodeFile("pnpm-lock.yaml")));
  it("rejects .lock files", () => assert.ok(!isCodeFile("some.lock")));

  it("rejects node_modules files", () => assert.ok(!isCodeFile("node_modules/lodash/index.js")));
  it("rejects .min.js files", () => assert.ok(!isCodeFile("dist/app.min.js")));
  it("rejects .d.ts declaration files", () => assert.ok(!isCodeFile("types/index.d.ts")));
  it("rejects files under dist/", () => assert.ok(!isCodeFile("dist/bundle.js")));
  it("rejects files under build/", () => assert.ok(!isCodeFile("build/output.js")));
});

// ── getChangedFiles ──────────────────────────────────────────────

describe("getChangedFiles", () => {
  it("returns code files from git diff output", () => {
    const mock = (_cmd, _opts) => "src/index.js\nbin/lib/run.mjs\n";
    const files = getChangedFiles("abc123", "/repo", mock);
    assert.deepEqual(files, ["src/index.js", "bin/lib/run.mjs"]);
  });

  it("filters out non-code files", () => {
    const mock = (_cmd, _opts) => "src/index.js\nREADME.md\npackage-lock.json\nlib/util.py\n";
    const files = getChangedFiles("abc123", "/repo", mock);
    assert.deepEqual(files, ["src/index.js", "lib/util.py"]);
  });

  it("returns empty array when no code files changed", () => {
    const mock = (_cmd, _opts) => "README.md\npackage-lock.json\n";
    const files = getChangedFiles("abc123", "/repo", mock);
    assert.deepEqual(files, []);
  });

  it("returns empty array when git diff output is empty", () => {
    const mock = (_cmd, _opts) => "";
    const files = getChangedFiles("abc123", "/repo", mock);
    assert.deepEqual(files, []);
  });

  it("returns empty array when execFn throws", () => {
    const mock = () => { throw new Error("not a git repo"); };
    const files = getChangedFiles("abc123", "/repo", mock);
    assert.deepEqual(files, []);
  });

  it("passes the base..HEAD range to git diff", () => {
    let capturedCmd = "";
    const mock = (cmd, _opts) => { capturedCmd = cmd; return ""; };
    getChangedFiles("deadbeef", "/repo", mock);
    assert.ok(capturedCmd.includes("deadbeef..HEAD"), `expected deadbeef..HEAD in: ${capturedCmd}`);
  });

  it("passes cwd to execFn options", () => {
    let capturedOpts = null;
    const mock = (_cmd, opts) => { capturedOpts = opts; return ""; };
    getChangedFiles("abc123", "/my/project", mock);
    assert.equal(capturedOpts?.cwd, "/my/project");
  });
});

// ── buildSimplifyBrief ───────────────────────────────────────────

describe("buildSimplifyBrief", () => {
  it("includes each file in the brief", () => {
    const brief = buildSimplifyBrief(["src/foo.mjs", "lib/bar.js"]);
    assert.ok(brief.includes("src/foo.mjs"), "brief should list src/foo.mjs");
    assert.ok(brief.includes("lib/bar.js"), "brief should list lib/bar.js");
  });

  it("returns a non-empty string", () => {
    const brief = buildSimplifyBrief(["src/index.js"]);
    assert.ok(typeof brief === "string" && brief.length > 0);
  });
});

// ── runSimplifyPass ──────────────────────────────────────────────

describe("runSimplifyPass — skip conditions", () => {
  it("skips when agent is null", () => {
    const result = runSimplifyPass({
      featureDir: "/feat", gateCmd: "npm test", cwd: "/cwd",
      agent: null, dispatchFn: () => {}, runGateFn: () => {},
    });
    assert.equal(result.skipped, true);
    assert.equal(result.filesReviewed, 0);
  });

  it("skips when gateCmd is falsy", () => {
    const result = runSimplifyPass({
      featureDir: "/feat", gateCmd: "", cwd: "/cwd",
      agent: "claude", dispatchFn: () => {}, runGateFn: () => {},
    });
    assert.equal(result.skipped, true);
  });

  it("skips when merge-base cannot be determined", () => {
    const mockExec = () => { throw new Error("not a git repo"); };
    const result = runSimplifyPass({
      featureDir: "/feat", gateCmd: "npm test", cwd: "/cwd",
      agent: "claude", dispatchFn: () => {}, runGateFn: () => {},
      execFn: mockExec,
    });
    assert.equal(result.skipped, true);
    assert.ok(result.reason);
  });

  it("returns filesReviewed=0 when no code files changed", () => {
    let callIndex = 0;
    const mockExec = (cmd, _opts) => {
      if (cmd.includes("merge-base")) return "basesha\n";
      if (cmd.includes("--name-only")) return "README.md\npackage-lock.json\n";
      return "";
    };
    const result = runSimplifyPass({
      featureDir: "/feat", gateCmd: "npm test", cwd: "/cwd",
      agent: "claude", dispatchFn: () => {}, runGateFn: () => {},
      execFn: mockExec,
    });
    assert.equal(result.skipped, false);
    assert.equal(result.filesReviewed, 0);
    assert.equal(result.filesChanged, 0);
  });
});

describe("runSimplifyPass — agent dispatch and gate re-run", () => {
  it("dispatches agent when code files are changed", () => {
    const dispatches = [];
    let revParseCount = 0;
    const execFn = (cmd, _opts) => {
      if (cmd.includes("merge-base")) return "basesha\n";
      if (cmd.includes("rev-parse HEAD")) return "sha1\n";
      if (cmd.includes("--name-only basesha..HEAD")) return "src/index.mjs\n";
      if (cmd.includes("--name-only HEAD")) return "";
      return "";
    };
    const dispatchFn = (agent, brief, cwd) => {
      dispatches.push({ agent, brief, cwd });
      return { ok: true, output: "done" };
    };
    runSimplifyPass({
      featureDir: "/feat", gateCmd: "npm test", cwd: "/cwd",
      agent: "claude", dispatchFn, runGateFn: () => ({ verdict: "PASS", exitCode: 0 }),
      execFn,
    });
    assert.equal(dispatches.length, 1);
    assert.equal(dispatches[0].agent, "claude");
    assert.ok(dispatches[0].brief.includes("src/index.mjs"), "brief must include the changed file");
  });

  it("does not dispatch agent when dispatchFn is skipped (no code files)", () => {
    const dispatches = [];
    const execFn = (cmd, _opts) => {
      if (cmd.includes("merge-base")) return "basesha\n";
      if (cmd.includes("--name-only basesha..HEAD")) return "README.md\n";
      return "";
    };
    runSimplifyPass({
      featureDir: "/feat", gateCmd: "npm test", cwd: "/cwd",
      agent: "claude", dispatchFn: (a, b, c) => dispatches.push(1) || { ok: true },
      runGateFn: () => ({ verdict: "PASS", exitCode: 0 }),
      execFn,
    });
    assert.equal(dispatches.length, 0);
  });

  it("re-runs gate when agent makes changes (new commits)", () => {
    const gateRuns = [];
    let revParseCallCount = 0;
    const execFn = (cmd, _opts) => {
      if (cmd.includes("merge-base")) return "basesha\n";
      if (cmd.includes("rev-parse HEAD")) {
        revParseCallCount++;
        return revParseCallCount === 1 ? "sha1\n" : "sha2\n"; // different SHA after agent
      }
      if (cmd.includes("--name-only basesha..HEAD")) return "src/index.mjs\n";
      if (cmd.includes("--name-only sha1..HEAD")) return "src/index.mjs\n";
      return "";
    };
    runSimplifyPass({
      featureDir: "/feat", gateCmd: "npm test", cwd: "/cwd",
      agent: "claude",
      dispatchFn: () => ({ ok: true, output: "done" }),
      runGateFn: (cmd, fd, tid, cwd) => { gateRuns.push(cmd); return { verdict: "PASS", exitCode: 0 }; },
      execFn,
    });
    assert.equal(gateRuns.length, 1, "gate must be re-run after simplifications");
    assert.equal(gateRuns[0], "npm test");
  });

  it("does NOT re-run gate when agent makes no changes", () => {
    const gateRuns = [];
    const execFn = (cmd, _opts) => {
      if (cmd.includes("merge-base")) return "basesha\n";
      if (cmd.includes("rev-parse HEAD")) return "sha1\n"; // same SHA before and after
      if (cmd.includes("--name-only basesha..HEAD")) return "src/index.mjs\n";
      if (cmd.includes("--name-only HEAD")) return ""; // no uncommitted changes either
      return "";
    };
    runSimplifyPass({
      featureDir: "/feat", gateCmd: "npm test", cwd: "/cwd",
      agent: "claude",
      dispatchFn: () => ({ ok: true, output: "done" }),
      runGateFn: (cmd) => { gateRuns.push(cmd); return { verdict: "PASS", exitCode: 0 }; },
      execFn,
    });
    assert.equal(gateRuns.length, 0, "gate must NOT run when no changes made");
  });

  it("returns filesChanged > 0 when gate passes", () => {
    let revParseCount = 0;
    const execFn = (cmd, _opts) => {
      if (cmd.includes("merge-base")) return "basesha\n";
      if (cmd.includes("rev-parse HEAD")) {
        revParseCount++;
        return revParseCount === 1 ? "sha1\n" : "sha2\n";
      }
      if (cmd.includes("--name-only basesha..HEAD")) return "src/index.mjs\n";
      if (cmd.includes("--name-only sha1..HEAD")) return "src/index.mjs\n";
      return "";
    };
    const result = runSimplifyPass({
      featureDir: "/feat", gateCmd: "npm test", cwd: "/cwd",
      agent: "claude",
      dispatchFn: () => ({ ok: true, output: "done" }),
      runGateFn: () => ({ verdict: "PASS", exitCode: 0 }),
      execFn,
    });
    assert.ok(result.filesChanged > 0, "filesChanged should be > 0 when gate passes");
    assert.equal(result.reverted, undefined);
    assert.equal(result.skipped, false);
  });

  it("reverts changes and returns reverted=true when gate fails", () => {
    const revertCmds = [];
    let revParseCount = 0;
    const execFn = (cmd, _opts) => {
      if (cmd.includes("merge-base")) return "basesha\n";
      if (cmd.includes("rev-parse HEAD")) {
        revParseCount++;
        return revParseCount === 1 ? "sha1\n" : "sha2\n";
      }
      if (cmd.includes("--name-only basesha..HEAD")) return "src/index.mjs\n";
      if (cmd.includes("--name-only sha1..HEAD")) return "src/index.mjs\n";
      if (cmd.includes("reset --hard")) { revertCmds.push(cmd); return ""; }
      return "";
    };
    const result = runSimplifyPass({
      featureDir: "/feat", gateCmd: "npm test", cwd: "/cwd",
      agent: "claude",
      dispatchFn: () => ({ ok: true, output: "done" }),
      runGateFn: () => ({ verdict: "FAIL", exitCode: 1 }),
      execFn,
    });
    assert.equal(result.reverted, true);
    assert.equal(result.filesChanged, 0);
    assert.equal(revertCmds.length, 1, "should run git reset --hard");
    assert.ok(revertCmds[0].includes("sha1"), "revert target must be pre-simplification SHA");
  });

  it("reverts uncommitted changes with checkout when SHA unchanged but files modified", () => {
    const revertCmds = [];
    const execFn = (cmd, _opts) => {
      if (cmd.includes("merge-base")) return "basesha\n";
      if (cmd.includes("rev-parse HEAD")) return "sha1\n"; // same SHA (no new commits)
      if (cmd.includes("--name-only basesha..HEAD")) return "src/index.mjs\n";
      if (cmd.includes("--name-only HEAD") && !cmd.includes("..")) return "src/index.mjs\n"; // uncommitted change
      if (cmd.includes("checkout HEAD")) { revertCmds.push(cmd); return ""; }
      return "";
    };
    const result = runSimplifyPass({
      featureDir: "/feat", gateCmd: "npm test", cwd: "/cwd",
      agent: "claude",
      dispatchFn: () => ({ ok: true, output: "done" }),
      runGateFn: () => ({ verdict: "FAIL", exitCode: 1 }),
      execFn,
    });
    assert.equal(result.reverted, true);
    assert.ok(revertCmds.some(c => c.includes("checkout HEAD")), "should use git checkout HEAD -- . for uncommitted changes");
  });

  it("returns skipped=false and filesChanged=0 when dispatch fails", () => {
    const execFn = (cmd, _opts) => {
      if (cmd.includes("merge-base")) return "basesha\n";
      if (cmd.includes("rev-parse HEAD")) return "sha1\n";
      if (cmd.includes("--name-only basesha..HEAD")) return "src/index.mjs\n";
      return "";
    };
    const result = runSimplifyPass({
      featureDir: "/feat", gateCmd: "npm test", cwd: "/cwd",
      agent: "claude",
      dispatchFn: () => ({ ok: false, error: "agent not found" }),
      runGateFn: () => { throw new Error("should not call gate"); },
      execFn,
    });
    assert.equal(result.skipped, false);
    assert.equal(result.filesChanged, 0);
  });

  it("reverts changes and returns reverted=true when gate throws", () => {
    const revertCmds = [];
    let revParseCount = 0;
    const execFn = (cmd, _opts) => {
      if (cmd.includes("merge-base")) return "basesha\n";
      if (cmd.includes("rev-parse HEAD")) {
        revParseCount++;
        return revParseCount === 1 ? "sha1\n" : "sha2\n";
      }
      if (cmd.includes("--name-only basesha..HEAD")) return "src/index.mjs\n";
      if (cmd.includes("--name-only sha1..HEAD")) return "src/index.mjs\n";
      if (cmd.includes("reset --hard")) { revertCmds.push(cmd); return ""; }
      return "";
    };
    const result = runSimplifyPass({
      featureDir: "/feat", gateCmd: "npm test", cwd: "/cwd",
      agent: "claude",
      dispatchFn: () => ({ ok: true, output: "done" }),
      runGateFn: () => { throw new Error("gate crashed"); },
      execFn,
    });
    assert.equal(result.reverted, true);
    assert.equal(result.filesChanged, 0);
    assert.equal(revertCmds.length, 1, "should run git reset --hard on gate exception");
  });
});

// ── Source assertion: run.mjs imports and calls runSimplifyPass ──

describe("run.mjs integration", () => {
  const src = readFileSync(new URL("../bin/lib/run.mjs", import.meta.url), "utf8");

  it("imports runSimplifyPass from simplify-pass.mjs", () => {
    assert.ok(
      /import.*runSimplifyPass.*from.*simplify-pass\.mjs/.test(src),
      "run.mjs must import runSimplifyPass from simplify-pass.mjs"
    );
  });

  it("calls runSimplifyPass before harness finalize", () => {
    const simplifyIdx = src.indexOf("runSimplifyPass(");
    const finalizeIdx = src.indexOf('harness("finalize"');
    assert.ok(simplifyIdx !== -1, "run.mjs must call runSimplifyPass");
    assert.ok(finalizeIdx !== -1, 'run.mjs must call harness("finalize"');
    assert.ok(simplifyIdx < finalizeIdx, "runSimplifyPass must be called before harness finalize");
  });

  it("passes gateCmd and cwd to runSimplifyPass", () => {
    assert.ok(
      /runSimplifyPass\(\s*\{[\s\S]*?gateCmd[\s\S]*?\}\s*\)/.test(src),
      "runSimplifyPass call must pass gateCmd"
    );
    assert.ok(
      /runSimplifyPass\(\s*\{[\s\S]*?cwd[\s\S]*?\}\s*\)/.test(src),
      "runSimplifyPass call must pass cwd"
    );
  });

  it("only runs simplify pass when completed > 0", () => {
    // Verify guard: if (completed > 0) wraps the simplify pass call
    const simplifyBlock = src.slice(src.indexOf("runSimplifyPass(") - 200, src.indexOf("runSimplifyPass("));
    assert.ok(
      /completed\s*>\s*0/.test(simplifyBlock),
      "runSimplifyPass must be guarded by completed > 0"
    );
  });
});
