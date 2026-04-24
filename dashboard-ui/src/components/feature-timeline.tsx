import type { Feature } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { humanizeName, relativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Zap } from 'lucide-react';

interface FeatureTimelineProps {
  features: Feature[];
  onFeatureSelect: (featureName: string) => void;
}

export function FeatureTimeline({ features, onFeatureSelect }: FeatureTimelineProps) {
  const withState = features.filter((f) => f.status && f.status !== 'unknown');

  if (withState.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">No features yet</div>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...withState].sort((a, b) => {
    const ta = a.completedAt || a._last_modified || '';
    const tb = b.completedAt || b._last_modified || '';
    return tb.localeCompare(ta);
  });

  return (
    <Card>
      <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-0.5">
          {sorted.map((feature) => {
            const tasks = (feature.tasks || []).filter(t => t.title !== 'Quality gate passes');
            const passed = tasks.filter(t => t.status === 'passed').length;
            const dateStr = feature.completedAt || feature._last_modified || feature.createdAt || '';
            const isActive = ['active', 'executing'].includes(feature.status);
            const isDone = feature.status === 'completed';

            return (
              <div
                key={feature.name}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-sm cursor-pointer transition-colors",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                  isActive && "bg-[var(--ops-accent-subtle)] border-l-2 border-l-primary"
                )}
                onClick={() => onFeatureSelect(feature.name)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFeatureSelect(feature.name); } }}
                tabIndex={0}
                role="button"
              >
                <div className="flex-shrink-0">
                  {isActive ? <Zap className="size-4 text-primary" /> :
                   isDone ? <CheckCircle2 className="size-4 text-muted-foreground" /> :
                   <Circle className="size-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm font-medium truncate", isActive && "text-primary")}>{humanizeName(feature.name)}</div>
                  <div className="text-xs text-muted-foreground font-mono tabular-nums">
                    {passed}/{tasks.length}
                    {dateStr && <span className="ml-2">{relativeTime(dateStr)}</span>}
                  </div>
                </div>
                {feature.tokenUsage?.total?.costUsd != null && (
                  <div className="flex-shrink-0 text-xs font-mono tabular-nums text-muted-foreground">
                    ${feature.tokenUsage.total.costUsd.toFixed(4)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
