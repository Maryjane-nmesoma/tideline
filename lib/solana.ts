import { createHash } from "node:crypto";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const P = (BigInt(1) << BigInt(255)) - BigInt(19);
const ZERO = BigInt(0);
const ONE = BigInt(1);

export function base58Decode32(s: string): Uint8Array {
  let n = ZERO;
  for (const c of s) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("bad base58");
    n = n * BigInt(58) + BigInt(i);
  }
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & BigInt(0xff));
    n >>= BigInt(8);
  }
  return out;
}

export function base58Encode(bytes: Uint8Array): string {
  let n = ZERO;
  for (const b of bytes) n = (n << BigInt(8)) | BigInt(b);
  let s = "";
  while (n > ZERO) {
    s = ALPHABET[Number(n % BigInt(58))] + s;
    n /= BigInt(58);
  }
  for (const b of bytes) {
    if (b !== 0) break;
    s = `1${s}`;
  }
  return s;
}

function modPow(base: bigint, exp: bigint, mod: bigint) {
  let result = ONE;
  let b = base % mod;
  let e = exp;
  while (e > ZERO) {
    if (e & ONE) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= ONE;
  }
  return result;
}

// d = -121665 / 121666 in GF(2^255 - 19)
const D = ((P - BigInt(121665)) * modPow(BigInt(121666), P - BigInt(2), P)) % P;
const SQRT_M1 = modPow(BigInt(2), (P - ONE) / BigInt(4), P);

/** True when the 32 bytes decode to a valid ed25519 point. A PDA must NOT be on the curve. */
function onCurve(bytes: Uint8Array): boolean {
  let y = ZERO;
  for (let i = 31; i >= 0; i--) y = (y << BigInt(8)) | BigInt(bytes[i]);
  const sign = y >> BigInt(255);
  y &= (ONE << BigInt(255)) - ONE;
  if (y >= P) return false;
  const u = (y * y - ONE + P) % P;
  const v = (D * y * y + ONE) % P;
  const x2 = (u * modPow(v, P - BigInt(2), P)) % P;
  let x = modPow(x2, (P + BigInt(3)) / BigInt(8), P);
  if ((x * x - x2 + P) % P !== ZERO) {
    x = (x * SQRT_M1) % P;
    if ((x * x - x2 + P) % P !== ZERO) return false;
  }
  return !(x === ZERO && sign === ONE);
}

export function findProgramAddress(seeds: Uint8Array[], programId: string): string {
  const program = base58Decode32(programId);
  for (let bump = 255; bump >= 0; bump--) {
    const h = createHash("sha256");
    for (const s of seeds) h.update(s);
    h.update(Uint8Array.of(bump));
    h.update(program);
    h.update("ProgramDerivedAddress");
    const digest = new Uint8Array(h.digest());
    if (!onCurve(digest)) return base58Encode(digest);
  }
  throw new Error("no viable bump");
}
