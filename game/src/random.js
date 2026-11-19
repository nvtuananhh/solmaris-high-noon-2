// random.js — the ONLY source of randomness in the game.
// Seeded mulberry32 streams. Every system gets its own named stream, created
// once from the URL seed at world init, and draws in a fixed order per tick.
// Nothing in game/ may use an unseeded random source: all gameplay randomness
// flows through these streams, so the same seed always replays the same game.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function range(rng, min, max) { return min + rng() * (max - min); }
export function rangeInt(rng, min, max) { return Math.floor(range(rng, min, max + 1)); }
export function chance(rng, p) { return rng() < p; }
export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}
// Named stream factory: one stream per system, each seeded from the base
// seed plus a stable per-system salt, so call order in one system can never
// shift another system's draws.
export function makeStreams(baseSeed) {
  const salt = (name) => {
    let h = baseSeed >>> 0;
    for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) >>> 0;
    return h;
  };
  return {
    world: makeRng(salt('world')),
    traffic: makeRng(salt('traffic')),
    peds: makeRng(salt('peds')),
    combat: makeRng(salt('combat')),
    audio: makeRng(salt('audio')),
    effects: makeRng(salt('effects')),
    missions: makeRng(salt('missions')),
    police: makeRng(salt('police')),
  };
}
