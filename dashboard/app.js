// agentic-team dashboard — app.js
// No framework. Reads .team/ data via /api/ or uses demo data.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const app = $("#app");

// ── State ──
let features = [];
let currentPage = "overview";

// ── Demo data (used when no API available) ──
const DEMO_FEATURES = [
  {
    name: "auth-system",
    state: {
      version: "2.0",
      feature: "auth-system",
      status: "completed",
      tasks: [
        { id: "setup-db", status: "passed", description: "Set up database schema" },
        { id: "auth-api", status: "passed", description: "Implement auth endpoints" },
        { id: "jwt-tokens", status: "passed", description: "JWT token management" },
        { id: "tests", status: "passed", description: "Integration tests" },
      ],
      gates: [
        { verdict: "PASS", command: "npm test", timestamp: "2025-04-10T10:00:00Z" },
        { verdict: "PASS", command: "npm test", timestamp: "2025-04-10T14:00:00Z" },
      ],
      transitionCount: 8,
      createdAt: "2025-04-10T08:00:00Z",
      completedAt: "2025-04-10T16:00:00Z",
      _last_modified: "2025-04-10T16:00:00Z",
    },
  },
  {
    name: "dashboard-ui",
    state: {
      version: "2.0",
      feature: "dashboard-ui",
      status: "active",
      tasks: [
        { id: "layout", status: "passed", description: "Create page layout" },
        { id: "charts", status: "in-progress", description: "Add metrics charts" },
        { id: "real-time", status: "pending", description: "Real-time updates" },
        { id: "responsive", status: "pending", description: "Mobile responsive" },
      ],
      gates: [
        { verdict: "PASS", command: "npm test", timestamp: "2025-04-12T10:00:00Z" },
        { verdict: "FAIL", command: "npm run lint", timestamp: "2025-04-12T11:00:00Z" },
        { verdict: "PASS", command: "npm run lint", timestamp: "2025-04-12T12:00:00Z" },
      ],
      transitionCount: 5,
      createdAt: "2025-04-12T08:00:00Z",
      _last_modified: "2025-04-14T09:00:00Z",
    },
  },
  {
    name: "api-rate-limiting",
    state: {
      version: "2.0",
      feature: "api-rate-limiting",
      status: "active",
      tasks: [
        { id: "middleware", status: "in-progress", description: "Rate limit middleware" },
        { id: "redis-store", status: "blocked", description: "Redis token bucket", lastReason: "Redis not configured" },
        { id: "tests", status: "pending", description: "Load tests" },
      ],
      gates: [
        { verdict: "FAIL", command: "npm test", timestamp: "2025-04-13T15:00:00Z" },
      ],
      transitionCount: 3,
      createdAt: "2025-04-13T10:00:00Z",
      _last_modified: "2025-04-13T16:00:00Z",
    },
  },
];

// ── Data loading ──
async function loadData() {
  try {
    const res = await fetch("/api/features");
    if (res.ok) {
      features = await res.json();
      if (features.length === 0) features = DEMO_FEATURES;
    } else {
      features = DEMO_FEATURES;
    }
  } catch {
    features = DEMO_FEATURES;
  }
  render();
}

// ── Navigation ──
$$(".nav-links a").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    $$(".nav-links a").forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
    currentPage = link.dataset.page;
    render();
  });
});

// ── Render ──
function render() {
  switch (currentPage) {
    case "overview":  renderOverview();  break;
    case "timeline":  renderTimeline();  break;
    case "board":     renderBoard();     break;
    case "metrics":   renderMetrics();   break;
  }
}

