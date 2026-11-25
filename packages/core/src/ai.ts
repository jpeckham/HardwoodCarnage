import { legalActions } from './actions.js';
import { courtSize, distance, inBounds, rim } from './court.js';
import { player } from './match.js';
import type { BlockFace, Command, MatchState } from './types.js';

const faceValue:Record<BlockFace,number>={'Attacker Down':-4,'Both Down':-1,'Push':1,'Defender Stumbles':3,'POW!':4};
export function chooseAiCommand(s:MatchState):Command {
  const actions=legalActions(s);
  if(!actions.length) throw new Error('No actions: match is over');
  const b=s.pending;
  if(b) {
    if(b.type==='check') return actions.find(c=>c.type==='reroll'&&c.source==='skill')??actions.find(c=>c.type==='reroll')??actions[0]!;
    if(b.type==='block') {
      const sign=b.chooser===player(s,b.attacker).team?1:-1;
      let best=0;for(let i=1;i<b.dice.length;i++) if(faceValue[b.dice[i]!] *sign>faceValue[b.dice[best]!] *sign)best=i;
      return {type:'chooseBlock',index:best};
    }
    if(b.type==='push') return actions.find(c=>c.type==='push'&&!inBounds(c.to,s))??actions[0]!;
    return {type:'follow',yes:true};
  }
  const controlled=s.players.filter(p=>p.team===s.current && !p.used && !p.offCourt && (!s.active||s.active===p.id) && (p.status==='standing'||p.status==='prone'));
  controlled.sort((a,b)=>Number(s.ball.carrier===b.id)-Number(s.ball.carrier===a.id)||a.id.localeCompare(b.id));
  for(const p of controlled) {
    const own=actions.filter(c=>'playerId' in c&&c.playerId===p.id);
    const cannon=actions.find(c=>c.type==='throwTeamMate'&&c.spins===1);if(cannon)return cannon;
    const stand=own.find(c=>c.type==='stand');if(stand) return stand;
    const aerial=own.find(c=>['dunk','ladder','throwTeamMate','alleyOop'].includes(c.type)&&'spins'in c&&c.spins===1);if(aerial)return aerial;
    const goal=rim(p.team,s.half,s),carrier=s.ball.carrier?player(s,s.ball.carrier):null;
    const steal=own.find(c=>c.type==='steal');if(steal)return steal;
    if(carrier?.id===p.id && (distance(p.pos,goal)<=6 || p.moved>=p.ma)) return own.find(c=>c.type==='shoot')!;
    const target=carrier?.team===p.team?(carrier.id===p.id?goal:goal):carrier?.pos??s.ball.pos;
    const movements=own.filter((c):c is Extract<Command,{type:'move'}>=>c.type==='move');
    movements.sort((a,b)=>distance(a.to,target)-distance(b.to,target));
    const next=movements.find(c=>distance(c.to,target)<distance(p.pos,target));
    if(s.config.court==='arcade') {
      const runs=own.filter((c):c is Extract<Command,{type:'run'}>=>c.type==='run'&&distance(c.to,p.pos)<=p.ma-p.moved);
      runs.sort((a,b)=>distance(a.to,target)-distance(b.to,target)||distance(a.to,p.pos)-distance(b.to,p.pos));
      const run=runs.find(c=>distance(c.to,target)<distance(p.pos,target));if(run)return run;
    }
    if(next && p.moved<p.ma) return next;
    const block=own.find(c=>c.type==='block'&&!c.blitz)??own.find(c=>c.type==='block');if(block)return block;
    const shoot=own.find(c=>c.type==='shoot');if(shoot)return shoot;
    const end=own.find(c=>c.type==='endActivation');if(end)return end;
  }
  return {type:'endTurn'};
}
