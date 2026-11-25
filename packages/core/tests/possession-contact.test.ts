import { describe, expect, it } from 'vitest';
import { applyCommand, chooseAiCommand, courtSize, createMatch, distance, inBounds, isRim, legalActions, replayMatch, ROSTERS, serializeReplay } from '../src/index.js';
import type { Command, MatchConfig, MatchState, Position, RosterName } from '../src/index.js';

const config = {teamA:'Reikland Reavers',teamB:'Gouged Eye',court:'arcade',ruleset:'possession'} as const;
const legacyConfig = {teamA:config.teamA,teamB:config.teamB,court:config.court} as const;
const make = (seed:number, options:Partial<MatchConfig>={}) => createMatch({...config,...options},seed);
const get = (s:MatchState,id:string) => s.players.find(p=>p.id===id)!;
const place = (s:MatchState,id:string,x:number,y:number) => {
  const p=get(s,id);p.pos={x,y};if(s.ball.carrier===id)s.ball.pos={...p.pos};return p;
};
const carry = (s:MatchState,id:string,hot=false) => {
  const p=get(s,id);s.ball={carrier:id,pos:{...p.pos},lastTouch:id,hot};s.possession=p.team;
};
const move = (playerId:string,x:number,y:number):Command => ({type:'move',playerId,to:{x,y}});
const run = (playerId:string,x:number,y:number):Command => ({type:'run',playerId,to:{x,y}});
const pass = {type:'pass',playerId:'A0',targetId:'A1'} as const;
const decline = {type:'decline'} as const;
const rollValues = (s:MatchState) => s.events.filter(e=>e.kind==='roll').map(e=>e.value);
const turnovers = (s:MatchState) => s.events.filter(e=>e.kind==='turnover');
const noInjuries = (s:MatchState) => {
  expect(s.events.some(e=>e.kind==='armor'||e.kind==='injury')).toBe(false);
  expect(s.players.every(p=>p.status==='standing'||p.status==='prone')).toBe(true);
};
function reject(s:MatchState,c:Command) {
  const before=structuredClone(s);
  expect(()=>applyCommand(s,c)).toThrow();
  expect(s).toEqual(before);
}

describe('clean active defense',()=>{
  function ready(seed:number,targetId='B1',x=4) {
    const s=make(seed);place(s,'A0',x,6);place(s,targetId,x,7);carry(s,targetId,true);
    return s;
  }

  it('does not offer or accept body actions, Blitz or legacy steals, even with a forged pending block',()=>{
    const s=ready(1);
    for(const command of [
      {type:'block',playerId:'A0',targetId:'B1',blitz:false},
      {type:'block',playerId:'A0',targetId:'B1',blitz:true},
      {type:'steal',playerId:'A0',targetId:'B1'},
      {type:'push',to:{x:4,y:8}}, {type:'follow',yes:true},
      {type:'chooseBlock',index:0}, {type:'brawler',index:0},
    ] as const) {
      expect(legalActions(s).some(c=>c.type===command.type)).toBe(false);
      reject(s,command);
    }
    s.pending={type:'block',attacker:'A0',defender:'B1',chooser:'A',dice:['POW!'],blitz:false,frenzy:false,brawlerUsed:false};
    expect(legalActions(s)).toEqual([]);
    reject(s,{type:'chooseBlock',index:0});
    reject(s,{type:'reroll',source:'team'});
    s.pending={type:'check',check:{type:'check',playerId:'A0',label:'Forged',target:2,success:[],failure:[{type:'knock',playerId:'B1'}]},roll:1,remaining:[]};
    reject(s,decline);
  });

  it.each(['standing','prone'] as const)('swats a %s carrier loose without knocking them or the swatter down',status=>{
    const s=ready(243);get(s,'B1').status=status;
    const command={type:'swat',playerId:'A0',targetId:'B1'} as const;
    expect(legalActions(s,'A0')).toContainEqual(command);
    const result=applyCommand(s,command);
    expect(rollValues(result)).toEqual([3,3]);
    expect(result.ball).toEqual({carrier:null,pos:{x:4,y:8},lastTouch:'A0',hot:true});
    expect(result).toMatchObject({turn:0,current:'A',active:null,pending:null});
    expect(get(result,'A0')).toMatchObject({used:true,status:'standing'});
    expect(get(result,'B1').status).toBe(status);
    noInjuries(result);
  });

  it('raises the swat target from three to five against stronger Dodge carriers',()=>{
    const s=ready(1,'B0');get(s,'B0').skills.push('Dodge');
    const command={type:'swat',playerId:'A0',targetId:'B0'} as const;
    const miss=applyCommand(s,command);
    expect(rollValues(miss)).toEqual([4]);
    expect(miss.ball.carrier).toBe('B0');
    expect(miss.pending).toBeNull();
    const success=ready(53,'B0');get(success,'B0').skills.push('Dodge');
    expect(applyCommand(success,command).ball.carrier).toBeNull();
    const legacy=createMatch(legacyConfig,1);place(legacy,'A0',4,6);place(legacy,'B0',4,7);carry(legacy,'B0');
    expect(legalActions(legacy).some(c=>c.type==='swat')).toBe(false);
    reject(legacy,command);
  });

  it('credits the swatter for a ball swatted across the side boundary',()=>{
    const s=ready(53,'B1',0);
    const result=applyCommand(s,{type:'swat',playerId:'A0',targetId:'B1'});
    expect(result).toMatchObject({turn:1,current:'B',possession:'B',throwIn:{team:'B'},ball:{lastTouch:'A0'}});
    expect(turnovers(result)).toHaveLength(1);
  });
});

