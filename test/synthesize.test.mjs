// Tests for bin/lib/synthesize.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { writeFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { parseFindings, computeVerdict, verifyFormat } from "../bin/lib/synthesize.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const harnessPath = join(__dirname, "..", "bin", "agt-harness.mjs");

function harnessJSON(...args) {
  const out = execFileSync("node", [harnessPath, ...args], {
    encoding: "utf8",
    timeout: 10000,
  });
  const lines = out.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return JSON.parse(lines[i]); } catch {}
  }
  return JSON.parse(out.trim());
}

describe("parseFindings", () => {
  it("finds critical (🔴) findings", () => {
    const findings = parseFindings("🔴 foo.mjs:10 — Fix this now");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "critical");
    assert.ok(findings[0].text.includes("🔴"));
  });

  it("finds warning (🟡) findings", () => {
    const findings = parseFindings("🟡 bar.mjs:20 — Consider fixing");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "warning");
  });

  it("finds suggestion (🔵) findings", () => {
    const findings = parseFindings("🔵 baz.mjs:30 — Optional improvement");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "suggestion");
  });

  it("finds multiple findings across lines", () => {
    const text = [
      "🔴 a.mjs:1 — Critical issue here",
      "Some non-finding text",
      "🟡 b.mjs:2 — Warning issue here",
      "🔵 c.mjs:3 — Suggestion here",
    ].join("\n");
    const findings = parseFindings(text);
    assert.equal(findings.length, 3);
    assert.equal(findings[0].severity, "critical");
    assert.equal(findings[1].severity, "warning");
    assert.equal(findings[2].severity, "suggestion");
  });

  it("returns empty array for text with no findings", () => {
    const findings = parseFindings("No findings.");
    assert.equal(findings.length, 0);
  });

  it("returns empty array for empty input", () => {
    assert.equal(parseFindings("").length, 0);
    assert.equal(parseFindings(null).length, 0);
  });

  it("ignores lines without severity emoji", () => {
    const findings = parseFindings("This is just a comment\nAnd another line");
    assert.equal(findings.length, 0);
  });
});

describe("computeVerdict", () => {
  it("returns FAIL when there are critical findings", () => {
    const findings = [{ severity: "critical", text: "🔴 foo.mjs:1 — fix" }];
    const { verdict, backlog } = computeVerdict(findings);
    assert.equal(verdict, "FAIL");
    assert.equal(backlog, false);
  });

  it("returns PASS with backlog=true when only warnings", () => {
    const findings = [{ severity: "warning", text: "🟡 foo.mjs:1 — fix" }];
    const { verdict, backlog } = computeVerdict(findings);
    assert.equal(verdict, "PASS");
    assert.equal(backlog, true);
  });

  it("returns PASS with backlog=false when only suggestions", () => {
    const findings = [{ severity: "suggestion", text: "🔵 foo.mjs:1 — fix" }];
    const { verdict, backlog } = computeVerdict(findings);
    assert.equal(verdict, "PASS");
    assert.equal(backlog, false);
  });

  it("returns PASS with backlog=false when no findings", () => {
    const { verdict, backlog } = computeVerdict([]);
    assert.equal(verdict, "PASS");
    assert.equal(backlog, false);
  });

  it("FAIL trumps warnings — any red = FAIL", () => {
    const findings = [
      { severity: "critical", text: "🔴 a.mjs:1 — fix" },
      { severity: "warning", text: "🟡 b.mjs:2 — fix" },
    ];
    const { verdict } = computeVerdict(findings);
    assert.equal(verdict, "FAIL");
  });

  it("counts severities correctly", () => {
    const findings = [
      { severity: "critical", text: "" },
      { severity: "warning", text: "" },
      { severity: "warning", text: "" },
      { severity: "suggestion", text: "" },
    ];
    const { critical, warning, suggestion } = computeVerdict(findings);
    assert.equal(critical, 1);
    assert.equal(warning, 2);
    assert.equal(suggestion, 1);
  });

  it("backlog=true only when no critical but has warnings", () => {
    const findings = [
      { severity: "warning", text: "" },
      { severity: "suggestion", text: "" },
    ];
    const { verdict, backlog } = computeVerdict(findings);
    assert.equal(verdict, "PASS");
    assert.equal(backlog, true);
  });
});

