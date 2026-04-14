// Tests for bin/lib/tiers.mjs — quality tier selection and baselines
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TIERS, selectTier, formatTierBaseline, getMissingSeverity } from "../bin/lib/tiers.mjs";

describe("TIERS", () => {
  it("defines functional, polished, and delightful tiers", () => {
    assert.ok(TIERS.functional);
    assert.ok(TIERS.polished);
    assert.ok(TIERS.delightful);
  });

  it("functional has no baseline items", () => {
    assert.equal(TIERS.functional.baseline.length, 0);
  });

  it("polished has baseline items", () => {
    assert.ok(TIERS.polished.baseline.length > 0);
    assert.ok(TIERS.polished.baseline.some(b => b.key === "typography"));
    assert.ok(TIERS.polished.baseline.some(b => b.key === "responsive"));
  });

  it("delightful has more baseline items than polished", () => {
    assert.ok(TIERS.delightful.baseline.length > TIERS.polished.baseline.length);
  });

  it("delightful includes polished items plus extras", () => {
    assert.ok(TIERS.delightful.baseline.some(b => b.key === "typography"));
    assert.ok(TIERS.delightful.baseline.some(b => b.key === "micro-interactions"));
    assert.ok(TIERS.delightful.baseline.some(b => b.key === "page-transitions"));
  });

  it("all baseline items have key and text", () => {
    for (const tier of Object.values(TIERS)) {
      for (const item of tier.baseline) {
        assert.ok(item.key, `Missing key in ${tier.name}`);
        assert.ok(item.text, `Missing text in ${tier.name}:${item.key}`);
      }
    }
  });
});

describe("selectTier", () => {
  it("returns explicit tier when flag is provided", () => {
    assert.equal(selectTier("polished", "anything").name, "polished");
    assert.equal(selectTier("delightful", "cli tool").name, "delightful");
    assert.equal(selectTier("functional", "beautiful ui").name, "functional");
  });

  it("ignores invalid tier flag and falls through to auto-detect", () => {
    const result = selectTier("banana", "build a cli tool");
    assert.equal(result.name, "functional");
  });

  it("selects functional for CLI/API descriptions", () => {
    assert.equal(selectTier(null, "build a cli tool").name, "functional");
    assert.equal(selectTier(null, "create api endpoint").name, "functional");
    assert.equal(selectTier(null, "backend service for auth").name, "functional");
    assert.equal(selectTier(null, "add database migration").name, "functional");
  });

  it("selects polished for UI/frontend descriptions", () => {
    assert.equal(selectTier(null, "build the dashboard ui").name, "polished");
    assert.equal(selectTier(null, "create a website for docs").name, "polished");
    assert.equal(selectTier(null, "redesign the frontend").name, "polished");
  });

  it("selects delightful for showcase/demo descriptions", () => {
    assert.equal(selectTier(null, "build a showcase page").name, "delightful");
    assert.equal(selectTier(null, "create pitch demo").name, "delightful");
    assert.equal(selectTier(null, "make it beautiful").name, "delightful");
    assert.equal(selectTier(null, "wow the investors").name, "delightful");
  });

  it("defaults to functional for ambiguous descriptions", () => {
    assert.equal(selectTier(null, "do the thing").name, "functional");
    assert.equal(selectTier(null, "").name, "functional");
    assert.equal(selectTier(null, null).name, "functional");
  });
});

describe("formatTierBaseline", () => {
  it("formats functional tier with no checklist", () => {
    const result = formatTierBaseline(TIERS.functional);
    assert.ok(result.includes("functional"));
    assert.ok(result.includes("correctness only"));
  });

  it("formats polished tier with checklist items", () => {
    const result = formatTierBaseline(TIERS.polished);
    assert.ok(result.includes("polished"));
    assert.ok(result.includes("typography"));
    assert.ok(result.includes("responsive"));
    assert.ok(result.includes("Baseline Checklist"));
  });

  it("formats delightful tier with all items", () => {
    const result = formatTierBaseline(TIERS.delightful);
    assert.ok(result.includes("delightful"));
    assert.ok(result.includes("micro-interactions"));
    assert.ok(result.includes("page-transitions"));
  });

  it("includes builder and reviewer guidance", () => {
    const result = formatTierBaseline(TIERS.polished);
    assert.ok(result.includes("Builders") || result.includes("builder"));
    assert.ok(result.includes("Reviewers") || result.includes("reviewer"));
  });

  it("handles null tier gracefully", () => {
    const result = formatTierBaseline(null);
    assert.ok(result.includes("functional"));
  });
});

describe("getMissingSeverity", () => {
  it("returns null for functional tier", () => {
    assert.equal(getMissingSeverity("functional", "typography"), null);
    assert.equal(getMissingSeverity("functional", "responsive"), null);
  });

  it("returns warning for most polished items", () => {
    assert.equal(getMissingSeverity("polished", "typography"), "warning");
    assert.equal(getMissingSeverity("polished", "loading-states"), "warning");
  });

  it("returns critical for key polished items", () => {
    assert.equal(getMissingSeverity("polished", "navigation"), "critical");
    assert.equal(getMissingSeverity("polished", "responsive"), "critical");
  });

  it("returns critical for all delightful items", () => {
    assert.equal(getMissingSeverity("delightful", "typography"), "critical");
    assert.equal(getMissingSeverity("delightful", "micro-interactions"), "critical");
    assert.equal(getMissingSeverity("delightful", "responsive"), "critical");
  });
});
