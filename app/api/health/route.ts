import { NextResponse } from "next/server";
import { ENDPOINTS } from "@/lib/config";

async function ping(source: string, url: string) {
  const t = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    return { source, ok: res.ok, ms: Date.now() - t, message: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { source, ok: false, ms: Date.now() - t, message: e instanceof Error ? e.message : "unreachable" };
  }
}

export async function GET() {
  const results = await Promise.all([
    ping("LayerZero Scan", `${ENDPOINTS.layerzero}/messages/latest?limit=1`),
    ping("Circle Iris", `${ENDPOINTS.iris}/publicKeys`),
    ping("Stellar Horizon", `${ENDPOINTS.horizon}/ledgers?order=desc&limit=1`),
    ping("DefiLlama", `${ENDPOINTS.stablecoins}/stablecoincharts/Stellar`),
  ]);
  return NextResponse.json({
    sources: [
      ...results,
      {
        source: "Allbridge Core",
        ok: false,
        ms: 0,
        message: "No public hosted API. Allbridge Core exposes its REST API only as a self-hosted service.",
      },
    ],
  });
}
