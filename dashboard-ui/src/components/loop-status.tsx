import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Zap, Search, Hammer, Eye } from 'lucide-react';

interface LoopStatus {
  phase: string;
  cycle?: number;
  feature?: string;
  updatedAt?: string;
  project?: string;
}

const PHASE_CONFIG: Record<string, { icon: typeof Zap; label: string; accent?: boolean }> = {
  prioritizing: { icon: Search, label: 'Prioritizing' },
  brainstorming: { icon: Zap, label: 'Brainstorming' },
  executing: { icon: Hammer, label: 'Executing' },
  reviewing: { icon: Eye, label: 'Reviewing' },
  checkpoint: { icon: Eye, label: '⏸ Checkpoint' },
  blocked: { icon: Zap, label: '⚠ Blocked', accent: true },
};

const PROJECT_CODES: Record<string, string> = {
  'agentic-team': 'AGT',
  'sequoia-seed': 'TRY',
  'api.tasteful.work': 'API',
  'LISSA': 'LSA',
  'Atlas History': 'ATL',
};

function getProjectCode(name: string): string {
  return PROJECT_CODES[name] || name.slice(0, 3).toUpperCase();
}

function StatusLine({ status, multi }: { status: LoopStatus; multi: boolean }) {
  const config = PHASE_CONFIG[status.phase];
  if (!config) return null;
  const Icon = config.icon;
  const elapsed = status.updatedAt
    ? Math.round((Date.now() - new Date(status.updatedAt).getTime()) / 1000)
    : 0;
  const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.round(elapsed / 60)}m`;

  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="size-3.5 text-primary" />
      {multi && <span className="font-mono text-[10px] text-primary/60">{getProjectCode(status.project || '')}</span>}
      <span className="font-medium text-primary">{config.label}</span>
      {status.feature && <span className="text-muted-foreground truncate">{status.feature}</span>}
      <span className="text-muted-foreground ml-auto font-mono tabular-nums">
        cycle {status.cycle || '?'} · {elapsedStr} ago
      </span>
    </div>
  );
}

export function LoopStatusBanner({ projects }: { projects: { name: string; path: string }[] }) {
  const [statuses, setStatuses] = useState<LoopStatus[]>([]);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    async function pollAll() {
      const results: LoopStatus[] = [];
      for (const p of projects) {
        try {
          const res = await fetch(`/api/loop-status?path=${encodeURIComponent(p.path)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.phase && data.phase !== 'idle') {
              results.push({ ...data, project: p.name });
            }
          }
        } catch {}
      }
      setStatuses(results);
    }
    pollAll();
    const interval = setInterval(pollAll, 5000);
    return () => clearInterval(interval);
  }, [projects]);

  // Crossfade rotation
  useEffect(() => {
    if (statuses.length <= 1) return;
    const interval = setInterval(() => {
      setVisible(false); // fade out
    }, 5000);
    return () => clearInterval(interval);
  }, [statuses.length]);

  // After fade out completes, switch content and fade in
  const handleTransitionEnd = () => {
    if (!visible) {
      setDisplayIndex(i => (i + 1) % Math.max(statuses.length, 1));
      setVisible(true);
    }
  };

  if (statuses.length === 0) return null;

  const status = statuses[displayIndex % statuses.length];
  if (!status) return null;

  return (
    <div className={cn(
      "border-b px-4 md:px-6 py-2",
      status.phase === 'blocked' ? "border-[var(--ops-error)]/30 bg-[var(--ops-error)]/5" : "border-primary/20 bg-[var(--ops-accent-subtle)]"
    )}>
      <div
        className={cn("transition-opacity duration-700 ease-in-out", visible ? "opacity-100" : "opacity-0")}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1"><StatusLine status={status} multi={statuses.length > 1} /></div>
          {statuses.length > 1 && (
            <span className="text-[10px] font-mono text-primary/40 flex-shrink-0">
              {(displayIndex % statuses.length) + 1}/{statuses.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
