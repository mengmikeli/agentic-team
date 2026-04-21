# Progress: add-real-time-dashboard-updates-via-server-sent-ev

**Started:** 2026-04-21T10:19:43.177Z
**Tier:** functional
**Tasks:** 2

## Plan
1. Add real-time dashboard updates via Server-Sent Events (SSE). Currently the dashboard polls every 10s and misses in-progress states. Fix: 1) Add GET /api/events SSE endpoint to the dashboard server that streams notifications in real-time. 2) When agt-harness notify fires, it should write events to a shared log file at .team/.notify-stream. 3) The SSE endpoint watches this file and pushes new events to connected clients. 4) The dashboard frontend opens an EventSource connection and updates the UI immediately on task-started, task-passed, task-blocked, feature-complete events — no polling needed for active state. 5) Keep the 10s polling as fallback for when SSE disconnects. 6) Dashboard should show a live indicator (pulsing dot) when SSE is connected.
2. Quality gate passes

## Execution Log

