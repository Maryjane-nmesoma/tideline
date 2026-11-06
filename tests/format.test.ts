import { describe, expect, it } from "vitest";
import { formatAmount, formatCount, formatDuration, formatUsd, pctChange } from "@/lib/format";

describe("formatDuration", () => {
  it("picks a readable unit", () => {
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(600)).toBe("10m");
    expect(formatDuration(3600 + 5 * 60)).toBe("1h 5m");
    expect(formatDuration(3 * 86_400)).toBe("3d");
  });

  it("says n/a instead of printing NaN", () => {
    expect(formatDuration(null)).toBe("n/a");
    expect(formatDuration(undefined)).toBe("n/a");
    expect(formatDuration(Number.NaN)).toBe("n/a");
  });
});

describe("formatUsd and formatCount", () => {
  it("compacts large numbers", () => {
    expect(formatUsd(1_500_000)).toBe("$1.50M");
    expect(formatUsd(2_500_000_000)).toBe("$2.50B");
    expect(formatUsd(12_345)).toBe("$12.3K");
    expect(formatCount(2_500_000)).toBe("2.50M");
    expect(formatUsd(null)).toBe("n/a");
  });
});

describe("formatAmount and pctChange", () => {
  it("groups thousands without touching decimals", () => {
    expect(formatAmount("1234567.123456", "USDC")).toBe("1,234,567.123456 USDC");
    expect(formatAmount("5", null)).toBe("5");
    expect(formatAmount(null, "USDC")).toBe("n/a");
  });

  it("guards division by zero", () => {
    expect(pctChange(110, 100)).toBeCloseTo(10);
    expect(pctChange(5, 0)).toBeNull();
  });
});