describe("verifyFormat", () => {
  it("accepts valid finding with emoji + file:line + fix", () => {
    const result = verifyFormat("🔴 bin/lib/foo.mjs:42 — Add input validation before use");
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.findings, 1);
  });

  it("accepts multiple valid findings", () => {
    const text = [
      "🔴 a.mjs:1 — Critical fix needed here",
      "🟡 b.mjs:20 — Should add error handling",
      "🔵 c.mjs:3 — Consider extracting this constant",
    ].join("\n");
    const result = verifyFormat(text);
    assert.equal(result.valid, true);
    assert.equal(result.findings, 3);
  });

  it("flags missing file:line reference", () => {
    const result = verifyFormat("🔴 Fix this now — no file reference");
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("file:line")));
  });

  it("flags missing fix suggestion", () => {
    const result = verifyFormat("🔴 foo.mjs:1 — ok");
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("fix suggestion")));
  });

  it("returns valid=true and findings=0 for no findings", () => {
    const result = verifyFormat("No findings.");
    assert.equal(result.valid, true);
    assert.equal(result.findings, 0);
    assert.equal(result.errors.length, 0);
  });

  it("returns ok=true always (it's a format check, not a verdict)", () => {
    const result = verifyFormat("garbage input with no structure");
    assert.equal(result.ok, true);
  });
});

describe("agt-harness synthesize CLI", () => {
  it("synthesize --input returns FAIL for critical findings", () => {
    const dir = mkdtempSync(join(tmpdir(), "synth-test-"));
    const file = join(dir, "review.txt");
    writeFileSync(file, "🔴 bin/lib/foo.mjs:10 — Missing validation; add sanitize()");
    const result = harnessJSON("synthesize", "--input", file);
    assert.equal(result.ok, true);
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.critical, 1);
  });

  it("synthesize --input returns PASS with backlog for warnings only", () => {
    const dir = mkdtempSync(join(tmpdir(), "synth-test-"));
    const file = join(dir, "review.txt");
    writeFileSync(file, "🟡 bin/lib/synthesize.mjs:20 — Add error handling here");
    const result = harnessJSON("synthesize", "--input", file);
    assert.equal(result.verdict, "PASS");
    assert.equal(result.backlog, true);
    assert.equal(result.warning, 1);
  });

  it("synthesize --input returns PASS for no findings", () => {
    const dir = mkdtempSync(join(tmpdir(), "synth-test-"));
    const file = join(dir, "review.txt");
    writeFileSync(file, "No findings.");
    const result = harnessJSON("synthesize", "--input", file);
    assert.equal(result.verdict, "PASS");
    assert.equal(result.backlog, false);
    assert.equal(result.critical, 0);
  });

  it("synthesize verify --input accepts valid format", () => {
    const dir = mkdtempSync(join(tmpdir(), "synth-test-"));
    const file = join(dir, "review.txt");
    writeFileSync(file, "🔴 bin/lib/run.mjs:42 — Add input sanitization before processing");
    const result = harnessJSON("synthesize", "verify", "--input", file);
    assert.equal(result.ok, true);
    assert.equal(result.valid, true);
    assert.equal(result.findings, 1);
  });

  it("synthesize verify --input rejects format without file:line", () => {
    const dir = mkdtempSync(join(tmpdir(), "synth-test-"));
    const file = join(dir, "review.txt");
    writeFileSync(file, "🔴 This is broken — no file reference at all");
    const result = harnessJSON("synthesize", "verify", "--input", file);
    assert.equal(result.ok, true);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it("synthesize includes findings array in output", () => {
    const dir = mkdtempSync(join(tmpdir(), "synth-test-"));
    const file = join(dir, "review.txt");
    writeFileSync(file, [
      "🔴 bin/lib/synthesize.mjs:1 — Critical issue needs fix",
      "🔵 bin/lib/compound-gate.mjs:2 — Consider refactoring this block",
    ].join("\n"));
    const result = harnessJSON("synthesize", "--input", file);
    assert.ok(Array.isArray(result.findings));
    assert.equal(result.findings.length, 2);
    assert.equal(result.findings[0].severity, "critical");
    assert.equal(result.findings[1].severity, "suggestion");
  });
});
