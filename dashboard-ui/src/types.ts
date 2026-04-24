export interface Project {
  name: string;
  path: string;
  rawPath: string;
  version?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'passed' | 'failed' | 'blocked' | 'skipped';
  attempts?: number;
  duration?: string;
  lastGate?: {
    verdict: 'passed' | 'failed' | 'blocked';
  };
  lastTransition?: string;
}

export interface Feature {
  name: string;
  status: 'unknown' | 'active' | 'executing' | 'completed';
  tasks: Task[];
  createdAt?: string;
  completedAt?: string;
  _last_modified?: string;
  _runStartedAt?: string;
  summary?: {
    duration?: string;
  };
  tokenUsage?: FeatureTokenUsage | null;
}

export interface TaskTokenUsage {
  phase: string;
  dispatches: number;
  inputTokens: number;
  cachedInput: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface PhaseTokenUsage {
  dispatches: number;
  inputTokens: number;
  cachedInput: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface FeatureTokenUsage {
  byTask: Record<string, TaskTokenUsage>;
  byPhase: Record<string, PhaseTokenUsage>;
  total: PhaseTokenUsage;
}

export interface BacklogItem {
  source: string;
  title: string;
  description?: string;
}

export interface Issue {
  number: number;
  title: string;
}

export interface TokenSummary {
  input: number;
  cached: number;
  output: number;
  reasoning: number;
  total: number;
}

export interface DailyTokenUsage {
  date: string;
  total: number;
  input: number;
  output: number;
  cached: number;
}

export interface ModelUsage {
  model: string;
  total: number;
  input: number;
  output: number;
}

export interface SourceUsage {
  source: string;
  total: number;
  input: number;
  output: number;
}

export interface TokenData {
  available: boolean;
  summary: TokenSummary;
  daily: DailyTokenUsage[];
  models: ModelUsage[];
  sources: SourceUsage[];
  error?: boolean;
  status?: number;
}