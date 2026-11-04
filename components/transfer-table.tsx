"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { ProtocolBadge } from "@/components/protocol-badge";
import { formatAgo, formatAmount } from "@/lib/format";
import { shortAddress } from "@/lib/stellar";
import { cn } from "@/lib/utils";
import type { Transfer } from "@/lib/types";

function Route({ t }: { t: Transfer }) {
  const stellar = (key: string) => key === "stellar";
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <span className={cn(!stellar(t.src.key) && "text-muted-foreground")}>{t.src.name}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      <span className={cn(!stellar(t.dst.key) && "text-muted-foreground")}>{t.dst.name}</span>
    </span>
  );
}

export function TransferTable({ transfers }: { transfers: Transfer[] }) {
  const router = useRouter();
  const open = (t: Transfer) => router.push(`/transfers/${encodeURIComponent(t.id)}`);
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Source tx</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((t) => (
              <TableRow
                key={t.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => open(t)}
                onKeyDown={(e) => e.key === "Enter" && open(t)}
              >
                <TableCell>
                  <StatusBadge status={t.status} />
                </TableCell>
                <TableCell>
                  <Link href={`/transfers/${encodeURIComponent(t.id)}`} className="hover:underline">
                    <Route t={t} />
                  </Link>
                </TableCell>
                <TableCell>
                  <ProtocolBadge protocol={t.protocol} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatAmount(t.wireAmount, t.asset)}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatAgo(t.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {t.srcTxHash ? shortAddress(t.srcTxHash, 8, 6) : "n/a"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">View details</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 sm:hidden">
        {transfers.map((t) => (
          <Link
            key={t.id}
            href={`/transfers/${encodeURIComponent(t.id)}`}
            className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <StatusBadge status={t.status} />
              <span className="text-xs text-muted-foreground">{formatAgo(t.createdAt)}</span>
            </div>
            <div className="text-sm">
              <Route t={t} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <ProtocolBadge protocol={t.protocol} />
              <span className="tabular-nums">{formatAmount(t.wireAmount, t.asset)}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
