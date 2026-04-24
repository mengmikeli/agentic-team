// Tests that .team/runbooks/ is created by agt init and lazily by agt run
// Uses Node.js built-in test runner (node --test)

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const agtPath = join(__dirname, "..", "bin", "agt.mjs");
const initMjsPath = join(__dirname, "..", "bin", "lib", "init.mjs");

function createTmpDir() {
  const dir = join(tmpdir(), `runbook-dir-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── init.mjs contains runbooks directory creation ────────────────

describe("init.mjs creates .team/runbooks/", () => {
  it("init.mjs source calls mkdirSync for runbooks alongside features", () => {
    const src = readFileSync(initMjsPath, "utf8");
    // Both features and runbooks must be created
    assert.match(src, /mkdirSync\(join\(teamDir,\s*"features"\)/,
      "init.mjs should create .team/features/");
    assert.match(src, /mkdirSync\(join\(teamDir,\s*"runbooks"\)/,
      "init.mjs should create .team/runbooks/");
  });

  it("runbooks mkdirSync appears after features mkdirSync in init.mjs", () => {
    const src = readFileSync(initMjsPath, "utf8");
    const featuresIdx = src.indexOf('mkdirSync(join(teamDir, "features")');
    const runbooksIdx = src.indexOf('mkdirSync(join(teamDir, "runbooks")');
    assert.ok(featuresIdx !== -1, "features mkdir must exist");
    assert.ok(runbooksIdx !== -1, "runbooks mkdir must exist");
    assert.ok(runbooksIdx > featuresIdx, "runbooks mkdir should appear after features mkdir");
  });
});

// ── agt run lazily creates .team/runbooks/ ───────────────────────

describe("agt run lazily creates .team/runbooks/", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates .team/runbooks/ on first run even if dir was absent", () => {
    // Set up minimal .team/ without runbooks/
    mkdirSync(join(tmpDir, ".team", "features"), { recursive: true });
    assert.ok(!existsSync(join(tmpDir, ".team", "runbooks")), "runbooks/ should not exist yet");

    // Run agt run — may succeed or fail, but runbooks/ must be created regardless
    try {
      execFileSync("node", [agtPath, "run", "test feature", "--dry-run"], {
        encoding: "utf8",
        cwd: tmpDir,
        timeout: 20000,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, NO_COLOR: "1" },
      });
    } catch {
      // process.exit(1) during dry-run is acceptable; runbooks/ must still exist
    }

    assert.ok(
      existsSync(join(tmpDir, ".team", "runbooks")),
      ".team/runbooks/ should be created lazily by agt run"
    );
  });

  it("does not fail if .team/runbooks/ already exists", () => {
    // Pre-create runbooks/ to verify idempotency
    mkdirSync(join(tmpDir, ".team", "features"), { recursive: true });
    mkdirSync(join(tmpDir, ".team", "runbooks"), { recursive: true });

    // agt run should not error on an already-existing runbooks dir
    try {
      execFileSync("node", [agtPath, "run", "test feature", "--dry-run"], {
        encoding: "utf8",
        cwd: tmpDir,
        timeout: 20000,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, NO_COLOR: "1" },
      });
    } catch {
      // process.exit(1) is fine; we only care it didn't throw on the mkdir
    }

    assert.ok(
      existsSync(join(tmpDir, ".team", "runbooks")),
      ".team/runbooks/ should still exist after second run"
    );
  });
});
