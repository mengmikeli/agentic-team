// Tests for bin/lib/validator-parsers.mjs — JUnit XML and TAP parsers

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseJunitXml, parseTap, getParser } from "../bin/lib/validator-parsers.mjs";

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
});

describe("getParser", () => {
  it("returns junit-xml parser for 'junit-xml' format", () => {
    const parser = getParser("junit-xml");
    assert.equal(typeof parser, "function");
  });

  it("falls back to exit-code parser for unknown format", () => {
    const parser = getParser("unknown-format");
    assert.equal(typeof parser, "function");
    const result = parser("", "", 0);
    assert.equal(result.findings.critical, 0);
  });
});
