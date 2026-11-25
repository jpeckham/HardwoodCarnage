import { isPossessionGame, legalActions, same, type Command, type MatchState, type Side } from '../../packages/core/src/index.js';
import type { Mode } from './session.js';
export const restartFor=(s:MatchState)=>isPossessionGame(s)?s.throwIn:null;

export function decisionCoach(s:MatchState):Side {
  const pending=s.pending;
  return restartFor(s)?.team??(pending?.type==='block'?pending.chooser:pending?.type==='check'?s.players.find(p=>p.id===pending.check.playerId)!.team:s.current);
}
export function humanCanCommand(s:MatchState,mode:Mode,c:Command):boolean {
  if(mode==='demo')return false;
  const restart=restartFor(s);
  if(restart) {
    return (mode==='hotseat'||restart.team==='A')&&c.type==='throwIn'&&c.playerId===restart.throwerId
      &&legalActions(s,c.playerId).some(a=>a.type==='throwIn'&&same(a.to,c.to));
  }
  if(mode==='hotseat')return true;
  const p=s.pending;
  const side=p?.type==='block'&&(c.type==='reroll'||c.type==='brawler')?s.players.find(q=>q.id===p.attacker)!.team:decisionCoach(s);
  return side==='A';
}
export function defaultSelection(s:MatchState):string|null {
  if(s.active)return s.active;
  const ready=s.players.filter(p=>p.team===s.current&&!p.used&&!p.offCourt&&(p.status==='standing'||p.status==='prone'));
  return ready.find(p=>p.id===s.ball.carrier)?.id??ready.find(p=>p.status==='standing')?.id??ready[0]?.id??null;
}
export function shouldAutoEnd(s:MatchState):boolean {
  return s.config.court==='arcade'&&!restartFor(s)&&!s.pending&&!s.over&&!s.active
    &&!s.players.some(p=>p.team===s.current&&!p.offCourt&&!p.used&&(p.status==='standing'||p.status==='prone'));
}
export function awaitingAttacker(s:MatchState,mode:Mode,released:boolean):boolean {
  const p=s.pending;
  return !released && mode==='solo' && p?.type==='block' && p.chooser==='B' && s.players.find(q=>q.id===p.attacker)?.team==='A' && legalActions(s).some(c=>c.type==='reroll'||c.type==='brawler');
}
