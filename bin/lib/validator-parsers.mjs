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
export function parseJunitXml(stdout, stderr, exitCode) {
  const findings = { critical: 0, warning: 0, suggestion: 0 };
  const messages = [];

  const tcRe = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g;
  let m;
  while ((m = tcRe.exec(stdout)) !== null) {
    const tcAttrs = extractAttrs(m[1]);
    const body = m[2];

    const failMatch = /<(?:failure|error)\b([^>]*)/.exec(body);
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

  const totalMatch = /\btests="(\d+)"/.exec(stdout);
  const total = totalMatch ? parseInt(totalMatch[1], 10) : findings.critical;

  return {
    findings,
    summary: `${findings.critical} failure(s) in ${total} test(s)`,
    meta: { messages },
  };
}

// ── TAP ──────────────────────────────────────────────────────────

/**
 * Parse TAP (Test Anything Protocol) output and return structured findings.
 * Each `not ok` line (excluding TODO directives) produces one critical finding.
 *
 * @param {string} stdout
 * @returns {{ findings: object, summary: string, meta: object }}
 */
export function parseTap(stdout, stderr, exitCode) {
  const findings = { critical: 0, warning: 0, suggestion: 0 };
  const messages = [];

  for (const line of stdout.split('\n')) {
    // Match only top-level `not ok` lines (no leading whitespace).
    // Indented lines are subtest output — counting them would double-count failures.
    if (/^not ok\b/.test(line) && !/# (?:TODO|SKIP)\b/i.test(line)) {
      // Strip control characters before storing (security: untrusted input).
      messages.push(line.replace(/[\x00-\x1f\x7f]/g, ''));
      findings.critical++;
    }
  }

  const planMatch = /^1\.\.(\d+)/m.exec(stdout);
  const total = planMatch ? parseInt(planMatch[1], 10) : findings.critical;

  return {
    findings,
    summary: `${findings.critical} failure(s) in ${total} test(s)`,
    meta: { messages },
  };
}

// ── GitHub Actions problem matcher ───────────────────────────────

/**
 * Parse GitHub Actions workflow command output and return structured findings.
 * Each `::error ...::message` line produces one critical finding.
 * Each `::warning ...::message` line produces one warning finding.
 *
 * @param {string} stdout
 * @returns {{ findings: object, summary: string, meta: object }}
 */
export function parseGithubActions(stdout, stderr, exitCode) {
  const findings = { critical: 0, warning: 0, suggestion: 0 };
  const messages = [];

  // Combine stdout and stderr — GA commands may appear on either stream
  const combined = [stdout, stderr].filter(Boolean).join('\n');

  // Regex: ::error|warning|notice [properties]::message
  // Properties are optional key=value pairs separated by commas
  const lineRe = /^::([a-z]+)(?:\s+([^:]*))?::(.*)$/;

  for (const raw of combined.split('\n')) {
    const line = raw.replace(/[\x00-\x1f\x7f]/g, '').trim();
    const m = lineRe.exec(line);
    if (!m) continue;

    const level = m[1];
    const propsStr = m[2] || '';
    const message = m[3] || '';

    // Parse properties: file=src/foo.js,line=5,col=1,...
    const props = {};
    for (const part of propsStr.split(',')) {
      const eq = part.indexOf('=');
      if (eq !== -1) {
        props[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
      }
    }

    const file = props.file || '';
    const line_ = props.line || '';
    const location = file && line_ ? `${file}:${line_}` : file || '';
    const label = location ? `${location} — ${message}` : message;

    if (level === 'error') {
      messages.push(label);
      findings.critical++;
    } else if (level === 'warning') {
      messages.push(label);
      findings.warning++;
    } else if (level === 'notice') {
      messages.push(label);
      findings.suggestion++;
    }
  }

  return {
    findings,
    summary: `${findings.critical} error(s), ${findings.warning} warning(s)`,
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
  "junit-xml": parseJunitXml,
  "tap": parseTap,
  "github-actions": parseGithubActions,
  "exit-code": parseExitCode,
};

export function getParser(format) {
  return PARSERS[format] || PARSERS["exit-code"];
}
