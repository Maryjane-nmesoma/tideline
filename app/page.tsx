"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UniversalLoader } from "@/components/ui/universal-loader";
import { TransferTable } from "@/components/transfer-table";
import { SourceHealth } from "@/components/source-health";
import { ChartTooltip, useChartTheme } from "@/components/charts";
import { EmptyState, ErrorState, PageShell, Panel } from "@/components/states";
import { useStablecoins, useStats, useTransferFeed } from "@/hooks/use-api";
import { formatDuration, formatUsd, pctChange } from "@/lib/format";

function StatValue({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return loading ? <Skeleton className="h-8 w-28" /> : <>{children}</>;
}

export default function OverviewPage() {
  const stats = useStats();
  const feed = useTransferFeed("all", 10);
  const coins = useStablecoins();
  const chart = useChartTheme();

  const day = stats.data?.day;
  const week = stats.data?.week;
  const supply = coins.data?.assets?.reduce((a, c) => a + c.circulatingUsd, 0);
  const supplyWeekAgo = coins.data?.assets?.reduce((a, c) => a + c.prevWeekUsd, 0);
  const supplyChange = supply !== undefined && supplyWeekAgo ? pctChange(supply, supplyWeekAgo) : null;

  const rows = feed.data?.pages.flatMap((p) => p.transfers) ?? [];
  const stuck = rows.filter((t) => t.status === "stalled" || t.status === "failed");

  return (
    <PageShell>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Transfers, 24h"
          info="LayerZero messages to or from Stellar in the last 24 hours. Stellar volume is low, so this number is often small."
          value={
            <StatValue loading={stats.isLoading}>
              {stats.error ? "n/a" : (day?.total ?? 0)}
              {day && (
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {day.inbound} in, {day.outbound} out
                </span>
              )}
            </StatValue>
          }
        />
        <StatCard
          title="Median delivery, 7d"
          info="Median time from source confirmation to destination execution for delivered LayerZero messages."
          value={
            <StatValue loading={stats.isLoading}>
              {stats.error ? "n/a" : formatDuration(week?.medianLatencySeconds)}
              {week && (
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  p90 {formatDuration(week.p90LatencySeconds)}
                </span>
              )}
            </StatValue>
          }
        />
        <StatCard
          title="Stalled or failed, 7d"
          info="Messages stuck beyond 60 minutes, with a stored payload, or failed."
          value={
            <StatValue loading={stats.isLoading}>
              {stats.error ? "n/a" : (week ? week.stalled + week.failed : 0)}
              {week && (
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {week.inFlight} still in flight
                </span>
              )}
            </StatValue>
          }
        />
        <StatCard
          title="Stablecoins on Stellar"
          info="Circulating stablecoin supply on Stellar from DefiLlama."
          value={
            <StatValue loading={coins.isLoading}>
              {supply !== undefined ? formatUsd(supply) : "n/a"}
              {supplyChange !== null && (
                <span
                  className={`mt-1 block text-xs font-normal ${
                    supplyChange >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  7d: {supplyChange >= 0 ? "+" : ""}
                  {supplyChange.toFixed(2)}%
                </span>
              )}
            </StatValue>
          }
        />
      </div>

      {stuck.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-600/30 bg-red-600/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              {stuck.length} recent transfer{stuck.length > 1 ? "s need" : " needs"} attention
            </p>
            <p className="text-muted-foreground">
              Open one to see which verifier or executor step is holding it.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/transfers/${encodeURIComponent(stuck[0].id)}`}>Diagnose</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Daily transfers, last 30 days" className="lg:col-span-2" id="daily-transfers">
          <div className="h-[300px]">
            {stats.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : stats.error || !stats.data ? (
              <ErrorState message={stats.error?.message} onRetry={() => stats.refetch()} />
            ) : stats.data.month.total === 0 ? (
              <EmptyState title="No transfers in the last 30 days" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.data.daily} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid vertical={false} stroke={chart.cursor} strokeOpacity={0.4} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: chart.tick }}
                    minTickGap={40}
                    tickFormatter={(d: number) =>
                      new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    }
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                    tick={{ fontSize: 11, fill: chart.tick }}
                  />
                  <Tooltip
                    cursor={{ fill: chart.cursor, fillOpacity: 0.2 }}
                    content={
                      <ChartTooltip
                        formatLabel={(l) =>
                          new Date(Number(l)).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })
                        }
                      />
                    }
                  />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="inbound" name="Into Stellar" stackId="a" fill={chart.stroke} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="outbound" name="Out of Stellar" stackId="a" fill={chart.stroke2} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {stats.data?.capped && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing the most recent messages only; the 30 day window was larger than the fetch cap.
            </p>
          )}
        </Panel>
        <SourceHealth />
      </div>

      <Panel
        title="Live cross-chain feed"
        id="live-feed"
        action={
          <Button asChild variant="link" size="sm" className="px-0">
            <Link href="/transfers">
              View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      >
        {feed.isLoading ? (
          <UniversalLoader
            variant="table"
            rows={6}
            config={{
              columns: [{ type: "badge" }, { type: "text" }, { type: "badge" }, { type: "text" }, { type: "text" }],
            }}
          />
        ) : feed.error ? (
          <ErrorState message={feed.error.message} onRetry={() => feed.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No transfers found" message="LayerZero Scan returned no messages touching Stellar." />
        ) : (
          <TransferTable transfers={rows} />
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          LayerZero messages only. Circle CCTP has no public feed, so find CCTP transfers by searching a burn
          transaction hash.
        </p>
      </Panel>
    </PageShell>
  );
}
