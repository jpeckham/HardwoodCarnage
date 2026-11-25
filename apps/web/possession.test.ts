// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand, chooseAiCommand, createMatch, legalActions, POSSESSION_RULES, serializeReplay, type Command, type MatchState } from '../../packages/core/src/index.js';
import { decisionCoach, humanCanCommand } from './control.js';
import { courtSvg, latestPlayCall, selectedPanel } from './render.js';
import { decodeSession, encodeSession, readSession, writeSession } from './session.js';
import { tabletopKit } from './tabletop.js';

const config={teamA:'Reikland Reavers',teamB:'Gouged Eye',court:'arcade',ruleset:'possession'} as const;
const legacy={teamA:config.teamA,teamB:config.teamB,court:config.court} as const;
const oldKey='hardwood-carnage-session-v1';
const run=(playerId:string,x:number,y:number):Command=>({type:'run',playerId,to:{x,y}});
const end={type:'endTurn'} as const;
const player=(s:MatchState,id:string)=>s.players.find(p=>p.id===id)!;
const fragment=(html:string)=>{const el=document.createElement('div');el.innerHTML=html;return el;};
const clickUi=(name:string)=>document.querySelector<HTMLButtonElement>(`[data-ui="${name}"]`)!.click();
const hit=(el:Element)=>el.dispatchEvent(new MouseEvent('click',{bubbles:true}));
const commandElements=(el:ParentNode,type?:string)=>[...el.querySelectorAll<HTMLElement>('[data-command]')].filter(node=>!type||JSON.parse(node.dataset.command!).type===type);
const commandElement=(el:ParentNode,command:Command)=>commandElements(el,command.type).find(node=>node.dataset.command===JSON.stringify(command))!;
const keyListeners:EventListenerOrEventListenerObject[]=[];
const boot=async()=>{
  const spy=vi.spyOn(document,'addEventListener');
  try {await import('./main.js');}
  finally {
    for(const [event,listener] of spy.mock.calls)if(event==='keydown'&&listener)keyListeners.push(listener);
    spy.mockRestore();
  }
};

function nearRestart():MatchState {
  return [run('A0',3,6),end,run('B1',4,15),end,{type:'endActivation',playerId:'A1'} as const,run('A0',4,8),{type:'shoot',playerId:'A0'} as const]
    .reduce(applyCommand,createMatch(config,70));
}

beforeEach(()=>{
  vi.resetModules();
  document.body.innerHTML='<div id="app"></div>';
  localStorage.clear();
});
afterEach(()=>{
  for(const listener of keyListeners.splice(0))document.removeEventListener('keydown',listener);
  vi.useRealTimers();
});

