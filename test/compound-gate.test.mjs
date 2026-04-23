// Tests for bin/lib/compound-gate.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  detectThinContent,
  detectMissingCodeRefs,
  detectLowUniqueness,
  detectFabricatedRefs,
  detectAspirationalClaims,
  runCompoundGate,
} from "../bin/lib/compound-gate.mjs";
import { parseFindings } from "../bin/lib/synthesize.mjs";

function makeDir() {
  return mkdtempSync(join(tmpdir(), "cg-test-"));
}

// ── Layer 1: Thin Content ──────────────────────────────────────────────────

describe("detectThinContent", () => {
  it("trips when >50% of non-suggestion findings have generic phrases", () => {
    const findings = [
      { severity: "critical", text: "🔴 foo.mjs:1 — this looks good overall" },
      { severity: "warning",  text: "🟡 bar.mjs:2 — implementation is reasonable" },
    ];
    assert.ok(detectThinContent(findings));
  });

  it("does not trip when <=50% of non-suggestion findings have generic phrases", () => {
    const findings = [
      { severity: "critical", text: "🔴 foo.mjs:1 — looks good here" },
      { severity: "warning",  text: "🟡 bar.mjs:2 — missing null check for user input" },
      { severity: "warning",  text: "🟡 baz.mjs:3 — unhandled promise rejection in callback" },
    ];
    // 1/3 = 33% is not >50%
    assert.ok(!detectThinContent(findings));
  });

  it("does not trip when all findings are suggestions", () => {
    const findings = [
      { severity: "suggestion", text: "🔵 foo.mjs:1 — looks good, consider extracting" },
    ];
    assert.ok(!detectThinContent(findings));
  });

  it("does not trip for empty findings", () => {
    assert.ok(!detectThinContent([]));
  });

  it("trips on 'seems correct' phrase", () => {
    const findings = [
      { severity: "warning", text: "🟡 foo.mjs:1 — seems correct to me" },
      { severity: "warning", text: "🟡 bar.mjs:2 — appears to work as expected" },
    ];
    assert.ok(detectThinContent(findings));
  });
});

// ── Layer 2: Missing Code References ──────────────────────────────────────

describe("detectMissingCodeRefs", () => {
  it("trips when no non-suggestion finding has a file:line reference", () => {
    const findings = [
      { severity: "critical", text: "🔴 — the function is broken" },
      { severity: "warning",  text: "🟡 — missing error handling" },
    ];
    assert.ok(detectMissingCodeRefs(findings));
  });

  it("does not trip when at least one non-suggestion finding has a code ref", () => {
    const findings = [
      { severity: "critical", text: "🔴 foo.mjs:10 — missing validation" },
      { severity: "warning",  text: "🟡 — needs refactoring" },
    ];
    assert.ok(!detectMissingCodeRefs(findings));
  });

  it("does not trip when all findings are suggestions", () => {
    const findings = [
      { severity: "suggestion", text: "🔵 consider using const instead of let" },
    ];
    assert.ok(!detectMissingCodeRefs(findings));
  });

  it("does not trip for empty findings", () => {
    assert.ok(!detectMissingCodeRefs([]));
  });
});

// ── Layer 3: Low Uniqueness ────────────────────────────────────────────────

describe("detectLowUniqueness", () => {
  it("trips when >40% of sentences are near-duplicates", () => {
    const base = "the module definitely needs comprehensive refactoring and extensive documentation updates here";
    const findings = [
      { severity: "critical", text: `🔴 foo.mjs:1 — ${base}` },
      { severity: "warning",  text: `🟡 bar.mjs:2 — ${base}` },
      { severity: "warning",  text: `🟡 baz.mjs:3 — ${base}` },
    ];
    assert.ok(detectLowUniqueness(findings));
  });

  it("does not trip when all sentences are distinct", () => {
    const findings = [
      { severity: "critical",  text: "🔴 foo.mjs:10 — variable x is not initialized before use" },
      { severity: "warning",   text: "🟡 bar.mjs:20 — missing error handling in async callback" },
      { severity: "suggestion", text: "🔵 baz.mjs:30 — consider extracting this logic into a helper" },
    ];
    assert.ok(!detectLowUniqueness(findings));
  });

  it("does not trip for fewer than 2 sentences", () => {
    const findings = [
      { severity: "critical", text: "🔴 foo.mjs:1 — single finding only" },
    ];
    assert.ok(!detectLowUniqueness(findings));
  });

  it("does not trip for empty findings", () => {
    assert.ok(!detectLowUniqueness([]));
  });
});

// ── Layer 4: Fabricated References ────────────────────────────────────────

