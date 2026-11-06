import { describe, expect, it } from "vitest";
import { bytesToHex, hexToBytes, keccak256 } from "@/lib/keccak";

const enc = (s: string) => new TextEncoder().encode(s);

describe("keccak256", () => {
  // Original Keccak padding (what Ethereum uses), not NIST SHA-3.
  it("matches known vectors", () => {
    expect(bytesToHex(keccak256(enc("")))).toBe("c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
    expect(bytesToHex(keccak256(enc("abc")))).toBe("4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45");
  });

  it("handles inputs longer than one 136 byte block", () => {
    const out = keccak256(new Uint8Array(300).fill(0x61));
    expect(out).toHaveLength(32);
    expect(bytesToHex(out)).not.toBe(bytesToHex(keccak256(new Uint8Array(299).fill(0x61))));
  });
});

describe("hex helpers", () => {
  it("round-trips with and without a 0x prefix", () => {
    expect(bytesToHex(hexToBytes("0x00ff10"))).toBe("00ff10");
    expect(bytesToHex(hexToBytes("DEADbeef"))).toBe("deadbeef");
  });
});
