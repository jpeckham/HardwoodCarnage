import { distance, inBounds, isRim, neighbors, rim, same, shotPoints } from './court.js';

import { endTurn, enemies, event, finish, player, team, validCell } from './match.js';

import { brawler, chooseBlock, follow, push, rerollBlock, startBlock } from './blocks.js';

import { canReroll, resolveCheck, resolveSteps } from './resolution.js';

import type { Command, MatchState, Player, Step } from './types.js';

import { movementSteps } from './movement.js';

import { pathTo, reachableMoves } from './paths.js';

import { aerialSteps, canAerial, canFormLadder, ladderHelpers } from './aerial.js';

import { canRecoverBall, performThrowIn, recoverBall, throwInActions } from './ball.js';

import { isPossessionGame, movementRemaining } from './rules.js';

const assert=(condition:unknown,message:string):void=>{if(!condition) throw new Error(message);};

function actor(s:MatchState,id:string):Player {

  const p=player(s,id);

  assert(p.team===s.current && !p.used && !p.offCourt && p.status==='standing','Player cannot act');

  assert(!s.active || s.active===p.id,'Finish the active player first');

  s.active=p.id;return p;

}

const check=(p:Player,label:string,target:number,success:Step[],failure:Step[],skill?:string):Step=>({type:'check',playerId:p.id,label,target,success,failure,...(skill?{skill}:{})});

const done=(p:Player):Step=>({type:'finish',playerId:p.id});

const turnover=(reason:string):Step=>({type:'turnover',reason});
const shotInRange=(s:MatchState,p:Player):boolean=>!isPossessionGame(s)||distance(p.pos,rim(p.team,s.half,s))<=6;

function pass(s:MatchState,p:Player,targetId:string):void {

  const q=player(s,targetId);

  assert(s.ball.carrier===p.id && q.team===p.team && q.id!==p.id && !q.offCourt && q.status==='standing' && distance(p.pos,q.pos)<=6,'Illegal pass');

  const fail:Step[]=[{type:'ball',playerId:null,pos:{...q.pos}},{type:'turnover',reason:'dropped pass/catch'}];

  resolveSteps(s,[check(p,'Pass',p.ag+(distance(p.pos,q.pos)>3?1:0)+enemies(s,p).length,[

    check(q,'Catch',q.ag+enemies(s,q).length,[{type:'ball',playerId:q.id,hot:s.ball.hot||p.fire},done(p)],fail,q.skills.includes('Catch')?'Catch':undefined)

  ],fail)]);

}

function shoot(s:MatchState,p:Player):void {

  assert(s.ball.carrier===p.id,'Player does not have the ball');

  const target=rim(p.team,s.half,s),points=shotPoints(p.pos,target,s);

  assert(shotInRange(s,p),'Shot is out of range');

  const mod=(points===3?1:0)+enemies(s,p).length-(points===3&&p.fire?2:0);

  resolveSteps(s,[{type:'clockReset'},check(p,'Shot',p.ag+mod,[{type:'score',playerId:p.id,points,dunk:false,spins:0,thrown:false}],

    [{type:'event',kind:'miss',text:'OFF THE RIM!',playerId:p.id},
      isPossessionGame(s)?{type:'scatter',from:target,lastTouchId:p.id}:{type:'ball',playerId:null,pos:{x:target.x,y:target.y===1?2:target.y-1}},
      done(p)])]);

}

