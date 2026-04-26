import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FeatureAnalytics {
  name: string;
  status: string;
  passes: number;
  reviewFails: number;
  gateFails: number;
  replans: number;
  failRate: number;
  cost: number;
  reviewCost: number;
}

interface Analytics {
  features: FeatureAnalytics[];
  totals: {
    passes: number;
    reviewFails: number;
    gateFails: number;
    replans: number;
    cost: number;
    reviewCost: number;
    failRate: number;
    reviewPct: number;
  };
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border bg-popover p-2 text-xs">
      <p className="font-medium mb-1 truncate max-w-[200px]">{label}</p>
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex justify-between gap-3">
          <span className="text-muted-foreground">{e.name}</span>
          <span className="font-mono tabular-nums">{e.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsView() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="text-center py-8 text-muted-foreground text-sm">Loading analytics...</div>;

  const { totals, features } = data;
  const activeFeatures = features.filter(f => f.passes + f.reviewFails + f.gateFails > 0);
  const buildCost = totals.cost - totals.reviewCost;

  // Chart: pass vs fail per feature (top 10 by attempts)
  const chartData = activeFeatures
    .map(f => ({
      name: f.name.slice(0, 25),
      pass: f.passes,
      fail: f.reviewFails + f.gateFails,
      cost: f.cost,
    }))
    .sort((a, b) => (b.pass + b.fail) - (a.pass + a.fail))
    .slice(0, 12);

  // Cost chart
  const costData = activeFeatures
    .filter(f => f.cost > 0)
    .map(f => ({
      name: f.name.slice(0, 25),
      review: f.reviewCost,
      build: f.cost - f.reviewCost,
    }))
    .sort((a, b) => (b.review + b.build) - (a.review + a.build));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Analytics</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Cost</div>
            <div className="text-2xl font-bold font-mono tabular-nums mt-1 text-primary">${totals.cost.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">review: ${totals.reviewCost.toFixed(2)} ({totals.reviewPct}%)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pass Rate</div>
            <div className="text-2xl font-bold font-mono tabular-nums mt-1">{100 - totals.failRate}%</div>
            <div className="text-xs text-muted-foreground">{totals.passes} pass / {totals.reviewFails + totals.gateFails} fail</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Replans</div>
            <div className="text-2xl font-bold font-mono tabular-nums mt-1">{totals.replans}</div>
            <div className="text-xs text-muted-foreground">task re-decompositions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Build vs Review</div>
            <div className="text-2xl font-bold font-mono tabular-nums mt-1">${buildCost.toFixed(0)} / ${totals.reviewCost.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">build $ / review $</div>
          </CardContent>
        </Card>
      </div>

      {/* Pass/Fail chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle>Pass vs Fail by Feature</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48 md:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="pass" stackId="a" fill="hsl(var(--foreground))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="fail" stackId="a" fill="var(--ops-accent)" radius={[1, 1, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-foreground" />pass</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: 'var(--ops-accent)' }} />fail</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost breakdown chart */}
      {costData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle>Cost by Feature (Build vs Review)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48 md:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="build" stackId="a" fill="hsl(var(--foreground))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="review" stackId="a" fill="var(--ops-accent)" radius={[1, 1, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-foreground" />build</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: 'var(--ops-accent)' }} />review</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feature table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle>All Features</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono tabular-nums">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left pb-1 pr-2 font-normal">Feature</th>
                  <th className="text-right pb-1 pr-2 font-normal">Pass</th>
                  <th className="text-right pb-1 pr-2 font-normal">Fail</th>
                  <th className="text-right pb-1 pr-2 font-normal">Fail%</th>
                  <th className="text-right pb-1 pr-2 font-normal">Cost</th>
                  <th className="text-right pb-1 font-normal">Rev%</th>
                </tr>
              </thead>
              <tbody>
                {activeFeatures.sort((a, b) => b.cost - a.cost).map((f, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-1 pr-2 truncate max-w-[200px]">{f.name}</td>
                    <td className="py-1 pr-2 text-right">{f.passes}</td>
                    <td className="py-1 pr-2 text-right">{f.reviewFails + f.gateFails}</td>
                    <td className="py-1 pr-2 text-right">{f.failRate}%</td>
                    <td className="py-1 pr-2 text-right">{f.cost > 0 ? `$${f.cost.toFixed(2)}` : '—'}</td>
                    <td className="py-1 text-right">{f.cost > 0 ? `${Math.round(f.reviewCost / f.cost * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
