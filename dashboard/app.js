// agentic-team dashboard — app.js
// Reads live project data from /api/ endpoints.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const app = $("#app");

// ── State ──
let projects = [];
let currentProject = null;
let features = [];
let sprints = [];
let issues = [];
let currentPage = "overview";
let selectedFeature = null;
let refreshTimer = null;

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

// ── Project selector ──
const projectSelect = $("#project-select");
projectSelect.addEventListener("change", (e) => {
  const idx = parseInt(e.target.value);
  if (projects[idx]) {
    currentProject = projects[idx];
    selectedFeature = null;
    loadProjectData();
  }
});

// ── Global handlers (called from onclick in rendered HTML) ──
window.selectProject = function (path) {
  const p = projects.find((pr) => pr.path === path);
  if (p) {
    currentProject = p;
    projectSelect.value = projects.indexOf(p);
    selectedFeature = null;
    loadProjectData();
  }
};

window.selectFeature = function (name) {
  selectedFeature = name;
  currentPage = "board";
  $$(".nav-links a").forEach((l) => l.classList.remove("active"));
  const boardLink = $$(".nav-links a").find((l) => l.dataset.page === "board");
  if (boardLink) boardLink.classList.add("active");
  render();
};

// ── Data loading ──
async function loadProjects() {
  try {
    const res = await fetch("/api/projects");
    if (res.ok) projects = await res.json();
  } catch {}

  if (projects.length > 0) {
    currentProject = projects[0];
    updateProjectSelector();
  } else {
    currentProject = { name: "Current Project", path: ".", rawPath: "." };
    projectSelect.style.display = "none";
  }
  await loadProjectData();
}

function updateProjectSelector() {
  projectSelect.innerHTML = projects
    .map((p, i) => `<option value="${i}">${p.name}${p.version ? " " + p.version : ""}</option>`)
    .join("");
}

async function loadProjectData() {
  if (!currentProject) return;
  const path = encodeURIComponent(currentProject.path);
  try {
    const [featRes, sprintRes, issueRes] = await Promise.all([
      fetch(`/api/features?path=${path}`),
      fetch(`/api/sprints?path=${path}`),
      fetch(`/api/issues?path=${path}`).catch(() => null),
    ]);
    if (featRes.ok) features = await featRes.json();
    if (sprintRes.ok) {
      const data = await sprintRes.json();
      sprints = data.sprints || [];
    }
    if (issueRes?.ok) issues = await issueRes.json();
  } catch {}
  render();
  startAutoRefresh();
}

// ── Auto-refresh (10s) ──
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(async () => {
    if (!currentProject) return;
    const path = encodeURIComponent(currentProject.path);
    try {
      const res = await fetch(`/api/features?path=${path}`);
      if (res.ok) {
        features = await res.json();
        render();
      }
    } catch {}
  }, 10000);
}

// ── Render ──
function render() {
  switch (currentPage) {
    case "overview":
      renderOverview();
      break;
    case "timeline":
      renderTimeline();
      break;
    case "board":
      renderBoard();
      break;
    case "metrics":
      renderMetrics();
      break;
  }
}

