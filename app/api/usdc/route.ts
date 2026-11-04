import { NextResponse } from "next/server";
import { USDC_ID, fetchStellarSupplySeries, fetchUsdcByChain } from "@/lib/adapters/defillama";

export const dynamic = "force-dynamic";

export async function GET() {
  const [series, byChain] = await Promise.allSettled([fetchStellarSupplySeries(USDC_ID), fetchUsdcByChain()]);
  if (series.status === "rejected" && byChain.status === "rejected") {
    return NextResponse.json({ error: "DefiLlama unavailable" }, { status: 502 });
  }
  return NextResponse.json({
    series: series.status === "fulfilled" ? series.value : null,
    byChain: byChain.status === "fulfilled" ? byChain.value : null,
  });
}
