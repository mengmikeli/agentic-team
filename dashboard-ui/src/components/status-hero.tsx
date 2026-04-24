import type { Feature } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { humanizeName, formatDuration, relativeTime, getActiveTask } from '@/lib/utils';
import { Clock, Inbox, Zap } from 'lucide-react';

interface StatusHeroProps {
  activeFeature: Feature | null;
  lastCompleted: Feature | null;
}

export function StatusHero({ activeFeature, lastCompleted }: StatusHeroProps) {
  if (activeFeature) {
    const tasks = (activeFeature.tasks || []).filter((t) => t.title !== "Quality gate passes");
    const passed = tasks.filter((t) => t.status === "passed").length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;
    const inProgress = getActiveTask(tasks);
    const currentTaskIndex = inProgress ? tasks.indexOf(inProgress) + 1 : passed + 1;
    const progress = tasks.length > 0 ? Math.round((passed / tasks.length) * 100) : 0;
    const duration = activeFeature.summary?.duration ||
      (activeFeature.createdAt ? formatDuration(Date.now() - new Date(activeFeature.createdAt).getTime()) : '');

    return (
      <Card className="border-l-2 border-l-primary">
        <CardContent className="p-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <Zap className="size-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">{humanizeName(activeFeature.name)}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium text-primary uppercase tracking-wider">Active</span>
                    {duration && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono tabular-nums">
                        <Clock className="size-3" />{duration}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono tabular-nums text-primary">{progress}%</div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Progress value={progress} className="h-1.5" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span><span className="font-mono tabular-nums">{passed}</span> of <span className="font-mono tabular-nums">{tasks.length}</span> tasks{blocked > 0 && <span className="text-[var(--ops-error)]"> · {blocked} blocked</span>}</span>
              </div>
              {/* Current task indicator */}
              {inProgress ? (
                <div className="text-xs text-muted-foreground truncate">
                  <span className="text-primary font-mono">▶ {currentTaskIndex}/{tasks.length}</span>
                  <span className="ml-1.5">{inProgress.title?.slice(0, 60)}</span>
                  {inProgress.attempts != null && inProgress.attempts > 1 && (
                    <span className="ml-1 text-primary font-mono">(attempt {inProgress.attempts})</span>
                  )}
                </div>
              ) : passed < tasks.length ? (
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">Waiting for task {currentTaskIndex}/{tasks.length}...</span>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <Inbox className="size-5 text-muted-foreground" />
          <div>
            <div className="text-sm text-muted-foreground">No active feature</div>
            {lastCompleted ? (
              <div className="text-xs text-muted-foreground">
                Last: <span className="text-foreground">{humanizeName(lastCompleted.name)}</span>
                {lastCompleted.completedAt && <span> · <span className="font-mono tabular-nums">{relativeTime(lastCompleted.completedAt)}</span></span>}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No features completed yet</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
