import { NextResponse } from "next/server";
import { dailyBuckets, fetchWindow, summarize } from "@/lib/server/window";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const win = await fetchWindow(24 * 30, 4);
    const now = Date.now() / 1000;
    const within = (hours: number) => win.transfers.filter((t) => (t.createdAt ?? 0) >= now - hours * 3600);
    return NextResponse.json({
      day: summarize(within(24)),
      week: summarize(within(24 * 7)),
      month: summarize(win.transfers),
      daily: dailyBuckets(win.transfers, 30),
      capped: win.capped,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "LayerZero Scan unavailable" },
      { status: 502 }
    );
  }
}
