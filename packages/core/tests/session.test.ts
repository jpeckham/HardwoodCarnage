import { describe, expect, it } from 'vitest';
import { createMatch, applyCommand } from '../src/index.js';
import { encodeSession, decodeSession, readSession, writeSession } from '../../../apps/web/session.js';
import { humanCanCommand, awaitingAttacker } from '../../../apps/web/control.js';
describe('browser persistence',()=>{
  it('restores accepted commands exactly, preserving mode',()=>{
    const s=applyCommand(createMatch({teamA:'Reikland Reavers',teamB:'Goblin Swarm'},2),{type:'endTurn'});
    expect(decodeSession(encodeSession(s,'solo'))).toEqual({state:s,mode:'solo'});
  });
  it('rejects malformed session data and tolerates disabled storage',()=>{
    expect(()=>decodeSession('{oops')).toThrow();
    expect(()=>decodeSession('{"mode":"hacked","replay":{}}')).toThrow();
    const storage={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('full');}};
    expect(readSession(storage)).toBeNull();
    expect(writeSession(storage,createMatch({teamA:'Reikland Reavers',teamB:'Gouged Eye'},1),'solo')).toBe(false);
  });
  it('rejects coerced roster keys before a bad replay can enter autosave',()=>{
    const good=JSON.parse(encodeSession(createMatch({teamA:'Gouged Eye',teamB:'Reikland Reavers'},1),'solo'));
    good.replay.config.teamA=['Gouged Eye'];
    expect(()=>decodeSession(JSON.stringify(good))).toThrow(/roster|config/i);
  });
  it('keeps attacker rerolls separate from defender choices in solo play',()=>{
    let s=createMatch({teamA:'Gouged Eye',teamB:'Skavenblight'},1);
    s.players[3]!.pos={x:6,y:11};
    s=applyCommand(s,{type:'block',playerId:'A0',targetId:'B1',blitz:false});
    expect(humanCanCommand(s,'solo',{type:'brawler',index:0})).toBe(true);
    expect(humanCanCommand(s,'solo',{type:'chooseBlock',index:0})).toBe(false);
    expect(awaitingAttacker(s,'solo',false)).toBe(true);
    expect(awaitingAttacker(s,'solo',true)).toBe(false);
    s.current='B';s.pending={type:'block',attacker:'B0',defender:'A0',chooser:'A',dice:['Push'],blitz:false,frenzy:false,brawlerUsed:false};
    expect(humanCanCommand(s,'solo',{type:'chooseBlock',index:0})).toBe(true);
    expect(humanCanCommand(s,'solo',{type:'reroll',source:'team'})).toBe(false);
  });
});
