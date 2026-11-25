import { ROSTERS, courtSize, inBounds, shotPoints, distance, legalActions, rim, isPossessionGame, movementRemaining, same, type Command, type GameEvent, type MatchState, type Player } from '../../packages/core/src/index.js';
import { movementPaths, pathTo } from '../../packages/core/src/paths.js';
import { restartFor } from './control.js';

export const escape=(value:unknown):string=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const xy=(p:{x:number;y:number})=>({x:p.y*40+20,y:p.x*40+20});
const coords=(p:{x:number;y:number})=>`${p.y+1}, ${p.x+1}`;
const ballCalls=new Set(['swat','bat','strip','intercept','fall','recover','throwIn','inbound']);
const playCalls=new Set(['score','turnover','fire','shatter','crowd','final','dunk']);
export const isBallCall=(e:GameEvent)=>ballCalls.has(e.kind)||(e.kind==='roll'&&e.text.startsWith('Swat ('));
export function latestPlayCall(events:GameEvent[]):GameEvent|undefined {
  for(let i=events.length-1;i>=0;i--){
    const event=events[i]!;
    if(playCalls.has(event.kind)||isBallCall(event))return event;
  }
  return undefined;
}
export const possessionSkills=(skills:string[])=>skills.filter(skill=>['Catch','Dodge','Prehensile Tail','Throw Team-Mate','Right Stuff','Stunty'].includes(skill));

export function ballStatus(s:MatchState):string {
  if(!isPossessionGame(s))return '';
  const touch=s.players.find(p=>p.id===s.ball.lastTouch), carrier=s.players.find(p=>p.id===s.ball.carrier);
  const restart=restartFor(s);
  return `<div class="ball-status"><b>${restart?`Team ${restart.team} throw-in`:carrier?`${escape(carrier.name)} holds the ball`:`Loose ball at ${coords(s.ball.pos)}`}</b>${touch?`<span>Last touch · ${escape(touch.name)} (Team ${touch.team})</span>`:''}</div>`;
}

