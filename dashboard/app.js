// agentic-team dashboard — single-scroll redesign
// 4 sections: Status Hero, Token Usage, Feature Timeline, Task Board

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const app = $("#app");

// ── Display helpers ──
function humanizeName(slug) {
  if (!slug) return "";
  const readable = slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return readable.length > 50 ? readable.slice(0, 47) + "…" : readable;
}

function truncate(text, maxLen) {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}

const GATE_TASK_TITLE = "Quality gate passes";
function isGateTask(t) {
  return t.title === GATE_TASK_TITLE;
}

// ── State ──
let projects = [];
let currentProject = null;
let features = [];
let sprints = [];
let issues = [];
let backlogItems = [];
let tokenData = null;
let selectedFeature = null;
let refreshTimer = null;
let eventSource = null;
let sseConnected = false;


// ── Project selector ──
const projectSelect = $("#project-select");
projectSelect.addEventListener("change", (e) => {
  const idx = parseInt(e.target.value);
  if (projects[idx]) {
    currentProject = projects[idx];
    selectedFeature = null;
    features = [];
    sprints = [];
    issues = [];
    backlogItems = [];
    tokenData = null;
    localStorage.setItem('agt-dashboard-project', currentProject.name);
    loadProjectData();
  }
});

// ── Global handlers ──
window.selectBoardFeature = function (name) {
  selectedFeature = name;
  render();
  // Scroll to board section
  const boardSection = document.getElementById("section-board");
  if (boardSection) boardSection.scrollIntoView({ behavior: "smooth" });
};

window.changeBoardFeature = function (name) {
  selectedFeature = name || null;
  render();
};

// ── Data loading ──
async function loadProjects() {
  try {
    const res = await fetch("/api/projects");
    if (res.ok) projects = await res.json();
  } catch {}

  if (projects.length > 0) {
    // Restore last selected project from localStorage
    const savedProject = localStorage.getItem('agt-dashboard-project');
    const savedIdx = savedProject ? projects.findIndex(p => p.name === savedProject) : -1;
    currentProject = savedIdx >= 0 ? projects[savedIdx] : projects[0];
    updateProjectSelector(savedIdx >= 0 ? savedIdx : 0);
  } else {
    currentProject = { name: "Current Project", path: ".", rawPath: "." };
    projectSelect.style.display = "none";
  }
  await loadProjectData();
}

function updateProjectSelector(selectedIdx = 0) {
  projectSelect.innerHTML = projects
    .map((p, i) => `<option value="${i}" ${i === selectedIdx ? 'selected' : ''}>${esc(p.name)}${p.version ? " " + esc(p.version) : ""}</option>`)
    .join("");
}

async function loadProjectData() {
  if (!currentProject) return;
  const path = encodeURIComponent(currentProject.path);
  try {
    const [featRes, sprintRes, issueRes, backlogRes, tokenRes] = await Promise.all([
      fetch(`/api/features?path=${path}`),
      fetch(`/api/sprints?path=${path}`),
      fetch(`/api/issues?path=${path}`).catch(() => null),
      fetch(`/api/backlog?path=${path}`).catch(() => null),
      fetch(`/api/tokens?path=${path}`).catch(() => null),
    ]);
    if (featRes.ok) features = await featRes.json();
    if (sprintRes.ok) {
      const data = await sprintRes.json();
      sprints = data.sprints || [];
    }
    if (issueRes?.ok) issues = await issueRes.json();
    if (backlogRes?.ok) backlogItems = await backlogRes.json();
    if (tokenRes?.ok) tokenData = await tokenRes.json();
  } catch {}
  render();
  startSSE();
  startAutoRefresh();
}

// ── Auto-refresh (10s fallback) — only refreshes features for active section ──
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

