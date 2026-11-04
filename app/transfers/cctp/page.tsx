"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TransferTable } from "@/components/transfer-table";
import { EmptyState, ErrorState, PageShell, Panel } from "@/components/states";
import { CctpCharts } from "@/components/cctp-charts";
import { useCctpFees, useSearch, type FeeQuote } from "@/hooks/use-api";

const fee = (q: FeeQuote[] | null, threshold: number) => {
  const hit = q?.find((x) => x.finalityThreshold === threshold);
  return hit ? `${hit.minimumFee} bps` : "n/a";
};

export default function CctpPage() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const search = useSearch(query);
  const fees = useCctpFees();
  const rows = (search.data?.transfers ?? []).filter((t) => t.protocol === "cctp");

  return (
    <PageShell>
      <CctpCharts />
      <Panel title="Find a CCTP transfer" id="cctp-search">
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          Circle does not publish a list of recent transfers. Paste the burn transaction hash from the source chain
          (EVM, Solana, Sui or Stellar) to see its attestation status. The mint transaction on the destination will
          not match.
        </p>
        <form
          role="search"
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(draft.trim());
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Burn transaction hash (0x..., Stellar, Solana or Sui)"
              aria-label="Burn transaction hash"
              className="pl-10"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        {query && (
          <div className="mt-4">
            {search.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : search.error ? (
              <ErrorState message={search.error.message} onRetry={() => search.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState
                title="No CCTP transfer found"
                message={
                  search.data?.notes.join(" ") ||
                  "Check the hash and that it is the burn transaction (depositForBurn) on the source chain."
                }
              />
            ) : (
              <TransferTable transfers={rows} />
            )}
          </div>
        )}
      </Panel>

      <Panel title="CCTP fees to and from Stellar, USDC" id="cctp-fees">
        {fees.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : fees.error || !fees.data ? (
          <ErrorState message={fees.error?.message} onRetry={() => fees.refetch()} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chain</TableHead>
                    <TableHead className="text-right">Into Stellar, fast</TableHead>
                    <TableHead className="text-right">Into Stellar, standard</TableHead>
                    <TableHead className="text-right">Out of Stellar, fast</TableHead>
                    <TableHead className="text-right">Out of Stellar, standard</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.data.rows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.chain}</TableCell>
                      <TableCell className="text-right tabular-nums">{fee(r.into, 1000)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fee(r.into, 2000)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fee(r.out, 1000)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fee(r.out, 2000)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Minimum fee in basis points from Circle Iris. Fast transfers confirm in seconds, standard waits for
              full source finality.
            </p>
          </>
        )}
      </Panel>
    </PageShell>
  );
}
