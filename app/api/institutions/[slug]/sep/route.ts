import { NextResponse } from "next/server";
import { fetchInstitution } from "@/lib/adapters/stellar-expert";
import { fetchSepInfo } from "@/lib/adapters/sep";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const inst = await fetchInstitution(slug).catch(() => null);
  if (!inst) return NextResponse.json({ error: "Institution not found" }, { status: 404 });
  if (!inst.domain) {
    return NextResponse.json({ error: "This institution does not publish a home domain" }, { status: 404 });
  }
  try {
    return NextResponse.json(await fetchSepInfo(inst.domain));
  } catch (e) {
    return NextResponse.json(
      { error: `Could not reach ${inst.domain}: ${e instanceof Error ? e.message : "unreachable"}` },
      { status: 502 }
    );
  }
}
