import { describe, expect, it } from "vitest";
import {
  decodeStrkey,
  horizonCursorForTx,
  hexToStrkey,
  isStellarAddress,
  ledgerFromToid,
  shortAddress,
  toidForLedger,
  toidFromEventId,
  txToid,
} from "@/lib/stellar";

const ZERO_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const ZERO_CONTRACT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const ZEROS = "0".repeat(64);

describe("strkey", () => {
  it("decodes account and contract addresses", () => {
    expect(decodeStrkey(ZERO_ACCOUNT)).toEqual({ kind: "account", hex: ZEROS });
    expect(decodeStrkey(ZERO_CONTRACT)).toEqual({ kind: "contract", hex: ZEROS });
  });

  it("encodes back to the same address", () => {
    expect(hexToStrkey(ZEROS, "account")).toBe(ZERO_ACCOUNT);
    expect(hexToStrkey(`0x${ZEROS}`, "contract")).toBe(ZERO_CONTRACT);
  });

  it("rejects a bad checksum, bad length and other prefixes", () => {
    expect(decodeStrkey(ZERO_ACCOUNT.slice(0, -1) + "A")).toBeNull();
    expect(decodeStrkey("GAAAA")).toBeNull();
    expect(decodeStrkey(`S${ZERO_ACCOUNT.slice(1)}`)).toBeNull();
    expect(isStellarAddress("not an address")).toBe(false);
    expect(isStellarAddress(ZERO_ACCOUNT)).toBe(true);
  });

  it("shortens addresses", () => {
    expect(shortAddress(ZERO_ACCOUNT)).toBe("GAAAAA...AWHF");
    expect(shortAddress("short")).toBe("short");
  });
});

describe("TOIDs", () => {
  // Real event from the CCTP MessageTransmitter: ledger 65337345, transaction 1, operation 1... see below.
  const eventId = "280621759983910913-0006";

  it("splits an event id into ledger and transaction", () => {
    const toid = toidFromEventId(eventId);
    expect(toid).toBe(BigInt("280621759983910913"));
    expect(ledgerFromToid(toid!)).toBe(65_337_345);
    expect(txToid(toid!)).toBe(BigInt("280621759983910912"));
  });

  it("builds the Horizon cursor one below the transaction TOID", () => {
    expect(horizonCursorForTx(toidFromEventId(eventId)!)).toBe("280621759983910911");
  });

  it("starts an events cursor at the first TOID of a ledger", () => {
    const start = toidForLedger(65_337_345);
    expect(ledgerFromToid(start)).toBe(65_337_345);
    expect(start).toBe(BigInt(65_337_345) * BigInt(2) ** BigInt(32));
    expect(toidForLedger(65_337_346)).toBeGreaterThan(toidFromEventId(eventId)!);
  });

  it("accepts a bare TOID and rejects junk", () => {
    expect(toidFromEventId("266917790653059073")).toBe(BigInt("266917790653059073"));
    expect(toidFromEventId("abc-0001")).toBeNull();
    expect(toidFromEventId("")).toBeNull();
  });
});