// ── Overview ──
function renderOverview() {
  const withState = features.filter((f) => f.state);
  const totalFeatures = withState.length;
  const active = withState.filter((f) => ["active", "executing"].includes(f.state?.status)).length;
  const completed = withState.filter((f) => f.state?.status === "completed").length;
  const specOnly = features.filter((f) => !f.state).length;
  const totalTasks = withState.reduce((s, f) => s + (f.state?.tasks?.length || 0), 0);
  const passedTasks = withState.reduce(
    (s, f) => s + (f.state?.tasks?.filter((t) => t.status === "passed").length || 0),
    0
  );
  const totalGates = withState.reduce((s, f) => s + (f.state?.gates?.length || 0), 0);
  const passedGates = withState.reduce(
    (s, f) => s + (f.state?.gates?.filter((g) => g.verdict === "PASS").length || 0),
    0
  );

  const projectCards =
    projects.length > 1
      ? `<div class="cards">${projects
          .map(
            (p) => `
        <div class="card project-card${p === currentProject ? " card-active" : ""}" onclick="selectProject('${p.path.replace(/'/g, "\\'")}')">
          <div class="card-header">
            <span class="card-title">${esc(p.name)}</span>
            ${p.version ? `<span class="badge badge-version">${esc(p.version)}</span>` : ""}
          </div>
          <div class="card-label">${esc(p.status || "")}</div>
          <div class="card-meta">
            ${p.totalFeatures ? `<span>${p.completedFeatures}/${p.totalFeatures} features</span>` : ""}
            ${p.activeFeatures ? `<span class="text-green">${p.activeFeatures} active</span>` : ""}
          </div>
          ${p.repo?.url ? `<div class="card-label"><a href="${p.repo.url}" target="_blank" class="repo-link">${esc(p.repo.name)}</a></div>` : ""}
        </div>`
          )
          .join("")}</div>`
      : "";

  app.innerHTML = `
    <h2 class="section-header">${esc(currentProject?.name || "Overview")}</h2>
    ${projectCards}
    <div class="cards">
      <div class="card">
        <div class="card-header"><span class="card-title">Features</span></div>
        <div class="card-value">${totalFeatures}</div>
        <div class="card-label">${active} active · ${completed} completed${specOnly ? ` · ${specOnly} spec-only` : ""}</div>
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
        <div class="card-value">${withState.reduce((s, f) => s + (f.state?.transitionCount || 0), 0)}</div>
        <div class="card-label">state changes</div>
      </div>
    </div>

    ${issues.length > 0 ? `<div class="issue-banner">${issues.length} open issue${issues.length === 1 ? "" : "s"} on GitHub</div>` : ""}

    <h3 class="section-header">Features</h3>
    <div class="feature-list">
      ${features
        .map((f) => {
          const s = f.state || {};
          const tasks = s.tasks || [];
          const passed = tasks.filter((t) => t.status === "passed").length;
          const pct = tasks.length > 0 ? Math.round((passed / tasks.length) * 100) : 0;
          const statusClass = s.status || (f.hasSpec ? "spec-only" : "unknown");
          const duration = s.summary?.duration || "";
          return `
          <div class="feature-item" onclick="selectFeature('${f.name}')">
            <div>
              <div class="feature-name">${esc(f.name)}</div>
              ${duration ? `<div class="feature-duration">⏱ ${duration}</div>` : ""}
            </div>
            <div class="feature-meta">
              ${
                tasks.length > 0
                  ? `<span>${passed}/${tasks.length} tasks</span>
                <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`
                  : ""
              }
              <span class="badge badge-${statusClass}">${statusClass}</span>
              <span>${relativeTime(s._last_modified)}</span>
            </div>
          </div>`;
        })
        .join("")}
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
      ${sorted
        .map((f) => {
          const s = f.state;
          const tasks = s.tasks || [];
          const passed = tasks.filter((t) => t.status === "passed").length;
          const gates = s.gates || [];
          const gp = gates.filter((g) => g.verdict === "PASS").length;
          const gf = gates.filter((g) => g.verdict === "FAIL").length;
          const dotClass = s.status === "completed" ? "completed" : s.status === "failed" ? "failed" : "";
          const time = s.completedAt || s._last_modified;
          const duration = s.summary?.duration;
          const created = s.createdAt ? new Date(s.createdAt) : null;
          const ended = s.completedAt ? new Date(s.completedAt) : null;
          const durationMs = created && ended ? ended - created : 0;
          const maxDuration = Math.max(...sorted.map((x) => {
            const c = x.state.createdAt ? new Date(x.state.createdAt) : null;
            const e = x.state.completedAt ? new Date(x.state.completedAt) : null;
            return c && e ? e - c : 0;
          }), 1);
          const barPct = Math.max(5, Math.round((durationMs / maxDuration) * 100));

          return `
          <div class="timeline-item">
            <div class="timeline-dot ${dotClass}"></div>
            <div class="timeline-content">
              <div class="timeline-title">${esc(f.name)}</div>
              <div class="timeline-time">${time ? fmtDate(time) : "—"} · ${s.status}</div>
              ${durationMs > 0 ? `<div class="duration-bar-wrap"><div class="duration-bar" style="width:${barPct}%"></div></div>` : ""}
              <div class="timeline-stats">
                <span>📋 ${passed}/${tasks.length} tasks</span>
                <span>🔒 ${gp}/${gates.length} gates${gf ? ` <span class="text-red">(${gf} fail)</span>` : ""}</span>
                <span>🔄 ${s.transitionCount || 0} transitions</span>
                ${duration ? `<span>⏱ ${duration}</span>` : ""}
              </div>
              ${gates.length > 0 ? `<div class="gate-verdicts">${gates.map((g) => `<span class="gate-badge gate-${g.verdict}">${g.verdict}</span>`).join("")}</div>` : ""}
            </div>
          </div>`;
        })
        .join("")}
    </div>
  `;
}

