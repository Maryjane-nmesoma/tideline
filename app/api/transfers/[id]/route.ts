import { NextResponse } from "next/server";
import { fetchCctpById, parseCctpId } from "@/lib/adapters/circle";
import { fetchLzByGuid } from "@/lib/adapters/layerzero";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const id = decodeURIComponent(raw);
  try {
    const transfer = parseCctpId(id)
      ? await fetchCctpById(id)
      : /^0x[0-9a-fA-F]{64}$/.test(id)
        ? await fetchLzByGuid(id)
        : null;
    if (!transfer) return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    return NextResponse.json(transfer);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upstream unavailable" },
      { status: 502 }
    );
  }
}
