import { ROSTERS, type RosterName } from './rosters.js';
import { seedRng, nextD6 } from './dice.js';
import { clampToCourt, courtSize, inBounds, inPaint, isRim, rim, same, distance, type Position } from './court.js';
import type { MatchConfig, MatchState, Player, Side } from './types.js';
import { effectiveMA, isPossessionGame, POSSESSION_RULES } from './rules.js';

export const RULES='hardwood-arcade/1.0.0';
export const ARCADE_RULES='hardwood-arcade/2.0.0';
export const rulesForConfig=(config:MatchConfig):string=>config.ruleset==='possession'?POSSESSION_RULES:config.court==='arcade'?ARCADE_RULES:RULES;
export const other=(s:Side):Side=>s==='A'?'B':'A';
export const team=(s:MatchState,id:Side)=>s.teams.find(t=>t.id===id)!;
export function player(s:MatchState,id:string):Player {
  const p=s.players.find(p=>p.id===id);
  if(!p) throw new Error('Unknown player');
  return p;
}
export const available=(p:Player):boolean=>!p.offCourt&&(p.status==='standing' || p.status==='prone' || p.status==='stunned');
export const occupant=(s:MatchState,pos:Position)=>s.players.find(p=>available(p) && same(p.pos,pos));
export const enemies=(s:MatchState,p:Player,pos=p.pos)=>s.players.filter(q=>q.team!==p.team && !q.offCourt && q.status==='standing' && distance(q.pos,pos)<=1);
export function event(s:MatchState,kind:string,text:string,p?:Player,value?:number):void {
  s.events.push({id:s.events.length,kind,text,...(p?{playerId:p.id,pos:{...p.pos}}:{}),...(value!==undefined?{value}:{})});
}
export function roll(s:MatchState,label:string,p?:Player):number {
  const d=nextD6(s.rng); s.rng=d.rng; event(s,'roll',`${label}: ${d.value}`,p,d.value); return d.value;
}
export function validateConfig(c:unknown):asserts c is MatchConfig {
  if(!c || typeof c!=='object' || Array.isArray(c)) throw new Error('Invalid match configuration');
  const v=c as MatchConfig;
  if(typeof v.teamA!=='string' || typeof v.teamB!=='string' || !Object.hasOwn(ROSTERS,v.teamA) || !Object.hasOwn(ROSTERS,v.teamB)) throw new Error('Unknown roster');
  if(v.court!==undefined && v.court!=='classic' && v.court!=='arcade')throw new Error('Unknown court mode');
  if(v.ruleset!==undefined && v.ruleset!=='possession')throw new Error('Unknown ruleset');
  if(v.teamA==='Goblin Swarm' && v.teamB==='Goblin Swarm') throw new Error('Five Goblins must face a standard duo');
}
export function createMatch(config:MatchConfig,seed:number):MatchState {
  validateConfig(config);
  const rng=seedRng(seed);
  const s:MatchState={rules:rulesForConfig(config),config:{teamA:config.teamA,teamB:config.teamB,...(config.court?{court:config.court}:{}),...(config.ruleset?{ruleset:config.ruleset}:{})},seed,rng,
    teams:[],players:[],current:'A',possession:'A',ball:{carrier:null,pos:{x:7,y:13},hot:false},
    half:1,turn:0,shotClock:4,active:null,over:false,pending:null,glass:[],ladders:[],hype:0,events:[],commands:[]};
  const armor:Record<string,number>={'Human Blitzer':9,'Human Catcher':8,'Black Orc':10,'Orc Blitzer':9,'Gutter Runner':8,'Rat Ogre':9,'Ogre':10,'Halfling':7};
  for(const id of ['A','B'] as const) {
    const name:RosterName=id==='A'?config.teamA:config.teamB;
    s.teams.push({id,name,score:0,rerolls:3,rerollUsed:false,blitzUsed:false});
    ROSTERS[name].forEach((r,i)=>s.players.push({...structuredClone(r),...(isPossessionGame(s)?{ma:effectiveMA(r.ma)}:{}),id:`${id}${i}`,team:id,pos:{x:0,y:0},armor:armor[r.name]??8,
      status:'standing',moved:0,forward:0,used:false,offCourt:false,skillUsed:[],streak:0,fire:false}));
  }
  setup(s,'A'); event(s,'start','WELCOME TO HARDWOOD CARNAGE!'); return s;
}
export function setup(s:MatchState,receiving:Side):void {
  s.ladders=[];
  const c=courtSize(s),arcade=s.config.court==='arcade',possession=isPossessionGame(s);
  if(possession)s.throwIn=null;
  for(const id of ['A','B'] as const) {
    const roster=s.players.filter(p=>p.team===id);
    roster.forEach((p,i)=>{
      const y=possession?(id==='A'?(arcade?2:5):(arcade?13:20)):(id==='A'?(arcade?6:10):(arcade?9:15));
      p.pos={x:roster.length===5?(arcade?i*2:3+i*2):(arcade?3+i:possession?6+i:6+i*2),y:s.half===1?y:c.length-1-y};
      p.moved=0; p.forward=0;
      p.offCourt=false;
    });
  }
  const receiver=(arcade?s.players.find(p=>p.team===receiving&&p.status==='standing'&&p.skills.includes('Right Stuff')):undefined)??s.players.find(p=>p.team===receiving && p.status==='standing');
  s.ball={carrier:receiver?.id??null,pos:receiver?{...receiver.pos}:{x:c.center,y:Math.floor(c.length/2)},hot:receiver?.fire??false,...(possession&&receiver?{lastTouch:receiver.id}:{})};
  s.possession=receiving; s.shotClock=4; s.active=null;
}
export function finish(s:MatchState,id:string):void { player(s,id).used=true; s.active=null; }
export function endTurn(s:MatchState,reason?:string):void {
  const turns=courtSize(s).turnsPerHalf;
  if(reason) event(s,'turnover',`TURNOVER — ${reason}`);
  if(s.current===s.possession) {
    s.shotClock--;
    if(s.shotClock<=0) {
      event(s,'turnover','TURNOVER — shot clock expired'); setup(s,other(s.possession));
    }
  }
  s.pending=null; s.active=null; s.turn++; s.current=other(s.current);
  if(s.turn===turns*4) {
    if(isPossessionGame(s))s.throwIn=null;
    s.over=true; event(s,'final',`FINAL — ${team(s,'A').score} : ${team(s,'B').score}`);return;
  }
  if(s.turn===turns*2) {
    s.half=2; s.glass=[];
    for(const t of s.teams) t.rerolls=3;
    for(const p of s.players) if(p.status==='ko' && roll(s,'Half-time recovery',p)>=4) p.status='standing';
    setup(s,'B'); event(s,'half','HALF TIME — switch ends, clear glass, refill rerolls');
  }
  const t=team(s,s.current); t.blitzUsed=false; t.rerollUsed=false;
  s.ladders=s.ladders.filter(ids=>player(s,ids[0]!).team!==s.current);
  for(const p of s.players.filter(p=>p.team===s.current)) {
    p.used=false; p.moved=0; p.forward=0; p.skillUsed=[];
    if(p.status==='stunned') {p.status='prone';p.used=true;}
  }
  event(s,'turn',`${team(s,s.current).name} — turn ${Math.floor((s.turn%(turns*2))/2)+1} of ${turns}`);
}
export function loseBall(s:MatchState,p:Player):void {
  if(s.ball.carrier===p.id) s.ball={carrier:null,pos:clampToCourt(p.pos,s),hot:s.ball.hot||p.fire,...(isPossessionGame(s)?{lastTouch:p.id}:{})};
}
export function injure(s:MatchState,p:Player,source?:Player,crowd=false):void {
  s.ladders=s.ladders.filter(ids=>!ids.includes(p.id));
  loseBall(s,p); p.status='prone';
  const c=courtSize(s);
  const glass=s.glass.some(side=>same(rim(side,s.half,s),{x:c.center,y:p.pos.y<c.length/2?1:c.length-2})) && inPaint(p.pos,s);
  if(!crowd) {
    const armor=roll(s,'Armor',p)+roll(s,'Armor',p)+(glass?1:0);
    event(s,'armor',`${p.name}: armor ${armor} vs ${p.armor}+${glass?' (glass +1)':''}`,p,armor);
    if(armor<p.armor) return;
  }
  const injury=roll(s,'Injury',p)+roll(s,'Injury',p)+(source?.skills.includes('Weeping Dagger')?1:0);
  p.status=injury>=10?'removed':injury>=8?'ko':'stunned';
  event(s,'injury',`${p.name} ${p.status.toUpperCase()}${crowd?' by the crowd':''}`,p,injury);
}
export function collectBall(s:MatchState,p:Player,hot=false):void {
  const oldPossession=s.possession;
  s.ball={carrier:p.id,pos:{...p.pos},hot:hot||p.fire,...(isPossessionGame(s)?{lastTouch:p.id}:{})};
  s.possession=p.team;
  if(oldPossession!==p.team) s.shotClock=4;
  if(hot && oldPossession!==p.team && !isPossessionGame(s)) {
    event(s,'fire','THE BALL IS BURNING!',p);
    // A flaming-ball steal forces armor without automatically knocking down.
    const oldStatus=p.status;
    const n=roll(s,'Burning ball armor',p)+roll(s,'Burning ball armor',p);
    event(s,'armor',`${p.name}: burning ball armor ${n} vs ${p.armor}+`,p,n);
    if(n>=p.armor) {
      loseBall(s,p);
      const injury=roll(s,'Injury',p)+roll(s,'Injury',p);
      p.status=injury>=10?'removed':injury>=8?'ko':'stunned';
      event(s,'injury',`${p.name} ${p.status.toUpperCase()} by the flaming ball`,p,injury);
      finish(s,p.id);
    } else p.status=oldStatus;
  }
}
export function scoreBasket(s:MatchState,p:Player,points:number,dunk:boolean,spins:number,thrown:boolean):void {
  const wasFire=p.fire;
  for(const q of s.players) if(q.team!==p.team) {q.streak=0;q.fire=false;}
  p.streak++; if(p.streak>=3 && !p.fire) {p.fire=true;event(s,'fire',"HE'S ON FIRE!",p);}
  let shatter=false;
  if(dunk && spins>0 && wasFire && (p.st>=4 || thrown)) {
    const power=roll(s,'Dunk power (6 = POW!)',p);
    shatter=power===6 && !s.glass.includes(p.team);
  }
  if(shatter) {points++;s.glass.push(p.team);event(s,'shatter','GLASS SHATTER! +1 STYLE POINT',p);}
  team(s,p.team).score+=points;
  s.hype=Math.min(100,s.hype+(dunk?15*(spins+1):6));
  event(s,'score',`${dunk?'BOOMSHAKALAKA!':points===3?'FROM DOWNTOWN!':'BUCKET!'} ${p.name} +${points}`,p,points);
  setup(s,other(p.team)); endTurn(s);
}
export function validCell(s:MatchState,pos:Position):boolean {return inBounds(pos,s) && !isRim(pos,s) && !occupant(s,pos);}
