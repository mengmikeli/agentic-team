import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Zap, Clock, Search, Hammer, Eye } from 'lucide-react';

interface LoopStatus {
  phase: string;
  cycle?: number;
  feature?: string;
  updatedAt?: string;
}

const PHASE_CONFIG: Record<string, { icon: typeof Zap; label: string }> = {
  prioritizing: { icon: Search, label: 'Prioritizing' },
  brainstorming: { icon: Zap, label: 'Brainstorming' },
  executing: { icon: Hammer, label: 'Executing' },
  reviewing: { icon: Eye, label: 'Reviewing' },
};

export function LoopStatusBanner() {
  const [status, setStatus] = useState<LoopStatus | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/api/loop-status');
        if (res.ok) setStatus(await res.json());
      } catch {}
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!status || status.phase === 'idle') return null;

  const config = PHASE_CONFIG[status.phase];
  if (!config) return null;

  const Icon = config.icon;
  const elapsed = status.updatedAt
    ? Math.round((Date.now() - new Date(status.updatedAt).getTime()) / 1000)
    : 0;
  const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.round(elapsed / 60)}m`;

  return (
    <div className="border-b border-primary/20 bg-[var(--ops-accent-subtle)] px-4 md:px-6 py-2">
      <div className="flex items-center gap-2 text-xs">
        <Icon className="size-3.5 text-primary animate-pulse" />
        <span className="font-medium text-primary">{config.label}</span>
        {status.feature && (
          <span className="text-muted-foreground truncate">{status.feature}</span>
        )}
        <span className="text-muted-foreground ml-auto font-mono tabular-nums">
          cycle {status.cycle || '?'} · {elapsedStr} ago
        </span>
      </div>
    </div>
  );
}
