"use client";

import { useMemo, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { RangeToggle } from "@/components/charts";
import { DonutShare, GroupedColumns, SeriesAreaChart, sliceRange, type RangeKey, type Slice } from "@/components/chart-kit";
import { EmptyState, ErrorState, Panel } from "@/components/states";
import { useCctpFees, useUsdc } from "@/hooks/use-api";
import { formatUsd } from "@/lib/format";

const RANGES = ["30D", "90D", "1Y", "All"] as const;
const TOP_CHAINS = 10;

/** USDC context for CCTP: its supply on Stellar, where the rest of USDC lives, and what each route costs. */
export function CctpCharts() {
  const usdc = useUsdc();
  const fees = useCctpFees();
  const [range, setRange] = useState<(typeof RANGES)[number]>("90D");
  const skel = <Skeleton className="h-8 w-24" />;

  const byChain = usdc.data?.byChain ?? null;
  const total = byChain?.reduce((a, c) => a + c.usd, 0) ?? 0;
  const stellarIdx = byChain ? byChain.findIndex((c) => c.chain === "Stellar") : -1;
  const stellar = stellarIdx >= 0 ? byChain![stellarIdx].usd : null;

  const slices = useMemo<Slice[]>(() => {
    if (!byChain) return [];
    const top = byChain.slice(0, TOP_CHAINS);
    const out: Slice[] = top.map((c) => ({ name: c.chain, value: c.usd, highlight: c.chain === "Stellar" }));
    const stellarRow = byChain.find((c) => c.chain === "Stellar");
    if (stellarRow && !top.includes(stellarRow)) out.push({ name: "Stellar", value: stellarRow.usd, highlight: true });
    const shown = new Set(out.map((s) => s.name));
    const rest = byChain.filter((c) => !shown.has(c.chain));
    if (rest.length) out.push({ name: `Other (${rest.length} chains)`, value: rest.reduce((a, c) => a + c.usd, 0) });
    return out;
  }, [byChain]);

  const fullSeries = usdc.data?.series;
  const series = useMemo(
    () => sliceRange(fullSeries ?? [], range as RangeKey).map((p) => ({ date: p.date, usd: p.usd })),
    [fullSeries, range]
  );

  const feeRows = (fees.data?.rows ?? [])
    .filter((r) => r.into)
    .map((r) => ({
      label: r.chain,
      a: r.into!.find((q) => q.finalityThreshold === 1000)?.minimumFee ?? 0,
      b: r.into!.find((q) => q.finalityThreshold === 2000)?.minimumFee ?? 0,
    }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="USDC on Stellar"
          info="Circulating USDC on Stellar, from DefiLlama. Most of it arrived through CCTP or was issued natively."
          value={usdc.isLoading ? skel : stellar === null ? "n/a" : formatUsd(stellar)}
        />
        <StatCard
          title="Share of all USDC"
          value={usdc.isLoading ? skel : stellar === null || !total ? "n/a" : `${((stellar / total) * 100).toFixed(2)}%`}
        />
        <StatCard
          title="Rank by chain"
          info="Where Stellar sits among every chain that holds USDC."
          value={
            usdc.isLoading ? skel : stellarIdx < 0 || !byChain ? "n/a" : (
              <>
                #{stellarIdx + 1}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">of {byChain.length} chains</span>
              </>
            )
          }
        />
        <StatCard
          title="CCTP routes to Stellar"
          info="Source chains with a published Circle fee quote into Stellar."
          value={fees.isLoading ? skel : fees.error ? "n/a" : feeRows.length}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="USDC supply on Stellar"
          className="lg:col-span-2"
          id="usdc-supply"
          action={<RangeToggle options={RANGES} value={range} onChange={setRange} />}
        >
          {usdc.isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : !fullSeries ? (
            <ErrorState message={usdc.error?.message ?? "USDC history unavailable"} onRetry={() => usdc.refetch()} />
          ) : series.length === 0 ? (
            <EmptyState title="No supply history" />
          ) : (
            <SeriesAreaChart
              data={series}
              xUnit="s"
              series={[{ key: "usd", name: "USDC" }]}
              formatY={(v) => formatUsd(v)}
              formatTip={(v) => formatUsd(v, false)}
              className="h-[300px] lg:h-[480px]"
            />
          )}
        </Panel>

        <Panel title="USDC supply by chain" id="usdc-by-chain">
          {usdc.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !byChain ? (
            <ErrorState message={usdc.error?.message ?? "Chain breakdown unavailable"} onRetry={() => usdc.refetch()} />
          ) : (
            <DonutShare
              slices={slices}
              formatValue={(v) => formatUsd(v)}
              footnote={`${byChain.length} chains hold USDC. The top ${TOP_CHAINS}${slices.some((s) => s.name === "Stellar") && stellarIdx >= TOP_CHAINS ? " and Stellar are" : " are"} shown, the rest are grouped as Other.`}
            />
          )}
        </Panel>
      </div>

      <Panel title="CCTP fee into Stellar by source chain" id="cctp-fee-chart">
        {fees.isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : fees.error || feeRows.length === 0 ? (
          <ErrorState message={fees.error?.message ?? "Fee quotes unavailable"} onRetry={() => fees.refetch()} />
        ) : (
          <GroupedColumns
            data={feeRows}
            a="Fast"
            b="Standard"
            formatValue={(v) => `${v} bps`}
            className="h-[280px]"
          />
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Minimum fee in basis points quoted by Circle Iris. Fast transfers confirm in seconds, standard waits for full
          source finality.
        </p>
      </Panel>
    </div>
  );
}
