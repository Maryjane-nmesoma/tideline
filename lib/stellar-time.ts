/**
 * Maps a Unix timestamp to a Stellar ledger sequence.
 *
 * Ledgers close about every 5.5 seconds, but not exactly, so a straight division drifts by hours over a month.
 * This does a secant search: guess from the average rate, ask the network what time the guessed ledger closed,
 * then re-aim using the two most recent points. It usually lands within a minute after two or three lookups.
 * The network call is injected so the search stays pure and testable.
 */

export type LedgerPoint = { seq: number; ts: number };

export type FindLedgerOptions = {
  /** Stop once a probe is this close to the target, in seconds. */
  toleranceSeconds?: number;
  /** Upper bound on network lookups. */
  maxProbes?: number;
  /** Prior for the average close time, used for the first guess. */
  secondsPerLedger?: number;
  /** The result is moved back this many seconds so it never lands after the target. */
  safetySeconds?: number;
};

export async function findLedgerAtTime(
  targetTs: number,
  latest: LedgerPoint,
  closeTimeOf: (seq: number) => Promise<number>,
  opts: FindLedgerOptions = {}
): Promise<number> {
  const { toleranceSeconds = 90, maxProbes = 6, secondsPerLedger = 5.5, safetySeconds = 120 } = opts;
  if (targetTs >= latest.ts) return latest.seq;

  let prev: LedgerPoint = latest;
  let guess = Math.max(1, Math.round(latest.seq - (latest.ts - targetTs) / secondsPerLedger));
  let rate = secondsPerLedger;
  let best: LedgerPoint | null = null;

  for (let i = 0; i < maxProbes; i++) {
    const point: LedgerPoint = { seq: guess, ts: await closeTimeOf(guess) };
    // Prefer the probe nearest the target from below, so the final answer is never later than the target.
    if (point.ts <= targetTs && (!best || point.ts > best.ts)) best = point;
    if (Math.abs(point.ts - targetTs) <= toleranceSeconds) {
      best = point; // converged: this probe, not an earlier one that was merely below the target
      break;
    }
    if (point.seq !== prev.seq && point.ts !== prev.ts) {
      const measured = (point.ts - prev.ts) / (point.seq - prev.seq);
      if (measured > 1 && measured < 30) rate = measured;
    }
    prev = point;
    guess = Math.max(1, Math.round(point.seq + (targetTs - point.ts) / rate));
    if (guess === point.seq) break;
  }

  const anchor = best ?? prev;
  const behind = Math.max(0, anchor.ts - targetTs) + safetySeconds;
  return Math.max(1, Math.floor(anchor.seq - behind / rate));
}
