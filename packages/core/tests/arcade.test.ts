import { describe, expect, it } from 'vitest';
import { createMatch, applyCommand, legalActions } from '../src/index.js';

const config={teamA:'Goblin Swarm',teamB:'Gouged Eye'} as const;
describe('arcade mechanics',()=>{
  it('fields five Goblins with PRD skills against a duo, never another swarm',()=>{
    const s=createMatch(config,1);
    expect(s.players.filter(p=>p.team==='A')).toHaveLength(5);
    expect(s.players[0]!.skills).toEqual(['Stunty','Dodge','Right Stuff']);
    expect(()=>createMatch({teamA:'Goblin Swarm',teamB:'Goblin Swarm'},1)).toThrow(/duo/i);
  });
  it('requires three forward squares for normal dunks and validates aerial spins',()=>{
    let s=createMatch({teamA:'Reikland Reavers',teamB:'Gouged Eye'},1);
    s.players[0]!.pos={x:6,y:22};
    expect(()=>applyCommand(s,{type:'dunk',playerId:'A0',spins:1})).toThrow();
    s.players[0]!.forward=3;
    expect(legalActions(s)).toContainEqual({type:'dunk',playerId:'A0',spins:3});
    expect(()=>applyCommand(s,{type:'dunk',playerId:'A0',spins:4})).toThrow(/spin/i);
    s=applyCommand(s,{type:'dunk',playerId:'A0',spins:0});
    expect(s.events.some(e=>e.kind==='roll' && e.text.includes('Leap'))).toBe(true);
  });
  it('permits a three-Goblin ladder but not two helpers far apart',()=>{
    const s=createMatch(config,1);
    s.players[0]!.pos={x:7,y:21};s.players[1]!.pos={x:6,y:21};s.players[2]!.pos={x:8,y:21};
    expect(legalActions(s)).toContainEqual({type:'ladder',playerId:'A0',spins:1});
    s.players[2]!.pos={x:3,y:10};
    expect(legalActions(s).some(c=>c.type==='ladder')).toBe(false);
  });
  it('forms a defensive ladder without the ball and keeps it active through the opposing turn',()=>{
    let s=createMatch(config,1);
    s.players[0]!.pos={x:7,y:3};s.players[1]!.pos={x:6,y:3};s.players[2]!.pos={x:8,y:3};
    s.ball.carrier='A3';
    expect(legalActions(s)).toContainEqual({type:'formLadder',playerId:'A0'});
    s=applyCommand(s,{type:'formLadder',playerId:'A0'});
    expect(s.ladders).toEqual([['A0','A1','A2']]);
    expect(s.players.slice(0,3).every(p=>p.used)).toBe(true);
    s=applyCommand(s,{type:'endTurn'});
    expect(s.ladders).toHaveLength(1);
    s=applyCommand(s,{type:'endTurn'});
    expect(s.ladders).toHaveLength(0);
  });
  it('requires Right Stuff plus an adjacent Throw Team-Mate player',()=>{
    const s=createMatch({teamA:'Grak & Crumbleberry',teamB:'Gouged Eye'},1);
    s.ball.carrier='A1';s.players[0]!.pos={x:6,y:20};s.players[1]!.pos={x:7,y:20};
    expect(legalActions(s)).toContainEqual({type:'throwTeamMate',playerId:'A0',targetId:'A1',spins:1});
    s.players[0]!.skills=[];
    expect(legalActions(s).some(c=>c.type==='throwTeamMate')).toBe(false);
  });
  it('measures Throw Team-Mate range from the thrower, not the carrier',()=>{
    const s=createMatch({teamA:'Grak & Crumbleberry',teamB:'Gouged Eye'},1);s.ball.carrier='A1';
    s.players[0]!.pos={x:7,y:17};s.players[1]!.pos={x:7,y:18};
    expect(legalActions(s).some(c=>c.type==='throwTeamMate')).toBe(false);
    s.players[0]!.pos={x:7,y:18};s.players[1]!.pos={x:7,y:17};
    expect(legalActions(s).some(c=>c.type==='throwTeamMate')).toBe(true);
  });
  it('ignites on a third basket and an opposing score clears streaks',()=>{
    let s=createMatch({teamA:'Reikland Reavers',teamB:'Gouged Eye'},1);
    s.players[0]!.streak=2;
    s=applyCommand(s,{type:'shoot',playerId:'A0'});
    expect(s.players[0]!.fire).toBe(true);
    s.players[2]!.ag=1;
    // Search a valid seeded stream yielding a natural non-1 for the next shot.
    for(let seed=1;seed<100;seed++) {
      const trial=structuredClone(s);trial.rng=seed;
      const n=applyCommand(trial,{type:'shoot',playerId:'B0'});
      if(n.teams[1]!.score) {s=n;break;}
    }
    expect(s.teams[1]!.score).toBeGreaterThan(0);
    expect(s.players[0]!.fire).toBe(false);
    expect(s.players[0]!.streak).toBe(0);
  });
  it('shatters only with a POW-powered flaming spin dunk and adds the style point',()=>{
    let found=false;
    for(let seed=1;seed<=1000;seed++) {
      let s=createMatch({teamA:'Gouged Eye',teamB:'Reikland Reavers'},seed);
      s.players[0]!.pos={x:7,y:21};s.players[0]!.forward=3;s.players[0]!.fire=true;s.players[0]!.ag=2;
      s=applyCommand(s,{type:'dunk',playerId:'A0',spins:1});
      if(s.glass.includes('A')) {
        expect(s.teams[0]!.score).toBe(3);
        expect(s.events.some(e=>e.kind==='shatter')).toBe(true);
        found=true;break;
      }
    }
    expect(found).toBe(true);
  });
  it('transfers an alley-oop to the receiver before a failed landing drops it',()=>{
    let s=createMatch({teamA:'Reikland Reavers',teamB:'Gouged Eye'},1);
    s.players[0]!.pos={x:6,y:19};s.players[0]!.ag=1;
    s.players[1]!.pos={x:7,y:21};s.players[1]!.forward=3;s.players[1]!.ag=99;
    s=applyCommand(s,{type:'alleyOop',playerId:'A0',targetId:'A1',spins:0});
    expect(s.pending?.type).toBe('check');
    s=applyCommand(s,{type:'decline'});
    expect(s.current).toBe('B');expect(s.ball.carrier).toBeNull();expect(s.ball.pos).toEqual({x:7,y:21});
  });
});
