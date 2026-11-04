import { NextResponse } from "next/server";
import { fetchInstitution } from "@/lib/adapters/stellar-expert";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  try {
    const inst = await fetchInstitution(slug);
    if (!inst) return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    return NextResponse.json(inst);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stellar Expert unavailable" },
      { status: 502 }
    );
  }
}
