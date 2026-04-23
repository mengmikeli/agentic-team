import type { Feature } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { formatDuration } from '@/lib/utils';

interface StatCardsProps {
  features: Feature[];
  currentProject: { name: string } | null;
}

function computeAvgCycleTime(features: Feature[]): string {
  const completed = features.filter(
    (f) => f.status === 'completed' && f.createdAt && f.completedAt
  );
  if (completed.length === 0) return '—';
  const totalMs = completed.reduce((sum, f) => {
    return sum + (new Date(f.completedAt!).getTime() - new Date(f.createdAt!).getTime());
  }, 0);
  return formatDuration(totalMs / completed.length);
}

export function StatCards({ features, currentProject }: StatCardsProps) {
  const withState = features.filter((f) => f.status && f.status !== 'unknown');
  const completed = withState.filter((f) => f.status === 'completed');
  const completedCount = completed.length;
  const successRate = withState.length > 0 ? Math.round((completedCount / withState.length) * 100) : 0;
  const avgCycleTime = computeAvgCycleTime(withState);
  const totalTasks = withState.reduce(
    (sum, f) => sum + (f.tasks || []).filter(t => t.title !== 'Quality gate passes').length, 0
  );

  const stats = [
    { label: 'Shipped', value: String(completedCount), sub: currentProject?.name || 'Project', highlight: true },
    { label: 'Success', value: `${successRate}%`, sub: 'pass rate', highlight: false },
    { label: 'Cycle', value: avgCycleTime, sub: 'avg / feature', highlight: false },
    { label: 'Tasks', value: String(totalTasks), sub: 'total', highlight: false },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="relative overflow-hidden">
          {/* Accent left strip */}
          <div className="absolute top-0 left-0 w-0.5 h-full bg-primary" />
          <CardContent className="p-4 pl-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</div>
            <div className={`text-2xl font-bold font-mono tabular-nums mt-1 ${stat.highlight ? 'text-primary' : ''}`}>{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
