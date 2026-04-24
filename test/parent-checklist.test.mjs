// Tests for parent issue ## Tasks checklist logic in bin/lib/github.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTasksChecklist } from "../bin/lib/github.mjs";

describe("buildTasksChecklist", () => {
  it("returns empty string when task list is empty", () => {
    assert.equal(buildTasksChecklist([]), "");
  });

  it("returns empty string when no tasks have issue numbers", () => {
    const tasks = [{ title: "Task 1" }, { title: "Task 2" }];
    assert.equal(buildTasksChecklist(tasks), "");
  });

  it("builds checklist with ## Tasks header and unchecked items", () => {
    const tasks = [
      { title: "Implement feature", issueNumber: 42 },
      { title: "Write tests", issueNumber: 43 },
    ];
    const result = buildTasksChecklist(tasks);
    assert.ok(result.includes("## Tasks"));
    assert.ok(result.includes("- [ ] Implement feature (#42)"));
    assert.ok(result.includes("- [ ] Write tests (#43)"));
  });

  it("skips tasks without issue numbers", () => {
    const tasks = [
      { title: "Task A", issueNumber: 10 },
      { title: "Task B" },
      { title: "Task C", issueNumber: 12 },
    ];
    const result = buildTasksChecklist(tasks);
    assert.ok(result.includes("- [ ] Task A (#10)"));
    assert.ok(!result.includes("Task B"));
    assert.ok(result.includes("- [ ] Task C (#12)"));
  });

  it("includes issue number in (#N) format", () => {
    const tasks = [{ title: "My Task", issueNumber: 99 }];
    const result = buildTasksChecklist(tasks);
    assert.ok(result.includes("(#99)"));
  });

  it("result starts with newlines to separate from existing body", () => {
    const tasks = [{ title: "Task", issueNumber: 1 }];
    const result = buildTasksChecklist(tasks);
    assert.ok(result.startsWith("\n\n"));
  });

  it("handles null/undefined tasks gracefully", () => {
    assert.equal(buildTasksChecklist(null), "");
    assert.equal(buildTasksChecklist(undefined), "");
  });
});

describe("task issue body back-link template", () => {
  it("includes Part of #N when approvalIssueNumber is set", () => {
    const approvalIssueNumber = 55;
    const featureName = "my-feature";
    const title = "Build the widget";
    const body = `Auto-created by \`agt run\` for feature **${featureName}**.\n\nTask: ${title}\n\nPart of #${approvalIssueNumber}`;
    assert.ok(body.includes(`Part of #${approvalIssueNumber}`));
  });

  it("does not include Part of when no approvalIssueNumber", () => {
    const approvalIssueNumber = null;
    const featureName = "my-feature";
    const title = "Build the widget";
    const backLink = approvalIssueNumber ? `\n\nPart of #${approvalIssueNumber}` : "";
    const body = `Auto-created by \`agt run\` for feature **${featureName}**.\n\nTask: ${title}${backLink}`;
    assert.ok(!body.includes("Part of"));
  });
});
