"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RangeToggle } from "@/components/charts";
import { ColumnChart, DonutShare, SeriesAreaChart, sliceRange, type RangeKey } from "@/components/chart-kit";
import { EmptyState, ErrorState, Panel } from "@/components/states";
import { useAssetHistory } from "@/hooks/use-api";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Institution } from "@/lib/types";

const RANGES = ["30D", "90D", "1Y", "All"] as const;
const keyOf = (a: { code: string; issuer: string }) => `${a.code}-${a.issuer}`;

/** Daily supply, holders and payments for one of the institution's assets, plus how holders split across assets. */
export function InstitutionCharts({ inst }: { inst: Institution }) {
  const best = useMemo(() => [...inst.assets].sort((a, b) => b.holders - a.holders)[0], [inst.assets]);
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]>("1Y");

  const asset = inst.assets.find((a) => keyOf(a) === selected) ?? best;
  const history = useAssetHistory(inst.slug, asset?.code, asset?.issuer);
  const points = history.data?.points;

  const view = useMemo(() => sliceRange(points ?? [], range as RangeKey), [points, range]);
  const supply = view.map((p) => ({ date: p.date, supply: p.supply }));
  const holders = view.map((p) => ({ date: p.date, holders: p.holders }));
  const payments = view.map((p) => ({ label: p.date, value: p.payments }));
  const hasData = view.some((p) => p.supply > 0 || p.holders > 0);

  const shares = inst.assets.filter((a) => a.holders > 0).map((a) => ({ name: a.code, value: a.holders }));
  const loading = history.isLoading;
  const failed = history.error || !points;

  const body = (node: React.ReactNode, h = "h-[260px]") =>
    loading ? (
      <Skeleton className={cn("w-full", h)} />
    ) : failed ? (
      <ErrorState message={history.error?.message ?? "History unavailable"} onRetry={() => history.refetch()} />
    ) : !hasData ? (
      <EmptyState title="No history for this range" />
    ) : (
      node
    );

  return (
    <div className="space-y-4">
      <Panel
        title={`${asset?.code ?? "Asset"} history`}
        id="asset-history"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {inst.assets.length > 1 && (
              <div className="flex max-w-full gap-1 overflow-x-auto rounded-md border p-1 no-scrollbar" role="group" aria-label="Asset">
                {inst.assets.slice(0, 8).map((a) => (
                  <button
                    key={keyOf(a)}
                    type="button"
                    aria-pressed={keyOf(a) === keyOf(asset)}
                    onClick={() => setSelected(keyOf(a))}
                    className={cn(
                      "shrink-0 rounded px-2.5 py-1 text-xs transition-colors",
                      keyOf(a) === keyOf(asset) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    {a.code}
                  </button>
                ))}
              </div>
            )}
            <RangeToggle options={RANGES} value={range} onChange={setRange} />
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Supply</h3>
            {body(
              <SeriesAreaChart
                data={supply}
                xUnit="s"
                series={[{ key: "supply", name: asset.code }]}
                formatY={(v) => formatCount(v)}
                formatTip={(v) => `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${asset.code}`}
                className="h-[260px]"
              />
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Holders</h3>
            {body(
              <SeriesAreaChart
                data={holders}
                xUnit="s"
                series={[{ key: "holders", name: "Holders", color: "secondary" }]}
                formatY={(v) => formatCount(v)}
                formatTip={(v) => v.toLocaleString()}
                className="h-[260px]"
              />
            )}
          </div>
        </div>
      </Panel>

      <div className={cn("grid grid-cols-1 gap-4", shares.length > 1 && "lg:grid-cols-3")}>
        <Panel title="Payments per day" id="asset-payments" className={shares.length > 1 ? "lg:col-span-2" : ""}>
          {body(
            <ColumnChart
              data={payments}
              name="Payments"
              xFormat={(v) => new Date(Number(v) * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              formatValue={(v) => formatCount(v)}
              className={shares.length > 1 ? "h-[260px] lg:h-[340px]" : "h-[260px]"}
            />
          )}
          <p className="mt-2 text-xs text-muted-foreground">Payment operations in {asset?.code} on each day.</p>
        </Panel>

        {shares.length > 1 && (
          <Panel title="Share of holders by asset" id="asset-holder-share">
            <DonutShare
              slices={shares}
              formatValue={(v) => `${formatCount(v)} holders`}
              footnote={`${shares.length} assets issued by ${inst.name}.`}
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
