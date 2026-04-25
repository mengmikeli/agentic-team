// Single source of truth for the seven required PRD/SPEC sections.
// All spec-related code paths (validation, prompt templates, minimal-spec
// generators, brainstorm output) MUST import PRD_SECTIONS from this module
// instead of redefining the list locally.

export const PRD_SECTIONS = Object.freeze([
  "Goal",
  "Requirements",
  "Acceptance Criteria",
  "Technical Approach",
  "Testing Strategy",
  "Out of Scope",
  "Done When",
]);