// ── Board ──
function renderBoard() {
  // Feature selector for board
  const withState = features.filter((f) => f.state);
  const active =
    (selectedFeature && withState.find((f) => f.name === selectedFeature)) ||
    withState.find((f) => ["active", "executing"].includes(f.state?.status)) ||
    withState[0];

  if (!active?.state) {
    app.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No features with state found</div></div>`;
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

  const featureSelector = withState.length > 1
    ? `<div class="feature-selector">
        <select onchange="selectFeature(this.value)">
          ${withState.map((f) => `<option value="${f.name}" ${f.name === active.name ? "selected" : ""}>${f.name} (${f.state.status})</option>`).join("")}
        </select>
      </div>`
    : "";

  app.innerHTML = `
    <h2 class="section-header">Task Board — ${esc(active.name)}</h2>
    ${featureSelector}
    <p class="section-sub"><span class="badge badge-${active.state.status}">${active.state.status}</span>
      ${active.state.summary?.duration ? `<span class="duration-tag">⏱ ${active.state.summary.duration}</span>` : ""}
    </p>
    <div class="board">
      ${Object.entries(columns)
        .map(
          ([col, items]) => `
        <div class="board-column">
          <div class="board-column-header">
            ${icons[col]} ${col} <span class="board-column-count">${items.length}</span>
          </div>
          ${items.length === 0 ? '<div class="board-empty">Empty</div>' : ""}
          ${items
            .map(
              (t) => `
            <div class="board-task">
              <div class="board-task-id">${esc(t.id)}</div>
              ${t.description || t.title ? `<div class="board-task-desc">${esc(t.description || t.title)}</div>` : ""}
              ${t.lastGate ? `<span class="gate-badge gate-${t.lastGate.verdict}">${t.lastGate.verdict}</span>` : ""}
              ${t.lastReason ? `<div class="board-task-reason">${esc(t.lastReason)}</div>` : ""}
              ${t.replanSource ? `<div class="board-task-replan">↳ re-planned from ${esc(t.replanSource)}</div>` : ""}
            </div>`
            )
            .join("")}
        </div>`
        )
        .join("")}
    </div>
  `;
}

// ── Metrics ──
function renderMetrics() {
  const withState = features.filter((f) => f.state);
  const totalTasks = withState.reduce((s, f) => s + (f.state?.tasks?.length || 0), 0);
  const passedTasks = withState.reduce(
    (s, f) => s + (f.state?.tasks?.filter((t) => t.status === "passed").length || 0),
    0
  );
  const totalGates = withState.reduce((s, f) => s + (f.state?.gates?.length || 0), 0);
  const passedGates = withState.reduce(
    (s, f) => s + (f.state?.gates?.filter((g) => g.verdict === "PASS").length || 0),
    0
  );
  const totalTransitions = withState.reduce((s, f) => s + (f.state?.transitionCount || 0), 0);
  const totalRetries = withState.reduce(
    (s, f) => s + (f.state?.tasks || []).reduce((rs, t) => rs + (t.retries || t.attempts || 0), 0),
    0
  );

  // Sprint history
  const sprintRows = sprints
    .map(
      (sp) => `
    <tr>
      <td>${esc(sp.name)}</td>
      <td>${esc(sp.status)}</td>
      <td>${esc(sp.version)}</td>
      <td>${esc(sp.dates)}</td>
      <td>${esc(sp.commits)}</td>
      <td>${esc(sp.model)}</td>
    </tr>`
    )
    .join("");

  // Activity heatmap from real transition dates
  const activityMap = new Map();
  for (const f of withState) {
    for (const t of f.state.transitionHistory || []) {
      if (!t.timestamp) continue;
      const day = t.timestamp.slice(0, 10);
      activityMap.set(day, (activityMap.get(day) || 0) + 1);
    }
  }
  const today = new Date();
  const heatmapCells = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (27 - i));
    const key = d.toISOString().slice(0, 10);
    const count = activityMap.get(key) || 0;
    const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;
    return `<div class="heatmap-cell level-${level}" title="${key}: ${count} transitions"></div>`;
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
        <div class="card-value" style="margin-top:8px">${withState.length}</div>
        <div class="card-label">${withState.filter((f) => f.state?.status === "completed").length} completed · ${withState.filter((f) => ["active", "executing"].includes(f.state?.status)).length} active</div>
      </div>
    </div>

    <div style="margin-top:32px">
      <div class="card">
        <div class="card-title">Activity (28 days)</div>
        <div class="heatmap" style="margin-top:12px">${heatmapCells}</div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--text-dim)">
          <span>4 weeks ago</span><span>Today</span>
        </div>
      </div>
    </div>

    ${
      sprints.length > 0
        ? `
    <div style="margin-top:32px">
      <h3 class="section-header">Sprint History</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Sprint</th><th>Status</th><th>Version</th><th>Dates</th><th>Commits</th><th>Model</th></tr>
          </thead>
          <tbody>${sprintRows}</tbody>
        </table>
      </div>
    </div>`
        : ""
    }

    <div style="margin-top:24px">
      <h3 class="section-header">Per-Feature Breakdown</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Feature</th><th>Status</th><th>Tasks</th><th>Gates</th><th>Transitions</th><th>Duration</th></tr>
          </thead>
          <tbody>
            ${withState
              .map((f) => {
                const s = f.state;
                const tasks = s.tasks || [];
                const gates = s.gates || [];
                return `
                <tr>
                  <td class="feat-name">${esc(f.name)}</td>
                  <td><span class="badge badge-${s.status}">${s.status}</span></td>
                  <td>${tasks.filter((t) => t.status === "passed").length}/${tasks.length}</td>
                  <td>${gates.filter((g) => g.verdict === "PASS").length}/${gates.length}</td>
                  <td>${s.transitionCount || 0}</td>
                  <td>${s.summary?.duration || "—"}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
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

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Init ──
loadProjects();
