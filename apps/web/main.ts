import './style.css';
import { createMatch, applyCommand, chooseAiCommand, legalActions, replayMatch, serializeReplay, type MatchState, type Command, type Replay, courtSize, type MatchConfig, type RosterName, type Side } from '../../packages/core/src/index.js';
import { actionButton, courtSvg, escape, factionOptions, pendingPanel, selectedPanel } from './render.js';
import { playEvents, unlockAudio } from './effects.js';
import { readSession, writeSession, type Mode } from './session.js';
import { tabletopKit } from './tabletop.js';
import { decisionCoach, humanCanCommand, awaitingAttacker } from './control.js';

const root=document.querySelector<HTMLDivElement>('#app')!;
let saved:ReturnType<typeof readSession>=null;
try {saved=readSession(localStorage);} catch {/* Privacy settings can disable all storage access. */}
let state=saved?.state??createMatch({teamA:'Grak & Crumbleberry',teamB:'Gouged Eye',court:'arcade'},1);
let mode:Mode=saved?.mode??'solo',selected:string|null=state.ball.carrier,spins=1;
let modal:'setup'|'help'|'print'|null=saved&&state.config.court==='arcade'?null:'setup';
let setupCourt:'arcade'|'classic'='arcade';
let setupA:RosterName=state.config.court==='arcade'?state.config.teamA:'Grak & Crumbleberry',setupB:RosterName=state.config.teamB,setupMode:Mode=mode,setupSeed=String(state.seed);
let aiDelay=90;
let sound=false,paused=false,error='',saveOk=true,blockReleased=false,aiTimer:ReturnType<typeof setTimeout>|undefined;
let theater:{replay:Replay;index:number;state:MatchState}|null=null;
const shown=()=>theater?.state??state;
function aiControls(s:MatchState):boolean {return mode==='demo'||(mode==='solo'&&decisionCoach(s)==='B');}
function persist():void {try {saveOk=writeSession(localStorage,state,mode);} catch {saveOk=false;}}
function dispatch(command:Command,automated=false):void {
  if(theater||modal||(!automated&&!humanCanCommand(state,mode,command))) return;
  try {
    const before=state.events.length,side=state.current,visualState=state;
    state=applyCommand(state,command);
    if(state.config.court==='arcade'&&!state.pending&&!state.over&&!state.active&&!state.players.some(p=>p.team===state.current&&!p.offCourt&&!p.used&&(p.status==='standing'||p.status==='prone')))state=applyCommand(state,{type:'endTurn'});
    aiDelay=state.events.slice(before).some(e=>e.kind==='dunk')?900:90;
    error='';blockReleased=false;persist();
    if(side!==state.current || !selected || state.players.find(p=>p.id===selected)?.used) selected=state.active??state.players.find(p=>p.team===state.current&&!p.used&&p.status==='standing')?.id??null;
    render();playEvents(state.events.slice(before),sound,visualState);
  } catch(e) {error=e instanceof Error?e.message:'Action failed';render();}
}
function scheduleAi():void {
  clearTimeout(aiTimer);
  if(!modal&&!theater&&!paused&&!state.over&&aiControls(state)&&!awaitingAttacker(state,mode,blockReleased)) aiTimer=setTimeout(()=>{
    try {dispatch(chooseAiCommand(state),true);} catch(e) {paused=true;error=`Coach stopped: ${e instanceof Error?e.message:'unknown error'}`;render();}
  },aiDelay);
}
function roster(s:MatchState,side:Side):string {
  return s.players.filter(p=>p.team===side).map(p=>`<button class="roster-chip team-${side} ${selected===p.id?'picked':''} ${p.used?'used':''}" data-player="${p.id}" title="${escape(p.name)}"><b>${Number(p.id.slice(1))+1}</b><span>${escape(p.name)}<small>${p.fire?'ON FIRE':p.status==='standing'?p.used?'DONE':'READY':p.status.toUpperCase()}</small></span>${s.ball.carrier===p.id?'<i class="ball-dot" aria-label="Ball carrier"></i>':''}</button>`).join('');
}
function render():void {
  const previous=document.activeElement as HTMLElement|null;
  const key=previous?.dataset.command?['command',previous.dataset.command]:previous?.dataset.player?['player',previous.dataset.player]:previous?.dataset.ui?['ui',previous.dataset.ui]:previous?.id?['id',previous.id]:null;
  const s=shown(),a=s.teams[0]!,b=s.teams[1]!,isAI=aiControls(s),turns=courtSize(s).turnsPerHalf,turnNo=Math.min(turns,Math.floor((s.turn%(turns*2))/2)+1);
  const lastCall=[...s.events].reverse().find(e=>['score','turnover','fire','shatter','crowd','final','dunk'].includes(e.kind));
  root.innerHTML=`<main class="game-app"><div class="game-content" ${modal?'inert':''}><header class="masthead"><a class="brand" href="./" aria-label="Hardwood Carnage home"><span class="brand-mark">HC<span>✦</span></span><span>HARDWOOD <b>CARNAGE</b><small>ARCADE FANTASY BASKETBALL</small></span></a><nav aria-label="Game menu"><span class="save-status">${saveOk?'LOCAL AUTOSAVE':'AUTOSAVE UNAVAILABLE'}</span><button data-ui="sound" aria-pressed="${sound}">SOUND ${sound?'ON':'OFF'}</button><button data-ui="help">How to play</button><button class="outline" data-ui="setup">New match</button></nav></header>
  <section class="scoreboard" aria-label="Scoreboard"><div class="team-score team-A"><span class="team-emblem">${a.name==='Goblin Swarm'?'V':'R'}</span><div><span class="eyebrow">HOME · COACH A</span><h1>${escape(a.name)}</h1><small>${s.possession==='A'?'● POSSESSION':s.current==='A'?'DEFENDING':'AWAITING TURN'}</small></div><strong data-testid="score-a">${String(a.score).padStart(2,'0')}</strong></div>
  <div class="game-clock"><span>HALF ${s.half} / 2</span><b>${s.over?'FINAL':`TURN ${turnNo}`}</b><span>${s.over?(a.score===b.score?'TIE GAME':`${a.score>b.score?'HOME':'AWAY'} WINS`):`OF ${turns} PER TEAM`}</span></div>
  <div class="team-score team-B"><strong data-testid="score-b">${String(b.score).padStart(2,'0')}</strong><div><span class="eyebrow">AWAY · ${mode==='hotseat'?'COACH B':'AI COACH'}</span><h1>${escape(b.name)}</h1><small>${s.possession==='B'?'● POSSESSION':s.current==='B'?'DEFENDING':'AWAITING TURN'}</small></div><span class="team-emblem">${b.name==='Goblin Swarm'?'V':'G'}</span></div></section>
  <div class="game-layout"><section class="arena-column"><div class="arena-topline"><span class="live-pill">${theater?'REPLAY':s.over?'FULL TIME':paused?'PAUSED':isAI?'AI THINKING':'YOUR COURT'}</span><span>${s.over?'THE CROWD WANTS A REMATCH':`COACH ${s.current} · ${escape((s.current==='A'?a:b).name.toUpperCase())}`}</span><button class="quick-end" data-command="${escape(JSON.stringify({type:'endTurn'}))}" ${s.pending||isAI||s.over||theater?'disabled':''}>End turn <kbd>E</kbd></button><span class="shot-clock">SHOT CLOCK <b>${s.shotClock}</b></span></div>
  <div class="arena"><div class="bleachers top-bleachers" aria-hidden="true"></div>${courtSvg(s,selected,!theater&&!modal&&!isAI)}<div id="effects" aria-hidden="true"></div><div class="bleachers bottom-bleachers" aria-hidden="true"></div></div>
  <div class="announcer" aria-live="polite"><span>COURTSIDE</span><b>${escape(lastCall?.text??'THE REFS ARE BRIBED. THE COURT IS YOURS.')}</b></div>
  <div class="teams-strip"><section><div class="strip-title"><b class="team-A">HOME ROSTER</b><span>REROLLS ${'◆'.repeat(a.rerolls)}${'◇'.repeat(3-a.rerolls)}</span></div><div class="roster-row">${roster(s,'A')}</div></section><section><div class="strip-title"><b class="team-B">AWAY ROSTER</b><span>REROLLS ${'◆'.repeat(b.rerolls)}${'◇'.repeat(3-b.rerolls)}</span></div><div class="roster-row">${roster(s,'B')}</div></section></div>
  <div class="hype-row"><span>CROWD HYPE</span><div class="hype-meter" role="meter" aria-label="Crowd hype" aria-valuenow="${s.hype}" aria-valuemin="0" aria-valuemax="100"><i style="width:${s.hype}%"></i></div><b>${s.hype}%</b></div>
  ${theater?`<section class="replay-bar"><label for="timeline">REPLAY · COMMAND ${theater.index} / ${theater.replay.commands.length}</label><input id="timeline" type="range" min="0" max="${theater.replay.commands.length}" value="${theater.index}"><button data-ui="exitReplay">Back to match</button></section>`:''}
  </section><aside class="coach-box"><div class="box-heading"><span class="eyebrow">TACTICAL PLAYBOOK</span><h2>Coach’s box<span>✦</span></h2></div>
  ${s.over?`<section class="final-card"><span class="eyebrow">FINAL BUZZER</span><h2>${a.score===b.score?'HONORS EVEN':escape((a.score>b.score?a:b).name.toUpperCase())+' WIN'}</h2><p>${a.score} – ${b.score} · ${s.turn} team turns</p><button class="primary" data-ui="rematch">Run it back</button><button data-ui="theater">Watch replay</button></section>`:s.pending&&!theater?pendingPanel(s,c=>humanCanCommand(s,mode,c),awaitingAttacker(s,mode,blockReleased)):selectedPanel(s,selected,spins,!!theater||isAI)}
  ${!s.over&&!theater?`<div class="turn-controls">${s.active&&!s.pending?actionButton({type:'endActivation',playerId:s.active},s):''}<button class="end-turn" data-command="${escape(JSON.stringify({type:'endTurn'}))}" ${s.pending||isAI?'disabled':''}>End team turn <kbd>E</kbd></button></div>`:''}
  <div class="log-heading"><span class="eyebrow">PLAY-BY-PLAY</span><span>${s.events.length} EVENTS</span></div><ol class="event-log" aria-label="Recent game events">${s.events.slice(-8).reverse().map(e=>`<li class="event-${e.kind}"><span>${String(e.id+1).padStart(3,'0')}</span>${escape(e.text)}</li>`).join('')}</ol></aside></div>
  <footer class="game-footer"><span>NO FOULS. ONLY TURNOVERS.</span><div><button data-ui="pause">${paused?'Resume AI':'Pause AI'}</button><button data-ui="export">Save replay</button><button data-ui="import">Load replay</button><button data-ui="theater">Replay theater</button><button data-ui="print">Tabletop kit</button></div><small>James &amp; Robert Peckham · Original pitch, 2022</small></footer>
  <input id="replay-file" type="file" accept="application/json,.json" hidden>
  </div>${error?`<div class="error-toast" role="alert">${escape(error)}<button data-ui="dismiss">Dismiss</button></div>`:''}
  ${modal?modalHtml():''}</main><div id="print-kit">${modal==='print'?tabletopKit(state.config.court??'classic'):''}</div>`;
  if(key && previous && root.contains(previous)===false) {
    const candidates=[...root.querySelectorAll<HTMLElement>(key[0]==='id'?'[id]':'[data-'+key[0]+']')];
    const replacement=candidates.find(el=>key[0]==='id'?el.id===key[1]:el.dataset[key[0]!]===key[1]);
    (replacement??(!modal?root.querySelector<HTMLElement>('.roster-chip.picked'):null))?.focus({preventScroll:true});
  }
  scheduleAi();
}
function modalHtml():string {
  if(modal==='setup') return `<div class="modal-backdrop"><section class="modal setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title"><span class="eyebrow">WELCOME TO THE UNDERCOURT</span><h2 id="setup-title">BIG DUNKS.<br>BAD INTENTIONS.</h2><p>Two stars. Or five Goblins. One very breakable backboard.</p><form id="setup-form"><div class="setup-teams"><label>HOME FACTION<select id="team-a">${factionOptions(setupA)}</select></label><span>VS</span><label>AWAY FACTION<select id="team-b">${factionOptions(setupB)}</select></label></div><label>COURT<select id="court-mode"><option value="arcade" ${setupCourt==='arcade'?'selected':''}>Turbo court · 9 × 16 · half-court dunks</option><option value="classic" ${setupCourt==='classic'?'selected':''}>Classic court · 15 × 26</option></select></label><label>COACHES<select id="mode"><option value="solo" ${setupMode==='solo'?'selected':''}>You vs AI · You coach home</option><option value="hotseat" ${setupMode==='hotseat'?'selected':''}>Local hotseat · Two coaches</option><option value="demo" ${setupMode==='demo'?'selected':''}>AI exhibition · Watch both coaches</option></select></label><label>MATCH SEED<input id="seed" type="number" min="0" max="4294967295" step="1" value="${escape(setupSeed)}" required></label><div class="modal-actions"><button type="submit" class="primary">Hit the hardwood</button><button type="button" data-ui="close">${saved||state.commands.length?'Back to match':'Explore the court'}</button></div><p class="fine-print">Turbo: six turns per team per half. Tap a destination to run. Launch a Halfling on the first play.</p></form></section></div>`;
  if(modal==='print') return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="print-title"><span class="eyebrow">TAKE IT TO THE TABLE</span><h2 id="print-title">PRINT &amp; PLAY</h2><p>Your kit includes a ${courtSize(state).width} × ${courtSize(state).length} hardwood court, every player card, and the compact rules with dunk and injury tables.</p><p>Use landscape A4 or Letter, 100% scale, background graphics on, and turn off browser headers. Choose “Save as PDF” for a digital copy.</p><div class="modal-actions"><button class="primary" data-ui="printNow">Print / Save PDF</button><button data-ui="close">Back to game</button></div></section></div>`;
  return `<div class="modal-backdrop"><section class="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><span class="eyebrow">THE REFS LOOK THE OTHER WAY</span><h2 id="help-title">HOW TO PLAY</h2><div class="help-columns"><section><h3>01 · Work the court</h3><p>Select a ready player, then tap any illuminated destination to run the full path in one click. Move up to MA; diagonal steps count as one. Stand for 3 movement. Finish a player before activating another. Each player gets one activation per team turn.</p><h3>02 · Chase the bucket</h3><p>Carry, pass, or pick up the ball. Shoot for 2 inside the arc and 3 outside it. A D6 must meet your AG target; natural 1 fails and 6 succeeds. Marking defenders make checks harder. Three unanswered baskets by a player put them on fire.</p><h3>03 · Make contact</h3><p>Block an adjacent enemy before moving, or use your team's one Blitz to move and block. Stronger players choose the dice. Push enemies into the crowd. Block prevents Both Down, Dodge prevents Stumbles. KO players can recover at halftime.</p></section><section><h3>04 · Go airborne</h3><p>Take two forward steps in Turbo or three in Classic, launch from half court in Turbo (within 3 in Classic), then dunk. Choose up to three aerial 2+ GFI rolls for spin bonuses. An alley-oop needs that receiver run-up and a passer within 8 of the rim in Turbo (6 in Classic). Three adjacent ready Goblins can form a ladder; an Ogre can throw an adjacent Right Stuff carrier.</p><h3>05 · Push your luck</h3><p>Two GFI movement squares at 2+. A failed dodge/GFI, dropped pass, botched dunk landing, or four-turn shot clock causes a turnover. Use three team rerolls per half, once per turn. Fire grants free unlimited GFI, +2 on threes/dunks and Push immunity. A flaming spin dunk with a big or thrown player can shatter on POW: +1 style point, dangerous glass until halftime.</p><h3>Controls &amp; saves</h3><p><kbd>E</kbd> ends a team turn. <kbd>Space</kbd> finishes a player. Arrow keys move the selected player along the screen; use Tab and Enter for all other controls. Sound is optional. Save/load a replay to move a match between devices; Replay theater lets you inspect each command. The tabletop kit contains full compact rules.</p></section></div><button class="primary" data-ui="close">Back to the court</button></section></div>`;
}
function openModal(value:typeof modal):void {modal=value;error='';render();requestAnimationFrame(()=>root.querySelector<HTMLElement>('.modal select,.modal button')?.focus());}
root.addEventListener('click',event=>{
  const el=(event.target as Element).closest<HTMLElement>('[data-command],[data-player],[data-ui]');if(!el)return;
  if(el.dataset.command) {dispatch(JSON.parse(el.dataset.command) as Command);return;}
  if(el.dataset.player) {selected=el.dataset.player;render();return;}
  switch(el.dataset.ui) {
    case 'setup':setupCourt=state.config.court??'arcade';setupA=state.config.teamA;setupB=state.config.teamB;setupMode=mode;setupSeed=String(Date.now()>>>0);openModal('setup');break;
    case 'help':openModal('help');break;
    case 'print':openModal('print');break;
    case 'printNow':window.print();break;
    case 'close':modal=null;render();break;
    case 'dismiss':error='';render();break;
    case 'keepDice':blockReleased=true;render();break;
    case 'pause':paused=!paused;render();break;
    case 'sound':sound=!sound;if(sound) {try{unlockAudio();}catch{sound=false;error='Audio is unavailable in this browser.';}}else if('speechSynthesis'in window)speechSynthesis.cancel();render();break;
    case 'rematch':theater=null;state=createMatch(state.config,(state.seed+1)>>>0);selected='A0';persist();render();break;
    case 'export': {
      const url=URL.createObjectURL(new Blob([serializeReplay(state)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`hardwood-carnage-${state.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;
    }
    case 'import':root.querySelector<HTMLInputElement>('#replay-file')!.click();break;
    case 'theater': {const replay=JSON.parse(serializeReplay(state)) as Replay;theater={replay,index:0,state:createMatch(replay.config,replay.seed)};render();break;}
    case 'exitReplay':theater=null;render();break;
  }
});
root.addEventListener('submit',event=>{
  if((event.target as Element).id!=='setup-form')return;event.preventDefault();
  try {
    const next=createMatch({teamA:setupA,teamB:setupB,court:setupCourt},Number(setupSeed));
    state=next;mode=setupMode;paused=false;theater=null;modal=null;selected='A0';error='';persist();render();
  } catch(e) {error=e instanceof Error?e.message:'Could not start match';render();}
});
root.addEventListener('change',async event=>{
  const el=event.target as HTMLInputElement|HTMLSelectElement;
  if(el.id==='team-a')setupA=el.value as RosterName;
  if(el.id==='team-b')setupB=el.value as RosterName;
  if(el.id==='court-mode')setupCourt=el.value as 'arcade'|'classic';
  if(el.id==='mode')setupMode=el.value as Mode;
  if(el.id==='seed')setupSeed=el.value;
  if(el.id==='spins'){spins=Number(el.value);render();}
  if(el.id==='timeline'&&theater) {const index=Number(el.value);theater.index=index;theater.state=replayMatch({...theater.replay,commands:theater.replay.commands.slice(0,index)});render();}
  if(el.id==='replay-file') {
    const file=(el as HTMLInputElement).files?.[0];if(!file)return;
    try {if(file.size>2_000_000)throw new Error('Replay file is too large (maximum 2 MB).');const next=replayMatch(JSON.parse(await file.text()));state=next;mode='hotseat';paused=false;theater=null;selected=state.ball.carrier;persist();error='';render();}
    catch(e) {error=`Replay could not be loaded: ${e instanceof Error?e.message:'invalid file'}`;render();}
  }
});
root.addEventListener('input',event=>{const el=event.target as HTMLInputElement;if(el.id==='seed')setupSeed=el.value;});
document.addEventListener('keydown',event=>{
  const target=event.target as HTMLElement;
  if(modal) {
    if(event.key==='Escape') {modal=null;render();}
    if(event.key==='Tab') {const nodes=[...root.querySelectorAll<HTMLElement>('.modal button,.modal select,.modal input')];const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&target===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&target===last){event.preventDefault();first?.focus();}}
    return;
  }
  if(['INPUT','SELECT','TEXTAREA'].includes(target.tagName))return;
  if((event.key==='Enter'||event.key===' ')&&target instanceof SVGElement&&(target.hasAttribute('data-player')||target.hasAttribute('data-command'))) {event.preventDefault();target.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}
  if(theater||aiControls(state))return;
  if(event.key.toLowerCase()==='e'&&!state.pending){event.preventDefault();dispatch({type:'endTurn'});}
  if(event.key===' '&&state.active&&!state.pending&&target.tagName!=='BUTTON'){event.preventDefault();dispatch({type:'endActivation',playerId:state.active});}
  const delta:Record<string,[number,number]>={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]};
  const d=delta[event.key],p=state.players.find(p=>p.id===selected);
  if(d&&p&&!state.pending) {event.preventDefault();const c=legalActions(state,p.id).find(c=>c.type==='move'&&c.to.x===p.pos.x+d[0]&&c.to.y===p.pos.y+d[1]);if(c)dispatch(c);}
});
render();
