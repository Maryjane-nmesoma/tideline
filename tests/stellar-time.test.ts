import { describe, expect, it } from "vitest";
import { findLedgerAtTime, type LedgerPoint } from "@/lib/stellar-time";

/** A fake chain whose ledgers close every `secondsPerLedger`, with an optional change of pace partway through. */
function chain(opts: { latest: LedgerPoint; secondsPerLedger: number; slowBefore?: { seq: number; secondsPerLedger: number } }) {
  const { latest, secondsPerLedger, slowBefore } = opts;
  let probes = 0;
  const closeTimeOf = async (seq: number) => {
    probes++;
    if (slowBefore && seq < slowBefore.seq) {
      const boundaryTs = latest.ts - (latest.seq - slowBefore.seq) * secondsPerLedger;
      return Math.round(boundaryTs - (slowBefore.seq - seq) * slowBefore.secondsPerLedger);
    }
    return Math.round(latest.ts - (latest.seq - seq) * secondsPerLedger);
  };
  return { closeTimeOf, probes: () => probes };
}

const latest: LedgerPoint = { seq: 65_337_349, ts: 1_793_973_987 };

describe("findLedgerAtTime", () => {
  it("returns the latest ledger for a target in the future", async () => {
    const c = chain({ latest, secondsPerLedger: 5.5 });
    expect(await findLedgerAtTime(latest.ts + 100, latest, c.closeTimeOf)).toBe(latest.seq);
    expect(c.probes()).toBe(0);
  });

  it("lands just before the target on a steady chain with few lookups", async () => {
    const c = chain({ latest, secondsPerLedger: 5.5 });
    const target = latest.ts - 30 * 86_400;
    const seq = await findLedgerAtTime(target, latest, c.closeTimeOf);
    const closeTime = await chain({ latest, secondsPerLedger: 5.5 }).closeTimeOf(seq);
    expect(closeTime).toBeLessThanOrEqual(target); // never after the burn
    expect(target - closeTime).toBeLessThan(15 * 60); // but not wastefully early
    expect(c.probes()).toBeLessThanOrEqual(3);
  });

  it("copes with a chain that ran faster than the prior", async () => {
    const c = chain({ latest, secondsPerLedger: 5.1 });
    const target = latest.ts - 90 * 86_400;
    const seq = await findLedgerAtTime(target, latest, c.closeTimeOf);
    const closeTime = await chain({ latest, secondsPerLedger: 5.1 }).closeTimeOf(seq);
    expect(closeTime).toBeLessThanOrEqual(target);
    expect(target - closeTime).toBeLessThan(30 * 60);
    expect(c.probes()).toBeLessThanOrEqual(6);
  });

  it("copes with a change of pace along the way", async () => {
    const shape = { latest, secondsPerLedger: 5.5, slowBefore: { seq: latest.seq - 2_000_000, secondsPerLedger: 6.3 } };
    const target = latest.ts - 150 * 86_400;
    const seq = await findLedgerAtTime(target, latest, chain(shape).closeTimeOf);
    const closeTime = await chain(shape).closeTimeOf(seq);
    expect(closeTime).toBeLessThanOrEqual(target);
    expect(target - closeTime).toBeLessThan(2 * 3600);
  });

  it("never returns a ledger below 1", async () => {
    const c = chain({ latest: { seq: 1_000, ts: 1_700_000_000 }, secondsPerLedger: 5 });
    const seq = await findLedgerAtTime(1_600_000_000, { seq: 1_000, ts: 1_700_000_000 }, c.closeTimeOf);
    expect(seq).toBeGreaterThanOrEqual(1);
  });

  it("gives up after maxProbes instead of looping", async () => {
    let calls = 0;
    // A clock that never gets closer to the target.
    const stuck = async () => {
      calls++;
      return latest.ts - 1_000_000 + calls;
    };
    await findLedgerAtTime(latest.ts - 5_000_000, latest, stuck, { maxProbes: 4 });
    expect(calls).toBeLessThanOrEqual(4);
  });
});
