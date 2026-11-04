// Keccak-256 (the Ethereum hash, not NIST SHA3). Needed for CCTP V1 used-nonce keys.
const MASK = (BigInt(1) << BigInt(64)) - BigInt(1);
const RC = [
  "0000000000000001", "0000000000008082", "800000000000808a", "8000000080008000", "000000000000808b",
  "0000000080000001", "8000000080008081", "8000000000008009", "000000000000008a", "0000000000000088",
  "0000000080008009", "000000008000000a", "000000008000808b", "800000000000008b", "8000000000008089",
  "8000000000008003", "8000000000008002", "8000000000000080", "000000000000800a", "800000008000000a",
  "8000000080008081", "8000000000008080", "0000000080000001", "8000000080008008",
].map((h) => BigInt(`0x${h}`));
// ROT[y][x]
const ROT = [
  [0, 1, 62, 28, 27],
  [36, 44, 6, 55, 20],
  [3, 10, 43, 25, 39],
  [41, 45, 15, 21, 8],
  [18, 2, 61, 56, 14],
];

const rotl = (v: bigint, n: number) =>
  n === 0 ? v : ((v << BigInt(n)) | (v >> BigInt(64 - n))) & MASK;

function keccakF(a: bigint[]) {
  for (let round = 0; round < 24; round++) {
    const c = Array.from({ length: 5 }, (_, x) => a[x] ^ a[x + 5] ^ a[x + 10] ^ a[x + 15] ^ a[x + 20]);
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1);
      for (let y = 0; y < 5; y++) a[x + 5 * y] ^= d;
    }
    const b: bigint[] = new Array(25).fill(BigInt(0));
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(a[x + 5 * y], ROT[y][x]);
      }
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        a[x + 5 * y] = b[x + 5 * y] ^ (~b[((x + 1) % 5) + 5 * y] & MASK & b[((x + 2) % 5) + 5 * y]);
      }
    }
    a[0] ^= RC[round];
  }
}

export function keccak256(data: Uint8Array): Uint8Array {
  const rate = 136;
  const padded = new Uint8Array(Math.ceil((data.length + 1) / rate) * rate);
  padded.set(data);
  padded[data.length] ^= 0x01;
  padded[padded.length - 1] ^= 0x80;
  const state: bigint[] = new Array(25).fill(BigInt(0));
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = BigInt(0);
      for (let j = 7; j >= 0; j--) lane = (lane << BigInt(8)) | BigInt(padded[off + i * 8 + j]);
      state[i] ^= lane;
    }
    keccakF(state);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    let lane = state[i];
    for (let j = 0; j < 8; j++) {
      out[i * 8 + j] = Number(lane & BigInt(0xff));
      lane >>= BigInt(8);
    }
  }
  return out;
}

export const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export const hexToBytes = (h: string) => {
  const s = h.replace(/^0x/i, "");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
};
