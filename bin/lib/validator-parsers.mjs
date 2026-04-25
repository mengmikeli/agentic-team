// Parsers for validator output formats.
// Each parser: parse(stdout, stderr, exitCode) → { findings, summary, meta }
//
// findings: { critical, warning, suggestion }
// meta:     format-specific data (e.g. messages array for junit-xml)

// ── Helpers ──────────────────────────────────────────────────────

function extractAttrs(tag) {
  const attrs = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(tag)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

// ── JUnit XML ────────────────────────────────────────────────────

/**
 * Parse JUnit XML output and return structured findings.
 * Each <failure> element produces one critical finding with text:
 *   file:line — classname: message
 *
 * @param {string} stdout
 * @returns {{ findings: object, summary: string, meta: object }}
 */
export function parseJunitXml(stdout) {
  const findings = { critical: 0, warning: 0, suggestion: 0 };
  const messages = [];

  try {
    const tcRe = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g;
    let m;
    while ((m = tcRe.exec(stdout)) !== null) {
      const tcAttrs = extractAttrs(m[1]);
      const body = m[2];

      const failMatch = /<failure\b([^>]*)/.exec(body);
      if (!failMatch) continue;

      const failAttrs = extractAttrs(failMatch[1]);
      const file = tcAttrs.file || "";
      const line = tcAttrs.line || "";
      const classname = tcAttrs.classname || tcAttrs.name || "";
      const message = failAttrs.message || "";

      const location = file && line ? `${file}:${line}` : file || classname;
      messages.push(`${location} — ${classname}: ${message}`);
      findings.critical++;
    }
  } catch {
    // Fault-tolerant: if parse fails, fall back to zero findings
  }

  const totalMatch = /\btests="(\d+)"/.exec(stdout);
  const total = totalMatch ? parseInt(totalMatch[1], 10) : findings.critical;

  return {
    findings,
    summary: `${findings.critical} failure(s) in ${total} test(s)`,
    meta: { messages },
  };
}

// ── Exit-code (passthrough) ──────────────────────────────────────

export function parseExitCode(stdout, stderr, exitCode) {
  const critical = exitCode !== 0 ? 1 : 0;
  return {
    findings: { critical, warning: 0, suggestion: 0 },
    summary: exitCode === 0 ? "passed" : `exited with code ${exitCode}`,
    meta: {},
  };
}

// ── Registry ─────────────────────────────────────────────────────

export const PARSERS = {
  "junit-xml": (stdout, stderr, exitCode) => parseJunitXml(stdout),
  "exit-code": parseExitCode,
};

export function getParser(format) {
  return PARSERS[format] || PARSERS["exit-code"];
}
