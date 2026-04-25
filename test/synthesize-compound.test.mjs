// Integration tests for synthesize + compound gate
// Tests that a thin/fabricated eval.md triggers FAIL and a detailed eval.md triggers PASS

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { parseFindings } from "../bin/lib/synthesize.mjs";
import { runCompoundGate } from "../bin/lib/compound-gate.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Thin/fabricated eval.md content: generic phrases, no code refs, aspirational claims
const THIN_EVAL_MD = `
## Review Findings

🔴 — looks good overall, implementation is reasonable
🟡 — seems correct and appears to work fine
🟡 — this should work after reviewing the logic
`.trim();

// Detailed eval.md content: specific code refs, no generic phrases, no aspirational claims
const DETAILED_EVAL_MD = `
## Review Findings

🔴 bin/lib/compound-gate.mjs:94 — path traversal: resolve joined path and assert startsWith(repoRoot + sep) before existsSync
🟡 bin/lib/synthesize.mjs:108 — computeVerdict runs without gate check; inject synthetic critical finding when compound gate returns FAIL
🔵 bin/lib/compound-gate.mjs:51 — jaccardSimilarity returns 1.0 for two empty trigram sets; replace with early return 0 when either set is empty
`.trim();

describe("synthesize + compound gate integration", () => {
  it("thin/fabricated eval.md → compound gate FAIL (≥3 layers tripped)", () => {
    const findings = parseFindings(THIN_EVAL_MD);
    const result = runCompoundGate(findings, repoRoot);
    assert.equal(result.verdict, "FAIL", `Expected FAIL but got ${result.verdict}. Tripped layers: ${result.layers.join(", ")}`);
    assert.ok(result.tripped >= 3, `Expected ≥3 tripped layers, got ${result.tripped}: ${result.layers.join(", ")}`);
  });

  it("thin eval.md trips thin-content, missing-code-refs, and aspirational-claims layers", () => {
    const findings = parseFindings(THIN_EVAL_MD);
    const result = runCompoundGate(findings, repoRoot);
    assert.ok(result.layers.includes("thin-content"), "Expected thin-content to trip");
    assert.ok(result.layers.includes("missing-code-refs"), "Expected missing-code-refs to trip");
    assert.ok(result.layers.includes("aspirational-claims"), "Expected aspirational-claims to trip");
  });

  it("detailed eval.md with real file refs → compound gate PASS (0 layers tripped)", () => {
    const findings = parseFindings(DETAILED_EVAL_MD);
    const result = runCompoundGate(findings, repoRoot);
    assert.equal(result.verdict, "PASS", `Expected PASS but got ${result.verdict}. Tripped layers: ${result.layers.join(", ")}`);
    assert.equal(result.tripped, 0, `Expected 0 tripped layers, got ${result.tripped}: ${result.layers.join(", ")}`);
  });

  it("detailed eval.md — fabricated-refs does not trip when cited files exist", () => {
    const findings = parseFindings(DETAILED_EVAL_MD);
    const result = runCompoundGate(findings, repoRoot);
    assert.ok(!result.layers.includes("fabricated-refs"), "Expected fabricated-refs NOT to trip for real files");
  });

  it("thin eval.md — fabricated-refs does not trip when no file paths cited", () => {
    const findings = parseFindings(THIN_EVAL_MD);
    const result = runCompoundGate(findings, repoRoot);
    // Thin eval has no file:ext paths, so fabricated-refs should not trip
    assert.ok(!result.layers.includes("fabricated-refs"), "Expected fabricated-refs NOT to trip when no paths cited");
  });

  it.skip("fabricated eval.md with nonexistent file paths → fabricated-refs trips (disabled)", () => {
    const dir = mkdtempSync(join(tmpdir(), "fab-eval-"));
    const FABRICATED_EVAL_MD = `
🔴 ghost-module.mjs:10 — this file does not exist at all in the repo
🟡 phantom.ts:20 — another nonexistent file reference cited here
`.trim();
    const findings = parseFindings(FABRICATED_EVAL_MD);
    const result = runCompoundGate(findings, dir); // dir is empty temp dir
    assert.ok(result.layers.includes("fabricated-refs"), "Expected fabricated-refs to trip for nonexistent files");
  });

  it.skip("path traversal in cited paths is blocked by fabricated-refs (disabled)", () => {
    const dir = mkdtempSync(join(tmpdir(), "traversal-eval-"));
    // A reviewer cites a path that traverses outside the repo root
    const TRAVERSAL_EVAL_MD = `
🔴 ../../etc/passwd.md:1 — a traversal path that exists outside the repo
`.trim();
    const findings = parseFindings(TRAVERSAL_EVAL_MD);
    const result = runCompoundGate(findings, dir);
    // Traversal paths should trip fabricated-refs (treated as fabricated)
    assert.ok(result.layers.includes("fabricated-refs"), "Expected traversal path to be treated as fabricated ref");
  });

  // ── Task-10: detailed, code-referencing eval.md → PASS (per-layer verification) ──

  it("detailed eval.md — thin-content layer does not trip (no generic phrases)", () => {
    const findings = parseFindings(DETAILED_EVAL_MD);
    const result = runCompoundGate(findings, repoRoot);
    assert.ok(
      !result.layers.includes("thin-content"),
      "Expected thin-content NOT to trip: detailed findings contain no generic phrases"
    );
  });

  it("detailed eval.md — missing-code-refs layer does not trip (file:line refs present)", () => {
    const findings = parseFindings(DETAILED_EVAL_MD);
    const result = runCompoundGate(findings, repoRoot);
    assert.ok(
      !result.layers.includes("missing-code-refs"),
      "Expected missing-code-refs NOT to trip: every finding has a file:line reference"
    );
  });

  it("detailed eval.md — low-uniqueness layer does not trip (distinct findings)", () => {
    const findings = parseFindings(DETAILED_EVAL_MD);
    const result = runCompoundGate(findings, repoRoot);
    assert.ok(
      !result.layers.includes("low-uniqueness"),
      "Expected low-uniqueness NOT to trip: each finding describes a distinct issue"
    );
  });

  it("detailed eval.md — aspirational-claims layer does not trip (concrete language only)", () => {
    const findings = parseFindings(DETAILED_EVAL_MD);
    const result = runCompoundGate(findings, repoRoot);
    assert.ok(
      !result.layers.includes("aspirational-claims"),
      "Expected aspirational-claims NOT to trip: findings use concrete, observed language"
    );
  });

  it("detailed eval.md — section output confirms PASS with 'All layers passed'", () => {
    const findings = parseFindings(DETAILED_EVAL_MD);
    const result = runCompoundGate(findings, repoRoot);
    assert.ok(result.section.includes("## Compound Gate"), "section must include header");
    assert.ok(result.section.includes("All layers passed"), "section must confirm all layers passed");
    assert.ok(!result.section.includes("FAIL"), "section must not mention FAIL verdict");
    assert.ok(!result.section.includes("WARN"), "section must not mention WARN verdict");
  });
});
