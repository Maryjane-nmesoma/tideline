/**
 * fetch with one retry on a network failure or a 5xx, with a short pause. The public APIs this app reads are
 * occasionally slow or reset a connection, and a second attempt almost always succeeds.
 */
export async function fetchRetry(input: string | URL, init?: RequestInit & { next?: { revalidate?: number } }) {
  try {
    const res = await fetch(input, init);
    if (res.status < 500) return res;
  } catch {
    // fall through to the retry
  }
  await new Promise((r) => setTimeout(r, 400));
  return fetch(input, init);
}
