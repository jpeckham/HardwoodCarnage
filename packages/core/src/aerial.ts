import { courtSize, distance, rim } from './court.js';

import { passContests } from './contact.js';

import { other, player } from './match.js';

import type { Command, MatchState, Player, Step } from './types.js';

import { isPossessionGame } from './rules.js';

export type AerialCommand=Extract<Command,{type:'dunk'|'ladder'|'alleyOop'|'throwTeamMate'}>;

export function ladderHelpers(s:MatchState,p:Player):Player[] {

  return s.players.filter(q=>q.team===p.team && q.id!==p.id && q.skills.includes('Stunty') && !q.offCourt && q.status==='standing' && !q.used && distance(q.pos,p.pos)<=1);

}

export function canFormLadder(s:MatchState,p:Player):boolean {

  return p.skills.includes('Stunty') && !p.offCourt && p.status==='standing' && !p.used && distance(p.pos,rim(other(p.team),s.half,s))<=2 && ladderHelpers(s,p).length>=2;

}

export function canAerial(s:MatchState,c:Command):c is AerialCommand {

  if(!['dunk','ladder','alleyOop','throwTeamMate'].includes(c.type) || !('playerId' in c)) return false;

  const p=player(s,c.playerId),target=rim(p.team,s.half,s),geometry=courtSize(s),arcade=s.config.court==='arcade';

  if(p.team!==s.current || p.offCourt || p.status!=='standing' || p.used || (s.active && s.active!==p.id && !(arcade&&c.type==='throwTeamMate'&&s.active===c.targetId))) return false;

  if(c.type==='dunk') return s.ball.carrier===p.id && (p.forward>=geometry.runUp||(arcade&&p.fire&&!isPossessionGame(s))) && distance(p.pos,target)<=geometry.dunkRange;

  if(c.type==='ladder') return s.ball.carrier===p.id && p.skills.includes('Stunty') && ladderHelpers(s,p).length>=2 && distance(p.pos,target)<=3;

  if(c.type==='alleyOop' || c.type==='throwTeamMate') {

    const q=player(s,c.targetId);

    if(q.id===p.id || q.team!==p.team || q.offCourt || q.status!=='standing') return false;

    if(c.type==='alleyOop') return s.ball.carrier===p.id && distance(p.pos,target)<=geometry.throwRange && distance(q.pos,target)<=geometry.dunkRange && q.forward>=geometry.runUp;

    return p.skills.includes('Throw Team-Mate') && q.skills.includes('Right Stuff') && s.ball.carrier===q.id && distance(p.pos,q.pos)===1 && distance(p.pos,target)<=geometry.throwRange;

  }

  return false;

}

export function aerialSteps(s:MatchState,c:AerialCommand):Step[] {

  const initiator=player(s,c.playerId);

  const q=(c.type==='alleyOop'||c.type==='throwTeamMate')?player(s,c.targetId):initiator;

  const spins=c.spins??0,thrown=c.type==='ladder'||c.type==='throwTeamMate',target=rim(q.team,s.half,s);
  const possession=isPossessionGame(s);

  const defenders=s.players.filter(p=>p.team!==q.team && !p.offCourt && p.status==='standing' && distance(p.pos,target)<=2);

  const ladderDefense=s.ladders.filter(ids=>ids.length===3&&ids.every(id=>{

    const p=player(s,id);return p.team!==q.team&&!p.offCourt&&p.status==='standing'&&distance(p.pos,target)<=3;

  })).length;

  const failure:Step[]=possession?[{type:'fall',playerId:q.id,reason:'botched dunk landing'}]
    :[{type:'knock',playerId:q.id},{type:'turnover',reason:'botched dunk landing'}];

  const makeCheck=(p:Player,label:string,value:number,success:Step[],fail:Step[]=failure):Step=>({type:'check',playerId:p.id,label,target:value,success,failure:fail});

  let steps:Step[]=[makeCheck(q,'Dunk landing',q.ag+defenders.length+ladderDefense-spins-(q.fire?2:0),[

    {type:'score',playerId:q.id,points:2,dunk:true,spins,thrown}

  ])];

  for(let i=spins;i>0;i--) steps=[makeCheck(q,`${possession?'Aerial spin':'Aerial GFI'} ${i} (${['','360°','720°','Gorilla Flip'][spins]})`,2,steps)];

  if(!thrown) steps=[makeCheck(q,'Leap',q.ag-(q.fire?2:0),steps)];

  if(c.type==='ladder') for(const helper of ladderHelpers(s,q).slice(0,2)) helper.used=true;

  const call=c.type==='ladder'?'GOBLIN LADDER!':c.type==='throwTeamMate'?'HALFLING CANNON — THROUGH THE HOOP!':c.type==='alleyOop'?'ALLEY-OOP!':distance(q.pos,target)>3?'HALF-COURT SKY JAM!':'TAKING FLIGHT!';
  const launch:Step[]=[{type:'clockReset'},{type:'event',kind:'dunk',text:`${call} ${['Straight slam','360° spin','720° spin','Gorilla Flip'][spins]}`,playerId:q.id}];

  if(c.type==='alleyOop') {
    const hot=s.ball.hot||initiator.fire;
    if(possession) {
      const {release,flight}=passContests(s,initiator,q.pos);
      return [{type:'touch',playerId:initiator.id},...release,makeCheck(initiator,'Alley-oop pass',initiator.ag,[
        {type:'ball',playerId:null,pos:{...q.pos},hot},...flight,{type:'ball',playerId:q.id,hot},...launch,...steps,
      ],[{type:'dropPass',playerId:initiator.id,lastTouchId:initiator.id,at:{...q.pos},reason:'dropped alley-oop'}])];
    }
    steps=[makeCheck(initiator,'Alley-oop pass',initiator.ag,[{type:'ball',playerId:q.id,hot},...steps],[{type:'ball',playerId:null,pos:{...q.pos}},{type:'turnover',reason:'dropped alley-oop'}])];
  } else if(c.type==='throwTeamMate') steps=[makeCheck(initiator,'Throw Team-Mate',s.config.court==='arcade'?Math.max(2,initiator.ag-1):initiator.ag,steps)];

  return [...launch,...steps];

}
