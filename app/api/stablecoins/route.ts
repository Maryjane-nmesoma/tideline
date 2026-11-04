import { NextResponse } from "next/server";
import { fetchStellarAssets, fetchStellarSupplySeries } from "@/lib/adapters/defillama";

export const dynamic = "force-dynamic";

export async function GET() {
  const [series, assets] = await Promise.allSettled([fetchStellarSupplySeries(), fetchStellarAssets()]);
  if (series.status === "rejected" && assets.status === "rejected") {
    return NextResponse.json({ error: "DefiLlama unavailable" }, { status: 502 });
  }
  return NextResponse.json({
    series: series.status === "fulfilled" ? series.value : null,
    assets: assets.status === "fulfilled" ? assets.value : null,
  });
}
