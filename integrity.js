// Streaming SHA-256 (WebCrypto has no incremental API, so large files can't be hashed in one go).
const P = [];
for (let n = 2; P.length < 64; n++) if (P.every(p => n % p)) P.push(n);
const frac = x => Math.floor((x - Math.floor(x)) * 4294967296);
const K = new Uint32Array(P.map(p => frac(Math.cbrt(p))));

export class Sha256 {
  constructor() {
    this.h = new Uint32Array(P.slice(0, 8).map(p => frac(Math.sqrt(p))));
    this.b = new Uint8Array(64); this.n = 0; this.len = 0; this.w = new Uint32Array(64);
  }
  _block(d, o) {
    const w = this.w, h = this.h;
    for (let i = 0; i < 16; i++) w[i] = (d[o+4*i] << 24 | d[o+4*i+1] << 16 | d[o+4*i+2] << 8 | d[o+4*i+3]) >>> 0;
    for (let i = 16; i < 64; i++) {
      const a = w[i-15], c = w[i-2];
      w[i] = w[i-16] + ((a>>>7|a<<25) ^ (a>>>18|a<<14) ^ (a>>>3)) + w[i-7] + ((c>>>17|c<<15) ^ (c>>>19|c<<13) ^ (c>>>10));
    }
    let [a, b, c, d2, e, f, g, H] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (H + ((e>>>6|e<<26) ^ (e>>>11|e<<21) ^ (e>>>25|e<<7)) + ((e&f) ^ (~e&g)) + K[i] + w[i]) >>> 0;
      const t2 = (((a>>>2|a<<30) ^ (a>>>13|a<<19) ^ (a>>>22|a<<10)) + ((a&b) ^ (a&c) ^ (b&c))) >>> 0;
      H = g; g = f; f = e; e = (d2 + t1) >>> 0; d2 = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0]+=a; h[1]+=b; h[2]+=c; h[3]+=d2; h[4]+=e; h[5]+=f; h[6]+=g; h[7]+=H;
  }
  update(d) {
    this.len += d.length; let i = 0;
    if (this.n) {
      while (i < d.length && this.n < 64) this.b[this.n++] = d[i++];
      if (this.n == 64) { this._block(this.b, 0); this.n = 0; }
    }
    for (; i + 64 <= d.length; i += 64) this._block(d, i);
    while (i < d.length) this.b[this.n++] = d[i++];
  }
  hex() {
    const bits = this.len * 8, p = new Uint8Array((this.n < 56 ? 64 : 128) - this.n), v = new DataView(p.buffer);
    p[0] = 128;
    v.setUint32(p.length - 8, Math.floor(bits / 4294967296));
    v.setUint32(p.length - 4, bits >>> 0);
    this.update(p);
    return [...this.h].map(x => x.toString(16).padStart(8, '0')).join('');
  }
}

// Whole-file SHA-256. Uses crypto.subtle.digest where it is available (secure contexts) and the file fits
// comfortably in memory; otherwise streams 1 MB slices through the JS hasher above.
export const SUBTLE_LIMIT = 128 * 1024 * 1024;
const hexOf = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export async function hashBlob(blob, limit = SUBTLE_LIMIT) {
  if (globalThis.crypto?.subtle && blob.size <= limit)
    return hexOf(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  const h = new Sha256(), S = 1 << 20;
  for (let o = 0; o < blob.size; o += S) h.update(new Uint8Array(await blob.slice(o, o + S).arrayBuffer()));
  return h.hex();
}
