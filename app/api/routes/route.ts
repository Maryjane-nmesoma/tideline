import { NextResponse } from "next/server";
import {
  buildCorridors,
  byPartnerChain,
  dailyBuckets,
  fetchWindow,
  latencyHistogram,
  summarize,
} from "@/lib/server/window";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const win = await fetchWindow(24 * 30, 4);
    return NextResponse.json({
      windowDays: 30,
      capped: win.capped,
      summary: summarize(win.transfers),
      corridors: buildCorridors(win.transfers),
      daily: dailyBuckets(win.transfers, 30),
      latency: latencyHistogram(win.transfers),
      byChain: byPartnerChain(win.transfers),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "LayerZero Scan unavailable" },
      { status: 502 }
    );
  }
}
