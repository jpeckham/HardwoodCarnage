import { legalActions, type Command, type MatchState, type Side } from '../../packages/core/src/index.js';
import type { Mode } from './session.js';
export function decisionCoach(s:MatchState):Side {
  const pending=s.pending;
  return pending?.type==='block'?pending.chooser:pending?.type==='check'?s.players.find(p=>p.id===pending.check.playerId)!.team:s.current;
}
export function humanCanCommand(s:MatchState,mode:Mode,c:Command):boolean {
  if(mode==='hotseat')return true;
  if(mode==='demo')return false;
  const p=s.pending;
  const side=p?.type==='block'&&(c.type==='reroll'||c.type==='brawler')?s.players.find(q=>q.id===p.attacker)!.team:decisionCoach(s);
  return side==='A';
}
export function awaitingAttacker(s:MatchState,mode:Mode,released:boolean):boolean {
  const p=s.pending;
  return !released && mode==='solo' && p?.type==='block' && p.chooser==='B' && s.players.find(q=>q.id===p.attacker)?.team==='A' && legalActions(s).some(c=>c.type==='reroll'||c.type==='brawler');
}
