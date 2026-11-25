import { describe, expect, it } from 'vitest';
import { createMatch, applyCommand, legalActions, chooseAiCommand, replayMatch, serializeReplay } from '../src/index.js';

describe('compact matches', () => {
  it('sets up exact rosters, rim geometry, possession and immutable moves', () => {
    const s = createMatch({teamA:'Reikland Reavers',teamB:'Gouged Eye'}, 123);
    expect(s.players).toHaveLength(4);
    expect(s.ball.carrier).toBe('A0');
    expect(s.shotClock).toBe(4);
    expect(s.teams.map(t=>t.rerolls)).toEqual([3,3]);
    const before = JSON.stringify(s);
    const n = applyCommand(s,{type:'move',playerId:'A0',to:{x:6,y:11}});
    expect(n.players[0]?.pos).toEqual({x:6,y:11});
    expect(JSON.stringify(s)).toBe(before);
    expect(n.rng).toBe(s.rng);
    expect(n.players[0]?.moved).toBe(1);
  });
  it('rejects malformed and illegal commands without mutation or random consumption', () => {
    const s = createMatch({teamA:'Reikland Reavers',teamB:'Gouged Eye'}, 17);
    const before = JSON.stringify(s);
    for (const command of [null, {}, {type:'wat'}, {type:'move',playerId:'B0',to:{x:6,y:16}},
      {type:'move',playerId:'A0',to:{x:6,y:20}}, {type:'move',playerId:'A0',to:{x:NaN,y:10}},
      {type:'shoot',playerId:17}]) {
      expect(()=>applyCommand(s,command as never)).toThrow();
      expect(JSON.stringify(s)).toBe(before);
    }
  });
  it('expires the four-possession-turn clock and completes two eight-turn halves', () => {
    let s=createMatch({teamA:'Reikland Reavers',teamB:'Gouged Eye'},1);
    for(let i=0;i<7;i++) s=applyCommand(s,{type:'endTurn'});
    expect(s.possession).toBe('B');
    expect(s.shotClock).toBe(4);
    expect(s.events.some(e=>e.kind==='turnover' && e.text.includes('clock'))).toBe(true);
    for(let i=7;i<32;i++) s=applyCommand(s,{type:'endTurn'});
    expect(s.over).toBe(true);
    expect(s.half).toBe(2);
    expect(s.turn).toBe(32);
    expect(()=>applyCommand(s,{type:'endTurn'})).toThrow(/over/i);
  });
  it('makes a complete AI match, saves it and reproduces every final state field', () => {
    let s=createMatch({teamA:'Reikland Reavers',teamB:'Skavenblight'}, 98451);
    let count=0;
    while(!s.over && count++<3000) {
      const command=chooseAiCommand(s);
      expect(legalActions(s)).toContainEqual(command);
      s=applyCommand(s,command);
    }
    expect(s.over).toBe(true);
    expect(s.events.some(e=>e.kind==='score')).toBe(true);
    expect(s.events.some(e=>e.kind==='move')).toBe(true);
    expect(replayMatch(JSON.parse(serializeReplay(s)))).toEqual(s);
    expect(()=>replayMatch({schema:99})).toThrow();
    const replay=JSON.parse(serializeReplay(s));
    replay.commands.push({type:'move',playerId:'A0',to:{x:99,y:99}});
    expect(()=>replayMatch(replay)).toThrow();
  });
});
