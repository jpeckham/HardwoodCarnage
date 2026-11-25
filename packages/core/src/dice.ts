export function seedRng(seed: number): number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be a uint32');
  return seed || 0x6d2b79f5;
}
function nextDie(rng:number,sides:number):{value:number;rng:number} {
  let next = rng >>> 0;
  next ^= next << 13; next ^= next >>> 17; next ^= next << 5;
  next >>>= 0;
  return {value: next % sides + 1, rng: next};
}
export const nextD6=(rng:number)=>nextDie(rng,6);
export const nextD8=(rng:number)=>nextDie(rng,8);
