"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ColumnChart, HorizontalBars } from "@/components/chart-kit";
import { EmptyState, ErrorState, Panel } from "@/components/states";
import { useRoutes } from "@/hooks/use-api";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CorridorStat } from "@/lib/types";

function latencyTone(seconds: number | null) {
  if (seconds === null) return "bg-muted/40 text-muted-foreground";
  if (seconds <= 15 * 60) return "bg-green-600/15 text-green-800 dark:text-green-300";
  if (seconds <= 45 * 60) return "bg-amber-600/15 text-amber-800 dark:text-amber-300";
  return "bg-red-600/15 text-red-800 dark:text-red-300";
}

function Heatmap({ corridors }: { corridors: CorridorStat[] }) {
  const partners = new Map<string, string>();
  for (const c of corridors) {
    if (c.from.key === "stellar" && c.to.key === "stellar") partners.set("stellar", "Stellar (to itself)");
    else if (c.from.key === "stellar") partners.set(c.to.key, c.to.name);
    else if (c.to.key === "stellar") partners.set(c.from.key, c.from.name);
  }
  const find = (partner: string, inbound: boolean) =>
    corridors.find((c) => (inbound ? c.from.key === partner && c.to.key === "stellar" : c.from.key === "stellar" && c.to.key === partner));

  if (!partners.size) return <EmptyState title="No Stellar routes in this window" />;

  const Cell = ({ c }: { c?: CorridorStat }) =>
    c ? (
      <div className={cn("rounded-md px-3 py-2 text-center", latencyTone(c.medianLatencySeconds))}>
        <p className="text-sm font-semibold tabular-nums">{formatDuration(c.medianLatencySeconds)}</p>
        <p className="text-xs opacity-80 tabular-nums">
          {c.count} transfer{c.count > 1 ? "s" : ""}
          {c.stalled > 0 ? `, ${c.stalled} stuck` : ""}
        </p>
      </div>
    ) : (
      <div className="rounded-md bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">No traffic</div>
    );

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[480px] grid-cols-[minmax(120px,1fr)_1fr_1fr] gap-2">
        <div />
        <p className="text-center text-xs font-medium text-muted-foreground">Into Stellar</p>
        <p className="text-center text-xs font-medium text-muted-foreground">Out of Stellar</p>
        {[...partners.entries()].map(([key, name]) => (
          <div key={key} className="contents">
            <p className="flex items-center text-sm font-medium">{name}</p>
            <Cell c={find(key, true)} />
            <Cell c={find(key, false)} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Cell value is the median delivery time. Green is 15 minutes or less, amber up to 45 minutes, red beyond.
      </p>
    </div>
  );
}

export function RouteAnalytics() {
  const { data, isLoading, error, refetch } = useRoutes();
  const stellarOnly = data?.corridors.filter((c) => c.from.key === "stellar" || c.to.key === "stellar") ?? [];
  const volume = stellarOnly.slice(0, 10).map((c) => ({ name: `${c.from.name} to ${c.to.name}`, value: c.count }));
  const delivered = data?.latency.reduce((a, b) => a + b.count, 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Delivery time distribution, 30d" id="latency-histogram">
          {isLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : error || !data ? (
            <ErrorState message={error?.message} onRetry={() => refetch()} />
          ) : delivered === 0 ? (
            <EmptyState title="No delivered transfers in this window" />
          ) : (
            <ColumnChart
              data={data.latency.map((b) => ({ label: b.label, value: b.count }))}
              name="Transfers"
              color="secondary"
            />
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            How long delivered transfers took from source confirmation to execution on the destination.
          </p>
        </Panel>

        <Panel title="Volume by route, 30d" id="route-volume">
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : error ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : volume.length === 0 ? (
            <EmptyState title="No volume in this window" />
          ) : (
            <HorizontalBars data={volume} name="Transfers" labelWidth={150} className="h-[260px]" />
          )}
        </Panel>
      </div>

      <Panel title="Route latency heatmap" id="latency-heatmap">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : error || !data ? (
          <ErrorState message={error?.message} onRetry={() => refetch()} />
        ) : (
          <Heatmap corridors={data.corridors} />
        )}
      </Panel>

      {data?.capped && (
        <p className="text-xs text-muted-foreground">
          The 30 day window exceeded the fetch cap, so older transfers may be missing.
        </p>
      )}
    </div>
  );
}
