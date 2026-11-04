"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RangeToggle } from "@/components/charts";
import { DonutShare, SeriesAreaChart, sliceRange, type RangeKey } from "@/components/chart-kit";
import { EmptyState, ErrorState, PageShell, Panel } from "@/components/states";
import { useStablecoins } from "@/hooks/use-api";
import { formatUsd, pctChange } from "@/lib/format";

const RANGES = ["30D", "90D", "1Y", "All"] as const;

function Change({ now, prev }: { now: number; prev: number }) {
  const c = pctChange(now, prev);
  if (c === null) return <span className="text-muted-foreground">n/a</span>;
  return (
    <span className={c >= 0 ? "text-green-600" : "text-red-600"}>
      {c >= 0 ? "+" : ""}
      {c.toFixed(2)}%
    </span>
  );
}

export default function LiquidityPage() {
  const { data, isLoading, error, refetch } = useStablecoins();
  const [range, setRange] = useState<(typeof RANGES)[number]>("90D");

  const fullSeries = data?.series;
  const series = useMemo(
    () => sliceRange(fullSeries ?? [], range as RangeKey).map((p) => ({ date: p.date, usd: p.usd })),
    [fullSeries, range]
  );

  const assets = data?.assets ?? [];
  const total = assets.reduce((a, c) => a + c.circulatingUsd, 0);
  const totalDay = assets.reduce((a, c) => a + c.prevDayUsd, 0);
  const totalMonth = assets.reduce((a, c) => a + c.prevMonthUsd, 0);
  const slices = assets.map((a) => ({ name: a.symbol, value: a.circulatingUsd }));

  return (
    <PageShell>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Stablecoin supply on Stellar"
          info="Circulating supply of all tracked stablecoins on Stellar, from DefiLlama."
          value={isLoading ? <Skeleton className="h-8 w-24" /> : error || !assets.length ? "n/a" : formatUsd(total)}
        />
        <StatCard
          title="Change, 24h"
          value={isLoading ? <Skeleton className="h-8 w-24" /> : assets.length ? <Change now={total} prev={totalDay} /> : "n/a"}
        />
        <StatCard
          title="Change, 30d"
          value={isLoading ? <Skeleton className="h-8 w-24" /> : assets.length ? <Change now={total} prev={totalMonth} /> : "n/a"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Total stablecoin supply"
          className="lg:col-span-2"
          id="supply-chart"
          action={<RangeToggle options={RANGES} value={range} onChange={setRange} />}
        >
          {isLoading ? (
            <Skeleton className="h-[300px] w-full lg:h-[470px]" />
          ) : error || !data?.series ? (
            <ErrorState message={error?.message ?? "Supply history unavailable"} onRetry={() => refetch()} />
          ) : series.length === 0 ? (
            <EmptyState title="No supply history" />
          ) : (
            <SeriesAreaChart
              data={series}
              xUnit="s"
              series={[{ key: "usd", name: "Supply" }]}
              formatY={(v) => formatUsd(v)}
              formatTip={(v) => formatUsd(v, false)}
              className="h-[300px] lg:h-[470px]"
            />
          )}
        </Panel>

        <Panel title="Share by asset" id="asset-share">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !assets.length ? (
            <ErrorState message={error?.message ?? "Asset breakdown unavailable"} onRetry={() => refetch()} />
          ) : (
            <DonutShare slices={slices} formatValue={(v) => formatUsd(v)} footnote={`${slices.length} assets on Stellar.`} />
          )}
        </Panel>
      </div>

      <Panel title="Assets on Stellar" id="asset-table">
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !assets.length ? (
          <EmptyState title="No asset data" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Supply</TableHead>
                  <TableHead className="text-right">24h</TableHead>
                  <TableHead className="text-right">7d</TableHead>
                  <TableHead className="text-right">30d</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span className="font-medium">{a.symbol}</span>{" "}
                      <span className="text-muted-foreground">{a.name}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(a.circulatingUsd)}</TableCell>
                    <TableCell className="text-right tabular-nums"><Change now={a.circulatingUsd} prev={a.prevDayUsd} /></TableCell>
                    <TableCell className="text-right tabular-nums"><Change now={a.circulatingUsd} prev={a.prevWeekUsd} /></TableCell>
                    <TableCell className="text-right tabular-nums"><Change now={a.circulatingUsd} prev={a.prevMonthUsd} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          This is total stablecoin supply on Stellar. Per-bridge pool reserves (CCTP, USDT0, Allbridge) are not
          exposed by any public API, so a sudden supply drop is the closest signal of a float problem.
        </p>
      </Panel>
    </PageShell>
  );
}
