// agt-harness synthesize — parse structured review output, compute verdict mechanically
// Usage (via agt-harness):
//   agt-harness synthesize [--input <file>]        — parse and compute verdict
//   agt-harness synthesize verify [--input <file>] — validate review format only
//
// Structured review format (each finding on its own line):
//   🔴 file:line — fix suggestion   (critical — any red = FAIL)
//   🟡 file:line — fix suggestion   (warning  — PASS but goes to backlog)
//   🔵 file:line — fix suggestion   (suggestion — PASS, no backlog)

import { readFileSync, appendFileSync } from "fs";
import { runCompoundGate } from "./compound-gate.mjs";

/**
 * Parse review text for severity-tagged findings.
 * A finding is any line containing 🔴, 🟡, or 🔵.
 */
export function parseFindings(text) {
  const findings = [];
  for (const line of (text || "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("🔴")) {
      findings.push({ severity: "critical", text: trimmed });
    } else if (trimmed.includes("🟡")) {
      findings.push({ severity: "warning", text: trimmed });
    } else if (trimmed.includes("🔵")) {
      findings.push({ severity: "suggestion", text: trimmed });
    }
  }
  return findings;
}

/**
 * Compute verdict from parsed findings.
 * - Any critical (🔴) → FAIL
 * - Only warnings (🟡) → PASS, backlog=true
 * - No findings or only suggestions (🔵) → PASS, backlog=false
 */
export function computeVerdict(findings) {
  const critical   = findings.filter(f => f.severity === "critical").length;
  const warning    = findings.filter(f => f.severity === "warning").length;
  const suggestion = findings.filter(f => f.severity === "suggestion").length;

  const verdict = critical > 0 ? "FAIL" : "PASS";
  const backlog = critical === 0 && warning > 0;

  return { verdict, backlog, critical, warning, suggestion };
}

/** Tag applied by mergeReviewFindings to a 🔴 finding from the simplicity role. */
export const SIMPLICITY_VETO_TAG = "[simplicity veto]";

/**
 * Returns true if any finding text contains the `[simplicity veto]` tag.
 * Pure function — no I/O, no side effects.
 * @param {Array<{text: string}>} findings
 * @returns {boolean}
 */
export function hasSimplicityVeto(findings) {
  if (!Array.isArray(findings)) return false;
  return findings.some(f => typeof f?.text === "string" && f.text.includes(SIMPLICITY_VETO_TAG));
}

/**
 * Validate that review text has proper structured format.
 * Each finding must have: severity emoji + file:line reference + fix suggestion.
 */
export function verifyFormat(text) {
  const findings = parseFindings(text);
  const errors = [];

  const fileLinePattern = /\S+:\d+/; // e.g. foo.mjs:42

  for (const f of findings) {
    if (!fileLinePattern.test(f.text)) {
      errors.push(`Missing file:line reference: ${f.text.slice(0, 80)}`);
    }
    // Fix suggestion: content after emoji and file:line must be non-trivial
    const withoutEmoji = f.text.replace(/🔴|🟡|🔵/, "").trim();
    const withoutFileRef = withoutEmoji.replace(/\S+:\d+/, "").replace(/^[\s—–-]+/, "").trim();
    if (withoutFileRef.length < 10) {
      errors.push(`Missing fix suggestion: ${f.text.slice(0, 80)}`);
    }
  }

  return {
    ok: true,
    valid: errors.length === 0,
    findings: findings.length,
    errors,
  };
}

export function cmdSynthesize(args) {
  const isVerify = args[0] === "verify";
  const restArgs = isVerify ? args.slice(1) : args;

  // Read input from --input file or stdin
  let text = "";
  const inputIdx = restArgs.indexOf("--input");
  if (inputIdx !== -1 && restArgs[inputIdx + 1]) {
    try {
      text = readFileSync(restArgs[inputIdx + 1], "utf8");
    } catch (err) {
      console.log(JSON.stringify({ ok: false, error: `Cannot read file: ${err.message}` }));
      process.exitCode = 1;
      return;
    }
  } else {
    try {
      text = readFileSync(0, "utf8"); // fd 0 = stdin
    } catch {
      text = "";
    }
  }

  // Optional --repo-root for compound gate fabricated-refs layer
  const repoRootIdx = restArgs.indexOf("--repo-root");
  const repoRoot = repoRootIdx !== -1 && restArgs[repoRootIdx + 1]
    ? restArgs[repoRootIdx + 1]
    : process.cwd();

  if (isVerify) {
    console.log(JSON.stringify(verifyFormat(text)));
    return;
  }

  let findings = parseFindings(text);

  // Run compound gate before computing verdict
  const gateResult = runCompoundGate(findings, repoRoot);
  if (gateResult.verdict === "FAIL") {
    findings = [
      { severity: "critical", text: `🔴 compound-gate.mjs:0 — Shallow review detected: ${gateResult.layers.join(", ")}` },
      ...findings,
    ];
  } else if (gateResult.verdict === "WARN") {
    findings = [
      { severity: "warning", text: `🟡 compound-gate.mjs:0 — Thin review warning: ${gateResult.layers.join(", ")}` },
      ...findings,
    ];
  }

  // Append compound gate section to input file only when --append-section is explicitly requested
  const inputFilePath = inputIdx !== -1 && restArgs[inputIdx + 1] ? restArgs[inputIdx + 1] : null;
  if (inputFilePath && restArgs.includes("--append-section")) {
    try {
      appendFileSync(inputFilePath, "\n\n" + gateResult.section);
    } catch { /* best-effort */ }
  }

  const { verdict, backlog, critical, warning, suggestion } = computeVerdict(findings);

  console.log(JSON.stringify({
    ok: true,
    verdict,
    backlog,
    critical,
    warning,
    suggestion,
    compoundGate: { tripped: gateResult.tripped, layers: gateResult.layers, verdict: gateResult.verdict },
    findings: findings.map(f => ({ severity: f.severity, text: f.text })),
  }));
}