describe("detectFabricatedRefs", () => {
  it("trips when a cited file does not exist in repoRoot", () => {
    const dir = makeDir();
    const findings = [
      { severity: "critical", text: "🔴 does-not-exist.mjs:1 — some critical issue" },
    ];
    assert.ok(detectFabricatedRefs(findings, dir));
  });

  it("does not trip when all cited files exist in repoRoot", () => {
    const dir = makeDir();
    writeFileSync(join(dir, "real.mjs"), "// real file");
    const findings = [
      { severity: "critical", text: "🔴 real.mjs:1 — some critical issue" },
    ];
    assert.ok(!detectFabricatedRefs(findings, dir));
  });

  it("does not trip when no file paths are cited in findings", () => {
    const dir = makeDir();
    const findings = [
      { severity: "critical", text: "🔴 — the function is broken" },
    ];
    assert.ok(!detectFabricatedRefs(findings, dir));
  });

  it("trips on the first non-existent path even if others exist", () => {
    const dir = makeDir();
    writeFileSync(join(dir, "real.mjs"), "// real");
    const findings = [
      { severity: "critical", text: "🔴 real.mjs:1 — exists fine" },
      { severity: "warning",  text: "🟡 ghost.mjs:2 — this file does not exist" },
    ];
    assert.ok(detectFabricatedRefs(findings, dir));
  });

  it("handles nested directory paths", () => {
    const dir = makeDir();
    mkdirSync(join(dir, "bin/lib"), { recursive: true });
    writeFileSync(join(dir, "bin/lib/foo.mjs"), "// nested");
    const findings = [
      { severity: "critical", text: "🔴 bin/lib/foo.mjs:5 — deep path issue" },
    ];
    assert.ok(!detectFabricatedRefs(findings, dir));
  });
});

// ── Layer 5: Aspirational Claims ──────────────────────────────────────────

describe("detectAspirationalClaims", () => {
  it("trips when a non-critical finding contains 'should work'", () => {
    const findings = [
      { severity: "warning", text: "🟡 foo.mjs:1 — this should work after fixing imports" },
    ];
    assert.ok(detectAspirationalClaims(findings));
  });

  it("trips when a suggestion contains 'will handle'", () => {
    const findings = [
      { severity: "suggestion", text: "🔵 bar.mjs:2 — the function will handle edge cases" },
    ];
    assert.ok(detectAspirationalClaims(findings));
  });

  it("does not trip when aspirational phrases only appear in critical findings", () => {
    const findings = [
      { severity: "critical", text: "🔴 foo.mjs:1 — should work but crashes due to null ref" },
    ];
    assert.ok(!detectAspirationalClaims(findings));
  });

  it("does not trip when no aspirational phrases are present", () => {
    const findings = [
      { severity: "warning",  text: "🟡 foo.mjs:1 — missing null check at line 42" },
      { severity: "critical", text: "🔴 bar.mjs:2 — unhandled exception in catch block" },
    ];
    assert.ok(!detectAspirationalClaims(findings));
  });

  it("does not trip for empty findings", () => {
    assert.ok(!detectAspirationalClaims([]));
  });

  it("trips on 'is designed to' phrase", () => {
    const findings = [
      { severity: "warning", text: "🟡 foo.mjs:5 — this is designed to prevent errors" },
    ];
    assert.ok(detectAspirationalClaims(findings));
  });
});

// ── Orchestrator: runCompoundGate ──────────────────────────────────────────

