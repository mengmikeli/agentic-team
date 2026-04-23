import type { Project, Feature, Issue, BacklogItem, TokenData } from '../types';

// Base fetch wrapper
async function apiFetch<T>(endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    return null;
  }
}

// API endpoints
export const api = {
  async getProjects(): Promise<Project[]> {
    const data = await apiFetch<Project[]>('/api/projects');
    return data || [];
  },

  async getFeatures(projectPath: string): Promise<Feature[]> {
    const path = encodeURIComponent(projectPath);
    const data = await apiFetch<Feature[]>(`/api/features?path=${path}`);
    return data || [];
  },

  async getSprints(projectPath: string): Promise<any> {
    const path = encodeURIComponent(projectPath);
    const data = await apiFetch<{ sprints: any[] }>(`/api/sprints?path=${path}`);
    return data?.sprints || [];
  },

  async getIssues(projectPath: string): Promise<Issue[]> {
    const path = encodeURIComponent(projectPath);
    const data = await apiFetch<Issue[]>(`/api/issues?path=${path}`);
    return data || [];
  },

  async getBacklog(projectPath: string): Promise<BacklogItem[]> {
    const path = encodeURIComponent(projectPath);
    const data = await apiFetch<BacklogItem[]>(`/api/backlog?path=${path}`);
    return data || [];
  },

  async getTokens(days: number = 7): Promise<TokenData> {
    const data = await apiFetch<TokenData>(`/api/tokens?days=${days}`);
    return data || { available: false, summary: { input: 0, cached: 0, output: 0, reasoning: 0, total: 0 }, daily: [], models: [], sources: [], error: true };
  },

  // SSE connection for real-time updates
  createEventSource(projectPath: string): EventSource | null {
    try {
      const path = encodeURIComponent(projectPath);
      return new EventSource(`/api/events?path=${path}`);
    } catch {
      return null;
    }
  }
};