describe('carrier movement and falls',()=>{
  it('rechecks entry only on a new opposing team turn, not a second boundary crossing in the same turn',()=>{
    let s=make(25);
    place(s,'A0',4,4);place(s,'B0',4,6);
    s=applyCommand(s,move('A0',4,5));
    expect(rollValues(s)).toEqual([1]);
    expect(get(s,'B0').reactionTurn).toBe(0);
    s=applyCommand(s,move('A0',4,4));
    expect(rollValues(s)).toEqual([1,3]);
    s=applyCommand(s,move('A0',4,5));
    expect(rollValues(s)).toEqual([1,3]);
    s=applyCommand(s,{type:'endTurn'});s=applyCommand(s,{type:'endTurn'});
    s=applyCommand(s,move('A0',4,4));
    expect(s.pending?.type).toBe('check'); // Dodge must resolve before a leaving reaction.
    // This seed's reroll resolves the attempted exit. Exactly one new reaction is offered.
    s=applyCommand(s,{type:'reroll',source:'team'});
    expect(get(s,'B0').reactionTurn).toBe(2);
    expect(s.events.filter(e=>e.kind==='roll'&&e.text.startsWith('Movement reaction')).map(e=>e.playerId)).toEqual(['B0','B0']);
  });

  it('stops immediately on a clean movement steal even when the carrier is on fire',()=>{
    const s=make(48);place(s,'A0',3,3);place(s,'B0',1,4);carry(s,'A0',true);
    const result=applyCommand(s,run('A0',3,6));
    expect(rollValues(result)).toEqual([6]);
    expect(get(result,'A0')).toMatchObject({pos:{x:2,y:4},moved:1,status:'standing'});
    expect(get(result,'B0').reactionTurn).toBe(0);
    expect(result).toMatchObject({turn:1,current:'B',possession:'B',ball:{carrier:'B0',hot:true,lastTouch:'B0'}});
    expect(turnovers(result)).toHaveLength(1);
    noInjuries(result);
  });

  it('stops an in-bounds bat and does not resume the run after an opponent catches its bounce',()=>{
    const s=make(539);place(s,'A0',3,3);place(s,'B0',1,4);place(s,'B1',2,5);
    const result=applyCommand(s,run('A0',3,6));
    expect(rollValues(result)).toEqual([5,3,3]);
    expect(get(result,'A0')).toMatchObject({pos:{x:2,y:4},moved:1,used:true});
    expect(get(result,'B1').reactionTurn).toBeUndefined();
    expect(result).toMatchObject({turn:1,current:'B',ball:{carrier:'B1',lastTouch:'B1'}});
    expect(turnovers(result)).toHaveLength(1);
  });

  it('abandons queued movement even when a bat simply leaves an in-bounds loose ball',()=>{
    const s=make(539);place(s,'A0',3,3);place(s,'B0',1,4);
    const result=applyCommand(s,run('A0',3,6));
    expect(rollValues(result)).toEqual([5,3]);
    expect(get(result,'A0')).toMatchObject({pos:{x:2,y:4},moved:1,used:true});
    expect(result).toMatchObject({turn:0,current:'A',active:null,ball:{carrier:null,pos:{x:2,y:5},lastTouch:'B0'}});
  });

  it('does not trigger a reaction for a step entirely within a marker’s reach',()=>{
    let s=make(935);place(s,'A0',4,5);place(s,'B0',4,6);
    s=applyCommand(s,move('A0',5,5));
    expect(get(s,'B0').reactionTurn).toBeUndefined();
    expect(s.pending?.type).toBe('check');
    s=applyCommand(s,{type:'reroll',source:'team'});
    expect(get(s,'A0').pos).toEqual({x:5,y:5});
    expect(get(s,'B0').reactionTurn).toBeUndefined();
    s=applyCommand(s,move('A0',6,5));
    expect(rollValues(s)).toEqual([2,5,3,1]);
    expect(get(s,'B0').reactionTurn).toBe(0);
  });

  function marked(seed:number,x=3,y=3) {
    const s=make(seed);place(s,'A0',x,y);place(s,'B0',x===0?1:x-1,y-1);return s;
  }

  it('falls prone but keeps the ball after succeeding at AG retention',()=>{
    let s=marked(6);get(s,'A0').fire=true;s.ball.hot=true;s.glass=['B'];
    s=applyCommand(s,run('A0',3,6));
    expect(s.pending?.type).toBe('check');
    expect(legalActions(s)).toContainEqual({type:'reroll',source:'team'});
    s=applyCommand(s,decline);
    expect(rollValues(s)).toEqual([1,3]);
    expect(get(s,'A0')).toMatchObject({status:'prone',pos:{x:3,y:3},used:true,moved:0});
    expect(s).toMatchObject({turn:1,current:'B',possession:'A',ball:{carrier:'A0',pos:{x:3,y:3},lastTouch:'A0',hot:true}});
    expect(turnovers(s)).toHaveLength(1);
    noInjuries(s);
  });

  it.each([
    {seed:8,x:3,y:3,rolls:[1,1,2],ball:{carrier:null,pos:{x:2,y:4},lastTouch:'A0'},turn:1,entitled:null},
    {seed:224,x:0,y:5,rolls:[1,1,1],ball:{carrier:null,lastTouch:'A0'},turn:1,entitled:'B'},
    {seed:2,x:3,y:3,rolls:[1,1,3,5],ball:{carrier:'B1',pos:{x:3,y:4},lastTouch:'B1'},turn:1,entitled:null,catchAt:{x:3,y:4}},
    {seed:3699,x:1,y:5,rolls:[1,1,1,1,1],ball:{carrier:null,lastTouch:'B1'},turn:0,entitled:'A',catchAt:{x:0,y:5}},
  ])('ends the old run exactly once after loss on a fall (seed $seed)',({seed,x,y,rolls,ball,turn,entitled,catchAt})=>{
    let s=marked(seed,x,y);
    if(catchAt)place(s,'B1',catchAt.x,catchAt.y);
    s=applyCommand(s,run('A0',x,y+3));
    s=applyCommand(s,decline);
    expect(rollValues(s)).toEqual(rolls);
    expect(get(s,'A0').moved).toBe(0);
    expect(s.ball).toMatchObject(ball);
    expect(s.turn).toBe(turn);
    expect(s.throwIn?.team??null).toBe(entitled);
    expect(turnovers(s)).toHaveLength(turn);
    noInjuries(s);
  });

  it('resumes a serialized dodge reroll without refunding previously spent movement',()=>{
    let s=make(6);
    // Move before the defender is put in reach, then spend the last three squares in one run.
    s=applyCommand(s,move('A0',3,3));place(s,'B0',2,2);
    s=applyCommand(s,run('A0',3,6));
    expect(s.pending?.type).toBe('check');
    expect(get(s,'A0').moved).toBe(1);
    const restored=JSON.parse(JSON.stringify(s)) as MatchState;
    const reroll={type:'reroll',source:'team'} as const;
    const result=applyCommand(restored,reroll);
    expect(result).toEqual(applyCommand(s,reroll));
    expect(get(result,'A0')).toMatchObject({pos:{x:3,y:6},moved:4,used:false,status:'standing'});
    expect(rollValues(result)).toEqual([1,3,3]);
    expect(legalActions(result,'A0').some(c=>c.type==='move'||c.type==='run')).toBe(false);
    reject(result,move('A0',3,7));
  });
});