function execute(s:MatchState,c:Command):void {

  assert(!s.over,'Match is over');

  if(isPossessionGame(s)&&s.throwIn) {
    if(c.type!=='throwIn')throw new Error('Complete the throw-in first');
    performThrowIn(s,c.playerId,c.to);return;
  }

  if(s.pending) {

    if(c.type==='reroll') {

      if(s.pending.type==='block') {assert(c.source==='team','Only team rerolls for blocks');rerollBlock(s);}

      else resolveCheck(s,c.source);

    } else if(c.type==='decline') resolveCheck(s,null);

    else if(c.type==='chooseBlock') chooseBlock(s,c.index);

    else if(c.type==='brawler') brawler(s,c.index);

    else if(c.type==='push') push(s,c.to);

    else if(c.type==='follow') follow(s,c.yes);

    else throw new Error('Resolve the pending decision first');

    return;

  }

  if(c.type==='endTurn') {endTurn(s);return;}

  assert('playerId' in c,'No pending decision for this command');

  if(!('playerId' in c)) return;

  if(c.type==='recover') {
    const p=player(s,c.playerId);
    assert(isPossessionGame(s)&&canRecoverBall(s,p),'Player cannot recover the ball here');
    s.active=p.id;recoverBall(s,p);return;
  }

  if(c.type==='throwIn')throw new Error('No throw-in is pending');

  if(c.type==='stand') {

    const p=player(s,c.playerId);

    assert(p.status==='prone' && !p.offCourt && p.team===s.current && !p.used && (!s.active||s.active===p.id),'Cannot stand');

    const possession=isPossessionGame(s);
    assert(!possession||movementRemaining(s,p)>0,'Standing requires one movement square');
    p.status='standing';p.moved=possession?p.moved+1:3;s.active=p.id;event(s,'stand',`${p.name} gets up`,p);return;

  }

  if(s.config.court==='arcade'&&c.type==='throwTeamMate'&&s.active===c.targetId&&s.ball.carrier===c.targetId)finish(s,c.targetId);
  const p=actor(s,c.playerId);

  switch(c.type) {

    case 'move': resolveSteps(s,movementSteps(s,p,c.to));break;

    case 'run': resolveSteps(s,pathTo(s,p.id,c.to).map(to=>({type:'walk',playerId:p.id,to})));break;

    case 'endActivation': finish(s,p.id);break;

    case 'formLadder': {

      assert(canFormLadder(s,p),'Defensive ladder needs three ready adjacent Goblins within two of your rim');

      const ids=[p.id,...ladderHelpers(s,p).slice(0,2).map(q=>q.id)];

      s.ladders.push(ids);for(const id of ids) finish(s,id);

      event(s,'ladder','GOBLIN LADDER — THE RIM IS GUARDED!',p);break;

    }

    case 'shoot': shoot(s,p);break;

    case 'pass':pass(s,p,c.targetId);break;

    case 'block': {

      const q=player(s,c.targetId);

      assert(q.team!==p.team && !q.offCourt && q.status==='standing' && distance(p.pos,q.pos)===1,'Illegal block target');

      assert((p.moved===0 || c.blitz) && (!c.blitz || !team(s,p.team).blitzUsed),'Block needs an available Blitz');

      assert(!c.blitz || p.moved<p.ma || p.fire,'Blitz requires one movement point');

      if(c.blitz) {team(s,p.team).blitzUsed=true;p.moved++;}

      startBlock(s,p,q,c.blitz);break;

    }

    case 'steal': {

      assert(typeof c.targetId==='string','Choose a carrier'); const q=player(s,c.targetId!);

      assert(q.team!==p.team && !q.offCourt && q.status==='standing' && s.ball.carrier===q.id && distance(p.pos,q.pos)===1,'Illegal steal');

      resolveSteps(s,[check(p,'Steal',p.ag+enemies(s,p).length,[{type:'ball',playerId:p.id,hot:s.ball.hot||q.fire},done(p)],[done(p)])]);break;

    }

    case 'dunk':case 'ladder':case 'alleyOop':case 'throwTeamMate': {

      assert(canAerial(s,c),'Aerial action requires a legal run-up, carrier, helpers and rim range');

      resolveSteps(s,aerialSteps(s,c));break;

    }

    default: throw new Error('Unknown action');

  }

}

export function validateCommand(c:unknown):asserts c is Command {

  assert(c && typeof c==='object' && !Array.isArray(c),'Malformed command');

  const v=c as Record<string,unknown>, type=v.type;

  assert(typeof type==='string','Malformed command type');

  const simple=['endTurn','decline'];

  if(simple.includes(type as string)) return;

  if(type==='reroll') {assert(v.source==='team'||v.source==='skill','Invalid reroll source');return;}

  if(type==='follow') {assert(typeof v.yes==='boolean','Invalid follow choice');return;}

  if(type==='chooseBlock'||type==='brawler') {assert(Number.isInteger(v.index) && (v.index as number)>=0,'Invalid die index');return;}

  if(type==='move'||type==='run'||type==='push'||type==='throwIn') {

    const to=v.to as {x:unknown;y:unknown}|undefined;

    assert(to && typeof to==='object' && Number.isInteger(to.x)&&Number.isInteger(to.y),'Invalid coordinates');

    if(type==='push') return;

  }

  assert(['move','run','stand','shoot','steal','endActivation','formLadder','pass','block','dunk','ladder','alleyOop','throwTeamMate','recover','throwIn','swat'].includes(type as string),'Unknown command');

  assert(typeof v.playerId==='string','Invalid player ID');

  if(['pass','steal','block','alleyOop','throwTeamMate','swat'].includes(type as string)) assert(typeof v.targetId==='string','Invalid target ID');

  if(type==='block') assert(typeof v.blitz==='boolean','Invalid Blitz flag');

  if(['dunk','ladder','alleyOop','throwTeamMate'].includes(type as string)) assert(Number.isInteger(v.spins) && (v.spins as number)>=0 && (v.spins as number)<=3,'Spins must be 0–3');

}

