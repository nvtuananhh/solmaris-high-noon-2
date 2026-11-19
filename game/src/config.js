// config.js — Solmaris tuning constants and pure helpers.
// Pure functions only: no randomness, no clocks, no I/O in this file.
export const CFG = {
  seedDefault: 1,
  dt: 1 / 60,
  worldHalf: 240,
  startCash: 120,
  startMinutes: 12 * 60, // bright midday: the clock starts at 12:00
  dayLengthMinutes: 24 * 60,
  playerHealth: 100,
  playerWalkSpeed: 5.2,
  playerRunSpeed: 9.0,
  playerJumpSpeed: 7.5,
  gravity: 22,
  pistolAmmoStart: 24,
  pistolDamage: 34,
  pistolRange: 46,
  pistolCooldown: 0.28,
  meleeDamage: 14,
  meleeRange: 2.2,
  meleeCooldown: 0.45,
  carAccel: 16,
  carBrake: 26,
  carMaxSpeed: 34,
  carMaxReverse: 9,
  carSteer: 1.9,
  carDrag: 0.55,
  wantedDecaySeconds: 26,
  bustedHoldSeconds: 3,
  tokenCount: 12,
  farePayMin: 45,
  farePayMax: 140,
};

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
// In-game clock string from sim minutes (0..1439). The only clock the game shows.
export function fmtClock(minutes) {
  const m = Math.floor(minutes) % CFG.dayLengthMinutes;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return (h < 10 ? '0' + h : '' + h) + ':' + (mm < 10 ? '0' + mm : '' + mm);
}
export function fmtDayClock(minutes) {
  return 'Day 1 — ' + fmtClock(minutes);
}
// FNV-1a hash of a string, returned as 8 hex chars. Used for state hashes.
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ('0000000' + (h >>> 0).toString(16)).slice(-8);
}
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
