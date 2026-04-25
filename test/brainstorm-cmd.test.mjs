// Tests for bin/lib/brainstorm-cmd.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildBrainstormBrief, buildInteractiveSpec } from "../bin/lib/brainstorm-cmd.mjs";
import { PRD_SECTIONS } from "../bin/lib/spec.mjs";

describe("brainstorm-cmd buildBrainstormBrief", () => {
  it("includes the idea, product context, and cwd", () => {
    const brief = buildBrainstormBrief("login form", "Our product is X", "/home/proj");
    assert.ok(brief.includes("login form"));
    assert.ok(brief.includes("Our product is X"));
    assert.ok(brief.includes("/home/proj"));
  });

  it("advertises all seven PRD_SECTIONS in the bullet list", () => {
    const brief = buildBrainstormBrief("idea", null, "/cwd");
    for (const section of PRD_SECTIONS) {
      assert.ok(
        brief.includes(`- ## ${section}`),
        `Brief bullet list must advertise "${section}"`
      );
    }
  });

  it("advertises all seven PRD_SECTIONS as headings inside the fenced example", () => {
    const brief = buildBrainstormBrief("idea", null, "/cwd");
    // Extract the fenced markdown example
    const fenceMatch = brief.match(/```markdown\n([\s\S]*?)\n```/);
    assert.ok(fenceMatch, "brief must contain a ```markdown fenced example");
    const example = fenceMatch[1];
    for (const section of PRD_SECTIONS) {
      const pattern = new RegExp(`^##\\s+${section}\\b`, "mi");
      assert.ok(
        pattern.test(example),
        `Fenced example must include heading "## ${section}" so it cannot drift from PRD_SECTIONS`
      );
    }
  });

  it("omits product context section when none is provided", () => {
    const brief = buildBrainstormBrief("idea", null, "/cwd");
    assert.ok(!brief.includes("## Product Context"));
  });
});

describe("brainstorm-cmd buildInteractiveSpec", () => {
  it("produces a spec containing every PRD_SECTIONS heading", () => {
    const spec = buildInteractiveSpec({
      idea: "my-feature",
      problem: "users need X",
      users: "everyone",
      constraints: "must be fast",
      requirements: ["does A", "does B"],
      acceptanceCriteria: ["A works", "B works"],
      notScope: "C",
      approach1: "simple",
      approach2: "robust",
      preferred: "a",
      technicalApproach: "do simple thing",
      testingStrategy: "unit tests",
      criteria: ["works"],
    });
    for (const section of PRD_SECTIONS) {
      const pattern = new RegExp(`^##\\s+${section}\\b`, "mi");
      assert.ok(
        pattern.test(spec),
        `Interactive spec must include "## ${section}" so it passes validateSpecFile`
      );
    }
  });
});
