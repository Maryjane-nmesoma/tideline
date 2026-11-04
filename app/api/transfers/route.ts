import { NextResponse } from "next/server";
import { fetchLzFeed } from "@/lib/adapters/layerzero";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dir = searchParams.get("direction");
  const direction = dir === "inbound" || dir === "outbound" ? dir : "all";
  const limit = Number(searchParams.get("limit") ?? 25);
  const nextToken = searchParams.get("nextToken") ?? undefined;
  try {
    const page = await fetchLzFeed({ direction, limit, nextToken });
    return NextResponse.json(page);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "LayerZero Scan unavailable" },
      { status: 502 }
    );
  }
}