describe('pass release, flight and catch',()=>{
  it('uses prone AG and throws without standing or consuming movement',()=>{
    let s=make(1);get(s,'A0').status='prone';get(s,'A0').moved=4;
    expect(legalActions(s,'A0')).toContainEqual(pass);
    s=applyCommand(s,pass);
    expect(rollValues(s)).toEqual([4,2]);
    expect(s.events.find(e=>e.kind==='roll')?.text).toContain('Pass (4+)');
    expect(get(s,'A0')).toMatchObject({status:'prone',moved:4,used:true});
    expect(s).toMatchObject({active:null,turn:0,ball:{carrier:'A1',lastTouch:'A1'}});
  });

  it('rejects illegal v3 passes without mutating events, RNG or any state',()=>{
    const s=make(1);
    for(const targetId of ['A0','B0','missing'])reject(s,{...pass,targetId});
    place(s,'A1',3,9);reject(s,pass);
    place(s,'A1',3,4).status='prone';reject(s,pass);
    get(s,'A1').status='standing';carry(s,'A1');reject(s,pass);
  });

  it.each([['prone',53,5,null],['standing',48,6,'B0']] as const)(
    'allows an adjacent defender to stop a %s release (seed %i)',(status,seed,roll,carrier)=>{
      const s=make(seed);place(s,'A0',4,3).status=status;place(s,'A1',4,6);place(s,'B0',5,3);
      expect(legalActions(s,'A0')).toContainEqual(pass);
      const result=applyCommand(s,pass);
      expect(rollValues(result)[0]).toBe(roll);
      expect(result.events.some(e=>e.kind==='roll'&&/^(Pass|Catch)/.test(e.text)&&!e.text.startsWith('Pass release contest'))).toBe(false);
      expect(result.ball).toMatchObject({carrier,lastTouch:'B0'});
      expect(result.turn).toBe(carrier?1:0);
      expect(get(result,'A0')).toMatchObject({used:true,status});
      noInjuries(result);
    },
  );

  it('traces corner-touching side cells and uses stable ID tie-breaks before diagonal flight progresses',()=>{
    const s=make(3);place(s,'A0',1,1);place(s,'A1',5,5);place(s,'B0',1,4);place(s,'B1',4,1);
    s.players.reverse();
    // Both interceptors are only adjacent to the two side cells at the same corner, not to diagonal centers.
    const result=applyCommand(s,pass);
    expect(rollValues(result)).toEqual([4,6]);
    expect(result.ball).toMatchObject({carrier:'B0',lastTouch:'B0'});
    expect(result.turn).toBe(1);
  });

  it('bats a pass at its first contested flight tile, not the passer or the receiver',()=>{
    const s=make(348);place(s,'A0',3,3);place(s,'A1',3,8);place(s,'B0',4,7);
    const result=applyCommand(s,pass);
    expect(rollValues(result)).toEqual([4,5,3]);
    expect(result.ball).toMatchObject({carrier:null,pos:{x:3,y:7},lastTouch:'B0'});
    expect(result.turn).toBe(0);
    expect(get(result,'A0').used).toBe(true);
  });

  it('uses release then flight order, skips the same defender in flight, and only then catches',()=>{
    const s=make(12404,{teamB:'Goblin Swarm'});
    place(s,'A0',4,3);place(s,'A1',4,9);
    place(s,'B0',5,7);place(s,'B1',3,7);place(s,'B2',5,5);place(s,'B3',5,4);
    s.players.reverse();
    const result=applyCommand(s,pass);
    expect(result.events.filter(e=>e.kind==='roll').map(e=>[e.playerId,e.value])).toEqual([
      ['B3',2],['A0',5],['B2',1],['B0',1],['B1',1],['A1',4],
    ]);
    expect(result).toMatchObject({turn:0,active:null,ball:{carrier:'A1',lastTouch:'A1'}});
    expect(get(result,'A0').used).toBe(true);
  });

  it('credits an AG release failure to the passer and scatters at the receiver edge before turning over',()=>{
    let s=make(2);place(s,'A0',1,3);place(s,'A1',0,7);
    s=applyCommand(s,pass);
    expect(s.pending?.type).toBe('check');
    s=applyCommand(s,decline);
    expect(rollValues(s)).toEqual([1,3]);
    expect(s.ball).toMatchObject({carrier:null,pos:{x:0,y:8},lastTouch:'A0'});
    expect(s.turn).toBe(1);
    expect(turnovers(s)).toHaveLength(1);
  });

  it('marks a pending catch attempt and preserves its skill reroll and edge entitlement after serialization',()=>{
    let s=make(350);place(s,'A0',1,3);place(s,'A1',0,7);
    s=applyCommand(s,pass);
    expect(s.ball).toMatchObject({carrier:null,pos:{x:0,y:7},lastTouch:'A1'});
    expect(legalActions(s)).toContainEqual({type:'reroll',source:'skill'});
    s=applyCommand(JSON.parse(JSON.stringify(s)),decline);
    expect(rollValues(s)).toEqual([4,1,1]);
    expect(s).toMatchObject({turn:1,current:'B',possession:'B',throwIn:{team:'B'},ball:{lastTouch:'A1'}});
    expect(turnovers(s)).toHaveLength(1);
  });

  it('does not apply a second turnover when a failed catch bounces to a standing opponent',()=>{
    let s=make(478);place(s,'A0',3,3);place(s,'A1',3,7);place(s,'B1',3,8);
    s=applyCommand(s,pass);
    expect(s.pending?.type).toBe('check');
    s=applyCommand(s,decline);
    expect(rollValues(s)).toEqual([4,1,1,3,5]);
    expect(s).toMatchObject({turn:1,current:'B',ball:{carrier:'B1',lastTouch:'B1'}});
    expect(turnovers(s)).toHaveLength(1);
  });

  it('resumes a serialized Pass reroll after the release contests without rerolling the same defender',()=>{
    let s=make(10652);
    place(s,'A0',4,3);place(s,'A1',4,7);place(s,'B0',5,4);place(s,'B1',5,6);
    s=applyCommand(s,pass);
    expect(rollValues(s)).toEqual([2,1]);
    expect(s.pending).toMatchObject({type:'check',check:{label:'Pass'}});
    const result=applyCommand(JSON.parse(JSON.stringify(s)),{type:'reroll',source:'team'});
    expect(result.events.filter(e=>e.kind==='roll').map(e=>[e.playerId,e.value])).toEqual([
      ['B0',2],['A0',1],['A0',6],['B1',1],['A1',4],
    ]);
    expect(result).toMatchObject({turn:0,active:null,ball:{carrier:'A1',lastTouch:'A1'}});
  });
});

