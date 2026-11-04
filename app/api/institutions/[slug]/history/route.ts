import { NextResponse } from "next/server";
import { fetchAssetHistory, fetchInstitution } from "@/lib/adapters/stellar-expert";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const issuer = searchParams.get("issuer");
  if (!code || !issuer) return NextResponse.json({ error: "Missing code or issuer" }, { status: 400 });
  try {
    // Only serve history for assets this institution actually issues.
    const inst = await fetchInstitution(slug);
    if (!inst?.assets.some((a) => a.code === code && a.issuer === issuer)) {
      return NextResponse.json({ error: "Asset not found for this institution" }, { status: 404 });
    }
    return NextResponse.json({ points: await fetchAssetHistory(code, issuer) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stellar Expert unavailable" },
      { status: 502 }
    );
  }
}
