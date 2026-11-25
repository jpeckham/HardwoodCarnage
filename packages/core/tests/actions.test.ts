import { describe, expect, it } from 'vitest';
import { createMatch, applyCommand, legalActions } from '../src/index.js';

const config={teamA:'Reikland Reavers',teamB:'Gouged Eye'} as const;
describe('ball actions and pending decisions',()=>{
  it('offers a failed shot reroll, rejects bypassing the choice, and spends only one reroll',()=>{
    let s=createMatch(config,1); // first D6 is 4: AG3 long shot succeeds on 4
    s.players[0]!.ag=6;
    s=applyCommand(s,{type:'shoot',playerId:'A0'});
    expect(s.pending?.type).toBe('check');
    const before=JSON.stringify(s);
    expect(()=>applyCommand(s,{type:'endTurn'})).toThrow(/pending/i);
    expect(JSON.stringify(s)).toBe(before);
    s=applyCommand(s,{type:'reroll',source:'team'});
    expect(s.teams[0]!.rerolls).toBe(2);
    expect(s.pending).toBeNull();
    expect(s.teams[0]!.rerollUsed).toBe(true);
    expect(()=>applyCommand(s,{type:'reroll',source:'team'})).toThrow();
  });
  it('scores three outside the arc and switches coach and inbound',()=>{
    let s=createMatch(config,1);
    s=applyCommand(s,{type:'shoot',playerId:'A0'});
    expect(s.teams[0]!.score).toBe(3);
    expect(s.current).toBe('B');
    expect(s.ball.carrier).toBe('B0');
    expect(s.shotClock).toBe(4);
  });
  it('failed dodge knocks down and turns over after declining a reroll',()=>{
    let s=createMatch(config,1);
    s.players[2]!.pos={x:6,y:11};
    s.players[0]!.ag=6;
    s=applyCommand(s,{type:'move',playerId:'A0',to:{x:5,y:10}});
    expect(s.pending?.type).toBe('check');
    s=applyCommand(s,{type:'decline'});
    expect(s.current).toBe('B');
    expect(s.players[0]!.status).not.toBe('standing');
    expect(s.events.some(e=>e.kind==='turnover')).toBe(true);
  });
  it('passes to a teammate with a free Catch reroll and preserves loose ball on failure',()=>{
    let s=createMatch(config,1);
    s.players[1]!.ag=6;
    s=applyCommand(s,{type:'pass',playerId:'A0',targetId:'A1'});
    expect(s.pending?.type).toBe('check');
    expect(legalActions(s)).toContainEqual({type:'reroll',source:'skill'});
    s=applyCommand(s,{type:'decline'});
    expect(s.ball.carrier).toBeNull();
    expect(s.ball.pos).toEqual({x:8,y:10});
    expect(s.current).toBe('B');
  });
});
