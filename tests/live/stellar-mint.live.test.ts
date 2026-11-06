/**
 * Live check of the Stellar CCTP mint search against the real network. Slow and dependent on public APIs, so it only
 * runs on request:  TIDELINE_LIVE=1 pnpm test:live
 *
 * It takes a real message_received event from the first weeks of the contract, months old, and checks that the mint is
 * still found and resolved to a transaction hash. A scan limited to the newest events cannot do that.
 */
import { describe, expect, it } from "vitest";
import { checkMint } from "@/lib/adapters/destination";
import type { ExpertEventPage } from "@/lib/upstream";

const live = process.env.TIDELINE_LIVE === "1";
const CONTRACT = "CACMENFFJPJMSDAJQLX4R7K3SFZIW2LJSE3R2UMLGSWHFHS353FVXAZV";

describe.skipIf(!live)("Stellar mint check (live)", () => {
  it("finds a months-old mint and its transaction", async () => {
    const res = await fetch(
      `https://api.stellar.expert/explorer/public/contract/${CONTRACT}/events?limit=20&order=asc`
    );
    const page = (await res.json()) as ExpertEventPage;
    const ev = page._embedded.records.find((e) => e.bodyXdr && e.bodyXdr.length > 200);
    expect(ev, "contract has old events with a body").toBeTruthy();

    // A slice from the middle of the event body, which is what a burn message looks like inside it.
    const hex = Buffer.from(ev!.bodyXdr!, "base64").toString("hex");
    const needle = hex.slice(100, 260);

    const check = await checkMint({
      srcDomain: 0,
      dstDomain: 27,
      eventNonce: "0x",
      version: 2,
      messageBody: `0x${needle}`,
      sourceTs: ev!.ts - 300,
    });

    expect(check.state).toBe("minted");
    expect(check.timestamp).toBe(ev!.ts);
    expect(check.txHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reports pending, not unknown, when a recent burn has no mint yet", async () => {
    const check = await checkMint({
      srcDomain: 0,
      dstDomain: 27,
      eventNonce: "0x",
      version: 2,
      messageBody: `0x${"de".repeat(80)}`,
      sourceTs: Math.floor(Date.now() / 1000) - 3600,
    });
    expect(check.state).toBe("pending");
  });
});
