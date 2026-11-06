import { describe, expect, it } from "vitest";
import { analyzeInbound, analyzeOutbound, dustFreeAmount, formatUnits, parseUnits } from "@/lib/dust";

describe("parseUnits", () => {
  it("scales decimals exactly", () => {
    expect(parseUnits("1.5", 7)).toEqual({ ok: true, value: BigInt(15_000_000) });
    expect(parseUnits(".5", 7)).toEqual({ ok: true, value: BigInt(5_000_000) });
    expect(parseUnits("5.", 7)).toEqual({ ok: true, value: BigInt(50_000_000) });
    expect(parseUnits("1,234.5", 7)).toEqual({ ok: true, value: BigInt(12_345_000_000) });
  });

  it("rejects bad input with a specific error", () => {
    expect(parseUnits("", 7)).toEqual({ ok: false, error: "empty" });
    expect(parseUnits("   ", 7)).toEqual({ ok: false, error: "empty" });
    expect(parseUnits("-1", 7)).toEqual({ ok: false, error: "negative" });
    expect(parseUnits("1e5", 7)).toEqual({ ok: false, error: "invalid" });
    expect(parseUnits(".", 7)).toEqual({ ok: false, error: "invalid" });
    expect(parseUnits("1.12345678", 7)).toEqual({ ok: false, error: "too_many_decimals" });
    expect(parseUnits("9".repeat(40), 7)).toEqual({ ok: false, error: "too_large" });
  });
});

describe("formatUnits", () => {
  it("round-trips and groups thousands", () => {
    expect(formatUnits(BigInt(12_345_678_900), 7)).toBe("1,234.56789");
    expect(formatUnits(BigInt(0), 7)).toBe("0");
    expect(formatUnits(BigInt(1), 7)).toBe("0.0000001");
    expect(formatUnits(BigInt(10_000_000), 7, false)).toBe("1.0000000");
  });
});

describe("analyzeOutbound (Stellar 7dp to wire 6dp)", () => {
  it("leaves no dust when the last digit is zero", () => {
    const r = analyzeOutbound("10.1234560");
    expect(r).toMatchObject({ ok: true, hasDust: false, wireDisplay: "10.123456", dustDisplay: "0" });
  });

  it("keeps the remainder with the sender", () => {
    const r = analyzeOutbound("10.1234567");
    expect(r).toMatchObject({ ok: true, hasDust: true, wireDisplay: "10.123456", dustDisplay: "0.0000007" });
  });

  it("handles dust-only amounts", () => {
    const r = analyzeOutbound("0.0000009");
    expect(r).toMatchObject({ ok: true, hasDust: true, wireDisplay: "0", dustDisplay: "0.0000009" });
  });

  it("surfaces parse errors", () => {
    expect(analyzeOutbound("abc")).toMatchObject({ ok: false, error: "invalid" });
  });
});

describe("analyzeInbound (wire 6dp to Stellar 7dp)", () => {
  it("scales up exactly by ten", () => {
    expect(analyzeInbound("1.234567")).toMatchObject({ ok: true, stellarDisplay: "1.234567" });
    expect(analyzeInbound("1.234567")).toMatchObject({ stroops: BigInt(12_345_670) });
  });

  it("rejects a seventh decimal", () => {
    expect(analyzeInbound("1.2345678")).toMatchObject({ ok: false, error: "too_many_decimals" });
  });
});

describe("dustFreeAmount", () => {
  it("rounds down to a multiple of ten stroops", () => {
    expect(dustFreeAmount(BigInt(12_345_679))).toBe(BigInt(12_345_670));
    expect(dustFreeAmount(BigInt(12_345_670))).toBe(BigInt(12_345_670));
    expect(dustFreeAmount(BigInt(9))).toBe(BigInt(0));
  });
});

/** Small seeded generator so a failure is reproducible. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

describe("randomized check against an independent string-based reference", () => {
  it("agrees on 20,000 random amounts", () => {
    const rand = lcg(7);
    const mismatches: string[] = [];
    for (let i = 0; i < 20_000; i++) {
      const wholeDigits = Math.floor(rand() * 12);
      let whole = "";
      for (let d = 0; d < wholeDigits; d++) whole += String(Math.floor(rand() * 10));
      let frac = "";
      for (let d = 0; d < 7; d++) frac += String(Math.floor(rand() * 10));
      const input = `${whole || "0"}.${frac}`;

      const r = analyzeOutbound(input);
      if (!r.ok) {
        mismatches.push(`${input}: rejected (${r.error})`);
        continue;
      }
      // Reference: split the seven decimals as text, no arithmetic on the amount.
      const refDust = BigInt(frac[6]);
      const refWire = BigInt(((whole || "0") + frac.slice(0, 6)).replace(/^0+(?=\d)/, ""));
      const conserved = r.wireUnits * BigInt(10) + r.dustStroops === r.stroops; // nothing created or destroyed
      if (r.dustStroops !== refDust || r.wireUnits !== refWire || !conserved) mismatches.push(input);
    }
    expect(mismatches).toEqual([]);
  });
});
