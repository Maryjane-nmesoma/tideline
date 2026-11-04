import Link from "next/link";
import { Info } from "lucide-react";
import { formatUnits, parseUnits } from "@/lib/dust";
import type { Transfer } from "@/lib/types";

export function DustInspector({ transfer }: { transfer: Transfer }) {
  if (!transfer.wireAmount) {
    return (
      <p className="text-sm text-muted-foreground">
        The wire amount could not be decoded for this message (compose payload or non-token message), so no
        decimal check is possible.
      </p>
    );
  }
  const wire = parseUnits(transfer.wireAmount, 6);
  const stroops = wire.ok ? wire.value * BigInt(10) : null;

  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">On the wire (6 decimals)</dt>
          <dd className="font-mono tabular-nums">{transfer.wireAmount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">On Stellar (7 decimals)</dt>
          <dd className="font-mono tabular-nums">{stroops !== null ? formatUnits(stroops, 7) : "n/a"}</dd>
        </div>
      </dl>
      <div className="flex gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          {transfer.direction === "outbound"
            ? "Stellar amounts have 7 decimals but the bridge format has 6. Anything below 0.000001 in the original amount was removed before this message was created. It was not part of the transfer and stays in the sender's account."
            : "Moving from 6 to 7 decimals is exact, so the full amount arrives. A remainder only appears when sending out of Stellar."}{" "}
          <Link href="/tools/dust-calc" className="underline underline-offset-2 hover:text-foreground">
            Check an amount
          </Link>
        </p>
      </div>
    </div>
  );
}
