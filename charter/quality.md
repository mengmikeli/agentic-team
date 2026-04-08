# Quality

## Before refactoring: snapshot first

Write tests that capture current behavior before changing code. These tests are the safety net. If the refactor changes behavior, the tests catch it.

## Machine gates

Every commit must pass:
- Type check / lint
- Test suite
- Build
- Route smoke test (Playwright) — every route renders content

No exceptions. Machine gates are a hard stop — broken builds block all work.

**Note:** Machine gates and QA findings operate at different levels. Machine gates are binary (pass/fail, no negotiation). QA findings are risk-triaged (P0 blocks ship, P1/P2 may not). A green build with a QA-found UX bug is normal. A broken build is never acceptable.

## QA agent

QA runs after implementation, before merge. QA tests against a preview deploy, not local dev. QA uses the standard report format (see `charter/roles.md`). QA reports are structured — per-item pass/fail with evidence.

QA cannot verify audio, touch, or subjective feel — those are human gates.

## Human testing

The operator tests on real devices. This catches:
- iOS audio quirks
- Bluetooth behavior
- Touch interaction feel
- Visual polish on actual screens
- Platform-specific bugs that headless browsers can't reproduce

## Rapid fix cycle

During QA, the coordinator fixes small issues directly (no subagent dispatch). The cycle is: operator reports bug → coordinator fixes → pushes → preview redeploys → operator verifies. Target: 2-5 minutes per fix.

## Definition of done

A single canonical checklist for every sprint:

- [ ] Code complete — all planned tasks implemented
- [ ] Tests pass — full suite, no skips
- [ ] Build passes — clean, no new warnings
- [ ] Spec updated — if implementation deviated, spec reflects reality
- [ ] QA pass — structured report with PASS verdict
- [ ] Operator approval — explicit signoff if user-facing
- [ ] Deploy verified — staging and production confirmed working
- [ ] Release tagged — version bump + release notes
- [ ] Retro written — what worked, what didn't, what to change
