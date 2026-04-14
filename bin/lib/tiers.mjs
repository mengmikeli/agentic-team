// Quality tiers — concrete checklists for functional, polished, delightful.
// Auto-selected from task description or --tier flag.
// Tier baseline injected into builder AND reviewer briefs.

// ── Tier Definitions ────────────────────────────────────────────

export const TIERS = {
  functional: {
    name: "functional",
    label: "Functional — correctness only",
    description: "The product works correctly. No craft requirements beyond correctness.",
    appropriate: "CLI tools, backend APIs, internal scripts, libraries, infrastructure.",
    baseline: [],
  },

  polished: {
    name: "polished",
    label: "Polished — professional craft",
    description: "The product looks and feels professional. A user encountering it would not think 'this is a prototype.'",
    appropriate: "SaaS products, public-facing websites, SDK documentation sites, developer tools with UI.",
    baseline: [
      { key: "typography", text: "Intentional font stack (not system defaults). Heading/body/mono hierarchy." },
      { key: "color-scheme", text: "Dark/light theme support (respects prefers-color-scheme at minimum)." },
      { key: "navigation", text: "Persistent, structured navigation with active state indicator." },
      { key: "responsive", text: "Tested at 320px, 768px, 1024px, 1440px. No horizontal scroll." },
      { key: "code-blocks", text: "Syntax-highlighted with theme-consistent colors. Copy button." },
      { key: "tables", text: "Styled rows (striped or bordered), hover effect, proper cell padding." },
      { key: "loading-states", text: "Loading states for every async operation (skeleton or spinner)." },
      { key: "error-states", text: "Error states with recovery action (not just 'something went wrong')." },
      { key: "empty-states", text: "Empty states with guidance (not blank screens)." },
      { key: "favicon-meta", text: "Favicon and meta tags (title, description, og:image)." },
      { key: "focus-styles", text: "Focus-visible styles for keyboard navigation." },
      { key: "page-titles", text: "Page title updates on navigation." },
      { key: "smooth-scroll", text: "Smooth scroll behavior." },
    ],
  },

  delightful: {
    name: "delightful",
    label: "Delightful — memorable experience",
    description: "The product creates a memorable experience. Users would share it or comment on the quality.",
    appropriate: "Consumer-facing products, pitch demos, showcase/portfolio pieces, landing pages.",
    baseline: [
      // Includes everything from polished
      { key: "typography", text: "Intentional font stack with 2+ distinct typefaces. Web fonts with font-display: swap." },
      { key: "color-scheme", text: "Dark/light theme with toggle. Colors as CSS custom properties." },
      { key: "navigation", text: "Persistent navigation with active state. Collapsible on mobile." },
      { key: "responsive", text: "Mobile-first breakpoints at 320px, 768px, 1024px, 1440px." },
      { key: "code-blocks", text: "Syntax-highlighted, theme-consistent, copy button, horizontal scroll." },
      { key: "tables", text: "Styled rows, hover effect, cell padding, horizontal scroll on mobile." },
      { key: "loading-states", text: "Skeleton or spinner for every async operation." },
      { key: "error-states", text: "Error states with recovery action." },
      { key: "empty-states", text: "Empty states with guidance." },
      { key: "favicon-meta", text: "Favicon and meta tags." },
      { key: "focus-styles", text: "Focus-visible styles for keyboard navigation." },
      { key: "page-titles", text: "Page title updates on navigation." },
      { key: "smooth-scroll", text: "Smooth scroll behavior." },
      // Delightful extras
      { key: "page-transitions", text: "Smooth page/view transitions (fade, slide, or cross-fade)." },
      { key: "animated-nav", text: "Animated sidebar/navigation (collapse/expand with easing)." },
      { key: "micro-interactions", text: "Micro-interactions on user actions (button feedback, hover effects)." },
      { key: "onboarding", text: "Onboarding or first-run experience (guided tour, progressive disclosure)." },
      { key: "custom-visuals", text: "Custom illustrations or branded visual elements." },
      { key: "performance", text: "Performance budget: LCP < 2.5s, CLS < 0.1, INP < 200ms." },
      { key: "404-page", text: "404 page that's on-brand." },
    ],
  },
};

// ── Tier Selection ──────────────────────────────────────────────

// Keywords for auto-detecting tier from task description
const FUNCTIONAL_KEYWORDS = [
  "cli", "api", "backend", "library", "lib", "infrastructure", "infra",
  "script", "pipeline", "migration", "database", "config", "devops",
  "harness", "tooling", "internal",
];

const DELIGHTFUL_KEYWORDS = [
  "showcase", "demo", "pitch", "delightful", "beautiful", "impressive",
  "wow", "landing page", "portfolio", "consumer",
];

const POLISHED_KEYWORDS = [
  "ui", "frontend", "website", "dashboard", "docs", "documentation",
  "app", "web app", "interface", "design",
];

/**
 * Select quality tier from explicit flag or task description.
 * @param {string|null} tierFlag - Explicit --tier value
 * @param {string} description - Task/feature description
 * @returns {object} Tier definition from TIERS
 */
export function selectTier(tierFlag, description) {
  // 1. Explicit override
  if (tierFlag && TIERS[tierFlag]) {
    return TIERS[tierFlag];
  }

  // 2. Auto-detect from description
  const desc = (description || "").toLowerCase();

  if (DELIGHTFUL_KEYWORDS.some(kw => desc.includes(kw))) {
    return TIERS.delightful;
  }
  if (FUNCTIONAL_KEYWORDS.some(kw => desc.includes(kw))) {
    return TIERS.functional;
  }
  if (POLISHED_KEYWORDS.some(kw => desc.includes(kw))) {
    return TIERS.polished;
  }

  // 3. Default: functional for ambiguous
  return TIERS.functional;
}

/**
 * Format tier baseline as markdown for injection into briefs.
 * @param {object} tier - Tier definition
 * @returns {string} Markdown checklist
 */
export function formatTierBaseline(tier) {
  if (!tier || !tier.baseline || tier.baseline.length === 0) {
    return `## Quality Tier: ${tier?.name || "functional"}\nNo baseline checklist — correctness only.`;
  }

  const items = tier.baseline.map(item => `- [ ] **${item.key}** — ${item.text}`).join("\n");

  return `## Quality Tier: ${tier.name}

${tier.description}

### Baseline Checklist (${tier.baseline.length} items)
Every item is a requirement, not a nice-to-have.

${items}

### For Builders
Address baseline items during the first pass alongside functional requirements.
The evaluator will score missing baseline items as warnings or criticals.

### For Reviewers
Verify each baseline item with evidence. Missing items at this tier:
${tier.name === "polished" ? "- Missing item → 🟡 Warning" : tier.name === "delightful" ? "- Missing item → 🔴 Critical" : "- N/A"}`;
}

/**
 * Get the severity for a missing baseline item at a given tier.
 * @param {string} tierName - Tier name
 * @param {string} key - Baseline item key
 * @returns {"critical"|"warning"|"suggestion"|null}
 */
export function getMissingSeverity(tierName, key) {
  if (tierName === "functional") return null;

  // Polished tier: most items are warnings, some are critical
  const criticalAtPolished = ["navigation", "responsive"];
  if (tierName === "polished") {
    return criticalAtPolished.includes(key) ? "critical" : "warning";
  }

  // Delightful tier: everything is critical
  if (tierName === "delightful") {
    return "critical";
  }

  return null;
}
