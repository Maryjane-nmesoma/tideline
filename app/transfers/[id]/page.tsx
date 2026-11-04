"use client";

import Link from "next/link";
import { use } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, Info, OctagonAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { ProtocolBadge } from "@/components/protocol-badge";
import { PipelineSteps } from "@/components/pipeline-steps";
import { DustInspector } from "@/components/dust-inspector";
import { MetaList } from "@/components/meta-list";
import { AddressValue } from "@/components/address";
import { ErrorState, PageShell, Panel } from "@/components/states";
import { ApiError, useTransfer } from "@/hooks/use-api";
import { explorerTxUrl } from "@/lib/config";
import { formatAmount, formatDateTime, formatDuration } from "@/lib/format";
import { shortAddress } from "@/lib/stellar";
import { cn } from "@/lib/utils";
import type { Diagnostic, Transfer, VerifierState } from "@/lib/types";
import { notFound } from "next/navigation";

const SEVERITY: Record<Diagnostic["severity"], { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "border-blue-600/25 bg-blue-600/5" },
  warning: { icon: AlertTriangle, className: "border-amber-600/30 bg-amber-600/5" },
  critical: { icon: OctagonAlert, className: "border-red-600/30 bg-red-600/5" },
};

const VERIFIER: Record<VerifierState, { label: string; className: string }> = {
  verified: { label: "Signed", className: "text-green-700 dark:text-green-400" },
  verifying: { label: "Verifying", className: "text-amber-700 dark:text-amber-400" },
  waiting: { label: "Waiting", className: "text-muted-foreground" },
  failed: { label: "Failed", className: "text-red-700 dark:text-red-400" },
};

function TxLink({ chainKey, hash }: { chainKey: string; hash: string | null }) {
  if (!hash) return <span className="text-muted-foreground">n/a</span>;
  const href = explorerTxUrl(chainKey, hash);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs" title={hash}>
        {shortAddress(hash, 10, 8)}
      </span>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="sr-only">Open in explorer</span>
        </a>
      )}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm sm:text-right">{children}</dd>
    </div>
  );
}

function Details({ t }: { t: Transfer }) {
  return (
    <dl className="divide-y">
      <Row label="Identifier">
        <span className="font-mono text-xs break-all">{t.id}</span>
      </Row>
      <Row label="Source transaction">
        <TxLink chainKey={t.src.key} hash={t.srcTxHash} />
      </Row>
      <Row label="Destination transaction">
        <TxLink chainKey={t.dst.key} hash={t.dstTxHash} />
      </Row>
      <Row label="Sender">
        <AddressValue chainKey={t.src.key} value={t.sender} />
      </Row>
      <Row label="Recipient">
        <AddressValue chainKey={t.dst.key} value={t.receiver} />
      </Row>
      <Row label="Sent">{formatDateTime(t.createdAt)}</Row>
      <Row label="Delivery time">{formatDuration(t.latencySeconds)}</Row>
      <Row label="Upstream status">
        <span className="font-mono text-xs">{t.rawStatus}</span>
      </Row>
    </dl>
  );
}

function Loading() {
  return (
    <PageShell>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-44 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </PageShell>
  );
}

export default function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = use(params);
  const id = decodeURIComponent(raw);
  const { data: t, isLoading, error, refetch } = useTransfer(id);

  if (isLoading) return <Loading />;
  if (error instanceof ApiError && error.status === 404) notFound();
  if (error || !t) {
    return (
      <PageShell>
        <Panel title="Transfer">
          <ErrorState message={error?.message} onRetry={() => refetch()} />
        </Panel>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/transfers">
          <ArrowLeft className="mr-2 h-4 w-4" />
          All transfers
        </Link>
      </Button>

      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={t.status} />
          <ProtocolBadge protocol={t.protocol} />
          <span className="text-sm text-muted-foreground">
            {t.direction === "inbound" ? "Into Stellar" : t.direction === "outbound" ? "Out of Stellar" : "Other route"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-2xl font-bold">
          <span>{t.src.name}</span>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <span>{t.dst.name}</span>
        </div>
        <p className="mt-1 text-lg tabular-nums">{formatAmount(t.wireAmount, t.asset)}</p>
        {t.statusMessage && <p className="mt-1 text-sm text-muted-foreground">{t.statusMessage}</p>}
      </div>

      <Panel title="Pipeline">
        <PipelineSteps steps={t.pipeline} />
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Diagnostic autopsy">
          {t.diagnostics.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.status === "completed"
                ? "No issues found. This transfer completed normally."
                : "No issues detected so far."}
            </p>
          ) : (
            <ul className="space-y-3">
              {t.diagnostics.map((d) => {
                const S = SEVERITY[d.severity];
                return (
                  <li key={d.title} className={cn("flex gap-3 rounded-lg border p-3", S.className)}>
                    <S.icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{d.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{d.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Decimal and dust check">
          <DustInspector transfer={t} />
        </Panel>
      </div>

      {t.verifiers.length > 0 && (
        <Panel
          title="Verifier quorum"
          action={
            t.verifierQuorum && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {t.verifierQuorum.verified} of {t.verifierQuorum.required} required signed
              </span>
            )
          }
        >
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {t.verifiers.map((v) => (
              <li key={v.id} className="rounded-lg border p-3">
                <p className="truncate text-sm font-medium">{v.name}</p>
                <p className={cn("text-xs font-medium", VERIFIER[v.state].className)}>{VERIFIER[v.state].label}</p>
                {v.timestamp ? (
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">{formatDateTime(v.timestamp)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Transaction details">
          <Details t={t} />
        </Panel>
        <Panel title="Protocol details">
          <MetaList rows={t.meta} />
        </Panel>
      </div>
    </PageShell>
  );
}
