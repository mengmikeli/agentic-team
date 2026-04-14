// at-harness gate — run quality checks, write verdict to STATE.json
// Execute a shell command, capture exit code + output, write tamper-detected verdict.

import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import {
  getFlag, resolveDir, lockFile,
  readState, writeState, WRITER_SIG,
} from "./util.mjs";

export function cmdGate(args) {
  const cmd = getFlag(args, "cmd");
  const dir = resolveDir(args, getFlag(args, "dir", "."));
  const taskId = getFlag(args, "task");

  if (!cmd) {
    console.error("Usage: at-harness gate --cmd <command> --dir <path> [--task <id>]");
    process.exit(1);
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
      const gateResult = {
        command: cmd,
        exitCode,
        verdict,
        stdout: stdout.slice(0, 4096), // cap output size
        stderr: stderr.slice(0, 4096),
        timestamp: new Date().toISOString(),
        taskId: taskId || null,
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
      }));
    } finally {
      lock.release();
    }
  }
}
