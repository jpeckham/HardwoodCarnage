import { courtSize, rim, type GameEvent, type MatchState } from '../../packages/core/src/index.js';
import { isBallCall, jersey, latestPlayCall, xy } from './render.js';
let audio:AudioContext|undefined;
export function unlockAudio():void { audio??=new AudioContext();void audio.resume(); }
export function flightGeometry(s:MatchState,e:GameEvent) {
  const p=s.players.find(p=>p.id===e.playerId);
  if(!p||!e.pos)return null;
  const c=courtSize(s),start=xy(e.pos),end=xy(rim(p.team,s.half,s));
  const path=`M ${start.x} ${start.y} Q ${(start.x+end.x)/2} ${Math.min(start.y,end.y)-Math.min(220,c.width*24)} ${end.x} ${end.y} L ${end.x} ${end.y+32}`;
  return {start,end,path,width:c.length*40+64,height:c.width*40+72,player:p};
}
export function playEvents(events:GameEvent[],enabled:boolean,context:MatchState):void {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const geometry=courtSize(context),width=geometry.length*40+64,height=geometry.width*40+72;
  for(const e of events) {
    if(e.kind==='dunk' && e.pos && !reduced) {
      const layer=document.querySelector('#effects'),flight=flightGeometry(context,e);
      if(layer&&flight) {
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
        svg.classList.add('flight-overlay');svg.setAttribute('viewBox',`-32 -36 ${flight.width} ${flight.height}`);
        const turns=e.text.includes('Gorilla')?3:e.text.includes('720')?2:e.text.includes('360')?1:0;
        svg.innerHTML=`<path d="${flight.path}" class="sky-trail" pathLength="1"><animate attributeName="stroke-dashoffset" from="1" to="0" dur=".75s" fill="freeze"/></path>
        <g><animateMotion path="${flight.path}" dur=".82s" fill="freeze"/><g transform="scale(1.6)"><g>${jersey(flight.player)}<circle cx="18" cy="-4" r="8" fill="#ffad42" stroke="#53381f" stroke-width="2"/><animateTransform attributeName="transform" type="rotate" from="0" to="${turns*360}" dur=".76s" fill="freeze"/></g></g></g>
        <circle cx="${flight.end.x}" cy="${flight.end.y}" r="10" fill="none" stroke="#ffe9aa" stroke-width="5" opacity="0"><animate attributeName="r" from="12" to="65" begin=".64s" dur=".25s"/><animate attributeName="opacity" values="0;1;0" begin=".64s" dur=".25s"/></circle>`;
        layer.append(svg);
        const call=document.createElement('b');call.className='sky-call';call.textContent=e.text;layer.append(call);
        setTimeout(()=>{svg.remove();call.remove();},1100);
      }
    }
    if(e.kind==='move' && e.pos) {
      const layer=document.querySelector('#effects');
      if(layer && !reduced) {
        const skid=document.createElement('i');const at=xy(e.pos);
        skid.className='skid';skid.style.left=`${(at.x+32)/width*100}%`;skid.style.top=`${(at.y+36)/height*100}%`;layer.append(skid);setTimeout(()=>skid.remove(),1800);
      }
    }
    if(['shatter','score','fire','hit','crowd','dunk'].includes(e.kind)||['swat','bat','strip','intercept','fall'].includes(e.kind)) {
      const arena=document.querySelector('.arena');
      if(!reduced) {arena?.classList.remove('impact');requestAnimationFrame(()=>arena?.classList.add('impact'));}
      if(e.kind==='shatter' && !reduced) {
        const layer=document.querySelector('#effects');
        for(let i=0;i<30;i++) {const shard=document.createElement('i');shard.className='shard';shard.style.left=`${e.pos&&e.pos.y>geometry.length/2?88:12}%`;shard.style.top='50%';shard.style.setProperty('--dx',`${(Math.random()-.5)*350}px`);shard.style.setProperty('--dy',`${(Math.random()-.5)*300}px`);layer?.append(shard);setTimeout(()=>shard.remove(),1200);}
      }
      if(enabled && audio) {
        const o=audio.createOscillator(),gain=audio.createGain();o.connect(gain);gain.connect(audio.destination);
        o.type=e.kind==='shatter'?'sawtooth':'square';o.frequency.setValueAtTime(e.kind==='score'?440:110,audio.currentTime);
        o.frequency.exponentialRampToValueAtTime(e.kind==='score'?880:40,audio.currentTime+.18);
        gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.25);o.start();o.stop(audio.currentTime+.26);
      }
    }
  }
  const call=latestPlayCall(events.filter(e=>isBallCall(e)||['score','fire','shatter','crowd','final'].includes(e.kind)));
  if(enabled && call && 'speechSynthesis' in window) {speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(call.text);u.rate=1.15;u.pitch=.75;speechSynthesis.speak(u);}
}
