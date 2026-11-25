import { describe, expect, it } from 'vitest';
import { createMatch, applyCommand, legalActions } from '../src/index.js';

describe('contact',()=>{
  it('gives defender the choice against a stronger player and prevents unrelated commands',()=>{
    let s=createMatch({teamA:'Reikland Reavers',teamB:'Gouged Eye'},1);
    s.players[2]!.pos={x:6,y:11};
    s=applyCommand(s,{type:'block',playerId:'A0',targetId:'B0',blitz:false});
    expect(s.pending).toMatchObject({type:'block',chooser:'B',dice:expect.any(Array)});
    expect((s.pending as {dice:string[]}).dice).toHaveLength(2);
    expect(()=>applyCommand(s,{type:'move',playerId:'A0',to:{x:5,y:10}})).toThrow();
    expect(legalActions(s).some(c=>c.type==='chooseBlock')).toBe(true);
  });
  it('requires Blitz for a block after moving, and permits only one blitz per turn',()=>{
    let s=createMatch({teamA:'Gouged Eye',teamB:'Reikland Reavers'},1);
    s.players[2]!.pos={x:6,y:12};
    s=applyCommand(s,{type:'move',playerId:'A0',to:{x:6,y:11}});
    expect(()=>applyCommand(s,{type:'block',playerId:'A0',targetId:'B0',blitz:false})).toThrow();
    s=applyCommand(s,{type:'block',playerId:'A0',targetId:'B0',blitz:true});
    expect(s.teams[0]!.blitzUsed).toBe(true);
  });
});
