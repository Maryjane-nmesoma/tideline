"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  AssetHistoryPoint,
  CorridorStat,
  Institution,
  SepInfo,
  StellarAssetSupply,
  SupplyPoint,
  Transfer,
  TransferPage,
} from "@/lib/types";
import type { SearchResult } from "@/lib/search";
import { hydratePage, hydrateTransfer } from "@/lib/hydrate";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

export type Direction = "all" | "inbound" | "outbound";

export function useTransferFeed(direction: Direction = "all", limit = 25) {
  return useInfiniteQuery({
    queryKey: ["transfers", "v2", direction, limit],
    queryFn: async ({ pageParam }) =>
      hydratePage(
        await getJson<TransferPage>(
          `/api/transfers?direction=${direction}&limit=${limit}${pageParam ? `&nextToken=${encodeURIComponent(pageParam)}` : ""}`
        )
      ),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.nextToken ?? undefined,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function useTransfer(id: string) {
  return useQuery({
    queryKey: ["transfer", "v2", id],
    queryFn: async () => hydrateTransfer(await getJson<Transfer>(`/api/transfers/${encodeURIComponent(id)}`)),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
    refetchInterval: (q) => {
      const t = q.state.data;
      return t && (t.status === "completed" || t.status === "failed") ? false : 20_000;
    },
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ["search", "v2", q],
    queryFn: async () => {
      const r = await getJson<SearchResult>(`/api/search?q=${encodeURIComponent(q)}`);
      return { ...r, notes: r.notes ?? [], transfers: (r.transfers ?? []).map(hydrateTransfer) };
    },
    enabled: q.length > 0,
    staleTime: 30_000,
  });
}

type Summary = {
  total: number;
  inbound: number;
  outbound: number;
  completed: number;
  inFlight: number;
  stalled: number;
  failed: number;
  medianLatencySeconds: number | null;
  p90LatencySeconds: number | null;
};

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => getJson<{
        day: Summary;
        week: Summary;
        month: Summary;
        daily: { date: number; inbound: number; outbound: number }[];
        capped: boolean;
      }>("/api/stats"),
    staleTime: 60_000,
  });
}

export type RoutesResponse = {
  windowDays: number;
  capped: boolean;
  summary: Summary;
  corridors: CorridorStat[];
  daily: { date: number; inbound: number; outbound: number }[];
  latency: { label: string; count: number }[];
  byChain: { key: string; name: string; count: number }[];
};

export type FeeQuote = { finalityThreshold: number; minimumFee: number };
export type CctpFeeRow = { chain: string; key: string; into: FeeQuote[] | null; out: FeeQuote[] | null };

export function useCctpFees() {
  return useQuery({
    queryKey: ["cctp-fees"],
    queryFn: () => getJson<{ rows: CctpFeeRow[] }>("/api/cctp-fees"),
    staleTime: 10 * 60_000,
  });
}


export function useRoutes() {
  return useQuery({
    queryKey: ["routes"],
    queryFn: () => getJson<RoutesResponse>("/api/routes"),
    staleTime: 5 * 60_000,
  });
}

export function useStablecoins() {
  return useQuery({
    queryKey: ["stablecoins"],
    queryFn: () =>
      getJson<{ series: SupplyPoint[] | null; assets: StellarAssetSupply[] | null }>("/api/stablecoins"),
    staleTime: 10 * 60_000,
  });
}

export type SourceStatus = { source: string; ok: boolean; ms: number; message?: string };

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => getJson<{ sources: SourceStatus[] }>("/api/health"),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useInstitutions() {
  return useQuery({
    queryKey: ["institutions"],
    queryFn: () => getJson<{ institutions: Institution[] }>("/api/institutions"),
    staleTime: 15 * 60_000,
  });
}

export function useInstitution(slug: string) {
  return useQuery({
    queryKey: ["institution", slug],
    queryFn: () => getJson<Institution>(`/api/institutions/${encodeURIComponent(slug)}`),
    staleTime: 15 * 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
}

export function useSepInfo(slug: string, enabled = true) {
  return useQuery({
    queryKey: ["sep", slug],
    queryFn: () => getJson<SepInfo>(`/api/institutions/${encodeURIComponent(slug)}/sep`),
    enabled,
    staleTime: 30 * 60_000,
    retry: false,
  });
}

export function useUsdc() {
  return useQuery({
    queryKey: ["usdc"],
    queryFn: () =>
      getJson<{ series: SupplyPoint[] | null; byChain: { chain: string; usd: number }[] | null }>("/api/usdc"),
    staleTime: 10 * 60_000,
  });
}

export function useAssetHistory(slug: string, code: string | undefined, issuer: string | undefined) {
  return useQuery({
    queryKey: ["asset-history", slug, code, issuer],
    queryFn: () =>
      getJson<{ points: AssetHistoryPoint[] }>(
        `/api/institutions/${encodeURIComponent(slug)}/history?code=${encodeURIComponent(code!)}&issuer=${encodeURIComponent(issuer!)}`
      ),
    enabled: !!code && !!issuer,
    staleTime: 30 * 60_000,
    retry: false,
  });
}
