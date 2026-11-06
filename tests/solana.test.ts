import { describe, expect, it } from "vitest";
import { base58Decode32, base58Encode, findProgramAddress } from "@/lib/solana";

describe("base58", () => {
  it("decodes the system program to 32 zero bytes", () => {
    const bytes = base58Decode32("11111111111111111111111111111111");
    expect(bytes).toEqual(new Uint8Array(32));
    expect(base58Encode(bytes)).toBe("11111111111111111111111111111111");
  });

  it("round-trips a real program id", () => {
    const id = "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC";
    expect(base58Encode(base58Decode32(id))).toBe(id);
  });
});

describe("findProgramAddress", () => {
  const program = "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC";
  const seed = [new TextEncoder().encode("used_nonce"), new Uint8Array(32).fill(7)];

  it("is deterministic and returns a 32 byte address", () => {
    const a = findProgramAddress(seed, program);
    expect(findProgramAddress(seed, program)).toBe(a);
    expect(base58Decode32(a)).toHaveLength(32);
  });

  it("changes with the seeds", () => {
    const other = [seed[0], new Uint8Array(32).fill(8)];
    expect(findProgramAddress(other, program)).not.toBe(findProgramAddress(seed, program));
  });
});
