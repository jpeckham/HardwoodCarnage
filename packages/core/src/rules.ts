import type { MatchState, Player } from './types.js';

export const POSSESSION_RULES='hardwood-possession/3.0.0';
export const isPossessionGame=(s:Pick<MatchState,'rules'>):boolean=>s.rules===POSSESSION_RULES;
export const effectiveMA=(baseMA:number):number=>Math.min(4,Math.max(2,Math.ceil(baseMA/2)));

export function movementRemaining(s:MatchState,p:Player):number {
  if(isPossessionGame(s))return Math.max(0,p.ma-p.moved);
  return p.fire?390:Math.max(0,p.ma+2-p.moved);
}
