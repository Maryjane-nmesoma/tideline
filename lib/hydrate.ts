import type { Transfer, TransferPage } from "@/lib/types";

/**
 * API payloads can be older than the page code that renders them (an open tab, a cached query, a stale
 * dev server). Filling the list fields keeps one missing array from crashing the whole page.
 */
export function hydrateTransfer(t: Transfer): Transfer {
  return {
    ...t,
    pipeline: t.pipeline ?? [],
    verifiers: t.verifiers ?? [],
    diagnostics: t.diagnostics ?? [],
    meta: t.meta ?? [],
  };
}

export function hydratePage(p: TransferPage): TransferPage {
  return { ...p, transfers: (p.transfers ?? []).map(hydrateTransfer) };
}
