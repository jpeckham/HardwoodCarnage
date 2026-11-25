export function seedRng(seed: number): number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be a uint32');
  return seed || 0x6d2b79f5;
}
export function nextD6(rng: number): { value: number; rng: number } {
  let next = rng >>> 0;
  next ^= next << 13; next ^= next >>> 17; next ^= next << 5;
  next >>>= 0;
  return {value: next % 6 + 1, rng: next};
}
