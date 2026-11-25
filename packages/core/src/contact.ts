import { markTouch, scatterBall } from './ball.js';
import { distance, type Position } from './court.js';
import { collectBall, endTurn, enemies, event, finish, player, roll } from './match.js';
import { supercoverLine } from './pass-line.js';
import { isPossessionGame } from './rules.js';
import type { MatchState, Player, Step } from './types.js';

type Contest = Extract<Step,{type:'ballContest'}>;
type DropPass = Extract<Step,{type:'dropPass'}>;

const stableId=(a:Player,b:Player)=>a.id.localeCompare(b.id);
const reaches=(p:Player,at:Position)=>distance(p.pos,at)<=1;
const passed=(value:number,target:number)=>value===6||(value!==1&&value>=target);

function requirePossession(s:MatchState):void {
  if(!isPossessionGame(s))throw new Error('Ball contact requires the possession ruleset');
}

export function canSwat(s:MatchState,p:Player,carrier:Player):boolean {
  return isPossessionGame(s)&&!s.over&&!s.pending&&!s.throwIn&&p.team===s.current&&!p.offCourt&&!p.used&&p.status==='standing'
    &&(!s.active||s.active===p.id)&&carrier.team!==p.team&&!carrier.offCourt&&(carrier.status==='standing'||carrier.status==='prone')
    &&s.ball.carrier===carrier.id&&distance(p.pos,carrier.pos)===1;
}

export function swat(s:MatchState,p:Player,carrier:Player):void {
  if(!canSwat(s,p,carrier))throw new Error('Swat requires a standing player adjacent to an opposing carrier');
  const target=3+Number(carrier.skills.includes('Dodge'))+Number(carrier.st>p.st);
  const success=passed(roll(s,`Swat (${target}+)`,p),target);
  finish(s,p.id);
  if(!success)return;
  event(s,'swat',`${p.name} swats the ball loose`,p);
  scatterBall(s,carrier.pos,p.id);
}

export function movementReactions(s:MatchState,p:Player,to:Position):Contest[] {
  if(!isPossessionGame(s)||s.ball.carrier!==p.id)return [];
  return s.players.filter(q=>q.team!==p.team&&!q.offCourt&&q.status==='standing'&&q.reactionTurn!==s.turn&&reaches(q,p.pos)!==reaches(q,to))
    .sort(stableId).map(q=>({type:'ballContest',stage:'movement',playerId:p.id,defenderId:q.id,at:{...to}}));
}

export function passContests(s:MatchState,p:Player,to:Position):{release:Contest[];flight:Contest[]} {
  const release:Contest[]=[],flight:Contest[]=[];
  if(!isPossessionGame(s))return {release,flight};
  const defenders=s.players.filter(q=>q.team!==p.team&&!q.offCourt&&q.status==='standing').sort(stableId);
  const checked=new Set<string>();
  for(const q of defenders) if(reaches(q,p.pos)) {
    checked.add(q.id);release.push({type:'ballContest',stage:'release',playerId:p.id,defenderId:q.id,at:{...p.pos}});
  }
  for(const group of supercoverLine(p.pos,to).slice(1)) for(const q of defenders) {
    if(checked.has(q.id))continue;
    const at=group.find(pos=>reaches(q,pos));
    if(!at)continue;
    checked.add(q.id);flight.push({type:'ballContest',stage:'flight',playerId:p.id,defenderId:q.id,at});
  }
  return {release,flight};
}

/** Returns true if the ball action ended and the remaining steps must be discarded. */
export function resolveBallContest(s:MatchState,step:Contest):boolean {
  requirePossession(s);
  const p=player(s,step.playerId),q=player(s,step.defenderId);
  if(step.stage==='movement') {
    if(s.ball.carrier!==p.id)return true;
    if(q.reactionTurn===s.turn)return false;
    q.reactionTurn=s.turn;
  }
  const label=step.stage==='movement'?'Movement reaction':step.stage==='release'?'Pass release contest':'Pass flight contest';
  const value=roll(s,label,q);
  if(value<=3)return false;
  finish(s,p.id);
  if(value===6) {
    event(s,step.stage==='flight'?'intercept':'strip',`${q.name} ${step.stage==='flight'?'intercepts the pass':'steals the ball cleanly'}`,q);
    collectBall(s,q,s.ball.hot);
    if(q.team!==s.current)endTurn(s,step.stage==='flight'?'pass intercepted':'ball stolen');
  } else {
    event(s,'bat',`${q.name} bats the ball loose`,q);
    scatterBall(s,step.at,q.id);
  }
  return true;
}

export function resolveInboundContests(s:MatchState,p:Player,to:Position):boolean {
  const {release,flight}=passContests(s,p,to);
  return [...release,...flight].some(step=>resolveBallContest(s,step));
}

function scatterBeforeTurnover(s:MatchState,at:Position,lastTouchId:string,reason:string):void {
  const turn=s.turn,current=s.current;
  scatterBall(s,at,lastTouchId);
  if(s.turn===turn&&s.current===current&&!s.throwIn)endTurn(s,reason);
}

export function stumble(s:MatchState,p:Player,reason:string):void {
  requirePossession(s);
  s.ladders=s.ladders.filter(ids=>!ids.includes(p.id));
  p.status='prone';
  finish(s,s.active??p.id);
  p.used=true;
  event(s,'fall',`${p.name} stumbles to the hardwood`,p);
  if(s.ball.carrier===p.id&&!passed(roll(s,`Ball retention (${p.ag}+)`,p),p.ag)) {
    scatterBeforeTurnover(s,p.pos,p.id,reason);
    return;
  }
  endTurn(s,reason);
}

export function dropPass(s:MatchState,step:DropPass):void {
  requirePossession(s);
  finish(s,step.playerId);
  scatterBeforeTurnover(s,step.at,step.lastTouchId,step.reason);
}

export function canPassTo(s:MatchState,p:Player,q:Player):boolean {
  return s.ball.carrier===p.id&&q.team===p.team&&q.id!==p.id&&!q.offCourt&&q.status==='standing'&&distance(p.pos,q.pos)<=6;
}

export function possessionPassSteps(s:MatchState,p:Player,q:Player):Step[] {
  const {release,flight}=passContests(s,p,q.pos);
  const hot=s.ball.hot||p.fire;
  const miss=(lastTouchId:string):DropPass=>({type:'dropPass',playerId:p.id,lastTouchId,at:{...q.pos},reason:'dropped pass/catch'});
  return [{type:'touch',playerId:p.id},...release,{
    type:'check',label:'Pass',playerId:p.id,
    target:p.ag+Number(distance(p.pos,q.pos)>3)+enemies(s,p).length+Number(p.status==='prone'),
    failure:[miss(p.id)],success:[{type:'ball',playerId:null,pos:{...q.pos},hot},...flight,{type:'touch',playerId:q.id},{
      type:'check',label:'Catch',playerId:q.id,target:q.ag+enemies(s,q).length,
      ...(q.skills.includes('Catch')?{skill:'Catch'}:{}),failure:[miss(q.id)],
      success:[{type:'ball',playerId:q.id,hot},{type:'finish',playerId:p.id}],
    }],
  }];
}