describe("runCompoundGate", () => {
  it("returns PASS when no layers trip", () => {
    const dir = makeDir();
    writeFileSync(join(dir, "foo.mjs"), "");
    const findings = [
      { severity: "critical", text: "🔴 foo.mjs:1 — null pointer dereference at runtime" },
      { severity: "warning",  text: "🟡 foo.mjs:2 — missing input validation for user data" },
    ];
    const result = runCompoundGate(findings, dir);
    assert.equal(result.verdict, "PASS");
    assert.equal(result.tripped, 0);
    assert.deepEqual(result.layers, []);
  });

  it("returns WARN when exactly 1 layer trips", () => {
    const dir = makeDir();
    // Only missing-code-refs trips: no file:line refs, no generic phrases, no aspirational, no paths
    const findings = [
      { severity: "critical", text: "🔴 — the function is broken completely" },
    ];
    const result = runCompoundGate(findings, dir);
    assert.equal(result.verdict, "WARN");
    assert.equal(result.tripped, 1);
    assert.ok(result.layers.includes("missing-code-refs"));
  });

  it("returns WARN when exactly 2 layers trip", () => {
    const dir = makeDir();
    // Trips: thin-content + missing-code-refs
    const findings = [
      { severity: "critical", text: "🔴 — this looks good overall" },
      { severity: "warning",  text: "🟡 — implementation is reasonable here" },
    ];
    const result = runCompoundGate(findings, dir);
    assert.equal(result.verdict, "WARN");
    assert.equal(result.tripped, 2);
    assert.ok(result.layers.includes("thin-content"));
    assert.ok(result.layers.includes("missing-code-refs"));
  });

  it("returns FAIL when 3 layers trip", () => {
    const dir = makeDir();
    // Trips: thin-content + missing-code-refs + aspirational-claims
    const findings = [
      { severity: "critical", text: "🔴 — this looks good overall" },
      { severity: "warning",  text: "🟡 — implementation is reasonable and should work fine" },
    ];
    const result = runCompoundGate(findings, dir);
    assert.equal(result.verdict, "FAIL");
    assert.ok(result.tripped >= 3);
    assert.ok(result.layers.includes("thin-content"));
    assert.ok(result.layers.includes("missing-code-refs"));
    assert.ok(result.layers.includes("aspirational-claims"));
  });

  it("section contains verdict and layer names", () => {
    const dir = makeDir();
    const findings = [
      { severity: "critical", text: "🔴 — this looks good overall" },
      { severity: "warning",  text: "🟡 — implementation is reasonable and should work fine" },
    ];
    const result = runCompoundGate(findings, dir);
    assert.ok(result.section.includes("## Compound Gate"));
    assert.ok(result.section.includes("FAIL"));
    assert.ok(result.section.includes("thin-content"));
  });

  it("section says 'All layers passed' when no layers trip", () => {
    const dir = makeDir();
    writeFileSync(join(dir, "foo.mjs"), "");
    const findings = [
      { severity: "critical", text: "🔴 foo.mjs:1 — real null dereference issue found" },
    ];
    const result = runCompoundGate(findings, dir);
    assert.ok(result.section.includes("All layers passed"));
  });

  it("returns correct structure shape", () => {
    const dir = makeDir();
    const result = runCompoundGate([], dir);
    assert.ok(typeof result.tripped === "number");
    assert.ok(Array.isArray(result.layers));
    assert.ok(typeof result.verdict === "string");
    assert.ok(typeof result.section === "string");
  });
});

// ── Integration: eval.md file fixtures ────────────────────────────────────

describe("Integration: runCompoundGate with eval.md fixtures", () => {
  it("returns FAIL for thin/fabricated eval.md content (trips ≥3 layers)", () => {
    const dir = makeDir();
    // Thin content: generic phrases, no file:line refs, aspirational → ≥3 layers
    const evalContent = [
      "## Findings",
      "🔴 — this looks good overall",
      "🟡 — implementation is reasonable and should work fine",
    ].join("\n");
    writeFileSync(join(dir, "eval.md"), evalContent);

    const text = readFileSync(join(dir, "eval.md"), "utf8");
    const findings = parseFindings(text);
    const result = runCompoundGate(findings, dir);

    assert.equal(result.verdict, "FAIL");
    assert.ok(result.tripped >= 3,
      `Expected ≥3 layers tripped but got ${result.tripped}: ${result.layers.join(", ")}`);
    assert.ok(result.layers.includes("thin-content"), "Expected thin-content to trip");
    assert.ok(result.layers.includes("missing-code-refs"), "Expected missing-code-refs to trip");
    assert.ok(result.layers.includes("aspirational-claims"), "Expected aspirational-claims to trip");
    assert.ok(result.section.includes("## Compound Gate"), "section must include header");
    assert.ok(result.section.includes("FAIL"), "section must include verdict");
  });

  it("returns PASS for clean eval.md content with real file references", () => {
    const dir = makeDir();
    // Create a real file so fabricated-refs layer doesn't trip
    writeFileSync(join(dir, "real.mjs"), "// real module");

    const evalContent = [
      "## Findings",
      "🔴 real.mjs:10 — null pointer dereference in production code path, crashes on empty input",
      "🟡 real.mjs:25 — missing input validation for user-provided data passed to external API",
    ].join("\n");
    writeFileSync(join(dir, "eval.md"), evalContent);

    const text = readFileSync(join(dir, "eval.md"), "utf8");
    const findings = parseFindings(text);
    const result = runCompoundGate(findings, dir);

    assert.equal(result.verdict, "PASS",
      `Expected PASS but got ${result.verdict}. Tripped layers: ${result.layers.join(", ")}`);
    assert.equal(result.tripped, 0);
    assert.deepEqual(result.layers, []);
    assert.ok(result.section.includes("All layers passed"));
  });
});