describe('possession aerials and AI',()=>{
  it('needs two forward steps even on fire and cuts Turbo dunk launch range to six',()=>{
    const s=make(56);
    expect(courtSize(s)).toMatchObject({runUp:2,dunkRange:6,throwRange:6});
    expect(courtSize(createMatch(legacyConfig,56))).toMatchObject({runUp:2,dunkRange:8,throwRange:8});
    const dunk={type:'dunk',playerId:'A0',spins:0} as const;
    const a=place(s,'A0',4,8);a.fire=true;
    reject(s,dunk);expect(legalActions(s,'A0')).not.toContainEqual(dunk);
    a.forward=2;place(s,'A0',4,7);reject(s,dunk);
    place(s,'A0',4,8);
    expect(legalActions(s,'A0')).toContainEqual(dunk);
    expect(applyCommand(s,dunk).teams[0]!.score).toBe(2);
  });

  it('cuts both ends of the Turbo alley-oop range and still requires a prepared receiver',()=>{
    const s=make(56);place(s,'A0',4,7);const q=place(s,'A1',5,8);q.forward=2;
    const oop={type:'alleyOop',playerId:'A0',targetId:'A1',spins:0} as const;
    reject(s,oop);
    place(s,'A0',4,8);place(s,'A1',5,7);reject(s,oop);
    place(s,'A1',5,8);q.forward=1;reject(s,oop);
    q.forward=2;
    expect(applyCommand(s,oop).teams[0]!.score).toBe(2);
  });

  it('also caps the Halfling cannon to six while preserving a legal prepared throw',()=>{
    const s=make(56,{teamA:'Grak & Crumbleberry'});place(s,'A0',4,7);place(s,'A1',5,7);
    const cannon={type:'throwTeamMate',playerId:'A0',targetId:'A1',spins:0} as const;
    reject(s,cannon);expect(legalActions(s)).not.toContainEqual(cannon);
    place(s,'A0',4,8);place(s,'A1',5,8);
    expect(applyCommand(s,cannon).teams[0]!.score).toBe(2);
  });

  it('lands a failed aerial in prone with the retained ball and no hot-ball or glass injuries',()=>{
    let s=make(6);const p=place(s,'A0',4,11);p.fire=true;p.forward=2;s.glass=['A'];carry(s,'A0',true);
    s=applyCommand(s,{type:'dunk',playerId:'A0',spins:1});
    expect(s.pending?.type).toBe('check');
    s=applyCommand(s,decline);
    expect(rollValues(s)).toEqual([1,3]);
    expect(get(s,'A0').status).toBe('prone');
    expect(s).toMatchObject({turn:1,current:'B',ball:{carrier:'A0',hot:true,lastTouch:'A0'}});
    noInjuries(s);
  });

  it('retains the prepared Goblin ladder and a flaming POW shatter as scoring spectacle',()=>{
    const goblins=make(48,{teamA:'Goblin Swarm'});
    place(goblins,'A0',4,11);place(goblins,'A1',4,12);place(goblins,'A2',5,11);
    const ladder={type:'ladder',playerId:'A0',spins:0} as const;
    expect(legalActions(goblins)).toContainEqual(ladder);
    expect(applyCommand(goblins,ladder).teams[0]!.score).toBe(2);

    const grak=make(1598,{teamA:'Grak & Crumbleberry'});
    const p=place(grak,'A0',4,9);p.fire=true;p.forward=2;carry(grak,'A0',true);
    const result=applyCommand(grak,{type:'dunk',playerId:'A0',spins:1});
    expect(rollValues(result)).toEqual([6,6,6,6]);
    expect(result.teams[0]!.score).toBe(3);
    expect(result.glass).toEqual(['A']);
    noInjuries(result);
  });

  it('allows a release defender to intercept a prepared alley-oop before the leap',()=>{
    const s=make(48);place(s,'A0',4,8);place(s,'A1',5,11).forward=2;place(s,'B0',5,8);
    const result=applyCommand(s,{type:'alleyOop',playerId:'A0',targetId:'A1',spins:0});
    expect(rollValues(result)).toEqual([6]);
    expect(result).toMatchObject({current:'B',turn:1,ball:{carrier:'B0',lastTouch:'B0'}});
    expect(result.teams[0]!.score).toBe(0);
    expect(result.events.some(e=>e.kind==='dunk')).toBe(false);
    noInjuries(result);
  });

  it('also contests an alley-oop in flight without animating an intercepted launch',()=>{
    const s=make(3);place(s,'A0',1,8);place(s,'A1',5,12).forward=2;place(s,'B0',4,8);
    const result=applyCommand(s,{type:'alleyOop',playerId:'A0',targetId:'A1',spins:0});
    expect(rollValues(result)).toEqual([4,6]);
    expect(result).toMatchObject({turn:1,current:'B',ball:{carrier:'B0',lastTouch:'B0'}});
    expect(result.events.some(e=>e.kind==='dunk')).toBe(false);
  });

  it('drops an alley-oop failed on AG before flight with no fall or launch animation',()=>{
    let s=make(2);place(s,'A0',4,8);place(s,'A1',5,10).forward=2;
    s=applyCommand(s,{type:'alleyOop',playerId:'A0',targetId:'A1',spins:0});
    s=applyCommand(s,decline);
    expect(rollValues(s)).toEqual([1,3]);
    expect(s).toMatchObject({turn:1,current:'B',ball:{carrier:null,pos:{x:5,y:11},lastTouch:'A0'}});
    expect(s.events.some(e=>e.kind==='fall'||e.kind==='dunk')).toBe(false);
  });

  it('lets a defender intercept an inbound flight toward an empty tile',()=>{
    const s=make(48);place(s,'A0',0,5);place(s,'B0',1,7);
    s.throwIn={team:'A',spot:{x:0,y:5},throwerId:'A0'};
    s.ball={carrier:null,pos:{x:0,y:5},hot:false,lastTouch:'B1'};
    const result=applyCommand(s,{type:'throwIn',playerId:'A0',to:{x:0,y:8}});
    expect(rollValues(result)).toEqual([6]);
    expect(result).toMatchObject({current:'B',turn:1,throwIn:null,ball:{carrier:'B0',lastTouch:'B0'}});
    expect(get(result,'A0').used).toBe(true);
  });

  it('restarts the same turn if a defender bats an inbound release across the boundary',()=>{
    const s=make(53);place(s,'A0',0,5);place(s,'A1',0,7);place(s,'B0',1,5);
    s.throwIn={team:'A',spot:{x:0,y:5},throwerId:'A0'};
    s.ball={carrier:null,pos:{x:0,y:5},hot:false,lastTouch:'B1'};
    const result=applyCommand(s,{type:'throwIn',playerId:'A0',to:{x:0,y:7}});
    expect(rollValues(result)).toEqual([5,1]);
    expect(result).toMatchObject({current:'A',turn:0,throwIn:{team:'A'},ball:{carrier:null,lastTouch:'B0'}});
    expect(turnovers(result)).toHaveLength(0);
    expect(get(result,'A0').used).toBe(true);
  });

  it('chooses a legal prone outlet instead of trying to shoot or stand on an exhausted budget',()=>{
    const s=make(1);const p=get(s,'A0');p.status='prone';p.moved=p.ma;
    expect(chooseAiCommand(s)).toEqual(pass);
  });

  it('can finish a prone recovery when its movement is spent and it has no outlet',()=>{
    let s=make(1);const p=get(s,'A0');p.status='prone';p.moved=p.ma;get(s,'A1').status='prone';
    s.ball.carrier=null;
    s=applyCommand(s,{type:'recover',playerId:'A0'});
    const end={type:'endActivation',playerId:'A0'} as const;
    expect(legalActions(s)).toContainEqual(end);
    expect(applyCommand(s,end)).toMatchObject({active:null,ball:{carrier:'A0'}});
  });

  it.each(Object.keys(ROSTERS) as RosterName[])('gives %s no score from any opening run or single action',roster=>{
    const s=make(1,{teamA:roster});
    const scores=(c:Command)=>['shoot','dunk','ladder','alleyOop','throwTeamMate'].includes(c.type);
    expect(legalActions(s).filter(scores)).toEqual([]);
    const projected=legalActions(s).filter(c=>c.type==='run');
    expect(projected.length).toBeGreaterThan(0);
    for(const command of projected) {
      const next=applyCommand(s,command);
      expect(legalActions(next).filter(scores)).toEqual([]);
    }
  });

  it('lets a closing defense contest a prepared drive in a replayable command sequence',()=>{
    let s=make(48);
    s=applyCommand(s,run('A0',3,6));
    s=applyCommand(s,{type:'endTurn'});
    s=applyCommand(s,run('B1',4,10));
    s=applyCommand(s,{type:'endTurn'});
    s=applyCommand(s,run('A0',3,10));
    expect(s.ball).toMatchObject({carrier:'B1',lastTouch:'B1'});
    expect(s).toEqual(replayMatch(JSON.parse(serializeReplay(s))));
  });

  it.each([
    [1,'arcade','Grak & Crumbleberry','Goblin Swarm'],
    [48,'arcade','Reikland Reavers','Gouged Eye'],
    [983,'classic','Skavenblight','Goblin Swarm'],
  ] as const)('finishes seeded v3 match %i on %s with legal occupancy and exact replay',(seed,court,teamA,teamB)=>{
    let s=make(seed,{court,teamA,teamB});
    for(let i=0;i<500&&!s.over;i++) {
      const command=chooseAiCommand(s);
      expect(legalActions(s)).toContainEqual(command);
      s=applyCommand(s,command);
      const occupied:Position[]=s.players.filter(p=>!p.offCourt).map(p=>p.pos);
      expect(new Set(occupied.map(p=>`${p.x},${p.y}`)).size).toBe(occupied.length);
      expect(occupied.every(p=>inBounds(p,s)&&!isRim(p,s))).toBe(true);
      expect(inBounds(s.ball.pos,s)&&!isRim(s.ball.pos,s)).toBe(true);
      if(s.ball.carrier) {
        const p=get(s,s.ball.carrier);
        expect(p.offCourt).toBe(false);expect(['standing','prone']).toContain(p.status);
        expect(p.team).toBe(s.possession);expect(distance(p.pos,s.ball.pos)).toBe(0);
      }
    }
    expect(s.over).toBe(true);
    expect(s.turn).toBe(court==='arcade'?24:32);
    expect(s).toEqual(replayMatch(JSON.parse(serializeReplay(s))));
    noInjuries(s);
  });
});
