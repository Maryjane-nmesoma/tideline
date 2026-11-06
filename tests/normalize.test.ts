import { describe, expect, it } from "vitest";
import { normalizeLzMessage } from "@/lib/adapters/layerzero";
import { normalizeIrisMessage } from "@/lib/adapters/circle";
import { STELLAR_CCTP_DOMAIN, STELLAR_LZ_EID } from "@/lib/config";
import type { IrisMessage, LzMessage } from "@/lib/upstream";

const NOW = 1_800_000_000;
const RECIPIENT = "ab".repeat(32);
// 32 byte recipient + 8 byte amount (1,500,000 = 1.5 in 6 decimals)
const PAYLOAD = `0x${RECIPIENT}${(1_500_000).toString(16).padStart(16, "0")}`;

function lz(over: Partial<LzMessage> & Record<string, unknown> = {}): LzMessage {
  return {
    guid: "0xguid",
    created: new Date((NOW - 300) * 1000).toISOString(),
    pathway: { srcEid: 30101, dstEid: STELLAR_LZ_EID, nonce: 7, sender: { id: "usdt0", address: "0xsender" }, receiver: { address: "0xreceiver" } },
    source: { status: "SUCCEEDED", tx: { txHash: "0xsrc", blockTimestamp: NOW - 300, payload: PAYLOAD } },
    destination: { status: "WAITING" },
    verification: { dvn: { status: "WAITING", dvns: {} } },
    status: { name: "INFLIGHT", message: "Inflight" },
    ...over,
  } as LzMessage;
}

describe("normalizeLzMessage", () => {
  it("decodes the OFT amount and direction", () => {
    const t = normalizeLzMessage(lz(), NOW);
    expect(t.direction).toBe("inbound");
    expect(t.wireAmount).toBe("1.5");
    expect(t.asset).toBe("USDT0");
    expect(t.protocol).toBe("layerzero");
  });

  it("marks outbound when Stellar is the source", () => {
    const t = normalizeLzMessage(lz({ pathway: { srcEid: STELLAR_LZ_EID, dstEid: 30101 } }), NOW);
    expect(t.direction).toBe("outbound");
  });

  it("is attesting while verifiers have not signed", () => {
    expect(normalizeLzMessage(lz(), NOW).status).toBe("attesting");
  });

  it("is relaying once verified, waiting for the executor", () => {
    const t = normalizeLzMessage(lz({ verification: { dvn: { status: "SUCCEEDED", dvns: {} } } }), NOW);
    expect(t.status).toBe("relaying");
    expect(t.diagnostics.some((d) => d.title.startsWith("Verified, waiting for executor"))).toBe(true);
  });

  it("is completed when delivered, with a latency", () => {
    const t = normalizeLzMessage(
      lz({
        status: { name: "DELIVERED", message: "Delivered" },
        destination: { status: "SUCCEEDED", tx: { txHash: "0xdst", blockTimestamp: NOW - 240 } },
        verification: { dvn: { status: "SUCCEEDED", dvns: {} } },
      }),
      NOW
    );
    expect(t.status).toBe("completed");
    expect(t.latencySeconds).toBe(60);
    expect(t.dstTxHash).toBe("0xdst");
  });

  it("is stalled when a payload is stored, or when nothing moves for over an hour", () => {
    expect(normalizeLzMessage(lz({ status: { name: "PAYLOAD_STORED" } }), NOW).status).toBe("stalled");
    const old = lz({ source: { status: "SUCCEEDED", tx: { txHash: "0xsrc", blockTimestamp: NOW - 7200, payload: PAYLOAD } } });
    expect(normalizeLzMessage(old, NOW).status).toBe("stalled");
  });

  it("is failed on a terminal failure", () => {
    expect(normalizeLzMessage(lz({ status: { name: "FAILED" } }), NOW).status).toBe("failed");
  });

  it("tolerates a sparse payload without throwing", () => {
    const sparse = { guid: "0xg", pathway: { srcEid: 30101, dstEid: STELLAR_LZ_EID } } as LzMessage;
    expect(() => normalizeLzMessage(sparse, NOW)).not.toThrow();
  });
});

function iris(over: Partial<IrisMessage> = {}): IrisMessage {
  return {
    status: "complete",
    cctpVersion: 2,
    eventNonce: `0x${"11".repeat(32)}`,
    attestation: "0xatt",
    message: "0xmsg",
    decodedMessage: {
      sourceDomain: "0",
      destinationDomain: String(STELLAR_CCTP_DOMAIN),
      minFinalityThreshold: 1000,
      finalityThresholdExecuted: 1000,
      decodedMessageBody: { amount: "2500000", mintRecipient: "G...", messageSender: "0xme" },
    },
    ...over,
  };
}

const facts = (burnTs: number) => ({ timestamp: burnTs, rows: [] });

describe("normalizeIrisMessage", () => {
  it("is attesting until Circle signs", () => {
    const t = normalizeIrisMessage(iris({ status: "pending_confirmations" }), 0, "0xtx", 0, { facts: facts(NOW - 60), mint: null }, NOW);
    expect(t.status).toBe("attesting");
  });

  it("is completed only when the destination confirms the mint", () => {
    const t = normalizeIrisMessage(
      iris(),
      0,
      "0xtx",
      0,
      { facts: facts(NOW - 600), mint: { state: "minted", txHash: "abc", timestamp: NOW - 540, note: "ok" } },
      NOW
    );
    expect(t.status).toBe("completed");
    expect(t.latencySeconds).toBe(60);
    expect(t.dstTxHash).toBe("abc");
    expect(t.direction).toBe("inbound");
    expect(t.wireAmount).toBe("2.5");
  });

  it("stays attested, never completed, when the mint could not be checked", () => {
    const t = normalizeIrisMessage(iris(), 0, "0xtx", 0, { facts: facts(NOW - 600), mint: { state: "unknown", note: "no rpc" } }, NOW);
    expect(t.status).toBe("attested");
  });

  it("is relaying shortly after the burn and stalled after an hour with no mint", () => {
    const pending = { state: "pending" as const, note: "waiting" };
    const soon = normalizeIrisMessage(iris(), 0, "0xtx", 0, { facts: facts(NOW - 600), mint: pending }, NOW);
    const late = normalizeIrisMessage(iris(), 0, "0xtx", 0, { facts: facts(NOW - 7200), mint: pending }, NOW);
    expect(soon.status).toBe("relaying");
    expect(late.status).toBe("stalled");
    expect(late.diagnostics.some((d) => d.severity === "critical")).toBe(true);
  });

  it("explains a Fast Transfer delay", () => {
    const t = normalizeIrisMessage(iris({ delayReason: "insufficient_fee" }), 0, "0xtx", 0, { facts: facts(NOW - 60), mint: null }, NOW);
    expect(t.diagnostics[0].title).toContain("insufficient fee");
  });

  it("labels finality whether Circle sends a number or a string", () => {
    const numeric = normalizeIrisMessage(iris(), 0, "0xtx", 0, { facts: facts(NOW - 60), mint: null }, NOW);
    const asString = normalizeIrisMessage(
      iris({ decodedMessage: { ...iris().decodedMessage, minFinalityThreshold: "2000" } }),
      0,
      "0xtx",
      0,
      { facts: facts(NOW - 60), mint: null },
      NOW
    );
    expect(numeric.meta.find((r) => r.label === "Requested finality")?.value).toBe("Fast (confirmed)");
    expect(asString.meta.find((r) => r.label === "Requested finality")?.value).toBe("Standard (finalized)");
  });
});
