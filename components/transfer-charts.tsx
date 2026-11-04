"use client";

import { useMemo, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { RangeToggle } from "@/components/charts";
import { DonutShare, SeriesAreaChart, sliceRange, type RangeKey } from "@/components/chart-kit";
import { EmptyState, ErrorState, Panel } from "@/components/states";
import { useRoutes } from "@/hooks/use-api";
import { formatDuration } from "@/lib/format";

const RANGES = ["7D", "30D"] as const;

/** Headline numbers, a daily volume chart and the share by chain for LayerZero transfers touching Stellar. */
export function TransferCharts() {
  const { data, isLoading, error, refetch } = useRoutes();
  const [range, setRange] = useState<(typeof RANGES)[number]>("30D");
  const skel = <Skeleton className="h-8 w-20" />;
  const s = data?.summary;

  const daily = useMemo(
    () => sliceRange(data?.daily ?? [], range as RangeKey).map((d) => ({ ...d })),
    [data?.daily, range]
  );
  const total = s?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Transfers, 30d"
          info="LayerZero messages to or from Stellar over the last 30 days."
          value={
            isLoading ? skel : error ? "n/a" : (
              <>
                {total}
                {s && (
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {s.inbound} in, {s.outbound} out
                  </span>
                )}
              </>
            )
          }
        />
        <StatCard
          title="Median delivery, 30d"
          value={isLoading ? skel : error ? "n/a" : formatDuration(s?.medianLatencySeconds)}
        />
        <StatCard
          title="Slowest 10%, 30d"
          info="90th percentile delivery time. One in ten delivered transfers took at least this long."
          value={isLoading ? skel : error ? "n/a" : formatDuration(s?.p90LatencySeconds)}
        />
        <StatCard
          title="Stalled or failed, 30d"
          info="Stuck beyond 60 minutes, payload stored, or failed."
          value={
            isLoading ? skel : error ? "n/a" : (
              <>
                {s ? s.stalled + s.failed : 0}
                {s && (
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {s.inFlight} still in flight
                  </span>
                )}
              </>
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Daily transfers"
          className="lg:col-span-2"
          id="daily-transfers"
          action={<RangeToggle options={RANGES} value={range} onChange={setRange} />}
        >
          {isLoading ? (
            <Skeleton className="h-[300px] w-full lg:h-[470px]" />
          ) : error || !data ? (
            <ErrorState message={error?.message} onRetry={() => refetch()} />
          ) : total === 0 ? (
            <EmptyState title="No transfers in the last 30 days" />
          ) : (
            <SeriesAreaChart
              data={daily}
              stacked
              series={[
                { key: "inbound", name: "Into Stellar" },
                { key: "outbound", name: "Out of Stellar", color: "secondary" },
              ]}
              className="h-[300px] lg:h-[470px]"
            />
          )}
        </Panel>

        <Panel title="Share by chain" id="chain-share">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : error || !data ? (
            <ErrorState message={error?.message} onRetry={() => refetch()} />
          ) : data.byChain.length === 0 ? (
            <EmptyState title="No chains in this window" />
          ) : (
            <DonutShare
              slices={data.byChain.map((c) => ({ name: c.name, value: c.count }))}
              formatValue={(v) => `${v} transfers`}
              footnote={`${data.byChain.length} chains traded with Stellar in the last 30 days.`}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
