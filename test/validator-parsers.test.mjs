// Tests for bin/lib/validator-parsers.mjs — JUnit XML and TAP parsers

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseJunitXml, parseTap, parseGithubActions, getParser } from "../bin/lib/validator-parsers.mjs";

describe("parseJunitXml", () => {
  it("produces one critical finding from one <failure> element", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="com.example.MyTest" tests="1" failures="1" errors="0">
  <testcase classname="com.example.MyTest" name="testFailure" file="src/MyTest.java" line="42">
    <failure message="Expected 1 but was 2" type="AssertionError">
      Expected :1
      Actual   :2
    </failure>
  </testcase>
</testsuite>`;

    const result = parseJunitXml(xml, "", 0);
    assert.equal(result.findings.critical, 1, "should have 1 critical finding");
    assert.equal(result.findings.warning, 0);
    assert.equal(result.findings.suggestion, 0);
    assert.equal(result.meta.messages.length, 1);
    assert.equal(
      result.meta.messages[0],
      "src/MyTest.java:42 — com.example.MyTest: Expected 1 but was 2"
    );
  });

  it("produces zero findings for a passing test suite", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="com.example.MyTest" tests="1" failures="0" errors="0">
  <testcase classname="com.example.MyTest" name="testSuccess" time="0.05"/>
</testsuite>`;

    const result = parseJunitXml(xml, "", 0);
    assert.equal(result.findings.critical, 0);
    assert.equal(result.meta.messages.length, 0);
  });

  it("produces multiple critical findings for multiple failures", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="MyTest" tests="2" failures="2" errors="0">
  <testcase classname="MyTest" name="testA" file="src/A.java" line="10">
    <failure message="fail A" type="AssertionError"/>
  </testcase>
  <testcase classname="MyTest" name="testB" file="src/B.java" line="20">
    <failure message="fail B" type="AssertionError"/>
  </testcase>
</testsuite>`;

    const result = parseJunitXml(xml, "", 0);
    assert.equal(result.findings.critical, 2);
    assert.equal(result.meta.messages[0], "src/A.java:10 — MyTest: fail A");
    assert.equal(result.meta.messages[1], "src/B.java:20 — MyTest: fail B");
  });

  it("falls back to classname when file/line are absent", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="MyTest" tests="1" failures="1" errors="0">
  <testcase classname="com.example.FooTest" name="testX">
    <failure message="something broke" type="RuntimeError"/>
  </testcase>
</testsuite>`;

    const result = parseJunitXml(xml, "", 0);
    assert.equal(result.findings.critical, 1);
    assert.ok(result.meta.messages[0].includes("com.example.FooTest"));
    assert.ok(result.meta.messages[0].includes("something broke"));
  });

  it("produces one critical finding from one <error> element", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="com.example.MyTest" tests="1" failures="0" errors="1">
  <testcase classname="com.example.MyTest" name="testCrash" file="src/MyTest.java" line="7">
    <error message="NullPointerException" type="java.lang.NullPointerException"/>
  </testcase>
</testsuite>`;

    const result = parseJunitXml(xml, "", 0);
    assert.equal(result.findings.critical, 1, "should have 1 critical finding for <error>");
    assert.equal(result.meta.messages.length, 1);
    assert.equal(
      result.meta.messages[0],
      "src/MyTest.java:7 — com.example.MyTest: NullPointerException"
    );
  });

  it("returns zero findings on malformed input (fault-tolerant)", () => {
    const result = parseJunitXml("not xml at all", "", 0);
    assert.equal(result.findings.critical, 0);
    assert.equal(result.meta.messages.length, 0);
  });
});

describe("parseTap", () => {
  it("produces one critical finding from one not ok line", () => {
    const tap = `TAP version 13
1..1
not ok 1 - should pass but did not`;

    const result = parseTap(tap, "", 1);
    assert.equal(result.findings.critical, 1, "should have 1 critical finding");
    assert.equal(result.findings.warning, 0);
    assert.equal(result.findings.suggestion, 0);
    assert.equal(result.meta.messages.length, 1);
    assert.ok(result.meta.messages[0].startsWith("not ok 1"));
  });

  it("produces zero findings for all ok lines", () => {
    const tap = `TAP version 13
1..2
ok 1 - first test
ok 2 - second test`;

    const result = parseTap(tap, "", 0);
    assert.equal(result.findings.critical, 0);
    assert.equal(result.meta.messages.length, 0);
  });

  it("produces multiple critical findings for multiple not ok lines", () => {
    const tap = `TAP version 13
1..3
not ok 1 - first failure
ok 2 - passing
not ok 3 - second failure`;

    const result = parseTap(tap, "", 1);
    assert.equal(result.findings.critical, 2);
    assert.equal(result.meta.messages.length, 2);
  });

  it("does not count # TODO lines as critical findings", () => {
    const tap = `TAP version 13
1..2
not ok 1 - known issue # TODO fix later
ok 2 - passing`;

    const result = parseTap(tap, "", 0);
    assert.equal(result.findings.critical, 0);
  });

  it("does not count # SKIP lines as critical findings", () => {
    const tap = `TAP version 13
1..2
not ok 1 - skipped test # SKIP not implemented yet
ok 2 - passing`;

    const result = parseTap(tap, "", 0);
    assert.equal(result.findings.critical, 0);
  });

  it("counts only top-level not ok lines, ignoring indented subtest lines", () => {
    // Node.js --test-reporter tap produces indented `not ok` for subtests.
    // One failing subtest should yield exactly one critical finding (the parent).
    const tap = `TAP version 13
1..1
not ok 1 - parent test
    not ok 1 - child subtest that failed`;

    const result = parseTap(tap, "", 1);
    assert.equal(result.findings.critical, 1, "indented subtest not ok must not be double-counted");
  });
});

describe("getParser", () => {
  it("returns junit-xml parser for 'junit-xml' format", () => {
    const parser = getParser("junit-xml");
    assert.equal(typeof parser, "function");
  });

  it("returns github-actions parser for 'github-actions' format", () => {
    const parser = getParser("github-actions");
    assert.equal(typeof parser, "function");
    // Round-trip: registry wire-up verified by invoking with real input
    const result = parser("::error file=src/foo.js,line=5::msg", "", 1);
    assert.equal(result.findings.critical, 1);
  });

  it("falls back to exit-code parser for unknown format", () => {
    const parser = getParser("unknown-format");
    assert.equal(typeof parser, "function");
    const result = parser("", "", 0);
    assert.equal(result.findings.critical, 0);
  });
});

describe("parseGithubActions", () => {
  it("produces one critical finding from one ::error line", () => {
    const stdout = "::error file=src/foo.js,line=5::something went wrong";

    const result = parseGithubActions(stdout, "", 0);
    assert.equal(result.findings.critical, 1, "should have 1 critical finding");
    assert.equal(result.findings.warning, 0);
    assert.equal(result.findings.suggestion, 0);
    assert.equal(result.meta.messages.length, 1);
    assert.equal(result.meta.messages[0], "src/foo.js:5 — something went wrong");
  });

  it("produces zero findings for output with no workflow commands", () => {
    const stdout = "Build succeeded\nAll tests passed\n";

    const result = parseGithubActions(stdout, "", 0);
    assert.equal(result.findings.critical, 0);
    assert.equal(result.findings.warning, 0);
    assert.equal(result.meta.messages.length, 0);
  });

  it("produces multiple critical findings for multiple ::error lines", () => {
    const stdout = [
      "::error file=src/a.js,line=1::error one",
      "::error file=src/b.js,line=2::error two",
    ].join('\n');

    const result = parseGithubActions(stdout, "", 1);
    assert.equal(result.findings.critical, 2);
    assert.equal(result.meta.messages[0], "src/a.js:1 — error one");
    assert.equal(result.meta.messages[1], "src/b.js:2 — error two");
  });

  it("produces one warning finding from one ::warning line", () => {
    const stdout = "::warning file=src/foo.js,line=10::deprecated usage";

    const result = parseGithubActions(stdout, "", 0);
    assert.equal(result.findings.critical, 0);
    assert.equal(result.findings.warning, 1);
    assert.equal(result.meta.messages[0], "src/foo.js:10 — deprecated usage");
  });

  it("produces one suggestion finding from one ::notice line", () => {
    const stdout = "::notice file=src/foo.js,line=3::consider refactoring";

    const result = parseGithubActions(stdout, "", 0);
    assert.equal(result.findings.critical, 0);
    assert.equal(result.findings.warning, 0);
    assert.equal(result.findings.suggestion, 1);
  });

  it("handles ::error without file/line properties", () => {
    const stdout = "::error::build failed with no location";

    const result = parseGithubActions(stdout, "", 1);
    assert.equal(result.findings.critical, 1);
    assert.equal(result.meta.messages[0], "build failed with no location");
  });

  it("parses ::error commands from stderr as well", () => {
    const result = parseGithubActions("", "::error file=src/foo.js,line=5::from stderr", 1);
    assert.equal(result.findings.critical, 1);
  });

  it("returns zero findings on empty input (fault-tolerant)", () => {
    const result = parseGithubActions("", "", 0);
    assert.equal(result.findings.critical, 0);
    assert.equal(result.meta.messages.length, 0);
  });

  it("produces one critical finding when a property value contains a colon (e.g. title=TypeError: x)", () => {
    const stdout = "::error title=TypeError: x,file=src/foo.js,line=5::something went wrong";

    const result = parseGithubActions(stdout, "", 1);
    assert.equal(result.findings.critical, 1, "colon in property value must not prevent matching");
    assert.equal(result.meta.messages[0], "src/foo.js:5 — something went wrong");
  });

  it("strips control characters from messages before storing", () => {
    const stdout = "::error file=src/foo.js,line=5::evil\x1b[2J message";

    const result = parseGithubActions(stdout, "", 1);
    assert.equal(result.findings.critical, 1);
    // No control chars (bytes < 0x20) should appear in the stored message
    assert.ok(!/[\x00-\x1f]/.test(result.meta.messages[0]),
      "message must not contain control characters");
  });
});
