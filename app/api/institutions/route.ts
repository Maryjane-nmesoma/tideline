import { NextResponse } from "next/server";
import { fetchInstitutions } from "@/lib/adapters/stellar-expert";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ institutions: await fetchInstitutions() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stellar Expert unavailable" },
      { status: 502 }
    );
  }
}
