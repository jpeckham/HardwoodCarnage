import { movementSteps } from './movement.js';
import { distance, rim } from './court.js';
import { collectBall, endTurn, event, finish, injure, player, roll, scoreBasket, team } from './match.js';
import type { MatchState, Step } from './types.js';
import { recoverBall, scatterBall } from './ball.js';
import { isPossessionGame } from './rules.js';

export function canReroll(s:MatchState,check:Extract<Step,{type:'check'}>):('team'|'skill')[] {
  const p=player(s,check.playerId), t=team(s,p.team);
  const choices:('team'|'skill')[]=[];
  if(check.skill && !p.skillUsed.includes(check.skill)) choices.push('skill');
  if(!t.rerollUsed && t.rerolls>0) choices.push('team');
  return choices;
}
const passed=(value:number,target:number)=>value===6 || (value!==1 && value>=target);
export function resolveSteps(s:MatchState,steps:Step[]):void {
  const queue=[...steps];
  while(queue.length && !s.over) {
    const step=queue.shift()!;
    if(step.type==='check') {
      const p=player(s,step.playerId), value=roll(s,`${step.label} (${step.target}+)`,p);
      if(passed(value,step.target)) queue.unshift(...step.success);
      else if(canReroll(s,step).length) {s.pending={type:'check',check:step,roll:value,remaining:queue};return;}
      else queue.unshift(...step.failure);
    } else if(step.type==='walk') {
      const p=player(s,step.playerId);
      if(p.status!=='standing'||p.used||p.offCourt)return;
      queue.unshift(...movementSteps(s,p,step.to));
    } else if(step.type==='move') {
      const p=player(s,step.playerId), target=rim(p.team,s.half,s);
      if(distance(step.to,target)<distance(p.pos,target)) p.forward++;
      p.pos={...step.to}; p.moved++;
      if(s.ball.carrier===p.id) s.ball.pos={...p.pos};
      event(s,'move',`${p.name} moves to ${p.pos.x+1},${p.pos.y+1}`,p);
    } else if(step.type==='knock') {const p=player(s,step.playerId); event(s,'knock',`${p.name} hits the hardwood`,p);injure(s,p,step.sourceId?player(s,step.sourceId):undefined);}
    else if(step.type==='ball') {
      if(step.playerId) collectBall(s,player(s,step.playerId),step.hot??false);
      else s.ball={carrier:null,pos:{...(step.pos??s.ball.pos)},hot:step.hot??s.ball.hot,
        ...(isPossessionGame(s)&&s.ball.lastTouch!==undefined?{lastTouch:s.ball.lastTouch}:{})};
    } else if(step.type==='recover') {
      const turn=s.turn;
      if(!recoverBall(s,player(s,step.playerId))||s.turn!==turn||s.throwIn)return;
    } else if(step.type==='scatter') {
      const turn=s.turn;
      scatterBall(s,step.from,step.lastTouchId);
      if(s.turn!==turn||s.throwIn)return;
    } else if(step.type==='finish') {finish(s,step.playerId);return;}
    else if(step.type==='turnover') {endTurn(s,step.reason);return;}
    else if(step.type==='score') {scoreBasket(s,player(s,step.playerId),step.points,step.dunk,step.spins,step.thrown);return;}
    else if(step.type==='clockReset') s.shotClock=4;
    else if(step.type==='event') event(s,step.kind,step.text,player(s,step.playerId));
  }
}
export function resolveCheck(s:MatchState,source:'team'|'skill'|null):void {
  const pending=s.pending;
  if(pending?.type!=='check') throw new Error('No pending check');
  const {check,remaining}=pending;
  let success=false;
  if(source) {
    if(!canReroll(s,check).includes(source)) throw new Error('Reroll unavailable');
    const p=player(s,check.playerId),t=team(s,p.team);
    if(source==='team') {t.rerolls--;t.rerollUsed=true;} else p.skillUsed.push(check.skill!);
    event(s,'reroll',`${source==='team'?'TEAM REROLL':check.skill+' REROLL'}`,p);
    success=passed(roll(s,`${check.label} reroll (${check.target}+)`,p),check.target);
  }
  s.pending=null;
  resolveSteps(s,[...(success?check.success:check.failure),...remaining]);
}
