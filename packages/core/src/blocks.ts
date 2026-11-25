import { clampToCourt, distance, inBounds, isRim, neighbors, same } from './court.js';
import { event, finish, injure, loseBall, occupant, player, roll, team } from './match.js';
import type { BlockFace, MatchState, Player } from './types.js';

const faces:BlockFace[]=['Attacker Down','Both Down','Push','Push','Defender Stumbles','POW!'];
function blockStrength(p:Player,q:Player):number {return p.skills.includes('Stunty') && q.st>=4?Math.max(1,p.st-2):p.st;}
export function startBlock(s:MatchState,a:Player,d:Player,blitz:boolean,frenzy=false):void {
  const ast=blockStrength(a,d),dst=blockStrength(d,a), hi=Math.max(ast,dst),lo=Math.min(ast,dst);
  const count=ast===dst?1:hi>lo*2?3:2;
  const chooser=ast>=dst?a.team:d.team;
  const dice=Array.from({length:count},()=>faces[roll(s,'Block die',a)-1]!);
  s.pending={type:'block',attacker:a.id,defender:d.id,chooser,dice,blitz,frenzy,brawlerUsed:false};
  event(s,'block',`${a.name} blocks ${d.name}: ${dice.join(' / ')} — ${chooser} chooses`,a);
}
export function rerollBlock(s:MatchState):void {
  const b=s.pending;
  if(b?.type!=='block') throw new Error('No block to reroll');
  const a=player(s,b.attacker),t=team(s,a.team);
  if(t.rerollUsed || t.rerolls<1 || b.brawlerUsed) throw new Error('Reroll unavailable');
  t.rerolls--;t.rerollUsed=true;
  b.dice=b.dice.map(()=>faces[roll(s,'Block reroll',a)-1]!);b.brawlerUsed=true;
}
export function brawler(s:MatchState,index:number):void {
  const b=s.pending;
  if(b?.type!=='block' || b.blitz || b.brawlerUsed || b.dice[index]!=='Both Down' || !player(s,b.attacker).skills.includes('Brawler')) throw new Error('Brawler unavailable');
  b.dice[index]=faces[roll(s,'Brawler',player(s,b.attacker))-1]!;b.brawlerUsed=true;
  // Mark only this block as rerolled; a skill does not spend the team's turn allowance.
}
export function chooseBlock(s:MatchState,index:number):void {
  const b=s.pending;
  if(b?.type!=='block' || !Number.isInteger(index) || !b.dice[index]) throw new Error('Invalid block die');
  const a=player(s,b.attacker),d=player(s,b.defender),face=b.dice[index]!;
  s.pending=null; event(s,'hit',face,a);
  if(face==='Attacker Down' || face==='Both Down') {
    if(face==='Attacker Down' || !a.skills.includes('Block')) injure(s,a,d);
    if(face==='Both Down' && !d.skills.includes('Block')) injure(s,d,a);
    finish(s,a.id); return;
  }
  if(face==='Push' && d.fire) {event(s,'fire',`${d.name} ignores the push!`,d);finish(s,a.id);return;}
  const knock=face==='POW!' || (face==='Defender Stumbles' && !d.skills.includes('Dodge'));
  const dx=Math.sign(d.pos.x-a.pos.x),dy=Math.sign(d.pos.y-a.pos.y);
  const destinations=neighbors(d.pos).filter(p=>{
    if(occupant(s,p) || isRim(p,s)) return false;
    if(a.skills.includes('Grab')) return true;
    const px=p.x-d.pos.x,py=p.y-d.pos.y;
    return dx===0?py===dy:dy===0?px===dx:px===dx&&py===dy || px===dx&&py===0 || px===0&&py===dy;
  });
  if(!destinations.length) {injure(s,d,a);finish(s,a.id);return;}
  s.pending={type:'push',attacker:a.id,defender:d.id,destinations,knock,frenzy:!b.frenzy&&a.skills.includes('Frenzy')};
}
export function push(s:MatchState,to:{x:number;y:number}):void {
  const b=s.pending;
  if(b?.type!=='push' || !b.destinations.some(p=>same(p,to))) throw new Error('Invalid push destination');
  const a=player(s,b.attacker),d=player(s,b.defender),old={...d.pos};
  d.pos={...to};
  if(s.ball.carrier===d.id) s.ball.pos={...to};
  if(!inBounds(to,s)) {
    event(s,'crowd',`${d.name} goes into the bleachers!`,d); loseBall(s,d); injure(s,d,a,true);
    // Keep the actual injury result; crowd players return to the formation at the next inbound.
    d.offCourt=true;
    d.pos=clampToCourt(to,s);
  } else {event(s,'push',`${a.name} shoves ${d.name}`,d); if(b.knock) injure(s,d,a);}
  s.pending={type:'follow',attacker:a.id,defender:d.id,to:old,frenzy:b.frenzy};
  if(b.frenzy) follow(s,true);
}
export function follow(s:MatchState,yes:boolean):void {
  const b=s.pending;
  if(b?.type!=='follow') throw new Error('No follow-up');
  const a=player(s,b.attacker),d=player(s,b.defender);
  if(yes && !occupant(s,b.to)) {
    a.pos={...b.to};if(s.ball.carrier===a.id) s.ball.pos={...a.pos};event(s,'move',`${a.name} follows up`,a);
  }
  s.pending=null;
  if(yes && b.frenzy && d.status==='standing' && distance(a.pos,d.pos)===1) startBlock(s,a,d,false,true);
  else finish(s,a.id);
}
