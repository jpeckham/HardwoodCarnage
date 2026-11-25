import { clampToCourt, distance, exitBoundary, inBounds, isRim, neighbors, same, type Position } from './court.js';
import { nextD8 } from './dice.js';
import { available, collectBall, endTurn, event, finish, occupant, other, player, roll } from './match.js';
import { isPossessionGame } from './rules.js';
import type { Command, MatchState, Player } from './types.js';

const directions=[
  [-1,0,'N'],[-1,1,'NE'],[0,1,'E'],[1,1,'SE'],
  [1,0,'S'],[1,-1,'SW'],[0,-1,'W'],[-1,-1,'NW'],
] as const;
const MAX_BOUNCES=4;
const INBOUND_RANGE=3;

function requirePossessionRules(s:MatchState):void {
  if(!isPossessionGame(s))throw new Error('This ball rule requires the possession ruleset');
}

export function markTouch(s:MatchState,playerId:string):void {
  requirePossessionRules(s);
  s.ball.lastTouch=playerId;
}

function restBall(s:MatchState,pos:Position):void {
  s.ball.carrier=null;
  s.ball.pos={...pos};
}

function tryCatch(s:MatchState,p:Player,label:string):boolean {
  markTouch(s,p.id);
  const target=p.ag+(p.status==='prone'?1:0),value=roll(s,`${label} (${target}+)`,p);
  if(value!==6&&(value===1||value<target))return false;
  collectBall(s,p,s.ball.hot);
  event(s,'recover',`${p.name} controls the ball`,p);
  if(p.team!==s.current)endTurn(s,'defender recovered the ball');
  return true;
}

/** Returns success of the initial pickup, not of any later bounce catch. */
export function recoverBall(s:MatchState,p:Player):boolean {
  if(!canRecoverBall(s,p))throw new Error('Player cannot recover the ball here');
  if(tryCatch(s,p,'Recovery'))return true;
  finish(s,p.id);
  scatterBall(s,p.pos,p.id);
  return false;
}

export function canRecoverBall(s:MatchState,p:Player):boolean {
  return isPossessionGame(s)&&!s.pending&&!s.throwIn&&!s.over&&p.team===s.current&&!p.used&&!p.offCourt&&(p.status==='standing'||p.status==='prone')
    &&(!s.active||s.active===p.id)&&!s.ball.carrier&&same(p.pos,s.ball.pos);
}

export function scatterBall(s:MatchState,from:Position,lastTouchId?:string):void {
  requirePossessionRules(s);
  if(lastTouchId!==undefined)markTouch(s,lastTouchId);
  if(!inBounds(from,s)){awardThrowIn(s,from);return;}
  // A rim is never a resting tile, even if every allowed bounce is exhausted.
  if(isRim(from,s)) {
    const adjacent=neighbors(from).filter(pos=>inBounds(pos,s)&&!isRim(pos,s));
    restBall(s,adjacent.find(pos=>!occupant(s,pos))??adjacent[0]!);
  } else restBall(s,from);
  let cursor=from;
  for(let i=0;i<MAX_BOUNCES;i++) {
    const die=nextD8(s.rng);
    s.rng=die.rng;
    const [x,y,name]=directions[die.value-1]!;
    cursor={x:cursor.x+x,y:cursor.y+y};
    event(s,'roll',`Scatter D8: ${die.value} (${name})`,undefined,die.value);
    if(!inBounds(cursor,s)){awardThrowIn(s,cursor);return;}
    if(isRim(cursor,s))continue;
    restBall(s,cursor);
    const catcher=occupant(s,cursor);
    if(catcher?.status!=='standing'||tryCatch(s,catcher,'Bounce recovery'))return;
  }
}

export function awardThrowIn(s:MatchState,out:Position,lastTouchId?:string):void {
  requirePossessionRules(s);
  if(lastTouchId!==undefined)markTouch(s,lastTouchId);
  const touch=s.ball.lastTouch===undefined?undefined:player(s,s.ball.lastTouch);
  const entitled=other(touch?.team??s.possession),anchor=clampToCourt(out,s);
  if(entitled!==s.possession)s.shotClock=4;
  s.possession=entitled;
  s.pending=null;
  restBall(s,anchor);

  if(s.current!==entitled) {
    const half=s.half;
    endTurn(s,'ball out of bounds');
    if(s.over||s.half!==half)return;
  } else if(s.active)finish(s,s.active);

  const thrower=s.players.filter(p=>p.team===entitled&&available(p))
    .sort((a,b)=>distance(a.pos,anchor)-distance(b.pos,anchor)||a.id.localeCompare(b.id))[0];
  if(!thrower)throw new Error('No eligible throw-in player');
  const spot=exitBoundary(out,s).find(pos=>{const p=occupant(s,pos);return !p||p.id===thrower.id;});
  if(!spot)throw new Error('No free throw-in tile');
  s.ladders=s.ladders.filter(ids=>!ids.includes(thrower.id));
  thrower.pos={...spot};
  thrower.status='standing';
  restBall(s,spot);
  s.throwIn={team:entitled,spot:{...spot},throwerId:thrower.id};
  event(s,'throwIn',`${touch?.name??'The offense'} touched it last — Team ${entitled} throws in with ${thrower.name}`,thrower);
}

function canThrowInTo(s:MatchState,playerId:string,to:Position):boolean {
  const restart=s.throwIn;
  if(!isPossessionGame(s)||!restart||restart.throwerId!==playerId||restart.team!==s.current
    ||!inBounds(to,s)||isRim(to,s)||same(restart.spot,to)||distance(restart.spot,to)>INBOUND_RANGE)return false;
  const target=occupant(s,to);
  return !target||(target.team===restart.team&&target.status==='standing');
}

export function throwInActions(s:MatchState,selectedId?:string):Extract<Command,{type:'throwIn'}>[] {
  if(!s.throwIn||(selectedId&&selectedId!==s.throwIn.throwerId))return [];
  const {throwerId,spot}=s.throwIn,commands:Extract<Command,{type:'throwIn'}>[]=[];
  for(let x=spot.x-INBOUND_RANGE;x<=spot.x+INBOUND_RANGE;x++) for(let y=spot.y-INBOUND_RANGE;y<=spot.y+INBOUND_RANGE;y++) {
    const to={x,y};
    if(canThrowInTo(s,throwerId,to))commands.push({type:'throwIn',playerId:throwerId,to});
  }
  return commands;
}

/** A command may resolve release and flight contests before the destination is reached. */
export function performThrowIn(s:MatchState,playerId:string,to:Position,contest?:(s:MatchState,thrower:Player,to:Position)=>boolean):void {
  if(!canThrowInTo(s,playerId,to))throw new Error('Illegal throw-in player or destination');
  const thrower=player(s,playerId),target=occupant(s,to);
  if(thrower.team!==s.current||thrower.offCourt||thrower.status!=='standing'||!same(thrower.pos,s.throwIn!.spot))throw new Error('Throw-in player is not ready');
  s.throwIn=null;
  finish(s,playerId);
  markTouch(s,playerId);
  event(s,'inbound',`${thrower.name} throws the ball in`,thrower);
  if(contest?.(s,thrower,to))return;
  restBall(s,to);
  if(target&&!tryCatch(s,target,'Inbound catch'))scatterBall(s,to,target.id);
}
