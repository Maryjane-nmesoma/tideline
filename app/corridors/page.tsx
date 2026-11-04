"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DonutShare, HorizontalBars } from "@/components/chart-kit";
import { InstitutionLogo } from "@/components/institution-logo";
import { EmptyState, ErrorState, PageShell, Panel } from "@/components/states";
import { useInstitutions } from "@/hooks/use-api";
import { formatCount, formatUsd } from "@/lib/format";

const TYPE_LABEL: Record<string, string> = {
  fiat: "Fiat-pegged",
  bond: "Bonds",
  crypto: "Crypto-backed",
  other: "Other",
};

export default function CorridorsPage() {
  const { data, isLoading, error, refetch } = useInstitutions();
  const list = useMemo(() => data?.institutions ?? [], [data]);
  const skel = <Skeleton className="h-8 w-24" />;

  const totals = useMemo(
    () => ({
      assets: list.reduce((a, i) => a + i.assets.length, 0),
      holders: list.reduce((a, i) => a + i.holders, 0),
      currencies: new Set(list.flatMap((i) => i.currencies)).size,
    }),
    [list]
  );

  const holders = useMemo(() => list.map((i) => ({ name: i.name, value: i.holders })), [list]);

  // How many institutions issue each fiat currency.
  const fiat = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of list) {
      const own = new Set(i.assets.filter((a) => a.assetType === "fiat" && a.anchorAsset).map((a) => a.anchorAsset!));
      for (const c of own) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [list]);

  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of list) {
      for (const a of i.assets) {
        const label = a.assetType ? (TYPE_LABEL[a.assetType] ?? "Other") : "Unlabeled";
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [list]);

  const failed = !!error;

  return (
    <PageShell>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Institutions"
          info="Issuers of fiat-pegged or bond tokens on Stellar, plus known cross-chain issuers, as declared in their stellar.toml."
          value={isLoading ? skel : failed ? "n/a" : list.length}
        />
        <StatCard title="Assets issued" value={isLoading ? skel : failed ? "n/a" : totals.assets} />
        <StatCard
          title="Currencies covered"
          info="Distinct fiat currencies and real-world assets their tokens represent."
          value={isLoading ? skel : failed ? "n/a" : totals.currencies}
        />
        <StatCard
          title="Asset holders"
          info="Authorized trustlines across their assets. One account holding two assets counts twice."
          value={isLoading ? skel : failed ? "n/a" : formatCount(totals.holders)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Top institutions by holders" className="lg:col-span-2" id="institution-holders">
          {isLoading ? (
            <Skeleton className="h-[340px] w-full lg:h-[560px]" />
          ) : failed ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : (
            <HorizontalBars
              data={holders.slice(0, 16)}
              name="Holders"
              formatValue={(v) => formatCount(v)}
              className="h-[340px] lg:h-[560px]"
            />
          )}
        </Panel>

        <Panel title="Share of holders" id="holder-share">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : failed ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : (
            <DonutShare
              slices={holders}
              formatValue={(v) => `${formatCount(v)} holders`}
              footnote={`${holders.length} institutions. Circle holds most accounts, so the small ones are drawn at a minimum width.`}
            />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Fiat currencies by institution" className="lg:col-span-2" id="fiat-currencies">
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : failed ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : fiat.length === 0 ? (
            <EmptyState title="No fiat-pegged assets found" />
          ) : (
            <HorizontalBars data={fiat} name="Institutions" labelWidth={60} className="h-[300px]" />
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            How many institutions issue a token pegged to each currency.
          </p>
        </Panel>

        <Panel title="Assets by type" id="asset-types">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : failed ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : (
            <DonutShare
              slices={types}
              formatValue={(v) => `${v} assets`}
              footnote="Type as declared by each issuer in its stellar.toml."
            />
          )}
        </Panel>
      </div>

      <Panel title="Financial institutions on Stellar" id="institutions">
        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : failed ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : list.length === 0 ? (
          <EmptyState title="No institutions found" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Institution</TableHead>
                  <TableHead>Currencies</TableHead>
                  <TableHead className="text-right">Assets</TableHead>
                  <TableHead className="text-right">Holders</TableHead>
                  <TableHead className="text-right">Market value (est.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((i) => (
                  <TableRow key={i.slug}>
                    <TableCell>
                      <Link href={`/corridors/${i.slug}`} className="flex items-center gap-3 hover:underline">
                        <InstitutionLogo name={i.name} src={i.logo} />
                        <span className="font-medium">{i.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {i.currencies.slice(0, 4).map((c) => (
                          <Badge key={c} variant="secondary" className="font-medium">
                            {c}
                          </Badge>
                        ))}
                        {i.currencies.length > 4 && (
                          <span className="self-center text-xs text-muted-foreground">+{i.currencies.length - 4}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{i.assets.length}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(i.holders)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(i.valueUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Market value is supply times the last traded price. It is unreliable for thinly traded tokens, so holders are
          used for ranking.
        </p>
      </Panel>
    </PageShell>
  );
}
