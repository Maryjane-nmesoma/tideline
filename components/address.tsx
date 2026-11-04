"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { ENDPOINTS } from "@/lib/config";
import { hexToStrkey, shortAddress } from "@/lib/stellar";

const HEX32 = /^0x[0-9a-fA-F]{64}$/;

/** LayerZero reports Stellar addresses as 32 raw bytes. Account vs contract is decided by asking Horizon. */
function useStellarStrkey(hex: string, enabled: boolean) {
  return useQuery({
    queryKey: ["strkey", hex],
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      const g = hexToStrkey(hex, "account");
      const c = hexToStrkey(hex, "contract");
      if (!g || !c) return null;
      try {
        const res = await fetch(`${ENDPOINTS.horizon}/accounts/${g}`);
        if (res.ok) return { address: g, kind: "account" as const };
      } catch {
        // Horizon unreachable: fall through to the contract form.
      }
      return { address: c, kind: "contract" as const };
    },
  });
}

export function AddressValue({ chainKey, value }: { chainKey: string; value: string }) {
  const isStellarHex = chainKey === "stellar" && HEX32.test(value);
  const { data } = useStellarStrkey(value, isStellarHex);
  const display = isStellarHex && data ? data.address : value;
  const href =
    chainKey === "stellar" && isStellarHex && data
      ? `https://stellar.expert/explorer/public/${data.kind === "account" ? "account" : "contract"}/${data.address}`
      : null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="font-mono text-xs break-all" title={display}>
        {display.length > 24 ? shortAddress(display, 10, 8) : display}
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
