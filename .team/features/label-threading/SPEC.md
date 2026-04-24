# Feature: Label Threading

## Goal
The outer loop computes the roadmap position label (`[P#/#N]`) when prioritizing a feature and passes it to `runSingleFeature`, so GitHub issues and CLI banners consistently show the feature's roadmap position.

## Requirements
- The outer loop must extract the roadmap position label (`P3/#12` format) for the selected feature during the PRIORITIZE step, derived from its phase header and numbered position in PRODUCT.md.
- The label must be passed as an explicit argument from `outerLoop` → `runSingleFeature` (i.e., `_runSingleFeature`), not re-derived independently inside the inner loop.
- The approval issue title must include the label: `[P3/#12] [Feature] feature-name`.
- The inner loop CLI banner must display the label: `Feature:  [P3/#12] feature-name — description`.
- GitHub task issues created by the inner loop must include the label in their titles: `[P3/#12] [feature-name] Task title`.
- The feature completion banner must include the label: `Feature complete: [P3/#12] feature-name`.
- If no phase header applies to the item, label format is `#N` (no `P` prefix).

## Acceptance Criteria
- [ ] `parseRoadmap()` returns the roadmap position label (`P#/#N` or `#N`) alongside each item's name and description.
- [ ] `outerLoop` passes the label to `runSingleFeature` when dispatching a feature for execution.
- [ ] `createApprovalIssue` includes the label in the GitHub issue title.
- [ ] `_runSingleFeature` accepts a label parameter and does not re-derive it by parsing PRODUCT.md internally.
- [ ] Inner loop CLI startup banner shows `[P3/#12]` prefix on the Feature line.
- [ ] GitHub task issues created during execution include the label in the title.
- [ ] Feature completion banner shows `[P3/#12]` prefix.
- [ ] If the feature is run standalone (`agt run` without outer loop), no label is shown (label is optional/undefined).

## Technical Approach

**`bin/lib/outer-loop.mjs`**
- `parseRoadmap()` (line ~511): extend the returned objects to include a `label` field (`"P3/#12"` or `"#N"`). Phase is derived from the nearest preceding `### Phase N` header; item number is the 1-based ordinal across all roadmap items.
- Prioritization step: when the selected feature is resolved back to its roadmap entry, extract the `label` from the parsed roadmap item.
- `createApprovalIssue()` (~line 122): accept `featureLabel` param, prepend `[featureLabel] ` to the issue title.
- Outer loop dispatch (~line 775): change the call from `runSingleFeature(args, priorityDescription)` to `runSingleFeature(args, priorityDescription, featureLabel)`.

**`bin/lib/run.mjs`**
- `_runSingleFeature(args, description, featureLabel?)` (~line 688): add optional third param `featureLabel`.
- Remove any internal roadmap re-parsing for label derivation (lines ~740-768) — label now comes from the caller.
- CLI startup banner (~line 785): already conditionally renders `featureLabel`; no change needed if param is wired correctly.
- Task issue creation (~line 888): already conditionally prepends `featureLabel`; no change needed if param is wired.
- Completion banner (~line 1347): already conditionally renders `featureLabel`; no change needed if param is wired.

The changes are additive — existing `agt run` invocations that don't pass a label continue to work with no label shown.

## Testing Strategy
- **Unit tests** for `parseRoadmap()`: verify `label` field on returned items for items inside a phase, before any phase header, and at phase boundaries.
- **Unit test** for `createApprovalIssue()`: verify issue title includes label when provided, and omits it when absent.
- **Integration test** for outer-loop dispatch: mock `runSingleFeature` and assert it receives the correct label derived from the roadmap.
- **Snapshot / CLI output test**: run `_runSingleFeature` with a label and verify the startup banner and completion banner strings include `[P3/#12]`.
- **GitHub issue title test**: assert task issue titles include the label prefix when a label is passed.
- Manual verification: run `agt dogfood` on a roadmap item in Phase 3 and confirm GitHub issue titles and CLI output show `[P3/#N]`.

## Out of Scope
- Changing the label format (e.g., adding item names or descriptions to the label).
- Rendering the label in the dashboard UI (separate feature: Dashboard token breakdown / active task indicator).
- Persisting the label to STATE.json or approval sidecar (not needed for display).
- Changing how `agt run` is invoked directly by users (label is only injected by the outer loop).
- Retroactively updating existing GitHub issues with labels.

## Done When
- [ ] `parseRoadmap()` returns a `label` field on each roadmap item.
- [ ] `outerLoop` passes the label to `runSingleFeature` at the dispatch call site.
- [ ] Approval issue titles on GitHub include the roadmap label.
- [ ] Inner loop CLI banners (startup and completion) show the label when provided.
- [ ] Task issue titles on GitHub include the label when provided.
- [ ] All existing tests pass.
- [ ] New unit tests for label extraction and threading pass.
