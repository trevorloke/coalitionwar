// Deterministic, seedable RNG. Every die, draw, and the coin come from here so
// a game replays identically from its seed. For online play the per-round seed
// is derived from the SHA-256 of all revealed order sheets, which makes the
// dice provably fair: nobody can know them before the commit.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  if (a === 0) a = 0x9e3779b9;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    float: next,
    int(n) { return Math.floor(next() * n); },
    d6() { return 1 + this.int(6); },
    coin() { return next() < 0.5 ? 'heads' : 'tails'; },
    pick(arr) { return arr[this.int(arr.length)]; },
    shuffle(arr) {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = this.int(i + 1);
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    },
    state() { return a >>> 0; },
  };
}
