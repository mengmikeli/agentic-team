// Handshake protocol — the contract between steps.
// Builder writes handshake.json, harness validates it, reviewer reads it.
//
// Schema:
//   taskId, nodeType, runId, status, verdict, summary, timestamp, artifacts, findings
//
// Validation rules:
//   - Required fields: taskId, nodeType, status, summary, timestamp, artifacts
//   - nodeType=build → at least one code artifact
//   - nodeType=gate → at least one test-result or cli-output artifact
//   - nodeType=review → at least one evaluation artifact
//   - findings.critical > 0 → verdict cannot be PASS
//   - All artifact paths must point to existing files (when basePath given)

import { existsSync } from "fs";
import { join, isAbsolute } from "path";

// ── Schema constants ────────────────────────────────────────────

const VALID_NODE_TYPES = new Set(["build", "review", "gate"]);
const VALID_STATUSES = new Set(["completed", "failed", "blocked"]);
const VALID_VERDICTS = new Set(["PASS", "FAIL", "ITERATE", null, undefined]);
const VALID_ARTIFACT_TYPES = new Set([
  "code", "test-result", "cli-output", "evaluation", "screenshot",
]);

const REQUIRED_FIELDS = ["taskId", "nodeType", "status", "summary", "timestamp", "artifacts"];

// Artifact type requirements per nodeType
const NODE_ARTIFACT_REQUIREMENTS = {
  build:  { types: ["code"], label: "code" },
  gate:   { types: ["test-result", "cli-output"], label: "test-result or cli-output" },
  review: { types: ["evaluation"], label: "evaluation" },
};

// ── Validation ──────────────────────────────────────────────────

/**
 * Validate a handshake object against the schema.
 * @param {object} handshake - The handshake object to validate
 * @param {object} [opts] - Options
 * @param {string} [opts.basePath] - Base path for resolving artifact paths (skip file-existence check if null)
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateHandshake(handshake, opts = {}) {
  const errors = [];
  const { basePath } = opts;

  if (!handshake || typeof handshake !== "object") {
    return { valid: false, errors: ["handshake must be a non-null object"] };
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (handshake[field] === undefined || handshake[field] === null) {
      errors.push(`missing required field: ${field}`);
    }
  }

  // If missing critical fields, return early — can't validate further
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate nodeType
  if (!VALID_NODE_TYPES.has(handshake.nodeType)) {
    errors.push(`invalid nodeType: '${handshake.nodeType}' (valid: ${[...VALID_NODE_TYPES].join(", ")})`);
  }

  // Validate status
  if (!VALID_STATUSES.has(handshake.status)) {
    errors.push(`invalid status: '${handshake.status}' (valid: ${[...VALID_STATUSES].join(", ")})`);
  }

  // Validate verdict
  if (handshake.verdict !== undefined && handshake.verdict !== null && !VALID_VERDICTS.has(handshake.verdict)) {
    errors.push(`invalid verdict: '${handshake.verdict}' (valid: PASS, FAIL, ITERATE, or null)`);
  }

  // Validate summary is non-empty string
  if (typeof handshake.summary !== "string" || handshake.summary.trim().length === 0) {
    errors.push("summary must be a non-empty string");
  }

  // Validate timestamp is ISO 8601
  if (typeof handshake.timestamp !== "string" || isNaN(Date.parse(handshake.timestamp))) {
    errors.push("timestamp must be a valid ISO 8601 string");
  }

  // Validate artifacts is an array
  if (!Array.isArray(handshake.artifacts)) {
    errors.push("artifacts must be an array");
    return { valid: false, errors };
  }

  // Validate each artifact
  for (let i = 0; i < handshake.artifacts.length; i++) {
    const art = handshake.artifacts[i];
    if (!art || typeof art !== "object") {
      errors.push(`artifacts[${i}]: must be an object`);
      continue;
    }
    if (!art.type || !VALID_ARTIFACT_TYPES.has(art.type)) {
      errors.push(`artifacts[${i}]: invalid type '${art.type}' (valid: ${[...VALID_ARTIFACT_TYPES].join(", ")})`);
    }
    if (!art.path || typeof art.path !== "string") {
      errors.push(`artifacts[${i}]: missing or invalid path`);
    }

    // Check file existence if basePath provided
    if (basePath && art.path) {
      const fullPath = isAbsolute(art.path) ? art.path : join(basePath, art.path);
      if (!existsSync(fullPath)) {
        errors.push(`artifacts[${i}]: file not found: ${art.path}`);
      }
    }
  }

  // NodeType-specific artifact requirements
  if (VALID_NODE_TYPES.has(handshake.nodeType)) {
    const req = NODE_ARTIFACT_REQUIREMENTS[handshake.nodeType];
    if (req) {
      const hasRequired = handshake.artifacts.some(a => req.types.includes(a.type));
      if (!hasRequired) {
        errors.push(`nodeType '${handshake.nodeType}' requires at least one ${req.label} artifact`);
      }
    }
  }

  // Findings/verdict consistency
  if (handshake.findings && typeof handshake.findings === "object") {
    const critical = handshake.findings.critical || 0;
    if (critical > 0 && handshake.verdict === "PASS") {
      errors.push("verdict cannot be PASS when findings.critical > 0");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create a handshake object with defaults filled in.
 * @param {object} fields - Partial handshake fields
 * @returns {object} Complete handshake object
 */
export function createHandshake(fields) {
  return {
    taskId: fields.taskId || "unknown",
    nodeType: fields.nodeType || "build",
    runId: fields.runId || "run_1",
    status: fields.status || "completed",
    verdict: fields.verdict ?? null,
    summary: fields.summary || "",
    timestamp: fields.timestamp || new Date().toISOString(),
    artifacts: fields.artifacts || [],
    findings: fields.findings || { critical: 0, warning: 0, suggestion: 0 },
  };
}

// ── CLI command for agt-harness validate ─────────────────────────

import { readFileSync } from "fs";
import { getFlag } from "./util.mjs";

export function cmdValidate(args) {
  const file = getFlag(args, "file");

  if (!file) {
    console.error("Usage: agt-harness validate --file <handshake.json>");
    process.exit(1);
  }

  let handshake;
  try {
    const raw = readFileSync(file, "utf8");
    handshake = JSON.parse(raw);
  } catch (err) {
    console.log(JSON.stringify({ ok: false, valid: false, error: `Cannot read file: ${err.message}` }));
    return;
  }

  // Use the file's directory as basePath for artifact resolution
  const basePath = getFlag(args, "base") || join(file, "..");
  const result = validateHandshake(handshake, { basePath });

  console.log(JSON.stringify({
    ok: true,
    valid: result.valid,
    errors: result.errors,
    nodeType: handshake.nodeType,
    status: handshake.status,
    verdict: handshake.verdict || null,
  }));
}