export function commandLabel(c:Command,s:MatchState,pathCost?:number):string {
  const name=(id:string)=>s.players.find(p=>p.id===id)?.name??id;
  const possession=isPossessionGame(s);
  const prone=(id:string)=>possession&&s.players.find(p=>p.id===id)?.status==='prone';
  switch(c.type) {
    case 'run': {
      const cost=possession?(pathCost??pathTo(s,c.playerId,c.to).length):null;
      return `Run to ${coords(c.to)} · ${cost===null?'checks resolve along the path':`${cost} square${cost===1?'':'s'}`}`;
    }
    case 'move':return `Move to ${coords(c.to)}${possession?' · 1 square':''}`;
    case 'stand':return `Stand up · ${possession?1:3} movement`;
    case 'shoot':return 'Shoot';
    case 'steal':return `Steal from ${name(c.targetId!)}`;
    case 'swat':return `Swat ball from ${name(c.targetId)}`;
    case 'recover':return `Recover ball${prone(c.playerId)?' · +1 difficulty':''}`;
    case 'throwIn': {
      const teammate=s.players.find(p=>!p.offCourt&&same(p.pos,c.to));
      return `Throw in to ${teammate?`${teammate.name} at `:''}${coords(c.to)}`;
    }
    case 'pass':return prone(c.playerId)?`Pass from floor to ${name(c.targetId)} · +1 difficulty`:`Pass to ${name(c.targetId)}`;
    case 'block':return `${c.blitz?'Blitz':'Block'} ${name(c.targetId)}`;
    case 'dunk':return s.config.court==='arcade'?'Half-court sky jam':'Slam dunk';
    case 'ladder':return 'Goblin ladder';
    case 'formLadder':return 'Form defensive ladder';
    case 'alleyOop':return `Alley-oop to ${name(c.targetId)}`;
    case 'throwTeamMate':return `${name(c.targetId).includes('Halfling')?'Halfling cannon':'Goblin cannon'} · through the hoop`;
    case 'endTurn':return 'End team turn';
    case 'endActivation':return 'Finish player';
    case 'decline':return 'Accept the result';
    case 'reroll':return c.source==='skill'?'Free skill reroll':'Use team reroll';
    case 'chooseBlock':return s.pending?.type==='block'?s.pending.dice[c.index]??'Choose die':'Choose die';
    case 'brawler':return `Brawler · reroll die ${c.index+1}`;
    case 'push':return !inBounds(c.to,s)?'Into the bleachers!':`Push to ${coords(c.to)}`;
    case 'follow':return c.yes?'Follow up':'Stay put';
  }
}
export function actionButton(c:Command,s:MatchState,extra='',disabled=false):string {
  return `<button class="action ${extra}" data-command="${escape(JSON.stringify(c))}" ${disabled?'disabled':''}>${escape(commandLabel(c,s))}</button>`;
}
export const jersey=(p:Player):string=>{
  const big=p.st>=4,goblin=p.skills.includes('Stunty'),rat=p.name.includes('Rat')||p.name.includes('Gutter');
  return `<g class="miniature" transform="translate(0,-3)">
    ${goblin?'<path d="M-7 -8L-18 -17L-11 -2M7 -8L18 -17L11 -2" fill="#99c56b"/>':rat?'<path d="M-7 -8L-12 -19L-1 -14M7 -8L12 -19L1 -14" fill="#c8a582"/>':''}
    <path d="M-7 6L-10 17M7 6L10 17" stroke="#222b2d" stroke-width="6"/>
    <path d="M-8 -3L-16 5M8 -3L16 5" stroke="${p.team==='A'?'#83e4d3':'#ffb677'}" stroke-width="${big?8:6}"/>
    <path d="M-9 -6L9 -6L${big?13:10} 10L-${big?13:10} 10Z" fill="${p.team==='A'?'#207f76':'#a74c29'}" stroke="#fff4d5" stroke-width="1.5"/>
    <circle cy="-11" r="${big?9:7}" fill="${goblin?'#99c56b':p.team==='B'?'#c49b6c':'#d8c2a6'}"/>
    <path d="M-8 -15Q0 -24 8 -15L7 -10L-7 -10Z" fill="${p.team==='A'?'#215a56':'#713e29'}"/>
    <text y="7" text-anchor="middle" font-size="9" fill="#fff7de" font-weight="900">${Number(p.id.slice(1))+1}</text></g>`;
};
export function courtSvg(s:MatchState,selected:string|null,interactive=true,prefix='arena'):string {
  const geometry=courtSize(s),W=geometry.length*40,H=geometry.width*40,cy=geometry.center*40+20,depth=geometry.paintDepth*40,paintY=geometry.paintLeft*40,paintH=(geometry.paintRight-geometry.paintLeft+1)*40,arc=geometry.arc*40;
  const possession=isPossessionGame(s),restart=restartFor(s);
  const paths=interactive&&!restart&&!s.pending&&selected?movementPaths(s,selected):[];
  const pushes=interactive&&s.pending?legalActions(s).filter(c=>c.type==='push'):[];
  const commandAttrs=(command:Command,label:string)=>`data-command="${escape(JSON.stringify(command))}" role="button" tabindex="0" aria-label="${escape(label)}"`;
  const cells=[];
  for(let x=0;x<geometry.width;x++) for(let y=0;y<geometry.length;y++) {
    const pos={x,y};
    const path=paths.find(path=>same(path.at(-1)!,pos));
    const command:Command|undefined=path?{type:'run',playerId:selected!,to:pos}:pushes.find(c=>same(c.to,pos));
    const label=command?commandLabel(command,s,path?.length):'';
    cells.push(`<rect x="${y*40}" y="${x*40}" width="40" height="40" class="cell ${command?'legal':''}" ${command?commandAttrs(command,label):''}>${label?`<title>${escape(label)}</title>`:''}</rect>${possession&&path?`<text class="path-cost" aria-hidden="true" x="${y*40+30}" y="${x*40+13}" text-anchor="middle">${path.length}</text>`:''}`);
  }
  const token=s.players.filter(p=>!p.offCourt&&['standing','prone','stunned'].includes(p.status)).map(p=>{
    const at=xy(p.pos),isSelected=p.id===(restart?.throwerId??selected),thrower=p.id===restart?.throwerId;
    return `<g transform="translate(${at.x},${at.y})" class="token team-${p.team} ${p.used&&!thrower?'spent':''} ${isSelected?'selected':''} ${thrower?'thrower':''} ${p.fire?'on-fire':''}" ${interactive&&!restart?`data-player="${p.id}" role="button" tabindex="0" aria-label="${escape(`${p.name}, team ${p.team}, ${p.status}${s.ball.carrier===p.id?', ball carrier':''}${p.fire?', on fire':''}`)}"`:''}>
      <ellipse class="shadow" cy="15" rx="18" ry="7"/>
      ${p.fire?'<path class="flame" d="M-18 12Q-26 -8 -10 -27L-8 -13Q5 -35 13 -30Q9 -14 20 -5L18 13Z"/>':''}
      <circle r="23" class="selection"/>
      ${p.status==='standing'?jersey(p):`<g transform="rotate(85)">${jersey(p)}</g><text x="13" y="-10" class="stun">${p.status==='stunned'?'Zz':'↓'}</text>`}
      ${s.ball.carrier===p.id?'<g transform="translate(18,9)"><circle r="8" fill="#ff973e" stroke="#2a261f" stroke-width="2"/><path d="M-8 0H8M0 -8Q-5 0 0 8" stroke="#6c381f" fill="none" stroke-width="1.3"/></g>':''}
      ${p.used?'<circle cx="17" cy="-16" r="5" fill="#253539"/><path d="M14 -16L16 -14L20 -19" stroke="#b2c7c5" fill="none" stroke-width="2"/>':''}
      ${s.ladders.some(ids=>ids.includes(p.id))?'<text x="-23" y="-14" fill="#e4ffc2" font-size="15">▤</text>':''}
      <title>${escape(p.name)} · MA ${p.ma} ST ${p.st} AG ${p.ag}+${thrower?' · Throw-in':''}</title>
    </g>`;
  }).join('');
  // Inbound targets overlay the tokens so a standing teammate's square receives the click.
  const inbounds=restart?legalActions(s).filter(c=>c.type==='throwIn').map(command=>{
    const label=commandLabel(command,s);
    return `<rect x="${command.to.y*40+1}" y="${command.to.x*40+1}" width="38" height="38" rx="3" class="inbound-target${interactive?' available':''}" ${interactive?commandAttrs(command,label):''}><title>${escape(label)}</title></rect>`;
  }).join(''):'';
  const loose=!s.ball.carrier?xy(s.ball.pos):null;
  const glass=s.glass.map(side=>{const at=xy(rim(side,s.half,s));return `<g class="glass"><rect x="${at.x<W/2?0:W-depth}" y="${paintY}" width="${depth}" height="${paintH}" fill="url(#${prefix}-shards)"/><text x="${at.x<W/2?depth/2:W-depth/2}" y="${paintY+22}" text-anchor="middle">BROKEN GLASS${possession?'':' +1'}</text></g>`;}).join('');
  return `<svg class="court" viewBox="-32 -36 ${W+64} ${H+72}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="${geometry.width} by ${geometry.length} square hardwood basketball court">
  <defs><pattern id="${prefix}-wood" width="160" height="40" patternUnits="userSpaceOnUse"><rect width="160" height="40" fill="#bd8954"/><path d="M0 0H160M0 39H160M80 0V40" stroke="#986e47"/><path d="M3 12Q40 7 79 13M85 29Q118 26 156 31" stroke="#d1a26d" opacity=".5" fill="none"/></pattern>
  <pattern id="${prefix}-shards" width="49" height="43" patternUnits="userSpaceOnUse"><path d="M3 2L24 10L10 21ZM35 25L45 33L30 40Z" fill="#c4faff" stroke="#4c929b"/></pattern></defs>
  <rect class="court-surround" x="-32" y="-36" width="${W+64}" height="${H+72}" rx="5"/>
  <text class="sideline-label" x="${W/2}" y="-15" text-anchor="middle">${possession?'PLAY THE BALL. OWN THE COURT.':'NO FOULS. ONLY TURNOVERS.'}</text>
  <text class="sideline-label" x="${W/2}" y="${H+24}" text-anchor="middle">HARDWOOD CARNAGE · ${s.config.court==='arcade'?'TURBO COURT':'CLASSIC'}</text>
  <rect width="${W}" height="${H}" fill="url(#${prefix}-wood)"/>
  <path d="M0 ${paintY}H${depth}V${paintY+paintH}H0M${W} ${paintY}H${W-depth}V${paintY+paintH}H${W}" fill="#296b66" fill-opacity=".65" stroke="#fff1cc" stroke-width="3"/>
  <g fill="none" stroke="#fff1cc" stroke-width="3" opacity=".9"><rect x="2" y="2" width="${W-4}" height="${H-4}"/>
  <path d="M${W/2} 0V${H}M60 ${cy-arc}A${arc} ${arc} 0 0 1 60 ${cy+arc}M${W-60} ${cy-arc}A${arc} ${arc} 0 0 0 ${W-60} ${cy+arc}"/>
  <circle cx="${W/2}" cy="${cy}" r="${Math.min(76,H*.15)}"/><circle cx="${depth}" cy="${cy}" r="${paintH*.32}"/><circle cx="${W-depth}" cy="${cy}" r="${paintH*.32}"/></g>
  <g class="center-mark" transform="translate(${W/2},${cy}) rotate(-12)"><text text-anchor="middle" y="-3">HARDWOOD</text><text text-anchor="middle" y="27">CARNAGE</text></g>
  ${glass}<g class="grid">${cells.join('')}</g>
  <g class="baskets"><path d="M42 ${cy-38}V${cy+38}M${W-42} ${cy-38}V${cy+38}" stroke="#e6eff0" stroke-width="9"/><circle cx="60" cy="${cy}" r="16"/><circle cx="${W-60}" cy="${cy}" r="16"/></g>
  ${token}${loose?`<g transform="translate(${loose.x},${loose.y})" class="loose-ball"><circle r="10" fill="#ff973e" stroke="#4d331e" stroke-width="2"/><path d="M-10 0H10M0 -10V10" stroke="#4d331e"/><title>${restart?'Ball at throw-in spot':'Loose ball'}</title></g>`:''}
  ${inbounds?`<g class="inbound-targets" role="group" aria-label="Throw-in destinations">${inbounds}</g>`:''}</svg>`;
}
function signaturePanel(s:MatchState,p:Player,spins:number,readOnly:boolean):string {
  if(readOnly||p.team!==s.current||p.used||(isPossessionGame(s)&&p.status!=='standing'))return '';
  const acts=legalActions(s),geometry=courtSize(s);
  const cannon=acts.find(c=>c.type==='throwTeamMate'&&c.spins===spins&&(c.playerId===p.id||c.targetId===p.id));
  const big=s.players.find(q=>q.team===p.team&&q.skills.includes('Throw Team-Mate'));
  const small=s.players.find(q=>q.team===p.team&&q.skills.includes('Right Stuff')&&!q.skills.includes('Stunty'));
  const slam=acts.find(c=>c.type==='dunk'&&c.playerId===p.id&&c.spins===spins);
  return `<section class="signature-play"><span class="eyebrow">SIGNATURE PLAYS</span>${big&&small?`<h3>Halfling cannon</h3><p>Ogre + ball-carrying Halfling. Stay adjacent, then launch them through the hoop from up to ${geometry.throwRange} squares away.</p>${cannon?actionButton(cannon,s,'signature'): '<span class="setup-tip">Give the Halfling the ball and get the Ogre alongside. Finish another active player first.</span>'}`:''}
  ${s.ball.carrier===p.id?`<h3>${s.config.court==='arcade'?'Half-court sky jam':'Spin dunk'}</h3>${slam?actionButton(slam,s,'signature'):`<p>Take ${Math.max(0,geometry.runUp-p.forward)} more forward steps; launch within ${geometry.dunkRange} of the rim. ${s.config.court==='arcade'?'Yes, you can fly from the center line.':''}</p>`}`:''}</section>`;
}
export function selectedPanel(s:MatchState,id:string|null,spins:number,readOnly:boolean):string {
  const restart=restartFor(s);
  if(restart) {
    const thrower=s.players.find(p=>p.id===restart.throwerId)!;
    return `<section class="decision"><span class="eyebrow">THROW-IN · COACH ${restart.team}</span><h2>${escape(thrower.name)} to inbound</h2><p>${readOnly?'Only the designated thrower can restart play.':'Choose a highlighted square within 3 to find a standing teammate or put the ball on the floor. Throwing in uses this player’s activation.'}</p></section>`;
  }
  const p=s.players.find(p=>p.id===id);
  if(!p) return '<p class="muted">Select a player on the court.</p>';
  const possession=isPossessionGame(s),options=!readOnly?legalActions(s,p.id):[];
  const acts=options.filter(c=>'playerId'in c&&c.playerId===p.id&&c.type!=='move'&&c.type!=='endActivation'&&c.type!=='dunk'&&c.type!=='throwTeamMate'&&c.type!=='run'&&(!('spins'in c)||c.spins===spins));
  const goal=rim(p.team,s.half,s),three=shotPoints(p.pos,goal,s)===3,geometry=courtSize(s);
  const movement=options.filter((c):c is Extract<Command,{type:'move'}>=>c.type==='move');
  const movePad=movement.length?`<div class="move-pad" aria-label="Directional movement">${movement.map(c=>{
    const dx=c.to.y-p.pos.y,dy=c.to.x-p.pos.x,label=`${dy<0?'N':dy>0?'S':''}${dx<0?'W':dx>0?'E':''}`;
    return `<button style="grid-column:${dx+2};grid-row:${dy+2}" data-command="${escape(JSON.stringify(c))}" aria-label="${escape(commandLabel(c,s))}">${label}</button>`;
  }).join('')}<span>MOVE</span></div>`:'';
  return `<div class="player-heading"><span class="jersey-badge team-${p.team}">${Number(p.id.slice(1))+1}</span><div><span class="eyebrow">${p.fire?'ON FIRE':p.status.toUpperCase()} ${p.used?'· ACTIVATED':''}</span><h2>${escape(p.name)}</h2></div></div>
    <div class="stats">${possession?`<span><b>${p.ma}</b>MA</span><span><b>${movementRemaining(s,p)}</b>LEFT</span>`:`<span><b>${Math.max(0,p.ma-p.moved)}</b>MOVE</span>`}<span><b>${p.st}</b>STRENGTH</span><span><b>${p.ag}+</b>AGILITY</span>${possession?'':`<span><b>${p.armor}+</b>ARMOR</span>`}</div>
    <div class="skills">${(possession?possessionSkills(p.skills):p.skills).map(skill=>`<span>${escape(skill)}</span>`).join('')||'<span>All-rounder</span>'}</div>
    ${!readOnly&&p.team===s.current&&!p.used?`<p class="move-hint">${possession?(p.status==='prone'?'On the floor. Stand for 1 movement, or pass/recover from here if available.':movement.length?'Lit squares show the full path cost. Diagonal steps also cost 1.':movementRemaining(s,p)===0?'Movement spent for this team turn.':'Finish the active player before moving another.'):`${s.ball.carrier===p.id?`${three?'3-point':'2-point'} range · `:''}${p.forward}/${geometry.runUp} forward steps for a dunk. ${p.fire?'Unlimited GFI.':p.moved>=p.ma?'GFI movement needs 2+.':'Tap any lit square to run there.'}`}</p>`:''}
    ${signaturePanel(s,p,spins,readOnly)}${movePad}${!readOnly&&p.team===s.current&&!p.used&&p.status==='standing'?`<label class="spin-label" for="spins">DUNK STYLE <select id="spins"><option value="0" ${spins===0?'selected':''}>Straight slam</option><option value="1" ${spins===1?'selected':''}>360° · 1 spin check</option><option value="2" ${spins===2?'selected':''}>720° · 2 spin checks</option><option value="3" ${spins===3?'selected':''}>Gorilla Flip · 3 spin checks</option></select></label>`:''}
    ${readOnly?'':`<div class="actions">${acts.map(c=>actionButton(c,s,c.type==='shoot'?'primary':'')).join('')||`<p class="muted">${movement.length?'Move using the lit court squares, then finish this player.':'Select an available teammate or end the turn.'}</p>`}</div>`}`;
}
export function pendingPanel(s:MatchState,canAct:(c:Command)=>boolean=()=>true,waitForAttacker=false):string {
  const b=s.pending;if(!b)return '';
  let title='',sub='';
  if(b.type==='check') {title=`${b.check.label} failed`;sub=`Rolled ${b.roll} · needed ${b.check.target}+. Choose a reroll or accept the result.`;}
  if(b.type==='block') {title=`Coach ${b.chooser}: choose a die`;sub='Higher strength chooses the result. A team reroll belongs to the attacking coach.';}
  if(b.type==='push') {title='Choose the shove';sub='Tap a highlighted destination or send them into the bleachers.';}
  if(b.type==='follow') {title='Follow up?';sub='Move into the vacated square or hold your position.';}
  return `<section class="decision" aria-live="polite"><span class="eyebrow">DICE DECISION</span><h2>${escape(title)}</h2><p>${escape(sub)}</p>${waitForAttacker?'<p>Your reroll decision comes first. Keep these dice to hand the choice to the AI.</p>':''}<div class="actions">${legalActions(s).map(c=>actionButton(c,s,c.type==='chooseBlock'?'die':'',!canAct(c))).join('')}${waitForAttacker?'<button class="primary" data-ui="keepDice">Keep dice · let AI choose</button>':''}</div></section>`;
}
export const factionOptions=(selected:string)=>Object.keys(ROSTERS).map(name=>`<option ${name===selected?'selected':''}>${escape(name)}</option>`).join('');
