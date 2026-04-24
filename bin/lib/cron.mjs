// cron.mjs — agt cron-tick and agt cron-setup commands
// cron-tick: query project board, dispatch first Ready issue to runSingleFeature
// cron-setup: print a crontab entry for scheduling cron-tick

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { lockFile, getFlag } from "./util.mjs";
import {
  readTrackingConfig,
  listProjectItems,
  setProjectItemStatus,
  commentIssue,
} from "./github.mjs";
import { runSingleFeature } from "./run.mjs";

/**
 * Read the GitHub project number from .team/PROJECT.md.
 * Returns a number or null.
 */
function readProjectNumber(cwd) {
  const teamDir = join(cwd, ".team");
  const projectMdPath = join(teamDir, "PROJECT.md");
  if (!existsSync(projectMdPath)) return null;
  try {
    const text = readFileSync(projectMdPath, "utf8");
    const match = text.match(/\/projects\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

/**
 * agt cron-tick
 *
 * Queries the GitHub Project board for the first "Ready" issue and dispatches it
 * to runSingleFeature. Uses an advisory lock to prevent concurrent runs.
 *
 * @param {string[]} args - CLI args (unused for now)
 * @param {object} deps   - Injectable dependencies for testing
 */
export async function cmdCronTick(args = [], deps = {}) {
  const cwd = process.cwd();
  const teamDir = join(cwd, ".team");

  const {
    listProjectItems: _listProjectItems = listProjectItems,
    runSingleFeature: _runSingleFeature = runSingleFeature,
    setProjectItemStatus: _setProjectItemStatus = setProjectItemStatus,
    commentIssue: _commentIssue = commentIssue,
    readTrackingConfig: _readTrackingConfig = readTrackingConfig,
    lockFile: _lockFile = lockFile,
    readProjectNumber: _readProjectNumber = readProjectNumber,
  } = deps;

  // Read tracking config — required for project board access
  const tracking = _readTrackingConfig();
  if (!tracking) {
    console.log("cron-tick: not configured (no PROJECT.md tracking section with required field IDs)");
    process.exit(1);
  }

  // Read project number from PROJECT.md
  const projectNumber = _readProjectNumber(cwd);
  if (!projectNumber) {
    console.log("cron-tick: project number not found in .team/PROJECT.md");
    process.exit(1);
  }

  // Acquire lock (timeout: 0 = try once, don't wait)
  const lockPath = join(teamDir, ".cron-lock");
  const lock = _lockFile(lockPath, { timeout: 0, command: "cron-tick" });
  if (!lock.acquired) {
    console.log("cron-tick: tick already running (lock held by another process)");
    process.exit(0);
    return; // for testability — process.exit may be mocked
  }

  try {
    // Query board for all items
    const items = _listProjectItems(projectNumber);

    // Filter for Ready items (case-insensitive status match)
    const readyItems = items.filter(i => i.status?.toLowerCase() === "ready");

    if (readyItems.length === 0) {
      console.log("cron-tick: no ready items on project board");
      return;
    }

    // Take the first ready item
    const item = readyItems[0];
    const { issueNumber, title } = item;

    console.log(`cron-tick: dispatching issue #${issueNumber} — ${title}`);

    // Transition board item to in-progress before running
    _setProjectItemStatus(issueNumber, projectNumber, "in-progress");

    try {
      await _runSingleFeature([], title);
      // Transition to done on success
      _setProjectItemStatus(issueNumber, projectNumber, "done");
      console.log(`cron-tick: completed issue #${issueNumber}`);
    } catch (err) {
      // Revert to ready and comment on failure
      _setProjectItemStatus(issueNumber, projectNumber, "ready");
      _commentIssue(issueNumber, `cron-tick failed: ${err.message || String(err)}`);
      console.error(`cron-tick: failed for issue #${issueNumber}: ${err.message || err}`);
    }
  } finally {
    if (lock.acquired && lock.release) {
      lock.release();
    }
  }
}

/**
 * agt cron-setup
 *
 * Prints a crontab entry for scheduling cron-tick at a given interval.
 *
 * @param {string[]} args - CLI args; supports --interval <n> (default: 30)
 */
export function cmdCronSetup(args = []) {
  const interval = parseInt(getFlag(args, "interval", "30"), 10) || 30;
  const cwd = process.cwd();
  const agtPath = process.argv[1];

  const cronLine = `*/${interval} * * * * cd ${cwd} && PATH=${process.env.PATH} ${agtPath} cron-tick >> ${cwd}/.team/cron.log 2>&1`;

  console.log("Add this line to your crontab (run: crontab -e):\n");
  console.log(cronLine);
  console.log();
  console.log(`This will run 'agt cron-tick' every ${interval} minutes and log output to .team/cron.log`);
}
