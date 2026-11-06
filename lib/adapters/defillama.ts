import { fetchRetry } from "@/lib/fetch";
import { ENDPOINTS } from "@/lib/config";
import type { StellarAssetSupply, SupplyPoint } from "@/lib/types";
import type { LlamaChartRow, LlamaPeggedAsset } from "@/lib/upstream";


export async function fetchStellarSupplySeries(stablecoinId?: number): Promise<SupplyPoint[]> {
  const qs = stablecoinId ? `?stablecoin=${stablecoinId}` : "";
  const res = await fetchRetry(`${ENDPOINTS.stablecoins}/stablecoincharts/Stellar${qs}`, {
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`DefiLlama stablecoins responded ${res.status}`);
  const rows = (await res.json()) as LlamaChartRow[];
  return rows
    .map((r) => ({
      date: Number(r.date),
      usd: Number(r.totalCirculatingUSD?.peggedUSD ?? 0),
    }))
    .filter((p) => Number.isFinite(p.date) && p.usd > 0);
}

export async function fetchStellarAssets(): Promise<StellarAssetSupply[]> {
  const res = await fetchRetry(`${ENDPOINTS.stablecoins}/stablecoins?includePrices=true`, {
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`DefiLlama stablecoins responded ${res.status}`);
  const json = (await res.json()) as { peggedAssets: LlamaPeggedAsset[] };
  const out: StellarAssetSupply[] = [];
  for (const a of json.peggedAssets) {
    const c = a.chainCirculating?.Stellar;
    const cur = Number(c?.current?.[a.pegType] ?? 0);
    if (!c || cur <= 0) continue;
    out.push({
      id: String(a.id),
      name: a.name,
      symbol: a.symbol,
      pegType: a.pegType,
      circulatingUsd: cur,
      prevDayUsd: Number(c.circulatingPrevDay?.[a.pegType] ?? 0),
      prevWeekUsd: Number(c.circulatingPrevWeek?.[a.pegType] ?? 0),
      prevMonthUsd: Number(c.circulatingPrevMonth?.[a.pegType] ?? 0),
    });
  }
  return out.sort((a, b) => b.circulatingUsd - a.circulatingUsd);
}

/** DefiLlama's id for USDC. Used to read USDC-only series and its supply on every chain. */
export const USDC_ID = 2;

export async function fetchUsdcByChain(): Promise<{ chain: string; usd: number }[]> {
  const res = await fetchRetry(`${ENDPOINTS.stablecoins}/stablecoins?includePrices=true`, {
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`DefiLlama stablecoins responded ${res.status}`);
  const json = (await res.json()) as { peggedAssets: LlamaPeggedAsset[] };
  const usdc = json.peggedAssets.find((a) => String(a.id) === String(USDC_ID));
  if (!usdc) throw new Error("USDC not found in DefiLlama response");
  return Object.entries(usdc.chainCirculating ?? {})
    .map(([chain, v]) => ({ chain, usd: Number(v?.current?.peggedUSD ?? 0) }))
    .filter((r) => r.usd > 0)
    .sort((a, b) => b.usd - a.usd);
}
