// agt daemon — durable background execution
// agt run --daemon: fork to background, write PID
// agt stop: kill background process
// agt status: check if daemon is alive

import { spawn } from "child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync, openSync } from "fs";
import { join, resolve } from "path";
import { c } from "./util.mjs";

const PID_FILE = ".agt-daemon.pid";
const LOG_FILE = ".agt-daemon.log";

function pidPath(cwd) {
  return join(cwd, ".team", PID_FILE);
}

function logPath(cwd) {
  return join(cwd, ".team", LOG_FILE);
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid(cwd) {
  const p = pidPath(cwd);
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, "utf8"));
    return data;
  } catch {
    return null;
  }
}

function cleanupPid(cwd) {
  const p = pidPath(cwd);
  try {
    if (existsSync(p)) unlinkSync(p);
  } catch { /* best-effort */ }
}

// ── Start daemon ────────────────────────────────────────────────

export function daemonStart(args, cwd) {
  const pidData = readPid(cwd);

  if (pidData && isPidAlive(pidData.pid)) {
    console.log(`${c.yellow}Daemon already running (PID ${pidData.pid}).${c.reset}`);
    console.log(`${c.dim}Started: ${pidData.startedAt}${c.reset}`);
    process.exit(0);
  }

  // Clean up stale PID file
  if (pidData) {
    cleanupPid(cwd);
  }

  // Build the command args for the child — same as current invocation minus --daemon
  const childArgs = args.filter(a => a !== "--daemon");

  // Open log file for stdout/stderr
  const logFd = openSync(logPath(cwd), "a");

  // Fork the process
  const atPath = resolve(new URL(".", import.meta.url).pathname, "..", "at.mjs");

  const child = spawn(process.execPath, [atPath, "run", ...childArgs], {
    cwd,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env },
  });

  child.unref();

  // Write PID file
  const pidInfo = {
    pid: child.pid,
    startedAt: new Date().toISOString(),
    args: childArgs,
  };
  writeFileSync(pidPath(cwd), JSON.stringify(pidInfo, null, 2) + "\n");

  console.log(`${c.green}✓${c.reset} Daemon started (PID ${child.pid})`);
  console.log(`${c.dim}Log: ${logPath(cwd)}${c.reset}`);
}

// ── Stop daemon ─────────────────────────────────────────────────

export function daemonStop(cwd) {
  const pidData = readPid(cwd);

  if (!pidData) {
    console.log(`${c.dim}No daemon running.${c.reset}`);
    return false;
  }

  if (!isPidAlive(pidData.pid)) {
    console.log(`${c.dim}Daemon not running (stale PID ${pidData.pid}). Cleaning up.${c.reset}`);
    cleanupPid(cwd);
    return false;
  }

  try {
    process.kill(pidData.pid, "SIGTERM");
    console.log(`${c.green}✓${c.reset} Daemon stopped (PID ${pidData.pid})`);
  } catch (err) {
    console.log(`${c.red}Failed to stop daemon:${c.reset} ${err.message}`);
  }

  cleanupPid(cwd);
  return true;
}

// ── Daemon status ───────────────────────────────────────────────

export function daemonStatus(cwd) {
  const pidData = readPid(cwd);

  if (!pidData) {
    return { running: false, message: "No daemon PID file found" };
  }

  const alive = isPidAlive(pidData.pid);

  if (!alive) {
    cleanupPid(cwd);
    return { running: false, message: `Daemon not running (stale PID ${pidData.pid}, cleaned up)` };
  }

  return {
    running: true,
    pid: pidData.pid,
    startedAt: pidData.startedAt,
    args: pidData.args,
    message: `Daemon running (PID ${pidData.pid}, started ${pidData.startedAt})`,
  };
}
