import { describe, expect, it } from "vitest";
import { classifyQuery } from "@/lib/search";

const hex64 = "ab".repeat(32);

describe("classifyQuery", () => {
  it("recognizes transaction hashes", () => {
    expect(classifyQuery(`0x${hex64}`)).toBe("evm-hash");
    expect(classifyQuery(hex64)).toBe("stellar-hash");
    expect(classifyQuery(`  0x${hex64}  `)).toBe("evm-hash");
  });

  it("recognizes addresses", () => {
    expect(classifyQuery(`0x${"ab".repeat(20)}`)).toBe("evm-address");
    expect(classifyQuery("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF")).toBe("stellar-account");
    expect(classifyQuery("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4")).toBe("stellar-contract");
  });

  it("recognizes Solana signatures and Sui digests by their base58 length", () => {
    expect(classifyQuery("5".repeat(88))).toBe("solana-signature");
    expect(classifyQuery("5".repeat(44))).toBe("sui-digest");
  });

  it("does not mistake a Stellar-looking string with a bad checksum for an address", () => {
    expect(classifyQuery("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe("unknown");
  });

  it("returns unknown for everything else", () => {
    expect(classifyQuery("")).toBe("unknown");
    expect(classifyQuery("hello world")).toBe("unknown");
    expect(classifyQuery("0x1234")).toBe("unknown");
  });
});
