# Feature: Complete dashboard redesign and audit. The current IA is broken — global token data is under a per-project filter, which is misleading. Fix the entire information architecture:

1. SPLIT INTO TWO VIEWS with a tab bar at the top:
   - PROJECT view (default): project selector + features + timeline + task board + backlog. Everything here is project-scoped.
   - TOKENS view: global token usage from pew. This is cross-project data — total tokens, daily chart, model breakdown. No project filter here because pew doesn't track by project. Clear honest labeling.

2. PROJECT VIEW cleanup:
   - Hero: active feature or 'idle' with last completed
   - Stats row: 4 cards — features shipped, success rate, avg cycle time, total tasks
   - Feature timeline: compact cards sorted by recency, status badges, click to select in board
   - Task board: Kanban for selected/active feature, compact summary for completed features
   - Backlog: cards from PRODUCT.md roadmap + sprints/backlog/

3. TOKENS VIEW:
   - Hero stat cards: total tokens (input/output/cached/reasoning)
   - 7-day bar chart
   - Model breakdown with proportional bars
   - Source breakdown (by AI tool: claude-code, openclaw, etc.)
   - Label: 'All usage across all projects and tools · Last 7 days'

4. VISUAL AUDIT — fix all these issues:
   - Tab bar: clean, minimal, two tabs (Projects | Tokens)
   - Project selector: only shows in Projects tab
   - Mobile responsive: tabs stack properly, charts scale
   - Consistent spacing, no orphaned sections
   - Status dots/badges consistent colors
   - Dark theme polished (no harsh borders, proper surface hierarchy)
   - SSE live dot should be visible in both views

5. Remove the per-project token estimation hack — it was a bad idea. Tokens are global, period.

Test everything visually — render the HTML to stdout or a file and check the structure makes sense. Every section should have data or a clear empty state. No broken layouts.

## Goal
Complete dashboard redesign and audit. The current IA is broken — global token data is under a per-project filter, which is misleading. Fix the entire information architecture:

1. SPLIT INTO TWO VIEWS with a tab bar at the top:
   - PROJECT view (default): project selector + features + timeline + task board + backlog. Everything here is project-scoped.
   - TOKENS view: global token usage from pew. This is cross-project data — total tokens, daily chart, model breakdown. No project filter here because pew doesn't track by project. Clear honest labeling.

2. PROJECT VIEW cleanup:
   - Hero: active feature or 'idle' with last completed
   - Stats row: 4 cards — features shipped, success rate, avg cycle time, total tasks
   - Feature timeline: compact cards sorted by recency, status badges, click to select in board
   - Task board: Kanban for selected/active feature, compact summary for completed features
   - Backlog: cards from PRODUCT.md roadmap + sprints/backlog/

3. TOKENS VIEW:
   - Hero stat cards: total tokens (input/output/cached/reasoning)
   - 7-day bar chart
   - Model breakdown with proportional bars
   - Source breakdown (by AI tool: claude-code, openclaw, etc.)
   - Label: 'All usage across all projects and tools · Last 7 days'

4. VISUAL AUDIT — fix all these issues:
   - Tab bar: clean, minimal, two tabs (Projects | Tokens)
   - Project selector: only shows in Projects tab
   - Mobile responsive: tabs stack properly, charts scale
   - Consistent spacing, no orphaned sections
   - Status dots/badges consistent colors
   - Dark theme polished (no harsh borders, proper surface hierarchy)
   - SSE live dot should be visible in both views

5. Remove the per-project token estimation hack — it was a bad idea. Tokens are global, period.

Test everything visually — render the HTML to stdout or a file and check the structure makes sense. Every section should have data or a clear empty state. No broken layouts.

## Done when
- [ ] Complete dashboard redesign and audit. The current IA is broken — global token data is under a per-project filter, which is misleading. Fix the entire information architecture:

1. SPLIT INTO TWO VIEWS with a tab bar at the top:
   - PROJECT view (default): project selector + features + timeline + task board + backlog. Everything here is project-scoped.
   - TOKENS view: global token usage from pew. This is cross-project data — total tokens, daily chart, model breakdown. No project filter here because pew doesn't track by project. Clear honest labeling.

2. PROJECT VIEW cleanup:
   - Hero: active feature or 'idle' with last completed
   - Stats row: 4 cards — features shipped, success rate, avg cycle time, total tasks
   - Feature timeline: compact cards sorted by recency, status badges, click to select in board
   - Task board: Kanban for selected/active feature, compact summary for completed features
   - Backlog: cards from PRODUCT.md roadmap + sprints/backlog/

3. TOKENS VIEW:
   - Hero stat cards: total tokens (input/output/cached/reasoning)
   - 7-day bar chart
   - Model breakdown with proportional bars
   - Source breakdown (by AI tool: claude-code, openclaw, etc.)
   - Label: 'All usage across all projects and tools · Last 7 days'

4. VISUAL AUDIT — fix all these issues:
   - Tab bar: clean, minimal, two tabs (Projects | Tokens)
   - Project selector: only shows in Projects tab
   - Mobile responsive: tabs stack properly, charts scale
   - Consistent spacing, no orphaned sections
   - Status dots/badges consistent colors
   - Dark theme polished (no harsh borders, proper surface hierarchy)
   - SSE live dot should be visible in both views

5. Remove the per-project token estimation hack — it was a bad idea. Tokens are global, period.

Test everything visually — render the HTML to stdout or a file and check the structure makes sense. Every section should have data or a clear empty state. No broken layouts.
- [ ] Quality gate passes