export function applyCommand(state:MatchState,command:Command):MatchState {

  validateCommand(command);

  assert(state.config.ruleset===undefined||state.config.ruleset==='possession','Unknown ruleset');
  assert(isPossessionGame(state)===(state.config.ruleset==='possession'),'Match rules and configuration do not match');

  const s=structuredClone(state); execute(s,command);s.commands.push(structuredClone(command));return s;

}

export function legalActions(s:MatchState,playerId?:string):Command[] {

  if(s.over) return [];

  const possession=isPossessionGame(s);
  if(possession&&s.throwIn)return throwInActions(s,playerId);

  const b=s.pending;

  if(b) {

    if(b.type==='check') return [{type:'decline'},...canReroll(s,b.check).map(source=>({type:'reroll' as const,source}))];

    if(b.type==='block') {

      const actions:Command[]=b.dice.map((_,index)=>({type:'chooseBlock',index}));

      const t=team(s,player(s,b.attacker).team);

      if(!t.rerollUsed && t.rerolls>0 && !b.brawlerUsed) actions.push({type:'reroll',source:'team'});

      if(!b.blitz && !b.brawlerUsed && player(s,b.attacker).skills.includes('Brawler')) b.dice.forEach((d,index)=>{if(d==='Both Down')actions.push({type:'brawler',index});});

      return actions;

    }

    if(b.type==='push') return b.destinations.map(to=>({type:'push',to}));

    return [{type:'follow',yes:true},{type:'follow',yes:false}];

  }

  const result:Command[]=[{type:'endTurn'}];

  for(const p of s.players.filter(p=>p.team===s.current && !p.used && !p.offCourt && (!playerId||p.id===playerId) && (!s.active||s.active===p.id))) {

    if(possession&&canRecoverBall(s,p))result.push({type:'recover',playerId:p.id});

    if(p.status==='prone') {
      if(!possession||movementRemaining(s,p)>0)result.push({type:'stand',playerId:p.id});
      continue;
    }

    if(p.status!=='standing') continue;

    result.push({type:'endActivation',playerId:p.id});

    if(possession||s.config.court==='arcade')result.push(...reachableMoves(s,p.id));

    if(canFormLadder(s,p)) result.push({type:'formLadder',playerId:p.id});

    if(movementRemaining(s,p)>0) for(const to of neighbors(p.pos)) if(validCell(s,to)) result.push({type:'move',playerId:p.id,to});

    for(const q of s.players.filter(q=>q.id!==p.id && !q.offCourt && q.status==='standing')) {

      if(q.team===p.team) {

        if(s.ball.carrier===p.id && distance(p.pos,q.pos)<=6) result.push({type:'pass',playerId:p.id,targetId:q.id});

        for(const type of ['alleyOop','throwTeamMate'] as const) for(let spins=0;spins<=3;spins++) {

          const c:Command={type,playerId:p.id,targetId:q.id,spins}; if(canAerial(s,c)) result.push(c);

        }

      } else if(distance(p.pos,q.pos)===1) {

        if(!p.moved) result.push({type:'block',playerId:p.id,targetId:q.id,blitz:false});

        if(!team(s,p.team).blitzUsed && (p.moved<p.ma || p.fire)) result.push({type:'block',playerId:p.id,targetId:q.id,blitz:true});

        if(s.ball.carrier===q.id) result.push({type:'steal',playerId:p.id,targetId:q.id});

      }

    }

    if(s.ball.carrier===p.id) {

      if(shotInRange(s,p))result.push({type:'shoot',playerId:p.id});

      for(const type of ['dunk','ladder'] as const) for(let spins=0;spins<=3;spins++) {const c:Command={type,playerId:p.id,spins};if(canAerial(s,c))result.push(c);}

    }

  }

  if(s.config.court==='arcade'&&s.active&&s.ball.carrier===s.active) {
    for(const p of s.players.filter(p=>p.team===s.current&&p.id!==s.active&&p.skills.includes('Throw Team-Mate'))) {
      for(let spins=0;spins<=3;spins++) {
        const c:Command={type:'throwTeamMate',playerId:p.id,targetId:s.active,spins};
        if(canAerial(s,c))result.push(c);
      }
    }
  }
  return result;

}
