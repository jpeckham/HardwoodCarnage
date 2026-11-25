import { describe, expect, it } from 'vitest';
import { inBounds } from '../src/court.js';
import { nextD6, seedRng } from '../src/dice.js';
import { ROSTERS } from '../src/rosters.js';

describe('fixed PRD foundation', () => {
  it('has exactly 15 by 26 integer court squares', () => {
    for (const p of [{x:0,y:0},{x:14,y:25}]) expect(inBounds(p)).toBe(true);
    for (const p of [{x:-1,y:0},{x:15,y:0},{x:0,y:26},{x:1.5,y:0},{x:NaN,y:0}]) expect(inBounds(p)).toBe(false);
  });
  it('replays an immutable serializable RNG stream', () => {
    let a = seedRng(123); let b = JSON.parse(JSON.stringify(a)) as number;
    const rolls: number[] = [];
    for (let i=0;i<100;i++) {
      const old = a; const first = nextD6(a); const second = nextD6(b);
      expect(a).toBe(old); expect(first).toEqual(second);
      expect(first.value).toBeGreaterThanOrEqual(1); expect(first.value).toBeLessThanOrEqual(6);
      a=first.rng; b=second.rng; rolls.push(first.value);
    }
    expect(new Set(rolls).size).toBe(6);
    expect(seedRng(0)).not.toBe(0);
    for (const invalid of [-1, 2**32, NaN, 1.2, Infinity]) expect(()=>seedRng(invalid)).toThrow(/seed/i);
  });
  it('records every exact standard duo statistic and skill', () => {
    expect(Object.values(ROSTERS).slice(0,4).map(team=>team.map(p=>[p.name,p.ma,p.st,p.ag,p.skills]))).toEqual([
      [['Human Blitzer',7,3,3,[]],['Human Catcher',8,2,2,['Catch','Dodge']]],
      [['Black Orc',4,4,5,['Grab','Brawler']],['Orc Blitzer',6,3,3,['Block']]],
      [['Gutter Runner',9,2,2,['Dodge','Weeping Dagger']],['Rat Ogre',6,5,4,['Frenzy','Prehensile Tail']]],
      [['Ogre',5,5,4,['Throw Team-Mate']],['Halfling',5,2,3,['Right Stuff']]],
    ]);
  });
});
