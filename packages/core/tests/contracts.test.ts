import { describe, expect, it } from 'vitest';
import { applyCommand, createMatch, legalActions, chooseAiCommand, replayMatch, serializeReplay, shotPoints, rim, type MatchState, type RosterName } from '../src/index.js';
import { nextD6 } from '../src/dice.js';
import { courtSvg } from '../../../apps/web/render.js';
import { tabletopKit } from '../../../apps/web/tabletop.js';

const seedFor=(face:number)=>{for(let seed=1;seed<10000;seed++)if(nextD6(seed).value===face)return seed;throw Error('No seed');};
const config={teamA:'Gouged Eye',teamB:'Reikland Reavers'} as const;
function contact(face:'Push'|'POW!'|'Both Down'|'Defender Stumbles',s=createMatch(config,1)):MatchState {
  s.players[0]!.pos={x:1,y:10};s.players[2]!.pos={x:0,y:10};
  s=applyCommand(s,{type:'block',playerId:'A0',targetId:'B0',blitz:false});
  if(s.pending?.type==='block')s.pending.dice=[face];
  return s;
}
describe('rules contracts and regressions',()=>{
  it('uses mirrored rims and an exact radius-six arc boundary',()=>{
    expect(rim('A',1)).toEqual({x:7,y:24});expect(rim('A',2)).toEqual({x:7,y:1});
    expect(shotPoints({x:7,y:18},rim('A',1))).toBe(2);
    expect(shotPoints({x:8,y:18},rim('A',1))).toBe(3);
  });
  it('honors natural one and six even with extreme AG targets',()=>{
    let s=createMatch(config,seedFor(1));s.players[0]!.ag=1;
    s=applyCommand(s,{type:'shoot',playerId:'A0'});expect(s.pending?.type).toBe('check');
    s=createMatch(config,seedFor(6));s.players[0]!.ag=20;
    s=applyCommand(s,{type:'shoot',playerId:'A0'});expect(s.teams[0]!.score).toBe(3);
  });
  it('rejects rim squares and occupied squares and locks an active player',()=>{
    let s=createMatch(config,1);s.players[0]!.pos={x:7,y:23};
    expect(()=>applyCommand(s,{type:'move',playerId:'A0',to:{x:7,y:24}})).toThrow();
    s=applyCommand(s,{type:'move',playerId:'A0',to:{x:6,y:22}});
    expect(()=>applyCommand(s,{type:'shoot',playerId:'A1'})).toThrow(/active/);
  });
  it('adds glass armor in the paint and clears hazards/refills rerolls at half',()=>{
    const make=(glass:boolean)=>{
      let s=createMatch(config,1);s.players[0]!.pos={x:6,y:21};s.players[2]!.pos={x:7,y:21};if(glass)s.glass=['A'];
      s=applyCommand(s,{type:'block',playerId:'A0',targetId:'B0',blitz:false});
      if(s.pending?.type==='block')s.pending.dice=['POW!'];
      s=applyCommand(s,{type:'chooseBlock',index:0});s=applyCommand(s,{type:'push',to:{x:8,y:21}});return s;
    };
    const a=make(false),b=make(true);
    expect(b.events.find(e=>e.kind==='armor')!.value).toBe(a.events.find(e=>e.kind==='armor')!.value!+1);
    let s=createMatch(config,1);s.glass=['A'];s.teams[0]!.rerolls=0;
    for(let i=0;i<16;i++)s=applyCommand(s,{type:'endTurn'});
    expect(s.half).toBe(2);expect(s.glass).toEqual([]);expect(s.teams[0]!.rerolls).toBe(3);
  });
  it('crowd surf bypasses armor, removes the defender from the drive and keeps the ball in bounds',()=>{
    let s=contact('Push');s.ball.carrier='B0';s.possession='B';
    s=applyCommand(s,{type:'chooseBlock',index:0});s=applyCommand(s,{type:'push',to:{x:-1,y:10}});
    expect(s.players[2]!.status).toMatch(/stunned|ko|removed/);
    expect(s.players[2]!.offCourt).toBe(true);
    expect(s.ball.carrier).toBeNull();expect(s.ball.pos).toEqual({x:0,y:10});
    expect(s.events.some(e=>e.kind==='armor')).toBe(false);
    s=applyCommand(s,{type:'follow',yes:true});expect(s.players[0]!.pos).toEqual({x:0,y:10});
  });
  it('preserves a stunned crowd injury without promoting it to KO',()=>{
    let found=false;
    for(let seed=1;seed<=30;seed++) {
      let s=contact('Push',createMatch(config,seed));
      s=applyCommand(s,{type:'chooseBlock',index:0});s=applyCommand(s,{type:'push',to:{x:-1,y:10}});
      const injury=s.events.find(e=>e.kind==='injury')!;
      if(injury.value!<=7) {
        expect(s.players[2]!.status).toBe('stunned');expect(s.players[2]!.offCourt).toBe(true);
        expect(legalActions(s,'B0').some(c=>'playerId'in c)).toBe(false);found=true;break;
      }
    }
    expect(found).toBe(true);
  });
  it('fire grants ordinary push immunity and unlimited roll-free GFI',()=>{
    let s=contact('Push');s.players[2]!.fire=true;
    s=applyCommand(s,{type:'chooseBlock',index:0});expect(s.pending).toBeNull();expect(s.players[2]!.pos).toEqual({x:0,y:10});
    s=createMatch(config,1);s.players[0]!.moved=100;s.players[0]!.fire=true;
    const rng=s.rng;s=applyCommand(s,{type:'move',playerId:'A0',to:{x:6,y:11}});expect(s.rng).toBe(rng);
  });
  it('stealing an ignited ball forces armor without automatically knocking down',()=>{
    let s=createMatch(config,1);s.players[2]!.pos={x:6,y:11};s.ball.carrier='B0';s.possession='B';s.ball.hot=true;s.players[0]!.ag=1;s.players[0]!.armor=99;
    s=applyCommand(s,{type:'steal',playerId:'A0',targetId:'B0'});
    expect(s.events.some(e=>e.kind==='armor'&&e.text.includes('burning ball'))).toBe(true);
    expect(s.players[0]!.status).toBe('standing');expect(s.ball.carrier).toBe('A0');
  });
  it('Brawler prevents a reroll-of-reroll without using the team reroll for the rest of the turn',()=>{
    let s=contact('Both Down');s=applyCommand(s,{type:'brawler',index:0});
    expect(s.teams[0]!.rerollUsed).toBe(false);
    expect(legalActions(s).some(c=>c.type==='reroll')).toBe(false);
    expect(()=>applyCommand(s,{type:'reroll',source:'team'})).toThrow();
  });
  it('keeps screen and print SVG definitions separate and prints all thirteen player cards',()=>{
    const s=createMatch(config,1);
    const arena=courtSvg(s,'A0'),kit=tabletopKit();
    const ids=[...`${arena}${kit}`.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(kit.match(/class="print-card"/g)).toHaveLength(13);
    expect(kit).toContain('Injury 2D6');
  });
  it('finishes each faction matchup with valid occupancy and an exact replay',()=>{
    for(const teamA of ['Reikland Reavers','Gouged Eye','Skavenblight','Grak & Crumbleberry','Goblin Swarm'] as RosterName[]) {
      let s=createMatch({teamA,teamB:'Gouged Eye'},52);let count=0;
      while(!s.over&&count++<2000) {
        s=applyCommand(s,chooseAiCommand(s));
        const cells=s.players.filter(p=>!p.offCourt&&['standing','prone','stunned'].includes(p.status)).map(p=>`${p.pos.x},${p.pos.y}`);
        expect(new Set(cells).size).toBe(cells.length);
        expect(s.players.find(p=>p.id===s.ball.carrier)?.status??'standing').toBe('standing');
      }
      expect(s.over).toBe(true);expect(replayMatch(JSON.parse(serializeReplay(s)))).toEqual(s);
    }
  });
});
