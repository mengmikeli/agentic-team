import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ChevronRight, CheckCircle2, XCircle, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutionStepsProps {
  featureName: string;
  projectPath: string;
}

interface TaskDetail {
  id: string;
  handshake: {
    taskId: string;
    status: string;
    verdict: string;
    summary: string;
    timestamp: string;
    findings: Array<{ severity: string; text: string }>;
  } | null;
  eval: string | null;
  rounds: Array<{
    verdict: string;
    summary: string;
    timestamp: string;
  }>;
}

const verdictIcon = (verdict: string | undefined) => {
  switch (verdict?.toLowerCase()) {
    case 'pass': return <CheckCircle2 className="size-3.5 text-green-500" />;
    case 'fail': return <XCircle className="size-3.5 text-red-500" />;
    case 'blocked': return <AlertCircle className="size-3.5 text-yellow-500" />;
    default: return <Circle className="size-3.5 text-muted-foreground" />;
  }
};

const verdictColor = (verdict: string | undefined) => {
  switch (verdict?.toLowerCase()) {
    case 'pass': return 'text-green-500';
    case 'fail': return 'text-red-500';
    case 'blocked': return 'text-yellow-500';
    default: return 'text-muted-foreground';
  }
};

export function ExecutionSteps({ featureName, projectPath }: ExecutionStepsProps) {
  const [detail, setDetail] = useState<{ progress: string | null; tasks: TaskDetail[] } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getFeatureDetail(projectPath, featureName)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [featureName, projectPath]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <div className="text-xs text-muted-foreground py-4">Loading execution data...</div>;
  if (!detail || detail.tasks.length === 0) return <div className="text-xs text-muted-foreground py-4">No execution data available</div>;

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Execution Steps</h4>
      
      {detail.tasks.map((task, i) => {
        const isExpanded = expanded.has(task.id);
        const verdict = task.handshake?.verdict;
        const hasRounds = task.rounds.length > 0;
        const timestamp = task.handshake?.timestamp;
        
        return (
          <div key={task.id} className="border rounded-md overflow-hidden">
            {/* Task header - clickable */}
            <button
              onClick={() => toggle(task.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
            >
              <ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
              
              {/* Step number */}
              <span className="text-[10px] font-mono text-muted-foreground w-6 shrink-0">
                {i + 1}
              </span>
              
              {/* Verdict icon */}
              {verdictIcon(verdict)}
              
              {/* Task ID + title from handshake */}
              <span className="text-xs font-medium truncate flex-1">
                {task.handshake?.taskId || task.id}
              </span>
              
              {/* Rounds indicator */}
              {hasRounds && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {task.rounds.length + 1}R
                </span>
              )}
              
              {/* Verdict text */}
              <span className={cn("text-[10px] font-mono font-semibold uppercase", verdictColor(verdict))}>
                {verdict || 'pending'}
              </span>
            </button>
            
            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t bg-muted/10 px-3 py-2 space-y-2 text-xs">
                {/* Summary */}
                {task.handshake?.summary && (
                  <div>
                    <span className="text-muted-foreground font-medium">Summary: </span>
                    <span className="text-foreground">{task.handshake.summary.slice(0, 300)}</span>
                  </div>
                )}
                
                {/* Timestamp */}
                {timestamp && (
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {new Date(timestamp).toLocaleString()}
                  </div>
                )}
                
                {/* Review rounds */}
                {hasRounds && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium">Review Rounds:</span>
                    {task.rounds.map((round, ri) => (
                      <div key={ri} className="flex items-center gap-2 pl-4 py-1 border-l-2 border-muted">
                        <span className="text-[10px] font-mono text-muted-foreground">R{ri + 1}</span>
                        {verdictIcon(round.verdict)}
                        <span className={cn("text-[10px] font-mono", verdictColor(round.verdict))}>
                          {round.verdict}
                        </span>
                        {round.summary && (
                          <span className="text-[10px] text-muted-foreground truncate">{round.summary.slice(0, 100)}</span>
                        )}
                      </div>
                    ))}
                    {/* Final round */}
                    <div className="flex items-center gap-2 pl-4 py-1 border-l-2 border-primary/30">
                      <span className="text-[10px] font-mono text-muted-foreground">R{task.rounds.length + 1}</span>
                      {verdictIcon(verdict)}
                      <span className={cn("text-[10px] font-mono font-semibold", verdictColor(verdict))}>
                        {verdict} (final)
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Findings */}
                {task.handshake?.findings && task.handshake.findings.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium">Findings:</span>
                    {task.handshake.findings.slice(0, 10).map((f, fi) => (
                      <div key={fi} className="flex gap-2 pl-4 text-[10px]">
                        <span className={cn(
                          "shrink-0 font-mono",
                          f.severity === 'critical' ? 'text-red-500' : f.severity === 'warning' ? 'text-yellow-500' : 'text-blue-400'
                        )}>
                          {f.severity === 'critical' ? 'CRIT' : f.severity === 'warning' ? 'WARN' : 'INFO'}
                        </span>
                        <span className="text-muted-foreground">{f.text?.slice(0, 150)}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Eval markdown (collapsible) */}
                {task.eval && (
                  <details className="text-[10px]">
                    <summary className="text-muted-foreground cursor-pointer hover:text-foreground font-medium">
                      Review eval ({task.eval.length} chars)
                    </summary>
                    <pre className="mt-1 p-2 bg-background rounded text-[9px] overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {task.eval.slice(0, 2000)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
