import { NextResponse } from "next/server";
import { fetchCctpFees } from "@/lib/adapters/circle";
import { CHAINS, STELLAR_CCTP_DOMAIN } from "@/lib/config";

export const dynamic = "force-dynamic";

// CCTP has no transfer feed, so the CCTP page carries Iris fee quotes into and out of Stellar instead.
export async function GET() {
  const others = CHAINS.filter((c) => c.cctpDomain !== undefined && c.cctpDomain !== STELLAR_CCTP_DOMAIN);
  const rows = await Promise.all(
    others.map(async (c) => {
      const [into, out] = await Promise.allSettled([
        fetchCctpFees(c.cctpDomain!, STELLAR_CCTP_DOMAIN),
        fetchCctpFees(STELLAR_CCTP_DOMAIN, c.cctpDomain!),
      ]);
      return {
        chain: c.name,
        key: c.key,
        into: into.status === "fulfilled" ? into.value : null,
        out: out.status === "fulfilled" ? out.value : null,
      };
    })
  );
  if (rows.every((r) => !r.into && !r.out)) {
    return NextResponse.json({ error: "Circle Iris unavailable" }, { status: 502 });
  }
  return NextResponse.json({ rows });
}
