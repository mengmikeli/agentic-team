// at-harness gate — run quality checks, write verdict to STATE.json
// Execute a shell command, capture exit code + output, write tamper-detected verdict.
// Now also writes evidence artifacts and gate handshake.json to task artifact dirs.

import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  getFlag, resolveDir, lockFile,
  readState, writeState, WRITER_SIG,
} from "./util.mjs";
import { extractWarnings, findNewWarnings, documentWarnings } from "./backlog.mjs";
import { createHandshake } from "./handshake.mjs";

export function cmdGate(args) {
  const cmd = getFlag(args, "cmd");
  const dir = resolveDir(args, getFlag(args, "dir", "."));
  const taskId = getFlag(args, "task");

  if (!cmd) {
    console.error("Usage: at-harness gate --cmd <command> --dir <path> [--task <id>]");
    process.exit(1);
  }

  // Reject placeholder/fabricated gate commands that are not real quality gates.
  // Builder agents sometimes substitute "echo gate-recorded" instead of running actual tests.
  const PLACEHOLDER_GATE_RE = /^\s*echo\s+(["']?)gate-recorded\1\s*$/i;
  if (PLACEHOLDER_GATE_RE.test(cmd)) {
    console.log(JSON.stringify({
      ok: false,
      verdict: "FAIL",
      exitCode: 1,
      error: "Placeholder gate command rejected: 'echo gate-recorded' is not a valid quality gate. Run 'npm test' or the project's configured test command.",
    }));
    process.exit(1);
    return;
  }

  // Find STATE.json
  const state = readState(dir);
  if (!state) {
    console.log(JSON.stringify({ ok: false, error: "STATE.json not found in " + dir }));
    return;
  }

  if (state._written_by !== WRITER_SIG) {
    console.log(JSON.stringify({ ok: false, error: "STATE.json not written by at-harness — tamper detected" }));
    return;
  }

  // Acquire lock
  const statePath = join(dir, "STATE.json");
  const lock = lockFile(statePath, { command: "gate" });
  if (!lock.acquired) {
    console.log(JSON.stringify({ ok: false, error: "could not acquire lock", holder: lock.holder }));
    return;
  }

  let exitCode = 0;
  let stdout = "";
  let stderr = "";

  try {
    const result = execSync(cmd, {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 120000, // 2 min max
      shell: true, // required for Windows (npm, npx, etc. need shell)
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, AT_FEATURE: state.feature || "", AT_TASK: taskId || "" },
    });
    stdout = result;
  } catch (err) {
    // err.status is null/undefined on timeout or signal kill
    if (err.signal) {
      exitCode = 1;
      stderr = `Process killed by signal: ${err.signal}`;
    } else if (err.status != null) {
      exitCode = err.status;
    } else {
      exitCode = 1;
      stderr = err.message || "Unknown error";
    }
    stdout = err.stdout || "";
    stderr = stderr || err.stderr || "";
  } finally {
    // Write verdict to STATE.json
    try {
      const freshState = readState(dir);
      if (!freshState) {
        console.log(JSON.stringify({ ok: false, error: "STATE.json disappeared" }));
        return;
      }

      const verdict = exitCode === 0 ? "PASS" : "FAIL";

      // Backlog enforcement: extract warnings and document any new ones.
      const allWarnings = extractWarnings(stdout + "\n" + stderr);
      const newWarnings = findNewWarnings(allWarnings, dir);
      if (newWarnings.length > 0) {
        documentWarnings(dir, newWarnings, "gate");
      }

      // ── Write evidence artifacts to task directory ──
      if (taskId) {
        const artifactsDir = join(dir, "tasks", taskId, "artifacts");
        mkdirSync(artifactsDir, { recursive: true });

        // Capture stdout as test-output.txt
        if (stdout) {
          writeFileSync(join(artifactsDir, "test-output.txt"), stdout);
        }

        // Capture stderr as gate-stderr.txt
        if (stderr) {
          writeFileSync(join(artifactsDir, "gate-stderr.txt"), stderr);
        }

        // Write gate's own handshake.json
        const artifacts = [];
        if (stdout) artifacts.push({ type: "test-result", path: "artifacts/test-output.txt" });
        if (stderr) artifacts.push({ type: "cli-output", path: "artifacts/gate-stderr.txt" });
        // At minimum, always include a cli-output artifact
        if (artifacts.length === 0) {
          writeFileSync(join(artifactsDir, "gate-result.txt"), `exit code: ${exitCode}\n`);
          artifacts.push({ type: "cli-output", path: "artifacts/gate-result.txt" });
        }

        const gateHandshake = createHandshake({
          taskId,
          nodeType: "gate",
          runId: `run_${(freshState.gates || []).length + 1}`,
          status: exitCode === 0 ? "completed" : "failed",
          verdict,
          summary: `Gate command: ${cmd} — exit code ${exitCode}`,
          artifacts,
          findings: { critical: exitCode === 0 ? 0 : 1, warning: newWarnings.length, suggestion: 0 },
        });

        const taskDir = join(dir, "tasks", taskId);
        writeFileSync(join(taskDir, "handshake.json"), JSON.stringify(gateHandshake, null, 2) + "\n");
      }

      const gateResult = {
        command: cmd,
        exitCode,
        verdict,
        stdout: stdout.slice(0, 4096), // cap output size
        stderr: stderr.slice(0, 4096),
        timestamp: new Date().toISOString(),
        taskId: taskId || null,
        warnings: allWarnings.length,
        newWarnings: newWarnings.length,
      };

      if (!freshState.gates) freshState.gates = [];
      freshState.gates.push(gateResult);

      // If task specified, update task status
      if (taskId && freshState.tasks) {
        const task = freshState.tasks.find(t => t.id === taskId);
        if (task) {
          task.lastGate = gateResult;
          if (verdict === "PASS" && task.status === "in-progress") {
            task.status = "passed";
          }
        }
      }

      writeState(dir, freshState);

      console.log(JSON.stringify({
        ok: true,
        verdict,
        exitCode,
        command: cmd,
        taskId: taskId || null,
        stdout: stdout.slice(0, 1024),
        stderr: stderr.slice(0, 1024),
        warnings: allWarnings.length,
        newWarnings: newWarnings.length,
      }));
    } finally {
      lock.release();
    }
  }
}
