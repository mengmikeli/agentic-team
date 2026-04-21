# Feature: Impeccable design overhaul of the dashboard (dashboard/index.html, dashboard/app.js, dashboard/style.css). 

Current audit score: 10/20. Target: 16+/20.

The dashboard currently looks like every AI-generated GitHub-dark clone. Fix ALL of these:

1. STRIP AI SLOP:
- Remove gradient progress bars (lines 193, 241 in style.css) — use solid colors
- Remove glassmorphism nav (backdrop-filter blur line 47) — use solid surface color
- Remove the GitHub Primer color palette — design an original palette that feels like a CLI tool monitoring dashboard, not a social platform
- No rounded pill shapes on non-pill elements

2. TYPOGRAPHY:
- Replace system font stack with something intentional. This is a developer tool dashboard — use a monospace or technical font. JetBrains Mono for data/numbers, Inter or similar for labels. Import from Google Fonts or self-host.
- Establish clear type scale: stat values should be prominently large, labels should be small caps, section headers should be distinct from body text

3. RESPONSIVE/MOBILE:
- Nav must work on mobile: stack tab bar below brand, project selector full-width
- Stat cards: 2x2 grid on mobile, 4 across on desktop
- Token chart: scale SVG properly on small screens
- Touch targets: minimum 44px on all interactive elements
- Test at 320px, 375px, 768px, 1024px mentally and ensure no overflow

4. ACCESSIBILITY:
- Add ARIA roles: nav, main, tablist/tab/tabpanel for the two views
- Add focus-visible styles on all interactive elements
- Keyboard navigation for tabs (arrow keys)
- Screen reader labels for stat cards and charts
- Color contrast: verify all text meets 4.5:1 against backgrounds

5. VISUAL IDENTITY:
- This is a CLI tool dashboard for autonomous agent teams. It should feel like a terminal/ops dashboard — clean, data-dense, no decoration for decoration's sake
- Inspiration: Grafana dark theme, Datadog, railway.app dashboard — functional, not pretty
- Color palette: muted with one accent color for active states. No rainbow.
- Borders should be subtle (1px, low contrast), not GitHub-heavy

6. INFORMATION DENSITY:
- The current layout wastes vertical space with large padding
- Stat cards should be compact — value + label, no decorative borders
- Timeline cards should be denser — more features visible without scrolling
- Board columns should show task count prominently

Do NOT change the data model, API endpoints, or JavaScript logic beyond rendering. This is a CSS/HTML/template audit and fix. All 347 tests must pass.

## Goal
Impeccable design overhaul of the dashboard (dashboard/index.html, dashboard/app.js, dashboard/style.css). 

Current audit score: 10/20. Target: 16+/20.

The dashboard currently looks like every AI-generated GitHub-dark clone. Fix ALL of these:

1. STRIP AI SLOP:
- Remove gradient progress bars (lines 193, 241 in style.css) — use solid colors
- Remove glassmorphism nav (backdrop-filter blur line 47) — use solid surface color
- Remove the GitHub Primer color palette — design an original palette that feels like a CLI tool monitoring dashboard, not a social platform
- No rounded pill shapes on non-pill elements

2. TYPOGRAPHY:
- Replace system font stack with something intentional. This is a developer tool dashboard — use a monospace or technical font. JetBrains Mono for data/numbers, Inter or similar for labels. Import from Google Fonts or self-host.
- Establish clear type scale: stat values should be prominently large, labels should be small caps, section headers should be distinct from body text

3. RESPONSIVE/MOBILE:
- Nav must work on mobile: stack tab bar below brand, project selector full-width
- Stat cards: 2x2 grid on mobile, 4 across on desktop
- Token chart: scale SVG properly on small screens
- Touch targets: minimum 44px on all interactive elements
- Test at 320px, 375px, 768px, 1024px mentally and ensure no overflow

4. ACCESSIBILITY:
- Add ARIA roles: nav, main, tablist/tab/tabpanel for the two views
- Add focus-visible styles on all interactive elements
- Keyboard navigation for tabs (arrow keys)
- Screen reader labels for stat cards and charts
- Color contrast: verify all text meets 4.5:1 against backgrounds

5. VISUAL IDENTITY:
- This is a CLI tool dashboard for autonomous agent teams. It should feel like a terminal/ops dashboard — clean, data-dense, no decoration for decoration's sake
- Inspiration: Grafana dark theme, Datadog, railway.app dashboard — functional, not pretty
- Color palette: muted with one accent color for active states. No rainbow.
- Borders should be subtle (1px, low contrast), not GitHub-heavy

6. INFORMATION DENSITY:
- The current layout wastes vertical space with large padding
- Stat cards should be compact — value + label, no decorative borders
- Timeline cards should be denser — more features visible without scrolling
- Board columns should show task count prominently

Do NOT change the data model, API endpoints, or JavaScript logic beyond rendering. This is a CSS/HTML/template audit and fix. All 347 tests must pass.

## Done when
- [ ] Impeccable design overhaul of the dashboard (dashboard/index.html, dashboard/app.js, dashboard/style.css). 

Current audit score: 10/20. Target: 16+/20.

The dashboard currently looks like every AI-generated GitHub-dark clone. Fix ALL of these:

1. STRIP AI SLOP:
- Remove gradient progress bars (lines 193, 241 in style.css) — use solid colors
- Remove glassmorphism nav (backdrop-filter blur line 47) — use solid surface color
- Remove the GitHub Primer color palette — design an original palette that feels like a CLI tool monitoring dashboard, not a social platform
- No rounded pill shapes on non-pill elements

2. TYPOGRAPHY:
- Replace system font stack with something intentional. This is a developer tool dashboard — use a monospace or technical font. JetBrains Mono for data/numbers, Inter or similar for labels. Import from Google Fonts or self-host.
- Establish clear type scale: stat values should be prominently large, labels should be small caps, section headers should be distinct from body text

3. RESPONSIVE/MOBILE:
- Nav must work on mobile: stack tab bar below brand, project selector full-width
- Stat cards: 2x2 grid on mobile, 4 across on desktop
- Token chart: scale SVG properly on small screens
- Touch targets: minimum 44px on all interactive elements
- Test at 320px, 375px, 768px, 1024px mentally and ensure no overflow

4. ACCESSIBILITY:
- Add ARIA roles: nav, main, tablist/tab/tabpanel for the two views
- Add focus-visible styles on all interactive elements
- Keyboard navigation for tabs (arrow keys)
- Screen reader labels for stat cards and charts
- Color contrast: verify all text meets 4.5:1 against backgrounds

5. VISUAL IDENTITY:
- This is a CLI tool dashboard for autonomous agent teams. It should feel like a terminal/ops dashboard — clean, data-dense, no decoration for decoration's sake
- Inspiration: Grafana dark theme, Datadog, railway.app dashboard — functional, not pretty
- Color palette: muted with one accent color for active states. No rainbow.
- Borders should be subtle (1px, low contrast), not GitHub-heavy

6. INFORMATION DENSITY:
- The current layout wastes vertical space with large padding
- Stat cards should be compact — value + label, no decorative borders
- Timeline cards should be denser — more features visible without scrolling
- Board columns should show task count prominently

Do NOT change the data model, API endpoints, or JavaScript logic beyond rendering. This is a CSS/HTML/template audit and fix. All 347 tests must pass.
- [ ] Quality gate passes
