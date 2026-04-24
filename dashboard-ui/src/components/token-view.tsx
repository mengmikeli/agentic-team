import type { TokenData } from '@/types';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTokens } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';

interface TokenViewProps {
  tokenData: TokenData | null;
  loading: boolean;
  days: number;
  onDaysChange: (days: number) => void;
}

const RANGE_OPTIONS = [
  { value: 1, label: '24h' },
  { value: 7, label: '7d' },
  { value: 28, label: '28d' },
];

function TokenSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border bg-popover p-2.5 shadow-md text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground capitalize">{entry.name}</span>
          <span className="font-mono tabular-nums">{formatTokens(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function TokenView({ tokenData, loading, days, onDaysChange }: TokenViewProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/tokens/sync', { method: 'POST' });
      const data = await res.json();
      setSyncMsg(data.ok ? `Synced${data.records ? ` ${data.records} records` : ''}` : 'Sync failed');
      setTimeout(() => setSyncMsg(null), 3000);
    } catch {
      setSyncMsg('Sync failed');
      setTimeout(() => setSyncMsg(null), 3000);
    } finally {
      setSyncing(false);
    }
  }
  if (loading && !tokenData) return <TokenSkeleton />;

  if (!tokenData || tokenData.error) {
    return (
      <Card><CardContent className="p-8">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>Failed to load token data.</AlertDescription>
        </Alert>
      </CardContent></Card>
    );
  }

  if (tokenData.available === false) {
    return (
      <Card><CardContent className="p-8 text-center space-y-3">
        <TrendingUp className="size-8 mx-auto text-muted-foreground opacity-40" />
        <div className="text-sm">Install <a href="https://github.com/nicepkg/pew" target="_blank" rel="noopener noreferrer" className="text-primary underline">pew</a> for token tracking</div>
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">npm i -g pew</code>
      </CardContent></Card>
    );
  }

  const { summary, daily = [], models = [], sources = [] } = tokenData;
  const s = summary || { input: 0, cached: 0, output: 0, reasoning: 0, total: 0 };
  const rangeLabel = days === 1 ? '24 hours' : days === 28 ? '28 days' : '7 days';

  const chartData = daily.map(d => {
    const dateObj = new Date(d.date + 'T00:00:00');
    const label = days <= 7
      ? dateObj.toLocaleDateString('en-US', { weekday: 'short' })
      : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { date: label, cached: d.cached || 0, input: d.input || 0, output: d.output || 0 };
  });

  const stats = [
    { label: 'Total', value: s.total },
    { label: 'Input', value: s.input },
    { label: 'Cached', value: s.cached },
    { label: 'Output', value: s.output },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Tokens</h2>
          <p className="text-xs text-muted-foreground">{rangeLabel} · all tools</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-sm transition-all",
              "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              syncing && "opacity-50 cursor-not-allowed"
            )}
            title="Run pew sync"
          >
            <RefreshCw className={cn("size-3", syncing && "animate-spin")} />
            {syncMsg || 'Sync'}
          </button>
          <div className="flex bg-muted/80 rounded-sm p-0.5">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => onDaysChange(opt.value)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-sm transition-all",
                  days === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards — monochrome, same pattern as project stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <Card key={stat.label} className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-0.5 h-full bg-primary" />
            <CardContent className="p-4 pl-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</div>
              <div className={`text-2xl font-bold font-mono tabular-nums mt-1 ${i === 0 ? 'text-primary' : ''}`}>{formatTokens(stat.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart — stacked bars using accent at different opacities */}
      <Card>
        <CardHeader className="pb-2"><CardTitle>Daily</CardTitle></CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data</div>
          ) : (
            <div className="h-48 md:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => formatTokens(v)} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                  <Bar dataKey="cached" stackId="a" fill="var(--chart-low)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="input" stackId="a" fill="var(--chart-mid)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="output" stackId="a" fill="var(--chart-high)" radius={[1, 1, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: 'var(--chart-low)' }} />cached</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: 'var(--chart-mid)' }} />input</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: 'var(--chart-high)' }} />output</span>
          </div>
        </CardContent>
      </Card>

      {/* Model + Source — monochrome bars with accent */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {models.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle>Models</CardTitle></CardHeader>
            <CardContent className="space-y-2.5">
              {models.map((model, i) => {
                const pct = Math.max(2, (model.total / (models[0]?.total || 1)) * 100);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs truncate flex-1">{model.model}</span>
                      <span className="font-mono text-xs tabular-nums">{formatTokens(model.total)}</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--ops-accent)' }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
        {sources.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle>Sources</CardTitle></CardHeader>
            <CardContent className="space-y-2.5">
              {sources.map((source, i) => {
                const pct = Math.max(2, (source.total / (sources[0]?.total || 1)) * 100);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs truncate flex-1">{source.source}</span>
                      <span className="font-mono text-xs tabular-nums">{formatTokens(source.total)}</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--ops-accent-dim)' }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {s.reasoning > 0 && (
        <Card><CardContent className="p-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Reasoning</span>
          <span className="font-mono tabular-nums">{formatTokens(s.reasoning)}</span>
        </CardContent></Card>
      )}
    </div>
  );
}
