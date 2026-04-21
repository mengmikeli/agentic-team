// agt notify — route progress events to configured channels
// Channels: stdout (default), file:{path}, discord:{webhook-url}
// Config read from .team/PROJECT.md under ## Notifications

import { existsSync, readFileSync, appendFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { getFlag, VALID_EVENTS } from "./util.mjs";

// ── Parse notification config from PROJECT.md ───────────────────

export function parseNotifyConfig(cwd) {
  const projectPath = join(cwd, ".team", "PROJECT.md");
  if (!existsSync(projectPath)) return ["stdout"];

  try {
    const content = readFileSync(projectPath, "utf8");
    const section = content.match(/## Notifications\n([\s\S]*?)(?=\n##|$)/);
    if (!section) return ["stdout"];

    const channels = [];
    const lines = section[1].split("\n");
    for (const line of lines) {
      const trimmed = line.replace(/^[-*]\s*/, "").trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      if (trimmed === "stdout") {
        channels.push("stdout");
      } else if (trimmed.startsWith("file:")) {
        channels.push(trimmed);
      } else if (trimmed.startsWith("discord:")) {
        channels.push(trimmed);
      }
    }
    return channels.length > 0 ? channels : ["stdout"];
  } catch {
    return ["stdout"];
  }
}

// ── Channel senders ─────────────────────────────────────────────

function sendToStdout(event, msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${event}: ${msg}`);
}

function sendToFile(filePath, event, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${event}: ${msg}\n`;
  mkdirSync(dirname(filePath), { recursive: true });
  appendFileSync(filePath, line);
}

function sendToDiscord(webhookUrl, event, msg) {
  try {
    const payload = JSON.stringify({ content: `**${event}**: ${msg}` });
    execSync(
      `curl -s -X POST -H "Content-Type: application/json" -d ${JSON.stringify(payload)} ${JSON.stringify(webhookUrl)}`,
      { timeout: 10000, stdio: "pipe" }
    );
  } catch { /* best-effort */ }
}

// ── Main notify function ────────────────────────────────────────

export function notify(channels, event, msg) {
  if (!VALID_EVENTS.has(event)) return;

  for (const channel of channels) {
    if (channel === "stdout") {
      sendToStdout(event, msg);
    } else if (channel.startsWith("file:")) {
      const filePath = channel.slice(5);
      sendToFile(filePath, event, msg);
    } else if (channel.startsWith("discord:")) {
      const webhookUrl = channel.slice(8);
      sendToDiscord(webhookUrl, event, msg);
    }
  }
}

// ── Write to shared notify stream for SSE dashboard ─────────────

export function writeNotifyStream(cwd, event, msg) {
  const streamPath = join(cwd, ".team", ".notify-stream");
  const ts = new Date().toISOString();
  const line = JSON.stringify({ ts, event, msg }) + "\n";
  try {
    mkdirSync(dirname(streamPath), { recursive: true });
    appendFileSync(streamPath, line);
  } catch { /* best-effort */ }
}

// ── Legacy harness-compatible interface ─────────────────────────

export function cmdNotify(args) {
  const event = getFlag(args, "event");
  const msg = getFlag(args, "msg");

  if (!event || !msg) {
    console.error("Usage: notify --event <type> --msg <message>");
    process.exit(1);
  }

  if (!VALID_EVENTS.has(event)) {
    console.log(JSON.stringify({
      ok: false,
      error: `invalid event: '${event}' (valid: ${[...VALID_EVENTS].join(", ")})`,
    }));
    return;
  }

  const channels = parseNotifyConfig(process.cwd());
  notify(channels, event, msg);
  writeNotifyStream(process.cwd(), event, msg);
  console.log(JSON.stringify({ ok: true, event, channels }));
}
