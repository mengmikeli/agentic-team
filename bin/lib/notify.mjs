// at-harness notify — dispatch progress events
// Events: feature-started, task-started, task-passed, task-blocked, progress, anomaly, feature-complete
// Channels: stdout (default), file

import { existsSync, appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { getFlag, VALID_EVENTS } from "./util.mjs";

export function cmdNotify(args) {
  const event = getFlag(args, "event");
  const msg = getFlag(args, "msg");
  const channel = getFlag(args, "channel", "stdout");
  const dir = getFlag(args, "dir", ".");

  if (!event || !msg) {
    console.error("Usage: at-harness notify --event <type> --msg <message> [--channel <target>] [--dir <path>]");
    process.exit(1);
  }

  if (!VALID_EVENTS.has(event)) {
    console.log(JSON.stringify({
      ok: false,
      error: `invalid event: '${event}' (valid: ${[...VALID_EVENTS].join(", ")})`,
    }));
    return;
  }

  const notification = {
    event,
    message: msg,
    timestamp: new Date().toISOString(),
    channel,
  };

  switch (channel) {
    case "stdout":
      console.log(JSON.stringify({ ok: true, notification }));
      break;

    case "file": {
      const logPath = join(dir, "notifications.jsonl");
      mkdirSync(dirname(logPath), { recursive: true });
      appendFileSync(logPath, JSON.stringify(notification) + "\n");
      console.log(JSON.stringify({ ok: true, written: logPath }));
      break;
    }

    default:
      // For discord/other channels, output JSON for the caller to route
      console.log(JSON.stringify({
        ok: true,
        notification,
        note: `channel '${channel}' — caller should route this via appropriate API`,
      }));
      break;
  }
}
