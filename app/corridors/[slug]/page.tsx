"use client";

import Link from "next/link";
import { use } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InstitutionLogo } from "@/components/institution-logo";
import { InstitutionCharts } from "@/components/institution-charts";
import { EmptyState, ErrorState, PageShell, Panel } from "@/components/states";
import { ApiError, useInstitution, useSepInfo } from "@/hooks/use-api";
import { formatCount, formatUsd } from "@/lib/format";
import { shortAddress } from "@/lib/stellar";
import type { SepAmountRule } from "@/lib/types";

function fee(r: SepAmountRule) {
  const parts = [];
  if (r.feePercent) parts.push(`${r.feePercent}%`);
  if (r.feeFixed) parts.push(`${r.feeFixed} fixed`);
  return parts.length ? parts.join(" + ") : "None";
}

const limit = (n: number | null) => (n === null ? "n/a" : n.toLocaleString());

function RulesTable({ title, rows }: { title: string; rows: SepAmountRule[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">Max</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.asset}>
                <TableCell className="font-medium">{r.asset}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      r.enabled
                        ? "border-green-600/25 bg-green-600/10 text-green-700 dark:text-green-400"
                        : "text-muted-foreground"
                    }
                  >
                    {r.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{fee(r)}</TableCell>
                <TableCell className="text-right tabular-nums">{limit(r.min)}</TableCell>
                <TableCell className="text-right tabular-nums">{limit(r.max)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Ramps({ slug, hasDomain }: { slug: string; hasDomain: boolean }) {
  const sep = useSepInfo(slug, hasDomain);
  return (
    <Panel title="On and off ramps" id="ramps">
      {!hasDomain ? (
        <EmptyState title="No home domain published" message="This institution does not list a stellar.toml domain." />
      ) : sep.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : sep.error || !sep.data ? (
        <ErrorState
          title="Anchor services unreachable"
          message={sep.error?.message}
          onRetry={() => sep.refetch()}
        />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Read live from {sep.data.domain}:</span>
            {(
              [
                ["SEP-6", sep.data.services.sep6],
                ["SEP-24", sep.data.services.sep24],
                ["SEP-31", sep.data.services.sep31],
              ] as const
            ).map(([label, on]) => (
              <Badge key={label} variant={on ? "secondary" : "outline"} className={on ? "" : "text-muted-foreground"}>
                {label}
                {on ? "" : " not offered"}
              </Badge>
            ))}
          </div>
          {sep.data.deposit.length + sep.data.withdraw.length + sep.data.receive.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The institution answers, but lists no deposit, withdrawal or payment assets.
            </p>
          ) : (
            <>
              <RulesTable title="Deposit (fiat in, Stellar asset out)" rows={sep.data.deposit} />
              <RulesTable title="Withdraw (Stellar asset in, fiat out)" rows={sep.data.withdraw} />
              <RulesTable title="Cross-border payments received (SEP-31)" rows={sep.data.receive} />
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

export default function InstitutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: inst, isLoading, error, refetch } = useInstitution(slug);

  if (error instanceof ApiError && error.status === 404) notFound();

  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/corridors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          All institutions
        </Link>
      </Button>

      {isLoading ? (
        <>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </>
      ) : error || !inst ? (
        <Panel title="Institution">
          <ErrorState message={error?.message} onRetry={() => refetch()} />
        </Panel>
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-lg border bg-card p-4 sm:p-6">
            <InstitutionLogo name={inst.name} src={inst.logo} className="h-14 w-14 text-lg" />
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold">{inst.name}</h2>
              <p className="truncate text-sm text-muted-foreground">{inst.legalName}</p>
              {inst.domain && (
                <a
                  href={`https://${inst.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
                >
                  {inst.domain}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Asset holders" value={formatCount(inst.holders)} />
            <StatCard title="Assets issued" value={inst.assets.length} />
            <StatCard title="Currencies" value={inst.currencies.length} />
            <StatCard
              title="Market value (est.)"
              info="Supply times last traded price. Unreliable for thinly traded tokens."
              value={formatUsd(inst.valueUsd)}
            />
          </div>

          <InstitutionCharts inst={inst} />

          <Panel title="Assets issued" id="assets">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Pegged to</TableHead>
                    <TableHead className="text-right">Supply</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Holders</TableHead>
                    <TableHead className="text-right">Payments</TableHead>
                    <TableHead>Soroban contract</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inst.assets.map((a) => (
                    <TableRow key={a.issuer + a.code}>
                      <TableCell>
                        <span className="font-medium">{a.code}</span>
                        {a.name && <span className="ml-2 text-muted-foreground">{a.name}</span>}
                      </TableCell>
                      <TableCell>{a.anchorAsset ?? "n/a"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(a.supply)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.priceUsd === null ? "n/a" : `$${a.priceUsd < 1 ? a.priceUsd.toPrecision(3) : a.priceUsd.toFixed(2)}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(a.holders)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(a.payments)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {a.contract ? (
                          <a
                            href={`https://stellar.expert/explorer/public/contract/${a.contract}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-foreground"
                          >
                            {shortAddress(a.contract, 6, 6)}
                          </a>
                        ) : (
                          "n/a"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>

          <Ramps slug={slug} hasDomain={!!inst.domain} />
        </>
      )}
    </PageShell>
  );
}
