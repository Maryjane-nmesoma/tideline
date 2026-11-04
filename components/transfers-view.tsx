"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UniversalLoader } from "@/components/ui/universal-loader";
import { TransferTable } from "@/components/transfer-table";
import { EmptyState, ErrorState, PageShell, Panel } from "@/components/states";
import { useSearch, useTransferFeed, type Direction } from "@/hooks/use-api";
import { classifyKind } from "@/lib/query-kind";
import type { Protocol, TransferStatus } from "@/lib/types";

const STATUSES: (TransferStatus | "all")[] = [
  "all",
  "completed",
  "attested",
  "attesting",
  "relaying",
  "stalled",
  "failed",
];
const PROTOCOLS: (Protocol | "all")[] = ["all", "layerzero", "cctp"];
const DIRECTIONS: Direction[] = ["all", "inbound", "outbound"];
const PROTOCOL_LABEL: Record<string, string> = { all: "All", layerzero: "LayerZero", cctp: "Circle CCTP" };
const DIRECTION_LABEL: Record<string, string> = { all: "All", inbound: "Into Stellar", outbound: "Out of Stellar" };

function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  names,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  names?: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1 rounded-md border p-1" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={`rounded px-2.5 py-1 text-xs capitalize transition-colors ${
              value === o ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {names?.[o] ?? o}
          </button>
        ))}
      </div>
    </div>
  );
}

type ViewProps = { lockedProtocol?: Protocol; title?: string; before?: React.ReactNode };

export function TransfersView({ lockedProtocol, title, before }: ViewProps) {
  const router = useRouter();
  const params = useSearchParams();
  const basePath = usePathname();
  const q = params.get("q")?.trim() ?? "";
  const [draft, setDraft] = useState(q);
  const [direction, setDirection] = useState<Direction>("all");
  const [chosenProtocol, setProtocol] = useState<Protocol | "all">("all");
  const protocol = lockedProtocol ?? chosenProtocol;
  const [status, setStatus] = useState<TransferStatus | "all">("all");

  const feed = useTransferFeed(direction, 25);
  const search = useSearch(q);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    router.push(v ? `${basePath}?q=${encodeURIComponent(v)}` : basePath);
  };

  const feedRows = useMemo(() => {
    const seen = new Set<string>();
    return (feed.data?.pages.flatMap((p) => p.transfers) ?? []).filter((t) =>
      seen.has(t.id) ? false : (seen.add(t.id), true)
    );
  }, [feed.data]);

  const base = q ? (search.data?.transfers ?? []) : feedRows;
  const rows = base.filter(
    (t) => (protocol === "all" || t.protocol === protocol) && (status === "all" || t.status === status)
  );
  const loading = q ? search.isLoading : feed.isLoading;
  const error = q ? search.error : feed.error;

  return (
    <PageShell>
      {before}
      <Panel title={q ? "Search results" : (title ?? "All transfers touching Stellar")} id="transfer-explorer">
        <form onSubmit={submit} className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Transaction hash, LayerZero GUID, Solana signature, G... or C... address"
              aria-label="Search transfers"
              className="pl-10"
            />
          </div>
          <Button type="submit">Search</Button>
          {q && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft("");
                router.push(basePath);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </form>

        <div className="mb-4 flex flex-col gap-3">
          {!q && <Chips label="Direction" options={DIRECTIONS} value={direction} onChange={setDirection} names={DIRECTION_LABEL} />}
          {!lockedProtocol && (
            <Chips label="Protocol" options={PROTOCOLS} value={protocol} onChange={setProtocol} names={PROTOCOL_LABEL} />
          )}
          <Chips label="Status" options={STATUSES} value={status} onChange={setStatus} />
        </div>

        {q && search.data && (
          <p className="mb-3 text-xs text-muted-foreground">
            Recognized as {classifyKind(search.data.kind)}. {search.data.notes.join(" ")}
          </p>
        )}

        {loading ? (
          <UniversalLoader
            variant="table"
            rows={8}
            config={{
              columns: [{ type: "badge" }, { type: "text" }, { type: "badge" }, { type: "text" }, { type: "text" }],
            }}
          />
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => (q ? search.refetch() : feed.refetch())} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={q ? "No transfer found for that query" : "No transfers match these filters"}
            message={
              q
                ? "Check the hash or address. A very recent transaction can take a minute to be indexed."
                : "Try widening the filters or loading more."
            }
          />
        ) : (
          <TransferTable transfers={rows} />
        )}

        {!q && feed.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
              {feed.isFetchingNextPage ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}
      </Panel>
    </PageShell>
  );
}

export function TransfersExplorer(props: ViewProps) {
  return (
    <Suspense fallback={null}>
      <TransfersView {...props} />
    </Suspense>
  );
}