// ── Overview ──
function renderOverview() {
  const totalFeatures = features.length;
  const active = features.filter((f) => f.state?.status === "active").length;
  const completed = features.filter((f) => f.state?.status === "completed").length;
  const totalTasks = features.reduce((s, f) => s + (f.state?.tasks?.length || 0), 0);
  const passedTasks = features.reduce(
    (s, f) => s + (f.state?.tasks?.filter((t) => t.status === "passed").length || 0), 0
  );
  const totalGates = features.reduce((s, f) => s + (f.state?.gates?.length || 0), 0);
  const passedGates = features.reduce(
    (s, f) => s + (f.state?.gates?.filter((g) => g.verdict === "PASS").length || 0), 0
  );

  app.innerHTML = `
    <h2 class="section-header">Overview</h2>
    <div class="cards">
      <div class="card">
        <div class="card-header"><span class="card-title">Features</span></div>
        <div class="card-value">${totalFeatures}</div>
        <div class="card-label">${active} active · ${completed} completed</div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Tasks</span></div>
        <div class="card-value">${passedTasks}/${totalTasks}</div>
        <div class="card-label">${totalTasks > 0 ? Math.round((passedTasks / totalTasks) * 100) : 0}% complete</div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Gate Pass Rate</span></div>
        <div class="card-value">${totalGates > 0 ? Math.round((passedGates / totalGates) * 100) : 0}%</div>
        <div class="card-label">${passedGates}/${totalGates} passed</div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Transitions</span></div>
        <div class="card-value">${features.reduce((s, f) => s + (f.state?.transitionCount || 0), 0)}</div>
        <div class="card-label">state changes</div>
      </div>
    </div>

    <h3 class="section-header">Features</h3>
    <div class="feature-list">
      ${features.map((f) => {
        const s = f.state || {};
        const tasks = s.tasks || [];
        const passed = tasks.filter((t) => t.status === "passed").length;
        const pct = tasks.length > 0 ? Math.round((passed / tasks.length) * 100) : 0;
        const statusClass = s.status || "unknown";
        return `
          <div class="feature-item" data-feature="${f.name}">
            <div>
              <div class="feature-name">${f.name}</div>
            </div>
            <div class="feature-meta">
              <span>${passed}/${tasks.length} tasks</span>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${pct}%"></div>
              </div>
              <span class="badge badge-${statusClass}">${statusClass}</span>
              <span>${relativeTime(s._last_modified)}</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ── Timeline ──
function renderTimeline() {
  const sorted = [...features]
    .filter((f) => f.state)
    .sort((a, b) => {
      const ta = a.state.completedAt || a.state._last_modified || "";
      const tb = b.state.completedAt || b.state._last_modified || "";
      return tb.localeCompare(ta);
    });

  app.innerHTML = `
    <h2 class="section-header">Feature Timeline</h2>
    <p class="section-sub">History of features and their outcomes</p>
    <div class="timeline">
      ${sorted.map((f) => {
        const s = f.state;
        const tasks = s.tasks || [];
        const passed = tasks.filter((t) => t.status === "passed").length;
        const gates = s.gates || [];
        const gatesPassed = gates.filter((g) => g.verdict === "PASS").length;
        const dotClass = s.status === "completed" ? "completed" : s.status === "failed" ? "failed" : "";
        const time = s.completedAt || s._last_modified;
        return `
          <div class="timeline-item">
            <div class="timeline-dot ${dotClass}"></div>
            <div class="timeline-content">
              <div class="timeline-title">${f.name}</div>
              <div class="timeline-time">${time ? new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"} · ${s.status}</div>
              <div class="timeline-stats">
                <span>📋 ${passed}/${tasks.length} tasks</span>
                <span>🔒 ${gatesPassed}/${gates.length} gates</span>
                <span>🔄 ${s.transitionCount || 0} transitions</span>
                ${s.summary?.duration ? `<span>⏱ ${s.summary.duration}</span>` : ""}
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ── Board ──
function renderBoard() {
  // Find active feature or most recent
  const active = features.find((f) => f.state?.status === "active") || features[0];
  if (!active?.state) {
    app.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No features found</div></div>`;
    return;
  }

  const tasks = active.state.tasks || [];
  const columns = {
    pending: tasks.filter((t) => t.status === "pending"),
    "in-progress": tasks.filter((t) => t.status === "in-progress"),
    passed: tasks.filter((t) => t.status === "passed"),
    blocked: tasks.filter((t) => t.status === "blocked" || t.status === "failed"),
  };

  const icons = { pending: "⏳", "in-progress": "🔄", passed: "✅", blocked: "🚫" };

  app.innerHTML = `
    <h2 class="section-header">Task Board — ${active.name}</h2>
    <p class="section-sub"><span class="badge badge-${active.state.status}">${active.state.status}</span></p>
    <div class="board">
      ${Object.entries(columns).map(([col, items]) => `
        <div class="board-column">
          <div class="board-column-header">
            ${icons[col]} ${col} <span class="board-column-count">${items.length}</span>
          </div>
          ${items.length === 0 ? '<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:20px">Empty</div>' : ""}
          ${items.map((t) => `
            <div class="board-task">
              <div class="board-task-id">${t.id}</div>
              ${t.description ? `<div class="board-task-desc">${t.description}</div>` : ""}
              ${t.lastReason ? `<div class="board-task-desc" style="color:var(--yellow);margin-top:4px">${t.lastReason}</div>` : ""}
            </div>
          `).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

// ── Metrics ──
function renderMetrics() {
  const totalTasks = features.reduce((s, f) => s + (f.state?.tasks?.length || 0), 0);
  const passedTasks = features.reduce(
    (s, f) => s + (f.state?.tasks?.filter((t) => t.status === "passed").length || 0), 0
  );
  const totalGates = features.reduce((s, f) => s + (f.state?.gates?.length || 0), 0);
  const passedGates = features.reduce(
    (s, f) => s + (f.state?.gates?.filter((g) => g.verdict === "PASS").length || 0), 0
  );
  const totalTransitions = features.reduce((s, f) => s + (f.state?.transitionCount || 0), 0);
  const totalRetries = features.reduce(
    (s, f) => s + (f.state?.tasks || []).reduce((rs, t) => rs + (t.retries || 0), 0), 0
  );

  // Generate heatmap data (demo: random activity)
  const heatmapCells = Array.from({ length: 28 }, () => {
    const level = Math.random() < 0.3 ? 0 : Math.ceil(Math.random() * 4);
    return `<div class="heatmap-cell level-${level}"></div>`;
  }).join("");

  app.innerHTML = `
    <h2 class="section-header">Metrics</h2>

    <div class="metrics-grid">
      <div class="card">
        <div class="card-title">Task Completion</div>
        <div class="card-value" style="margin-top:8px">${totalTasks > 0 ? Math.round((passedTasks / totalTasks) * 100) : 0}%</div>
        <div class="card-label">${passedTasks} of ${totalTasks} tasks passed</div>
        <div class="progress-bar" style="width:100%;margin-top:12px">
          <div class="progress-fill" style="width:${totalTasks > 0 ? (passedTasks / totalTasks) * 100 : 0}%"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Gate Pass Rate</div>
        <div class="card-value" style="margin-top:8px">${totalGates > 0 ? Math.round((passedGates / totalGates) * 100) : 0}%</div>
        <div class="card-label">${passedGates} of ${totalGates} gates passed</div>
        <div class="progress-bar" style="width:100%;margin-top:12px">
          <div class="progress-fill" style="width:${totalGates > 0 ? (passedGates / totalGates) * 100 : 0}%"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Efficiency</div>
        <div class="card-value" style="margin-top:8px">${totalTransitions}</div>
        <div class="card-label">transitions · ${totalRetries} retries</div>
      </div>

      <div class="card">
        <div class="card-title">Features</div>
        <div class="card-value" style="margin-top:8px">${features.length}</div>
        <div class="card-label">${features.filter((f) => f.state?.status === "completed").length} completed · ${features.filter((f) => f.state?.status === "active").length} active</div>
      </div>
    </div>

    <div style="margin-top:32px">
      <div class="card">
        <div class="card-title">Activity (28 days)</div>
        <div class="heatmap" style="margin-top:12px">
          ${heatmapCells}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--text-dim)">
          <span>4 weeks ago</span>
          <span>Today</span>
        </div>
      </div>
    </div>

    <div style="margin-top:24px">
      <h3 class="section-header">Per-Feature Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="border-bottom:1px solid var(--border);text-align:left">
            <th style="padding:8px 12px;color:var(--text-dim);font-weight:600">Feature</th>
            <th style="padding:8px 12px;color:var(--text-dim);font-weight:600">Status</th>
            <th style="padding:8px 12px;color:var(--text-dim);font-weight:600">Tasks</th>
            <th style="padding:8px 12px;color:var(--text-dim);font-weight:600">Gates</th>
            <th style="padding:8px 12px;color:var(--text-dim);font-weight:600">Transitions</th>
          </tr>
        </thead>
        <tbody>
          ${features.map((f) => {
            const s = f.state || {};
            const tasks = s.tasks || [];
            const gates = s.gates || [];
            return `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:8px 12px;font-weight:600">${f.name}</td>
                <td style="padding:8px 12px"><span class="badge badge-${s.status || 'unknown'}">${s.status || "—"}</span></td>
                <td style="padding:8px 12px">${tasks.filter((t) => t.status === "passed").length}/${tasks.length}</td>
                <td style="padding:8px 12px">${gates.filter((g) => g.verdict === "PASS").length}/${gates.length}</td>
                <td style="padding:8px 12px">${s.transitionCount || 0}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ── Helpers ──
function relativeTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Init ──
loadData();

// Auto-refresh every 30s
setInterval(loadData, 30000);
