import { describe, expect, it } from "vitest";
import { buildSepInfo, isPublicHttpsUrl, parseTopLevelToml, rules, type Probe } from "@/lib/adapters/sep";

describe("parseTopLevelToml", () => {
  const toml = `
VERSION="2.0.0"
NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015"
TRANSFER_SERVER_SEP0024="https://api.example.com/sep24"
TRANSFER_SERVER_SEP0024="https://ignored.example.com"
# a comment
[DOCUMENTATION]
ORG_NAME="Example"
[[CURRENCIES]]
code="USD"
`;

  it("reads top-level pairs and keeps the first value of a repeated key", () => {
    const out = parseTopLevelToml(toml);
    expect(out.VERSION).toBe("2.0.0");
    expect(out.TRANSFER_SERVER_SEP0024).toBe("https://api.example.com/sep24");
    expect(out.NETWORK_PASSPHRASE).toContain("Public Global");
  });

  it("stops at the first table", () => {
    expect(parseTopLevelToml(toml).ORG_NAME).toBeUndefined();
    expect(parseTopLevelToml(toml).code).toBeUndefined();
  });

  it("returns nothing for an empty file", () => {
    expect(parseTopLevelToml("")).toEqual({});
  });
});

describe("rules", () => {
  it("maps the /info asset block", () => {
    expect(rules({ USDC: { enabled: true, fee_fixed: 1, fee_percent: 0.5, min_amount: 10, max_amount: 5000 } })).toEqual([
      { asset: "USDC", enabled: true, feeFixed: 1, feePercent: 0.5, min: 10, max: 5000 },
    ]);
  });

  it("treats a missing enabled flag as enabled and bad numbers as unknown", () => {
    expect(rules({ ARS: { fee_fixed: Number.NaN } })).toEqual([
      { asset: "ARS", enabled: true, feeFixed: null, feePercent: null, min: null, max: null },
    ]);
    expect(rules({ ARS: { enabled: false } })[0].enabled).toBe(false);
  });

  it("tolerates a missing block", () => {
    expect(rules(undefined)).toEqual([]);
  });
});

describe("buildSepInfo", () => {
  const ok = (doc: object): Probe => ({ state: "ok", doc });
  const absent: Probe = { state: "absent" };
  const error: Probe = { state: "error", message: "timeout" };

  it("separates offered, not offered and unreachable", () => {
    const info = buildSepInfo("anchor.example", {
      sep24: ok({ deposit: { USDC: {} }, withdraw: { USDC: {} } }),
      sep6: error,
      sep31: absent,
    });
    expect(info.services).toEqual({ sep6: false, sep24: true, sep31: false });
    expect(info.unreachable).toEqual(["sep6"]);
  });

  it("an anchor that lists nothing is not reported as unreachable", () => {
    const info = buildSepInfo("anchor.example", { sep6: absent, sep24: absent, sep31: absent });
    expect(info.services).toEqual({ sep6: false, sep24: false, sep31: false });
    expect(info.unreachable).toEqual([]);
  });

  it("prefers SEP-24 rules and fills gaps from SEP-6 without duplicates", () => {
    const info = buildSepInfo("anchor.example", {
      sep24: ok({ deposit: { USDC: { fee_fixed: 1 } } }),
      sep6: ok({ deposit: { USDC: { fee_fixed: 9 }, ARS: {} } }),
      sep31: ok({ receive: { BRL: {} } }),
    });
    expect(info.deposit.map((r) => [r.asset, r.feeFixed])).toEqual([
      ["USDC", 1],
      ["ARS", null],
    ]);
    expect(info.receive.map((r) => r.asset)).toEqual(["BRL"]);
  });
});

describe("isPublicHttpsUrl", () => {
  it("accepts ordinary anchor URLs", () => {
    expect(isPublicHttpsUrl("https://api.anclap.com/sep24")).toBe(true);
    expect(isPublicHttpsUrl("https://sep.example.co.uk/transfer/")).toBe(true);
  });

  it("rejects plain HTTP and unusual ports or credentials", () => {
    expect(isPublicHttpsUrl("http://api.example.com")).toBe(false);
    expect(isPublicHttpsUrl("https://api.example.com:8443")).toBe(false);
    expect(isPublicHttpsUrl("https://user:pw@api.example.com")).toBe(false);
  });

  it("rejects loopback, link-local and private hosts in every spelling", () => {
    for (const url of [
      "https://localhost/info",
      "https://foo.localhost/info",
      "https://127.0.0.1/info",
      "https://0x7f.1/info", // the URL parser turns this into 127.0.0.1
      "https://2130706433/info", // decimal form of 127.0.0.1
      "https://169.254.169.254/latest/meta-data",
      "https://10.0.0.5/info",
      "https://[::1]/info",
      "https://metadata.google.internal/computeMetadata",
      "https://printer.local/info",
      "https://intranet/info",
    ]) {
      expect(isPublicHttpsUrl(url), url).toBe(false);
    }
  });

  it("rejects things that are not URLs", () => {
    expect(isPublicHttpsUrl("")).toBe(false);
    expect(isPublicHttpsUrl("not a url")).toBe(false);
    expect(isPublicHttpsUrl("file:///etc/passwd")).toBe(false);
  });
});
