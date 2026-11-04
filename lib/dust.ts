// Stellar assets use 7 decimals (stroops). USDC/USDT0 on EVM and the LayerZero OFT
// shared format use 6. Converting 7 -> 6 drops the last digit; that remainder is dust. Circle CCTP and
// LayerZero OFT remove it before debiting, so the sender keeps it.
// All math is BigInt/string based. No floating point.

export const STELLAR_DECIMALS = 7;
export const WIRE_DECIMALS = 6;
const DUST_FACTOR = BigInt(10) ** BigInt(STELLAR_DECIMALS - WIRE_DECIMALS); // 10

export type DustError =
  | "empty"
  | "invalid"
  | "too_many_decimals"
  | "negative"
  | "too_large";

export type DustResult =
  | {
      ok: true;
      /** Input in stroops (7 decimals) */
      stroops: bigint;
      /** Amount that actually crosses the wire (6 decimals) */
      wireUnits: bigint;
      /** Stroops (0..9) removed before sending; they are not part of the transfer and stay with the sender */
      dustStroops: bigint;
      inputDisplay: string;
      wireDisplay: string;
      dustDisplay: string;
      hasDust: boolean;
    }
  | { ok: false; error: DustError; message: string };

const ERRORS: Record<DustError, string> = {
  empty: "Enter an amount.",
  invalid: "Use digits and an optional decimal point only.",
  too_many_decimals: "Stellar amounts support at most 7 decimal places.",
  negative: "Amount must be positive.",
  too_large: "Amount is too large.",
};

function fail(error: DustError): { ok: false; error: DustError; message: string } {
  return { ok: false, error, message: ERRORS[error] };
}

/** Parse a decimal string into an integer scaled by `decimals`. Rejects extra precision. */
export function parseUnits(
  input: string,
  decimals: number
): { ok: true; value: bigint } | { ok: false; error: DustError } {
  const s = input.trim().replace(/,/g, "");
  if (!s) return { ok: false, error: "empty" };
  if (s.startsWith("-")) return { ok: false, error: "negative" };
  if (!/^\d*\.?\d*$/.test(s) || s === ".") return { ok: false, error: "invalid" };
  const [whole = "", frac = ""] = s.split(".");
  if (frac.length > decimals) return { ok: false, error: "too_many_decimals" };
  const digits = (whole || "0") + frac.padEnd(decimals, "0");
  if (digits.length > 30) return { ok: false, error: "too_large" };
  return { ok: true, value: BigInt(digits) };
}

export function formatUnits(value: bigint, decimals: number, trim = true): string {
  const neg = value < BigInt(0);
  const abs = neg ? -value : value;
  const s = abs.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  let frac = s.slice(s.length - decimals);
  if (trim) frac = frac.replace(/0+$/, "");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${withCommas}${frac ? `.${frac}` : ""}`;
}

/** Outbound: Stellar (7dp) -> EVM/OFT wire (6dp). */
export function analyzeOutbound(input: string): DustResult {
  const parsed = parseUnits(input, STELLAR_DECIMALS);
  if (!parsed.ok) return fail(parsed.error);
  const stroops = parsed.value;
  const dustStroops = stroops % DUST_FACTOR;
  const wireUnits = stroops / DUST_FACTOR;
  return {
    ok: true,
    stroops,
    wireUnits,
    dustStroops,
    inputDisplay: formatUnits(stroops, STELLAR_DECIMALS),
    wireDisplay: formatUnits(wireUnits, WIRE_DECIMALS),
    dustDisplay: formatUnits(dustStroops, STELLAR_DECIMALS),
    hasDust: dustStroops > BigInt(0),
  };
}

/** Inbound: EVM/OFT wire (6dp) -> Stellar (7dp). Always exact, scaled up by 10. */
export type InboundResult =
  | { ok: true; wireUnits: bigint; stroops: bigint; wireDisplay: string; stellarDisplay: string }
  | { ok: false; error: DustError; message: string };

export function analyzeInbound(input: string): InboundResult {
  const parsed = parseUnits(input, WIRE_DECIMALS);
  if (!parsed.ok) return fail(parsed.error);
  const wireUnits = parsed.value;
  const stroops = wireUnits * DUST_FACTOR;
  return {
    ok: true,
    wireUnits,
    stroops,
    wireDisplay: formatUnits(wireUnits, WIRE_DECIMALS),
    stellarDisplay: formatUnits(stroops, STELLAR_DECIMALS),
  };
}

/** Largest amount <= input that survives the 7 -> 6 conversion with zero dust. */
export function dustFreeAmount(stroops: bigint): bigint {
  return stroops - (stroops % DUST_FACTOR);
}