describe('possession browser rules',()=>{
  it('clicks the actual cost-three detour, then one more square, and restores exactly four spent movement',async()=>{
    localStorage.setItem(oldKey,encodeSession(createMatch(config,1),'hotseat'));
    await boot();
    expect(document.querySelector('.stats')?.textContent).toContain('4MA');
    const first=run('A0',5,1);
    const destination=commandElement(document,first);
    expect(destination.getAttribute('aria-label')).toMatch(/3 squares/);
    const numeral=destination.nextElementSibling;
    expect(numeral?.matches('text.path-cost')).toBe(true);
    expect(numeral?.textContent).toBe('3');
    expect(commandElement(document,run('A0',4,2))).toBeUndefined(); // Occupied by the catcher.
    hit(destination);
    expect(document.querySelector('.stats')?.textContent).toMatch(/4MA.*1LEFT/);
    expect(player(readSession(localStorage)!.state,'A0').moved).toBe(3);
    const second=run('A0',5,2);
    hit(commandElement(document,second));
    expect(document.querySelector('.stats')?.textContent).toMatch(/4MA.*0LEFT/);
    expect(commandElements(document,'run')).toHaveLength(0);
    expect(readSession(localStorage)?.state).toEqual(applyCommand(applyCommand(createMatch(config,1),first),second));
  });

  it('shows prone passing and recovery with the extra difficulty without offering ground movement',()=>{
    const s=createMatch(config,1);
    const p=player(s,'A0');p.status='prone';
    const panel=fragment(selectedPanel(s,p.id,1,false));
    expect(commandElements(panel,'pass')[0]?.textContent).toMatch(/Pass from floor.*\+1 difficulty/);
    expect(commandElements(panel,'stand')[0]?.textContent).toMatch(/1 movement/);
    expect(commandElements(fragment(courtSvg(s,p.id)),'run')).toHaveLength(0);
    s.ball.carrier=null;
    const recovery=fragment(selectedPanel(s,p.id,1,false));
    expect(commandElements(recovery,'recover')[0]?.textContent).toMatch(/Recover ball.*\+1 difficulty/);
  });

  it('offers Swat ball even against a prone carrier, without body-only stats or controls',()=>{
    const s=createMatch(config,1),p=player(s,'A0'),enemy=player(s,'B0');
    enemy.status='prone';enemy.pos={x:p.pos.x-1,y:p.pos.y};s.ball.carrier=enemy.id;s.ball.pos={...enemy.pos};
    const panel=fragment(selectedPanel(s,p.id,1,false));
    expect(commandElements(panel,'swat')[0]?.textContent).toMatch(/Swat ball/);
    expect(panel.textContent).not.toMatch(/ARMOR|GFI/);
    expect(commandElements(panel,'block')).toHaveLength(0);
    expect(fragment(selectedPanel(s,enemy.id,1,false)).textContent).not.toMatch(/Grab|Brawler/);
  });

  it('replaces an old dunk call even when a swat only logs its failed roll',()=>{
    const s=createMatch(config,2), defender=player(s,'A0'),carrier=player(s,'B0');
    carrier.pos={x:defender.pos.x-1,y:defender.pos.y};s.ball={...s.ball,carrier:carrier.id,pos:{...carrier.pos},lastTouch:carrier.id};
    s.events.push({id:s.events.length,kind:'dunk',text:'TAKING FLIGHT!'});
    const after=applyCommand(s,{type:'swat',playerId:defender.id,targetId:carrier.id});
    expect(after.ball.carrier).toBe(carrier.id);
    expect(latestPlayCall(after.events)?.text).toMatch(/^Swat /);
  });

  it('uses v3 for the new setup, both court choices, and a rematch',async()=>{
    await boot();
    expect(document.querySelector('#setup-form')).not.toBeNull();
    document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    expect(readSession(localStorage)!.state.config).toMatchObject({court:'arcade',ruleset:'possession'});
    clickUi('setup');
    const court=document.querySelector<HTMLSelectElement>('#court-mode')!;
    court.value='classic';court.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    const saved=readSession(localStorage)!;
    expect(saved.state.config).toMatchObject({court:'classic',ruleset:'possession'});
    expect(saved.state.rules).toBe(POSSESSION_RULES);
    // Finish a real replay with ordinary end-turn commands, then reload it.
    let final=saved.state;while(!final.over)final=applyCommand(final,end);
    writeSession(localStorage,final,'hotseat');
    vi.resetModules();document.body.innerHTML='<div id="app"></div>';
    await boot();
    expect(document.querySelector('#setup-form')).toBeNull();
    clickUi('rematch');
    expect(readSession(localStorage)?.state).toEqual(createMatch(final.config,(final.seed+1)>>>0));
    clickUi('print');
    expect(document.querySelector('#print-kit')?.textContent).toContain('15 × 26 COURT · POSSESSION RULES');
  });

  it('starts an old autosave as a read-only option, and retains it when a v3 match starts',async()=>{
    const historic=applyCommand(createMatch(legacy,15),end);
    const raw=encodeSession(historic,'solo');
    localStorage.setItem(oldKey,raw);
    await boot();
    expect(document.querySelector('#setup-form')).not.toBeNull();
    expect(localStorage.getItem(oldKey)).toBe(raw);
    clickUi('legacyReplay');
    expect(document.querySelector('.replay-bar')?.textContent).toMatch(/read-only/i);
    expect((document.querySelector('#timeline') as HTMLInputElement).value).toBe('1');
    document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'e',bubbles:true}));
    expect(localStorage.getItem(oldKey)).toBe(raw);
    expect(decodeSession(raw).state).toEqual(historic);
    clickUi('exitReplay');
    document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    expect(readSession(localStorage)?.state.rules).toBe(POSSESSION_RULES);
    expect(localStorage.getItem(oldKey)).toBe(raw);
  });

  it('does not auto-end an exhausted team before its used thrower can inbound',async()=>{
    const pre=nearRestart(),restart=applyCommand(pre,{type:'decline'});
    expect(restart.throwIn?.team).toBe('A');
    expect(restart.players.filter(p=>p.team==='A').every(p=>p.used)).toBe(true);
    localStorage.setItem(oldKey,encodeSession(pre,'hotseat'));
    await boot();
    hit(commandElement(document,{type:'decline'}));
    expect(document.querySelector('.ball-status')?.textContent).toMatch(/Team A.*throw-in.*Orc Blitzer/i);
    expect(document.querySelector('.announcer')?.textContent).toMatch(/touched it last/);
    expect(document.querySelector('.decision')?.textContent).toMatch(/Choose a highlighted square/i);
    const offered=legalActions(restart);
    expect(commandElements(document.querySelector('.court')!).map(el=>JSON.parse(el.dataset.command!))).toEqual(offered);
    expect(commandElements(document,'endTurn').every(el=>el.hasAttribute('disabled'))).toBe(true);
    document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'e',bubbles:true}));
    expect(readSession(localStorage)?.state).toEqual(restart);
    const target=offered[0]!;
    hit(commandElement(document.querySelector('.court')!,target));
    expect(readSession(localStorage)?.state).toEqual(applyCommand(applyCommand(restart,target),end));
  });

  it('layers a legal occupied inbound target above the teammate token',()=>{
    const s=applyCommand(nearRestart(),{type:'decline'});
    player(s,'A1').pos={x:6,y:14};
    const court=fragment(courtSvg(s,'B0'));
    const target=commandElement(court,{type:'throwIn',playerId:'A0',to:{x:6,y:14}});
    expect(target.closest('.inbound-targets')).not.toBeNull();
    expect(target.getAttribute('aria-label')).toMatch(/Human Catcher/);
    const teammate=[...court.querySelectorAll('.token')].find(el=>el.textContent?.includes('Human Catcher'))!;
    expect(teammate.compareDocumentPosition(target)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('gates an inbound to the entitled coach and suppresses unrelated commands even in hotseat',()=>{
    const s=applyCommand(nearRestart(),{type:'decline'});
    const inbound=legalActions(s)[0]!;
    expect(decisionCoach(s)).toBe('A');
    expect(humanCanCommand(s,'solo',inbound)).toBe(true);
    expect(humanCanCommand(s,'hotseat',end)).toBe(false);
    expect(humanCanCommand(s,'solo',run('A1',3,3))).toBe(false);
    expect(humanCanCommand(s,'hotseat',{...inbound,playerId:'A1'} as Command)).toBe(false);
  });

  it('displays an away inbound but leaves its selection and execution to the solo AI',async()=>{
    vi.useFakeTimers();
    let s=createMatch(config,5);
    for(let i=0;i<31;i++)s=applyCommand(s,chooseAiCommand(s));
    expect(s.throwIn?.team).toBe('B');
    writeSession(localStorage,s,'solo');
    await boot();
    expect(document.querySelector('.ball-status')?.textContent).toContain('Team B throw-in');
    expect(document.querySelector('.live-pill')?.textContent).toBe('AI THINKING');
    expect(document.querySelectorAll('.inbound-target').length).toBeGreaterThan(0);
    expect(commandElements(document,'throwIn')).toHaveLength(0);
    expect(humanCanCommand(s,'solo',legalActions(s)[0]!)).toBe(false);
    await vi.advanceTimersByTimeAsync(90);
    expect(readSession(localStorage)?.state.commands.at(-1)).toEqual(chooseAiCommand(s));
  });

  it('selects a prone ball carrier when their team regains its turn',async()=>{
    const record=[run('A1',4,4),{type:'endActivation',playerId:'A1'} as const,run('A0',3,6),end,run('B1',3,10),end,
      run('A0',3,9),run('A0',3,8),{type:'decline'} as const].reduce(applyCommand,createMatch(config,2));
    expect(player(record,'A0').status).toBe('prone');
    expect(record.ball.carrier).toBe('A0');
    expect(record.current).toBe('B');
    writeSession(localStorage,record,'hotseat');
    await boot();
    hit(commandElement(document,end));
    expect(document.querySelector('.roster-chip.picked')?.getAttribute('data-player')).toBe('A0');
    const pass=commandElement(document,{type:'pass',playerId:'A0',targetId:'A1'});
    expect(pass.textContent).toMatch(/Pass from floor/);
    hit(pass);
    expect(readSession(localStorage)?.state.commands.at(-1)).toEqual({type:'pass',playerId:'A0',targetId:'A1'});
  });

  it('loads legacy files as records without replacing the current v3 session',async()=>{
    const live=createMatch(config,5);
    writeSession(localStorage,live,'hotseat');
    await boot();
    const record=applyCommand(createMatch(legacy,9),end);
    const file=new File([serializeReplay(record)],'old-replay.json',{type:'application/json'});
    const input=document.querySelector('#replay-file')!;
    Object.defineProperty(input,'files',{value:[file]});
    input.dispatchEvent(new Event('change',{bubbles:true}));
    await vi.waitFor(()=>expect(document.querySelector('.replay-bar')?.textContent).toContain('LEGACY REPLAY'));
    expect(commandElements(document.querySelector('.court')!)).toHaveLength(0);
    expect(readSession(localStorage)?.state).toEqual(live);
    clickUi('exitReplay');
    expect(document.querySelector('.replay-bar')).toBeNull();
    expect(document.querySelector('.stats')?.textContent).toContain('4MA');
  });

  it('prints the displayed legacy replay court using current rules instead of the hidden live court',async()=>{
    const live=createMatch(config,5);
    const record=applyCommand(createMatch({...legacy,court:'classic'},9),end);
    writeSession(localStorage,live,'hotseat');
    localStorage.setItem(oldKey,encodeSession(record,'hotseat'));
    await boot();
    expect(document.querySelectorAll('.arena .court .cell')).toHaveLength(144);
    clickUi('legacyReplay');
    expect(document.querySelector('.replay-bar')?.textContent).toContain('LEGACY REPLAY');
    expect(document.querySelectorAll('.arena .court .cell')).toHaveLength(390);
    clickUi('print');
    expect.soft(document.querySelector('.modal[aria-labelledby="print-title"]')?.textContent).toContain('15 × 26 court');
    expect.soft(document.querySelectorAll('#print-kit .court .cell')).toHaveLength(390);
    expect.soft(document.querySelector('#print-kit')?.textContent).toContain('15 × 26 COURT · POSSESSION RULES');
    expect.soft(document.querySelector('#print-kit .reference-page')?.textContent).toContain('3 forward steps in the activation and within 3 of the rim');
    expect(readSession(localStorage)?.state).toEqual(live);
  });

  it('prints v3 rules and effective movement with the original pitch credit and roster strengths',()=>{
    const kit=tabletopKit('arcade','possession');
    expect(kit).toMatch(/Possession rules/i);
    expect(kit).toContain('MA <b>4</b>');
    expect(kit).toMatch(/D8/);
    expect(kit).toMatch(/throw-in/i);
    expect(kit).toContain('+1 if the carrier is stronger than the swatter');
    expect(kit).not.toMatch(/Blocks &amp; injury|GFI|AV 8\+/);
    expect(kit).toContain('James Peckham &amp; Robert Peckham');
    expect(kit).toContain('Gorilla Flip');
    expect(kit).toContain('Halfling');
  });
});
