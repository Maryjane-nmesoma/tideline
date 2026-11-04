import { NextResponse } from "next/server";
import { searchTransfers } from "@/lib/search";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });
  try {
    return NextResponse.json(await searchTransfers(q));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed" },
      { status: 502 }
    );
  }
}
