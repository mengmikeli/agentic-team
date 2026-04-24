import type { Feature } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { humanizeName } from '@/lib/utils';
import { X } from 'lucide-react';

interface FeatureDetailProps {
  feature: Feature | null;
  onClose: () => void;
}

function fmtCost(v: number) {
  if (!Number.isFinite(v)) return '—';
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}
function fmtMs(v: number) {
  if (!Number.isFinite(v)) return '—';
  if (v >= 3_600_000) return `${(v / 3_600_000).toFixed(1)}h`;
  if (v >= 60000) return `${(v / 60000).toFixed(1)}m`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
  return `${Math.round(v)}ms`;
}
function fmtK(v: number) {
  if (!Number.isFinite(v)) return '—';
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

export function FeatureDetail({ feature, onClose }: FeatureDetailProps) {
  if (!feature) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">Select a feature</div>
        </CardContent>
      </Card>
    );
  }

  const { tokenUsage } = feature;

  const startTs = feature._runStartedAt || feature.createdAt;
  const endTs = feature.completedAt || feature._last_modified;
  const wallClockMs = startTs && endTs ? new Date(endTs).getTime() - new Date(startTs).getTime() : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="truncate">{humanizeName(feature.name)}</CardTitle>
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded-sm p-1 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close detail"
        >
          <X className="size-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {wallClockMs != null && wallClockMs > 0 && (
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-muted-foreground border-b border-border pb-3">
            <span>Run duration: <span className="text-foreground">{fmtMs(wallClockMs)}</span></span>
            {tokenUsage?.total?.costUsd != null && (
              <span>Cost: <span className="text-foreground">{fmtCost(tokenUsage.total.costUsd)}</span></span>
            )}
            {tokenUsage?.total?.durationMs != null && (
              <span>LLM time: <span className="text-foreground">{fmtMs(tokenUsage.total.durationMs)}</span></span>
            )}
          </div>
        )}
        {!tokenUsage ? (
          <div className="text-sm text-muted-foreground py-4 text-center">No token data available</div>
        ) : (
          <TokenBreakdown feature={feature} tokenUsage={tokenUsage} />
        )}
      </CardContent>
    </Card>
  );
}

function TokenBreakdown({ feature, tokenUsage }: { feature: Feature; tokenUsage: NonNullable<Feature['tokenUsage']> }) {
  const taskMap = new Map(feature.tasks.map(t => [t.id, t.title]));
  const total = tokenUsage.total;

  return (
    <>
      {/* Per-task table */}
      {Object.keys(tokenUsage.byTask).length > 0 && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Per Task</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono tabular-nums">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-1 pr-2 font-normal">Task</th>
                  <th className="text-left pb-1 pr-2 font-normal">Phase</th>
                  <th className="text-right pb-1 pr-2 font-normal">In</th>
                  <th className="text-right pb-1 pr-2 font-normal">Cached</th>
                  <th className="text-right pb-1 pr-2 font-normal">Out</th>
                  <th className="text-right pb-1 pr-2 font-normal">Cost</th>
                  <th className="text-right pb-1 font-normal">Dur</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(tokenUsage.byTask).map(([id, tu]) => (
                  <tr key={id} className="border-b border-border/40 last:border-0">
                    <td className="py-1 pr-2 max-w-[8rem] truncate text-foreground" title={taskMap.get(id) || id}>
                      {taskMap.get(id) || id}
                    </td>
                    <td className="py-1 pr-2 text-muted-foreground">{tu.phase}</td>
                    <td className="py-1 pr-2 text-right">{fmtK(tu.inputTokens)}</td>
                    <td className="py-1 pr-2 text-right">{fmtK(tu.cachedInput)}</td>
                    <td className="py-1 pr-2 text-right">{fmtK(tu.outputTokens)}</td>
                    <td className="py-1 pr-2 text-right text-foreground">{fmtCost(tu.costUsd)}</td>
                    <td className="py-1 text-right text-muted-foreground">{fmtMs(tu.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Phase breakdown */}
      {Object.keys(tokenUsage.byPhase).length > 0 && (
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">By Phase</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono tabular-nums">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-1 pr-2 font-normal">Phase</th>
                  <th className="text-right pb-1 pr-2 font-normal">Dispatches</th>
                  <th className="text-right pb-1 pr-2 font-normal">Tokens</th>
                  <th className="text-right pb-1 pr-2 font-normal">Cost</th>
                  <th className="text-right pb-1 font-normal">Dur</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(tokenUsage.byPhase).map(([phase, pu]) => (
                  <tr key={phase} className="border-b border-border/40 last:border-0">
                    <td className="py-1 pr-2 text-foreground">{phase}</td>
                    <td className="py-1 pr-2 text-right text-muted-foreground">{pu.dispatches}</td>
                    <td className="py-1 pr-2 text-right text-muted-foreground">{fmtK((pu.inputTokens || 0) + (pu.cachedInput || 0) + (pu.outputTokens || 0))}</td>
                    <td className="py-1 pr-2 text-right text-foreground">{fmtCost(pu.costUsd)}</td>
                    <td className="py-1 text-right text-muted-foreground">{fmtMs(pu.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Total */}
      <div className="flex items-center justify-between pt-1 border-t border-border text-xs font-mono tabular-nums">
        <span className="text-muted-foreground">Total</span>
        <span className="text-foreground font-medium">{fmtCost(total?.costUsd ?? 0)}</span>
        <span className="text-muted-foreground">{fmtK((total?.inputTokens ?? 0) + (total?.cachedInput ?? 0) + (total?.outputTokens ?? 0))} tokens</span>
        <span className="text-muted-foreground">{fmtMs(total?.durationMs ?? 0)}</span>
      </div>
    </>
  );
}
