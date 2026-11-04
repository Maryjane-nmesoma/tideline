// Minimal Stellar strkey (SEP-23) encode/decode so we can map LayerZero's 32-byte
// hex addresses to G... accounts / C... contracts without pulling in the full SDK.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const VERSION_ACCOUNT = 6 << 3; // G
const VERSION_CONTRACT = 2 << 3; // C

function crc16xmodem(bytes: Uint8Array): number {
  let crc = 0x0000;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Uint8Array | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of str) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.replace(/^0x/i, "");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function encode(version: number, payload: Uint8Array): string {
  const data = new Uint8Array(1 + payload.length);
  data[0] = version;
  data.set(payload, 1);
  const crc = crc16xmodem(data);
  const full = new Uint8Array(data.length + 2);
  full.set(data);
  full[data.length] = crc & 0xff; // little endian
  full[data.length + 1] = (crc >> 8) & 0xff;
  return base32Encode(full);
}

export type StrkeyKind = "account" | "contract";

export function decodeStrkey(
  s: string
): { kind: StrkeyKind; hex: string } | null {
  if (!/^[GC][A-Z2-7]{55}$/.test(s)) return null;
  const bytes = base32Decode(s);
  if (!bytes || bytes.length !== 35) return null;
  const data = bytes.slice(0, 33);
  const crc = bytes[33] | (bytes[34] << 8);
  if (crc16xmodem(data) !== crc) return null;
  const version = data[0];
  const kind =
    version === VERSION_ACCOUNT ? "account" : version === VERSION_CONTRACT ? "contract" : null;
  if (!kind) return null;
  return { kind, hex: bytesToHex(data.slice(1)) };
}

export function isStellarAddress(s: string): boolean {
  return decodeStrkey(s) !== null;
}

export function hexToStrkey(hex: string, kind: StrkeyKind): string | null {
  const h = hex.replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(h)) return null;
  return encode(kind === "account" ? VERSION_ACCOUNT : VERSION_CONTRACT, hexToBytes(h));
}

export function shortAddress(a: string, head = 6, tail = 4): string {
  if (a.length <= head + tail + 1) return a;
  return `${a.slice(0, head)}...${a.slice(-tail)}`;
}