// ── SSE real-time updates ──
function startSSE() {
  if (eventSource) { eventSource.close(); eventSource = null; }
  if (!currentProject) return;

  const path = encodeURIComponent(currentProject.path);
  eventSource = new EventSource(`/api/events?path=${path}`);

  eventSource.onopen = () => {
    sseConnected = true;
    updateSSEIndicator();
  };

  eventSource.onmessage = async (e) => {
    try {
      const ev = JSON.parse(e.data);
      const refreshEvents = ["task-started", "task-passed", "task-blocked", "feature-complete", "feature-started"];
      if (refreshEvents.includes(ev.event)) {
        const path = encodeURIComponent(currentProject.path);
        try {
          const res = await fetch(`/api/features?path=${path}`);
          if (res.ok) { features = await res.json(); render(); }
        } catch {}
      }
    } catch {}
  };

  eventSource.onerror = () => {
    sseConnected = false;
    updateSSEIndicator();
  };
}

function updateSSEIndicator() {
  const dot = document.getElementById("sse-live-dot");
  if (dot) dot.style.display = sseConnected ? "inline-block" : "none";
}

// ── Render ──
function render() {
  const withState = features.filter((f) => f.status && f.status !== "unknown");
  const active = withState.find((f) => ["active", "executing"].includes(f.status));
  const completed = withState.filter((f) => f.status === "completed");
  const totalFeatures = withState.length;
  const completedCount = completed.length;
  const successRate = totalFeatures > 0 ? Math.round((completedCount / totalFeatures) * 100) : 0;

  // Avg cycle time from sprints or features
  const avgCycleTime = computeAvgCycleTime(withState);

  // Total tokens from pew data
  const totalTokens = tokenData?.available !== false && tokenData?.summary
    ? formatTokens(tokenData.summary.total)
    : "—";

  // Update nav status
  const navStatus = $("#nav-status");
  if (active) {
    navStatus.innerHTML = `<div class="status-dot"></div> Executing`;
  } else {
    navStatus.innerHTML = `<span style="color:var(--text-muted)">Idle</span>`;
  }
  // Show SSE live indicator
  const liveDot = document.getElementById("sse-live-dot");
  if (liveDot) liveDot.style.display = sseConnected ? "inline-block" : "none";

  app.innerHTML = `
    ${renderStatusHero(active, completed, withState)}
    ${renderStatCards(completedCount, successRate, avgCycleTime, totalTokens)}
    ${renderTokenSection()}
    ${renderBacklog()}
    ${renderTimeline(withState)}
    ${renderBoard(withState, active)}
  `;
}

// ── Section 1: Status Hero ──
function renderStatusHero(active, completed, withState) {
  if (active) {
    const s = active;
    const tasks = (s.tasks || []).filter((t) => !isGateTask(t));
    const passed = tasks.filter((t) => t.status === "passed").length;
    const pct = tasks.length > 0 ? Math.round((passed / tasks.length) * 100) : 0;
    const duration = s.summary?.duration || computeDuration(s.createdAt);

    return `
    <div class="dashboard-section" id="section-hero">
      <div class="hero-card">
        <div class="hero-top">
          <div>
            <div class="hero-feature-name">${esc(humanizeName(active.name))}</div>
            <div class="hero-feature-status">
              <span class="badge badge-${s.status}">${s.status}</span>
              ${duration ? `<span class="hero-duration">⏱ ${duration}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="hero-progress">
          <div class="hero-progress-bar">
            <div class="hero-progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="hero-progress-label">
            <span>${passed} of ${tasks.length} tasks complete</span>
            <span>${pct}%</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  const lastCompleted = completed.length > 0
    ? completed.sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))[0]
    : null;

  return `
  <div class="dashboard-section" id="section-hero">
    <div class="hero-card hero-idle">
      <div class="hero-idle-msg">No active feature</div>
      ${lastCompleted
        ? `<div class="hero-idle-last">Last completed: <strong>${esc(humanizeName(lastCompleted.name))}</strong> ${lastCompleted.completedAt ? "— " + relativeTime(lastCompleted.completedAt) : ""}</div>`
        : `<div class="hero-idle-last">No features completed yet</div>`}
    </div>
  </div>`;
}

