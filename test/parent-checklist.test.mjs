// Tests for parent issue ## Tasks checklist logic in bin/lib/github.mjs
// Uses Node.js built-in test runner (node --test)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTasksChecklist, buildTaskIssueBody, tickChecklistItem, markChecklistItemBlocked } from "../bin/lib/github.mjs";

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

describe("tickChecklistItem", () => {
  it("replaces - [ ] with - [x] for the matching title and issue number", () => {
    const body = "## Tasks\n- [ ] Build the widget (#42)\n- [ ] Write tests (#43)";
    const result = tickChecklistItem(body, "Build the widget", 42);
    assert.ok(result.includes("- [x] Build the widget (#42)"));
    assert.ok(result.includes("- [ ] Write tests (#43)"));
  });

  it("leaves body unchanged when title not found", () => {
    const body = "## Tasks\n- [ ] Build the widget (#42)";
    const result = tickChecklistItem(body, "Other task", 42);
    assert.equal(result, body);
  });

  it("leaves body unchanged when issue number does not match", () => {
    const body = "## Tasks\n- [ ] Build the widget (#42)";
    const result = tickChecklistItem(body, "Build the widget", 99);
    assert.equal(result, body);
  });

  it("returns body unchanged when already checked", () => {
    const body = "## Tasks\n- [x] Build the widget (#42)";
    const result = tickChecklistItem(body, "Build the widget", 42);
    assert.equal(result, body);
  });

  it("returns body unchanged when body is falsy", () => {
    assert.equal(tickChecklistItem(null, "Title", 1), null);
    assert.equal(tickChecklistItem("", "Title", 1), "");
  });

  it("returns body unchanged when title or issueNumber is falsy", () => {
    const body = "- [ ] Task (#1)";
    assert.equal(tickChecklistItem(body, null, 1), body);
    assert.equal(tickChecklistItem(body, "Task", null), body);
  });
});

describe("markChecklistItemBlocked", () => {
  it("replaces - [ ] title with strikethrough and blocked marker", () => {
    const body = "## Tasks\n- [ ] Build the widget (#42)\n- [ ] Write tests (#43)";
    const result = markChecklistItemBlocked(body, "Build the widget", 42);
    assert.ok(result.includes("- [ ] ~~Build the widget~~ (#42) ⚠️ blocked"));
    assert.ok(result.includes("- [ ] Write tests (#43)"));
  });

  it("leaves body unchanged when title not found", () => {
    const body = "## Tasks\n- [ ] Build the widget (#42)";
    const result = markChecklistItemBlocked(body, "Other task", 42);
    assert.equal(result, body);
  });

  it("leaves body unchanged when issue number does not match", () => {
    const body = "## Tasks\n- [ ] Build the widget (#42)";
    const result = markChecklistItemBlocked(body, "Build the widget", 99);
    assert.equal(result, body);
  });

  it("does not modify an already-ticked item", () => {
    const body = "## Tasks\n- [x] Build the widget (#42)";
    const result = markChecklistItemBlocked(body, "Build the widget", 42);
    assert.equal(result, body);
  });

  it("returns body unchanged when body is falsy", () => {
    assert.equal(markChecklistItemBlocked(null, "Title", 1), null);
    assert.equal(markChecklistItemBlocked("", "Title", 1), "");
  });

  it("returns body unchanged when title or issueNumber is falsy", () => {
    const body = "- [ ] Task (#1)";
    assert.equal(markChecklistItemBlocked(body, null, 1), body);
    assert.equal(markChecklistItemBlocked(body, "Task", null), body);
  });
});

describe("buildTaskIssueBody", () => {
  it("includes Part of #N when approvalIssueNumber is a positive integer", () => {
    const body = buildTaskIssueBody("my-feature", "", "Build the widget", 55);
    assert.ok(body.includes("Part of #55"));
  });

  it("does not include Part of when approvalIssueNumber is null", () => {
    const body = buildTaskIssueBody("my-feature", "", "Build the widget", null);
    assert.ok(!body.includes("Part of"));
  });

  it("does not include Part of when approvalIssueNumber is 0", () => {
    const body = buildTaskIssueBody("my-feature", "", "Build the widget", 0);
    assert.ok(!body.includes("Part of"));
  });

  it("does not include Part of when approvalIssueNumber is a non-integer string", () => {
    const body = buildTaskIssueBody("my-feature", "", "Build the widget", "55\n\n**evil**");
    assert.ok(!body.includes("Part of"));
  });

  it("includes feature name and task title in body", () => {
    const body = buildTaskIssueBody("my-feature", "", "Build the widget", null);
    assert.ok(body.includes("my-feature"));
    assert.ok(body.includes("Build the widget"));
  });

  it("includes feature label in body when provided", () => {
    const body = buildTaskIssueBody("my-feature", "v2", "Build the widget", 10);
    assert.ok(body.includes("[v2]"));
    assert.ok(body.includes("Part of #10"));
  });
});
