import type { Feature, Task } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { humanizeName, truncate, relativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Clock, XCircle, AlertCircle, Zap } from 'lucide-react';

interface TaskBoardProps {
  features: Feature[];
  selectedFeature: string | null;
  onFeatureChange: (featureName: string | null) => void;
}

function getTaskIcon(status: string) {
  switch (status) {
    case 'passed': return <CheckCircle2 className="size-4 text-foreground" />;
    case 'failed': return <XCircle className="size-4 text-[var(--ops-error)]" />;
    case 'blocked': return <AlertCircle className="size-4 text-[var(--ops-error)]" />;
    case 'in-progress': return <Zap className="size-4 text-primary" />;
    default: return <Circle className="size-4 text-muted-foreground" />;
  }
}

function TaskColumn({ title, tasks, emptyMessage, isActive }: { title: string; tasks: Task[]; emptyMessage: string; isActive?: boolean }) {
  return (
    <div className="space-y-2">
      <h4 className={cn(
        "text-xs font-medium uppercase tracking-wider",
        isActive ? "text-primary" : "text-muted-foreground"
      )}>
        {title} <span className="font-mono tabular-nums">({tasks.length})</span>
      </h4>
      <div className="space-y-1.5">
        {tasks.length === 0 ? (
          <div className="text-center py-3 text-xs text-muted-foreground">{emptyMessage}</div>
        ) : (
          tasks.map((task, index) => (
            <div key={index} className={cn(
              "p-2.5 rounded-sm border bg-card space-y-1",
              task.status === 'in-progress' && "border-l-2 border-l-primary"
            )}>
              <div className="flex items-start gap-2">
                {getTaskIcon(task.status)}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] text-muted-foreground">{task.id}</div>
                  <div className="text-xs">{truncate(task.description || task.title || '—', 60)}</div>
                </div>
              </div>
              {task.duration && (
                <div className="text-[10px] text-muted-foreground font-mono tabular-nums pl-6">{task.duration}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecentActivity({ features }: { features: Feature[] }) {
  const events: Array<{ feature: Feature; task: Task; time: string }> = [];
  for (const feature of features) {
    for (const task of (feature.tasks || []).filter(t => t.title !== 'Quality gate passes')) {
      if (task.lastTransition) events.push({ feature, task, time: task.lastTransition });
    }
  }
  events.sort((a, b) => b.time.localeCompare(a.time));
  const recent = events.slice(0, 10);

  if (recent.length === 0) {
    return <div className="text-center py-8 text-sm text-muted-foreground">No recent activity</div>;
  }

  return (
    <div className="space-y-0.5">
      {recent.map((event, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-muted/50 transition-colors">
          {getTaskIcon(event.task.status)}
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{truncate(event.task.description || event.task.title || '—', 50)}</div>
            <div className="text-xs text-muted-foreground font-mono tabular-nums">
              {humanizeName(event.feature.name)} · {relativeTime(event.time)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TaskBoard({ features, selectedFeature, onFeatureChange }: TaskBoardProps) {
  const withState = features.filter((f) => f.status && f.status !== 'unknown');
  const feature = selectedFeature ? withState.find(f => f.name === selectedFeature) : null;

  const featureOptions = [
    { value: '__recent__', label: 'Recent Activity' },
    ...withState.map(f => ({ value: f.name, label: humanizeName(f.name) }))
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Tasks</CardTitle>
          {featureOptions.length > 1 && (
            <Select
              value={selectedFeature || '__recent__'}
              onValueChange={(v) => onFeatureChange(v === '__recent__' ? null : v)}
            >
              <SelectTrigger className="w-48 md:w-56 bg-card border-border text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {featureOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!selectedFeature || !feature ? (
          <RecentActivity features={withState} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TaskColumn title="Pending" tasks={(feature.tasks || []).filter(t => t.status === 'pending' && t.title !== 'Quality gate passes')} emptyMessage="—" />
            <TaskColumn title="Active" isActive tasks={(feature.tasks || []).filter(t => t.status === 'in-progress' && t.title !== 'Quality gate passes')} emptyMessage="—" />
            <TaskColumn title="Done" tasks={(feature.tasks || []).filter(t => ['passed', 'skipped'].includes(t.status) && t.title !== 'Quality gate passes')} emptyMessage="—" />
            <TaskColumn title="Blocked" tasks={(feature.tasks || []).filter(t => ['failed', 'blocked'].includes(t.status) && t.title !== 'Quality gate passes')} emptyMessage="—" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
