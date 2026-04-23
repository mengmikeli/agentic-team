// bin/lib/compound-gate.mjs
// 5-layer compound evaluation gate for detecting shallow/fabricated review findings

import { existsSync } from "fs";
import { join, resolve, sep } from "path";

// ── Layer 1: Thin Content ──────────────────────────────────────────────────

const GENERIC_PHRASES = [
  /looks good/i,
  /seems correct/i,
  /appears to work/i,
  /implementation is reasonable/i,
];

/**
 * Trips when >50% of non-suggestion findings contain at least one generic phrase.
 */
export function detectThinContent(findings) {
  const nonSugg = findings.filter(f => f.severity !== "suggestion");
  if (nonSugg.length === 0) return false;
  const withGeneric = nonSugg.filter(f => GENERIC_PHRASES.some(re => re.test(f.text)));
  return withGeneric.length / nonSugg.length > 0.5;
}

// ── Layer 2: Missing Code References ──────────────────────────────────────

const FILE_LINE_PATTERN = /\S+\.(mjs|ts|js|json|md|cjs|jsx|tsx|mts):\d+/;

/**
 * Trips when zero non-suggestion findings contain a file:line reference.
 */
export function detectMissingCodeRefs(findings) {
  const nonSugg = findings.filter(f => f.severity !== "suggestion");
  if (nonSugg.length === 0) return false;
  return !nonSugg.some(f => FILE_LINE_PATTERN.test(f.text));
}

// ── Layer 3: Low Uniqueness ────────────────────────────────────────────────

function wordTrigrams(text) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const tg = new Set();
  for (let i = 0; i + 2 < words.length; i++) {
    tg.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return tg;
}

function jaccardSimilarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) { if (b.has(x)) inter++; }
  return inter / (a.size + b.size - inter);
}

/**
 * Trips when >40% of finding sentences are near-duplicates of another sentence.
 * Near-duplicate: Jaccard similarity of word 3-grams >= 0.7.
 */
export function detectLowUniqueness(findings) {
  const sentences = findings.flatMap(f =>
    f.text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10)
  );
  if (sentences.length < 2) return false;
  const tgrams = sentences.map(wordTrigrams);
  const isDup = new Set();
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      if (jaccardSimilarity(tgrams[i], tgrams[j]) >= 0.7) {
        isDup.add(i);
        isDup.add(j);
      }
    }
  }
  return isDup.size / sentences.length > 0.4;
}

// ── Layer 4: Fabricated References ────────────────────────────────────────

const FILE_EXT_PATTERN = /([^\s:]+\.(mjs|ts|js|json|md))/g;

/**
 * Trips when any file path cited in findings does not exist under repoRoot.
 * Path traversal protection: paths that escape repoRoot are treated as fabricated.
 */
export function detectFabricatedRefs(findings, repoRoot) {
  const resolvedRoot = resolve(repoRoot);
  const paths = new Set();
  for (const f of findings) {
    for (const m of f.text.matchAll(FILE_EXT_PATTERN)) {
      paths.add(m[1]);
    }
  }
  if (paths.size === 0) return false;
  for (const p of paths) {
    const abs = resolve(join(resolvedRoot, p));
    // Block path traversal: if resolved path escapes repoRoot, treat as fabricated
    if (!abs.startsWith(resolvedRoot + sep) && abs !== resolvedRoot) {
      return true;
    }
    if (!existsSync(abs)) return true;
  }
  return false;
}

// ── Layer 5: Aspirational Claims ──────────────────────────────────────────

const ASPIRATIONAL_PHRASES = [
  /should work/i,
  /will handle/i,
  /is designed to/i,
  /should be able/i,
  /would handle/i,
];

/**
 * Trips when any non-critical finding contains an aspirational phrase.
 */
export function detectAspirationalClaims(findings) {
  const nonCritical = findings.filter(f => f.severity !== "critical");
  return nonCritical.some(f => ASPIRATIONAL_PHRASES.some(re => re.test(f.text)));
}

// ── Orchestrator ───────────────────────────────────────────────────────────

/**
 * Run all 5 compound gate layers.
 * @param {Array<{severity: string, text: string}>} findings
 * @param {string} repoRoot  Absolute path to repo root (for fabricated-refs check)
 * @returns {{ tripped: number, layers: string[], verdict: string, section: string }}
 */
export function runCompoundGate(findings, repoRoot) {
  const layers = [];
  if (detectThinContent(findings))              layers.push("thin-content");
  if (detectMissingCodeRefs(findings))          layers.push("missing-code-refs");
  if (detectLowUniqueness(findings))            layers.push("low-uniqueness");
  if (detectFabricatedRefs(findings, repoRoot)) layers.push("fabricated-refs");
  if (detectAspirationalClaims(findings))       layers.push("aspirational-claims");

  const tripped = layers.length;
  const verdict = tripped >= 3 ? "FAIL" : tripped >= 1 ? "WARN" : "PASS";
  const layerLine = layers.length > 0
    ? `**Tripped layers:** ${layers.join(", ")}`
    : "**All layers passed**";

  const section = [
    "## Compound Gate",
    "",
    `**Verdict:** ${verdict}`,
    `**Layers tripped:** ${tripped}/5`,
    layerLine,
  ].join("\n");

  return { tripped, layers, verdict, section };
}
