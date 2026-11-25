import { distance, inBounds, isRim, same, type Position } from './court.js';
import { movementReactions } from './contact.js';
import { enemies, occupant } from './match.js';
import { isPossessionGame, movementRemaining } from './rules.js';
import type { MatchState, Player, Step } from './types.js';
export function movementSteps(s:MatchState,p:Player,to:Position):Step[] {
  if(!inBounds(to,s)||isRim(to,s)||distance(p.pos,to)!==1||occupant(s,to))throw new Error('Illegal movement destination');
  if(!movementRemaining(s,p))throw new Error('Movement allowance exhausted');
  const check=(label:string,target:number,success:Step[],failure:Step[],skill?:string):Step=>({type:'check',playerId:p.id,label,target,success,failure,...(skill?{skill}:{})});
  const possession=isPossessionGame(s);
  let steps:Step[]=[{type:'move',playerId:p.id,to},...movementReactions(s,p,to)];
  if(!s.ball.carrier&&same(s.ball.pos,to))steps.push(possession
    ?{type:'recover',playerId:p.id}
    :check('Pickup',p.ag+enemies(s,p,to).length,[{type:'ball',playerId:p.id,hot:s.ball.hot}],[{type:'finish',playerId:p.id}]));
  if(!possession&&p.moved>=p.ma&&!p.fire)steps=[check('Go For It',2,steps,[{type:'knock',playerId:p.id},{type:'turnover',reason:'failed GFI'}])];
  const marking=enemies(s,p);
  if(marking.length)steps=[check('Dodge',p.ag+enemies(s,p,to).length+marking.filter(q=>q.skills.includes('Prehensile Tail')).length,steps,
    possession?[{type:'fall',playerId:p.id,reason:'failed dodge'}]:[{type:'knock',playerId:p.id},{type:'turnover',reason:'failed dodge'}],
    p.skills.includes('Dodge')?'Dodge':undefined)];
  return steps;
}
