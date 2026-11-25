import { legalActions } from './actions.js';
import { passContests } from './contact.js';
import { distance, inBounds, rim, type Position } from './court.js';
import { enemies, occupant, player } from './match.js';
import { isPossessionGame } from './rules.js';
import type { BlockFace, Command, MatchState } from './types.js';

const faceValue:Record<BlockFace,number>={'Attacker Down':-4,'Both Down':-1,'Push':1,'Defender Stumbles':3,'POW!':4};

function choosePossessionCommand(s:MatchState,actions:Command[]):Command {
  const goal=rim(s.current,s.half,s);
  const contestCount=(id:string,to:Position)=>{
    const {release,flight}=passContests(s,player(s,id),to);return release.length+flight.length;
  };
  if(s.throwIn) {
    const inbounds=actions.filter(c=>c.type==='throwIn').map(c=>({command:c,receiver:occupant(s,c.to),risk:contestCount(c.playerId,c.to)}));
    inbounds.sort((a,b)=>a.risk-b.risk||Number(!!b.receiver&&!b.receiver.used)-Number(!!a.receiver&&!a.receiver.used)
      ||distance(a.command.to,goal)-distance(b.command.to,goal));
    return inbounds[0]!.command;
  }

  const recover=actions.find(c=>c.type==='recover');if(recover)return recover;
  const swat=actions.find(c=>c.type==='swat');if(swat)return swat;
  const aerial=actions.find(c=>'spins'in c&&c.spins===1);if(aerial)return aerial;

  const carrier=s.ball.carrier?player(s,s.ball.carrier):null;
  const target=carrier?.team===s.current?goal:s.ball.pos;
  const controlled=s.players.filter(p=>p.team===s.current&&!p.used&&!p.offCourt&&(!s.active||s.active===p.id));
  controlled.sort((a,b)=>Number(b===carrier)-Number(a===carrier)||distance(a.pos,target)-distance(b.pos,target)||a.id.localeCompare(b.id));
  for(const p of controlled) {
    const own=actions.filter(c=>'playerId'in c&&c.playerId===p.id);
    const stand=own.find(c=>c.type==='stand');
    const shoot=own.find(c=>c.type==='shoot');
    if(shoot)return shoot;
    const outlets=own.filter(c=>c.type==='pass').map(c=>({command:c,receiver:player(s,c.targetId)}))
      .map(x=>({...x,risk:contestCount(p.id,x.receiver.pos)}));
    outlets.sort((a,b)=>a.risk-b.risk||Number(a.receiver.used)-Number(b.receiver.used)
      ||distance(a.receiver.pos,goal)-distance(b.receiver.pos,goal));
    const outlet=outlets[0];
    if(p.status==='prone') {
      if(outlet&&(!stand||(!outlet.risk&&!outlet.receiver.used)))return outlet.command;
      if(stand)return stand;
    }
    const runs=own.filter(c=>c.type==='run');
    runs.sort((a,b)=>distance(a.to,target)-distance(b.to,target)||enemies(s,p,a.to).length-enemies(s,p,b.to).length);
    const run=runs.find(c=>distance(c.to,target)<distance(p.pos,target));
    if(outlet&&!outlet.risk&&!outlet.receiver.used&&distance(outlet.receiver.pos,goal)<distance(run?.to??p.pos,goal))return outlet.command;
    if(run)return run;
    const end=own.find(c=>c.type==='endActivation');if(end)return end;
  }
  return {type:'endTurn'};
}

export function chooseAiCommand(s:MatchState):Command {
  const actions=legalActions(s);
  if(!actions.length) throw new Error('No actions: match is over');
  if(isPossessionGame(s)&&s.throwIn)return choosePossessionCommand(s,actions);
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
  if(isPossessionGame(s))return choosePossessionCommand(s,actions);
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