function renderStatCards(completedCount, successRate, avgCycleTime, totalTokens) {
  const projectLabel = currentProject?.name || "Project";
  return `
  <div class="dashboard-section">
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-card-accent" style="background:var(--accent)"></div>
        <div class="stat-card-label">Features Shipped</div>
        <div class="stat-card-value">${completedCount}</div>
        <div class="stat-card-sub">${esc(projectLabel)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-accent" style="background:var(--green)"></div>
        <div class="stat-card-label">Success Rate</div>
        <div class="stat-card-value">${successRate}%</div>
        <div class="stat-card-sub">completed / attempted</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-accent" style="background:var(--purple)"></div>
        <div class="stat-card-label">Avg Cycle Time</div>
        <div class="stat-card-value">${avgCycleTime}</div>
        <div class="stat-card-sub">per feature</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-accent" style="background:var(--cyan)"></div>
        <div class="stat-card-label">Token Usage</div>
        <div class="stat-card-value">${totalTokens}</div>
        <div class="stat-card-sub">all models</div>
      </div>
    </div>
  </div>`;
}

// ── Section 2: Token Usage ──
function renderBacklog() {
  if (!backlogItems.length && !issues.length) return '';
  return `
    <div class="section" id="section-backlog">
      <h2 class="section-title">Backlog</h2>
      <div class="backlog-grid">
        ${backlogItems.map(item => `
          <div class="backlog-card">
            <div class="backlog-source">${esc(item.source)}</div>
            <div class="backlog-title">${esc(item.title)}</div>
            <div class="backlog-desc">${esc(item.description?.slice(0, 150) || '')}</div>
          </div>
        `).join('')}
        ${issues.map(issue => `
          <div class="backlog-card backlog-issue">
            <div class="backlog-source">issue #${issue.number}</div>
            <div class="backlog-title">${esc(issue.title)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderTokenSection() {
  if (!tokenData || tokenData.available === false) {
    return `
    <div class="dashboard-section" id="section-tokens">
      <div class="section-header">Token Usage</div>
      <div class="token-unavailable">
        <div class="token-unavailable-icon">📊</div>
        <div>Install <a href="https://github.com/nicepkg/pew" target="_blank">pew</a> for token tracking</div>
        <div style="margin-top:8px;font-size:12px;color:var(--text-muted)">npm i -g pew</div>
      </div>
    </div>`;
  }

  const summary = tokenData.summary || {};
  const daily = tokenData.daily || [];
  const models = tokenData.models || [];

  return `
  <div class="dashboard-section" id="section-tokens">
    <div class="section-header">Token Usage</div>
    <div class="token-grid">
      <div class="token-summary-card">
        <div class="token-total">${formatTokens(summary.total || 0)}</div>
        <div class="token-total-label">${tokenData.scope === "project" ? esc(currentProject?.name || "Project") + " · Estimated" : "All Projects"} · Last 7 Days</div>
        <div class="token-data-note">${tokenData.scope === "project" ? "Estimated from " + tokenData.featureWindows + " feature time windows" : "pew tracks by tool, not per project"}</div>
        <div class="token-breakdown">
          <div class="token-row">
            <span class="token-row-label"><span class="token-row-dot" style="background:var(--accent)"></span> Input</span>
            <span class="token-row-value">${formatTokens(summary.input || 0)}</span>
          </div>
          <div class="token-row">
            <span class="token-row-label"><span class="token-row-dot" style="background:var(--green)"></span> Cached</span>
            <span class="token-row-value">${formatTokens(summary.cached || 0)}</span>
          </div>
          <div class="token-row">
            <span class="token-row-label"><span class="token-row-dot" style="background:var(--purple)"></span> Output</span>
            <span class="token-row-value">${formatTokens(summary.output || 0)}</span>
          </div>
          <div class="token-row">
            <span class="token-row-label"><span class="token-row-dot" style="background:var(--yellow)"></span> Reasoning</span>
            <span class="token-row-value">${formatTokens(summary.reasoning || 0)}</span>
          </div>
        </div>
        ${models.length > 0 ? `
        <div class="model-list">
          <div style="font-size:12px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-top:16px;margin-bottom:8px">By Model</div>
          ${models.map((m) => {
            const maxTokens = Math.max(...models.map((x) => x.total));
            const barPct = maxTokens > 0 ? Math.round((m.total / maxTokens) * 100) : 0;
            return `
            <div class="model-item">
              <span class="model-name">${esc(m.model)}</span>
              <div class="model-bar-wrap"><div class="model-bar" style="width:${barPct}%"></div></div>
              <span class="model-tokens">${formatTokens(m.total)}</span>
            </div>`;
          }).join("")}
        </div>` : ""}
      </div>
      <div class="token-chart-card">
        <div class="token-chart-title">Last 7 Days</div>
        ${renderBarChart(daily)}
      </div>
    </div>
  </div>`;
}

function renderBarChart(daily) {
  if (!daily || daily.length === 0) {
    return `<div style="color:var(--text-muted);text-align:center;padding:40px 0;font-size:13px">No data</div>`;
  }

  const maxVal = Math.max(...daily.map((d) => d.total), 1);
  const barWidth = 36;
  const gap = 12;
  const chartHeight = 140;
  const labelHeight = 20;
  const valueHeight = 16;
  const totalWidth = daily.length * (barWidth + gap) - gap;
  const svgHeight = chartHeight + labelHeight + valueHeight;

  const bars = daily.map((d, i) => {
    const x = i * (barWidth + gap);
    const barH = Math.max(2, (d.total / maxVal) * (chartHeight - valueHeight));
    const y = chartHeight - barH;
    const dayLabel = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
    return `
      <rect class="bar" x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="3"/>
      <text class="bar-value" x="${x + barWidth / 2}" y="${y - 4}">${formatTokensShort(d.total)}</text>
      <text class="bar-label" x="${x + barWidth / 2}" y="${chartHeight + 14}">${dayLabel}</text>
    `;
  }).join("");

  return `<svg class="token-chart-svg" viewBox="0 0 ${totalWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">${bars}</svg>`;
}

// ── Section 3: Feature Timeline ──
function renderTimeline(withState) {
  const sorted = [...withState].sort((a, b) => {
    const ta = a.completedAt || a._last_modified || "";
    const tb = b.completedAt || b._last_modified || "";
    return tb.localeCompare(ta);
  });

  if (sorted.length === 0) {
    return `
    <div class="dashboard-section" id="section-timeline">
      <div class="section-header">Feature Timeline</div>
      <div class="empty">
        <div class="empty-icon">📋</div>
        <div class="empty-text">No features yet</div>
      </div>
    </div>`;
  }

  return `
  <div class="dashboard-section" id="section-timeline">
    <div class="section-header">Feature Timeline</div>
    <div class="timeline-scroll">
      ${sorted.map((f) => {
        const s = f;
        const tasks = (s.tasks || []).filter((t) => !isGateTask(t));
        const passed = tasks.filter((t) => t.status === "passed").length;
        const status = s.status || "unknown";
        const dateStr = f.completedAt || f._last_modified || f.createdAt || "";
        const timeLabel = dateStr ? relativeTime(dateStr) : "";
        const isSelected = selectedFeature === f.name;

        return `
        <div class="timeline-card${isSelected ? " selected" : ""}" onclick="selectBoardFeature('${esc(f.name).replace(/'/g, "\\'")}')">
          <div class="timeline-border status-${status}"></div>
          <div class="timeline-body">
            <div class="timeline-top">
              <div style="display:flex;align-items:center;gap:8px;min-width:0">
                <span class="timeline-name">${esc(humanizeName(f.name))}</span>
                <span class="badge badge-${status}">${status}</span>
              </div>
              <div class="timeline-meta">
                ${timeLabel ? `<span class="timeline-date">${timeLabel}</span>` : ""}
                <span style="font-size:12px;color:var(--text-muted)">${passed}/${tasks.length} tasks</span>
              </div>
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>`;
}

// ── Section 4: Task Board ──
function buildFeatureSelector(withState, currentName) {
  if (withState.length <= 1) return '';
  return `<div class="board-feature-selector">
    <select onchange="changeBoardFeature(this.value)">
      <option value="" ${!currentName ? 'selected' : ''}>Recent Activity</option>
      ${withState.map((f) => `<option value="${esc(f.name)}" ${f.name === currentName ? 'selected' : ''}>${esc(humanizeName(f.name))} (${f.status})</option>`).join('')}
    </select>
  </div>`;
}

function renderBoard(withState, activeFeature) {
  if (!withState.length) {
    return `
    <div class="dashboard-section" id="section-board">
      <div class="section-header">Task Board</div>
      <div class="empty">
        <div class="empty-icon">📋</div>
        <div class="empty-text">No features with tasks</div>
      </div>
    </div>`;
  }

  const explicitFeature = selectedFeature ? withState.find((f) => f.name === selectedFeature) : null;
  const boardFeature = explicitFeature || activeFeature;

  // No active feature and no explicit selection → recent activity feed
  if (!boardFeature) return renderRecentActivity(withState);

  // Completed feature → compact summary (not a wall of Done cards)
  if (boardFeature.status === 'completed') return renderCompletedSummary(boardFeature, withState);

  // Active/executing feature → full kanban
  return renderKanban(boardFeature, withState);
}

function renderKanban(boardFeature, withState) {
  const tasks = (boardFeature.tasks || []).filter((t) => !isGateTask(t));
  const columns = {
    pending: tasks.filter((t) => t.status === "pending"),
    "in-progress": tasks.filter((t) => t.status === "in-progress"),
    passed: tasks.filter((t) => t.status === "passed"),
    blocked: tasks.filter((t) => t.status === "blocked" || t.status === "failed"),
  };
  const icons = { pending: "⏳", "in-progress": "🔄", passed: "✅", blocked: "🚫" };
  const labels = { pending: "Pending", "in-progress": "In Progress", passed: "Done", blocked: "Blocked" };
  const featureOptions = buildFeatureSelector(withState, boardFeature.name);

  return `
  <div class="dashboard-section" id="section-board">
    <div class="section-header">Task Board</div>
    <div class="board-header">
      <div class="board-feature-name">${esc(humanizeName(boardFeature.name))} <span class="badge badge-${boardFeature.status}">${boardFeature.status}</span></div>
      ${featureOptions}
    </div>
    <div class="board">
      ${Object.entries(columns).map(([col, items]) => `
        <div class="board-column">
          <div class="board-column-header">
            ${icons[col]} ${labels[col]} <span class="board-column-count">${items.length}</span>
          </div>
          ${items.length === 0 ? '<div class="board-empty">—</div>' : ''}
          ${items.map((t) => `
            <div class="board-task">
              <div class="board-task-id">${esc(t.id)}</div>
              ${t.description || t.title ? `<div class="board-task-desc">${esc(truncate(t.description || t.title, 80))}</div>` : ""}
              <div class="board-task-footer">
                ${t.lastGate ? `<span class="gate-badge gate-${t.lastGate.verdict}">${t.lastGate.verdict}</span>` : ""}
                ${t.attempts || t.retries ? `<span class="board-task-attempts">${t.attempts || t.retries} attempt${(t.attempts || t.retries) > 1 ? "s" : ""}</span>` : ""}
                ${t.duration ? `<span class="board-task-duration">⏱ ${t.duration}</span>` : ""}
              </div>
            </div>
          `).join("")}
        </div>`).join("")}
    </div>
  </div>`;
}

function renderCompletedSummary(f, withState) {
  const tasks = (f.tasks || []).filter((t) => !isGateTask(t));
  const cycleTime = f.createdAt && f.completedAt
    ? formatDuration(new Date(f.completedAt) - new Date(f.createdAt))
    : '—';
  const featureOptions = buildFeatureSelector(withState, f.name);

  return `
  <div class="dashboard-section" id="section-board">
    <div class="section-header">Task Board</div>
    <div class="board-header">
      <div class="board-feature-name">${esc(humanizeName(f.name))} <span class="badge badge-completed">completed</span></div>
      ${featureOptions}
    </div>
    <div class="completed-summary">
      <div class="completed-stats">
        <div class="completed-stat">
          <div class="completed-stat-value">${tasks.length}</div>
          <div class="completed-stat-label">Tasks</div>
        </div>
        <div class="completed-stat">
          <div class="completed-stat-value">${cycleTime}</div>
          <div class="completed-stat-label">Cycle Time</div>
        </div>
        ${f.completedAt ? `<div class="completed-stat">
          <div class="completed-stat-value">${relativeTime(f.completedAt)}</div>
          <div class="completed-stat-label">Completed</div>
        </div>` : ''}
      </div>
      <div class="completed-task-list">
        ${tasks.length === 0
          ? '<div class="board-empty">No tasks recorded</div>'
          : tasks.map((t) => `
          <div class="completed-task">
            <span class="completed-task-check">✓</span>
            <span class="completed-task-id">${esc(t.id)}</span>
            ${t.description || t.title
              ? `<span class="completed-task-desc">${esc(truncate(t.description || t.title, 100))}</span>`
              : '<span class="completed-task-desc" style="color:var(--text-muted)">—</span>'}
            <div class="completed-task-meta">
              ${t.lastGate ? `<span class="gate-badge gate-${t.lastGate.verdict}">${t.lastGate.verdict}</span>` : ''}
              ${t.duration ? `<span class="board-task-duration">⏱ ${t.duration}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>`;
}

function renderRecentActivity(withState) {
  const events = [];
  for (const f of withState) {
    const tasks = (f.tasks || []).filter((t) => !isGateTask(t));
    for (const t of tasks) {
      if (t.lastTransition) {
        events.push({ feature: f, task: t, time: t.lastTransition });
      }
    }
  }
  events.sort((a, b) => b.time.localeCompare(a.time));
  const recent = events.slice(0, 10);

  const featureOptions = buildFeatureSelector(withState, '');
  const statusIcons = {
    passed: '✅', failed: '❌', blocked: '🚫', 'in-progress': '🔄', pending: '⏳', skipped: '⏭️',
  };

  return `
  <div class="dashboard-section" id="section-board">
    <div class="section-header">Task Board</div>
    <div class="board-header">
      <div class="board-feature-name board-feature-name--dim">Recent Activity</div>
      ${featureOptions}
    </div>
    ${recent.length === 0
      ? `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No recent activity</div></div>`
      : `<div class="activity-feed">
          ${recent.map((e) => `
            <div class="activity-item" onclick="selectBoardFeature('${esc(e.feature.name).replace(/'/g, "\\'")}')">
              <div class="activity-icon">${statusIcons[e.task.status] || '📌'}</div>
              <div class="activity-body">
                <div class="activity-task">${esc(truncate(e.task.description || e.task.title, 80))}</div>
                <div class="activity-meta">
                  <span class="activity-feature">${esc(humanizeName(e.feature.name))}</span>
                  <span class="activity-time">${relativeTime(e.time)}</span>
                  ${e.task.lastGate ? `<span class="gate-badge gate-${e.task.lastGate.verdict}">${e.task.lastGate.verdict}</span>` : ''}
                </div>
              </div>
              <div class="activity-status">
                <span class="badge badge-task-${e.task.status.replace('-', '')}">${e.task.status}</span>
              </div>
            </div>
          `).join('')}
        </div>`
    }
  </div>`;
}

// ── Helpers ──
function formatTokens(n) {
  if (n === 0 || n == null) return "0";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

function formatTokensShort(n) {
  if (n === 0 || n == null) return "0";
  if (n >= 1e9) return (n / 1e9).toFixed(0) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(0) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(n);
}

function computeAvgCycleTime(features) {
  const completed = features.filter(
    (f) => f.status === "completed" && f.createdAt && f.completedAt
  );
  if (completed.length === 0) return "—";
  const totalMs = completed.reduce((sum, f) => {
    return sum + (new Date(f.completedAt) - new Date(f.createdAt));
  }, 0);
  const avgMs = totalMs / completed.length;
  return formatDuration(avgMs);
}

function computeDuration(createdAt) {
  if (!createdAt) return "";
  const ms = Date.now() - new Date(createdAt).getTime();
  return formatDuration(ms);
}

function formatDuration(ms) {
  if (ms < 60000) return "<1m";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours < 24) return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Init ──
loadProjects();
