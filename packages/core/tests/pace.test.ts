import { describe, expect, it } from 'vitest';
import { createMatch, applyCommand, legalActions, replayMatch, serializeReplay, chooseAiCommand, courtSize, rim } from '../src/index.js';
import { reachableMoves } from '../src/paths.js';
import { courtSvg, selectedPanel } from '../../../apps/web/render.js';
import { flightGeometry } from '../../../apps/web/effects.js';
const config={teamA:'Grak & Crumbleberry',teamB:'Gouged Eye',court:'arcade'} as const;
describe('fast arcade court',()=>{
  it('uses a smaller real grid and gives the signature duo an immediate throw opportunity',()=>{
    const s=createMatch(config,1);
    expect(courtSize(s)).toMatchObject({width:9,length:16,turnsPerHalf:6});
    expect(s.ball.carrier).toBe('A1');
    expect(legalActions(s)).toContainEqual({type:'throwTeamMate',playerId:'A0',targetId:'A1',spins:1});
    expect(courtSvg(s,'A1')).toContain('9 by 16 square');
    expect(selectedPanel(s,'A1',1,false)).toContain('Halfling cannon');
  });
  it('allows half-court spin dunks after a two-step run-up, with real chance resolution',()=>{
    let s=createMatch({...config,teamA:'Reikland Reavers'},1);
    s=applyCommand(s,{type:'run',playerId:'A0',to:{x:2,y:8}});
    expect(s.players[0]!.forward).toBe(2);
    expect(legalActions(s)).toContainEqual({type:'dunk',playerId:'A0',spins:2});
    s=applyCommand(s,{type:'dunk',playerId:'A0',spins:2});
    expect(s.events.some(e=>e.kind==='dunk'&&e.text.includes('HALF-COURT'))).toBe(true);
  });
  it('moves across several squares with one command and replays the whole path',()=>{
    const s=createMatch(config,7);
    const moves=reachableMoves(s,'A1');
    const c=moves.find(c=>c.to.x===1&&c.to.y===7)!;
    expect(c).toBeDefined();
    const n=applyCommand(s,c);
    expect(n.players[1]!.pos).toEqual({x:1,y:7});expect(n.players[1]!.moved).toBe(3);
    expect(s.players[1]!.moved).toBe(0);
    expect(replayMatch(JSON.parse(serializeReplay(n)))).toEqual(n);
  });
  it('rejects an unreachable run atomically and handles a failed path dodge before continuing',()=>{
    let s=createMatch(config,1);s.players[0]!.ag=99;s.players[2]!.pos={x:3,y:5};
    const before=JSON.stringify(s);
    expect(()=>applyCommand(s,{type:'run',playerId:'A0',to:{x:9,y:16}})).toThrow();
    expect(JSON.stringify(s)).toBe(before);
    s=applyCommand(s,{type:'run',playerId:'A0',to:{x:1,y:6}});
    expect(s.pending?.type).toBe('check');expect(s.players[0]!.moved).toBe(0);
    s=applyCommand(s,{type:'decline'});expect(s.current).toBe('B');expect(s.players[0]!.moved).toBe(0);
  });
  it('finishes arcade matches sooner and preserves Classic replay identity',()=>{
    let s=createMatch(config,2),count=0;
    while(!s.over&&count++<1500)s=applyCommand(s,chooseAiCommand(s));
    expect(s.over).toBe(true);expect(s.turn).toBe(24);
    expect(replayMatch(JSON.parse(serializeReplay(s)))).toEqual(s);
    const classic=createMatch({teamA:'Reikland Reavers',teamB:'Gouged Eye'},1);
    expect(classic.rules).toBe('hardwood-arcade/1.0.0');expect(rim('A',1,classic)).toEqual({x:7,y:24});
    expect(replayMatch(JSON.parse(serializeReplay(classic)))).toEqual(classic);
  });
  it('launches the ball-carrying Halfling from the opening setup and scores through the far hoop',()=>{
    const initial=createMatch(config,1);
    const n=applyCommand(initial,{type:'throwTeamMate',playerId:'A0',targetId:'A1',spins:1});
    expect(n.teams[0]!.score).toBe(2);
    const launch=n.events.find(e=>e.kind==='dunk')!;
    expect(launch.playerId).toBe('A1');expect(launch.text).toContain('THROUGH THE HOOP');
    expect(flightGeometry(initial,launch)?.end).toEqual({x:580,y:180});
    expect(n.events.find(e=>e.kind==='score')!.playerId).toBe('A1');
    expect(replayMatch(JSON.parse(serializeReplay(n)))).toEqual(n);
  });
  it('exposes the cannon while the adjacent Halfling is active, as one combined team play',()=>{
    let s=createMatch(config,1);
    s=applyCommand(s,{type:'move',playerId:'A1',to:{x:4,y:7}});
    expect(legalActions(s)).toContainEqual({type:'throwTeamMate',playerId:'A0',targetId:'A1',spins:1});
    expect(()=>applyCommand(s,{type:'throwTeamMate',playerId:'A0',targetId:'A1',spins:1})).not.toThrow();
  });
  it('releases an injured runner so a burning ball cannot lock out the ready teammate',()=>{
    let s=createMatch(config,3);s.ball={carrier:null,pos:{x:3,y:5},hot:true};s.possession='B';
    s=applyCommand(s,{type:'run',playerId:'A1',to:{x:4,y:4}});
    expect(s.players[1]!.status).toBe('stunned');
    expect(s.active).toBeNull();expect(s.current).toBe('A');
    expect(legalActions(s).some(c=>'playerId'in c&&c.playerId==='A0')).toBe(true);
  });
  it('resumes the remaining path after a successful reroll and serializes the pending decision',()=>{
    let found=false;
    for(let seed=1;seed<100;seed++) {
      let s=createMatch({...config,teamA:'Reikland Reavers'},seed);
      s.players[0]!.ag=6;s.players[2]!.pos={x:3,y:5};
      s=applyCommand(s,{type:'run',playerId:'A0',to:{x:1,y:8}});
      if(s.pending?.type!=='check')continue;
      const n=applyCommand(s,{type:'reroll',source:'team'});
      expect(applyCommand(JSON.parse(JSON.stringify(s)),{type:'reroll',source:'team'})).toEqual(n);
      if(n.current==='A'&&n.players[0]!.moved===2) {expect(n.players[0]!.pos).toEqual({x:1,y:8});found=true;break;}
    }
    expect(found).toBe(true);
  });
  it('rejects profile/rules mismatches rather than reinterpreting a saved court',()=>{
    const s=createMatch(config,1),r=JSON.parse(serializeReplay(s));
    r.config.court='classic';expect(()=>replayMatch(r)).toThrow(/rules|court/i);
  });
});
