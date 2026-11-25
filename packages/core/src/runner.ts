import { createMatch, applyCommand, chooseAiCommand, serializeReplay, replayMatch } from './index.js';
import { isDeepStrictEqual } from 'node:util';
let s=createMatch({teamA:'Grak & Crumbleberry',teamB:'Goblin Swarm',court:'arcade',ruleset:'possession'},1);
for(let i=0;!s.over && i<3000;i++) s=applyCommand(s,chooseAiCommand(s));
if(!s.over) throw new Error('AI failed to complete match');
if(!isDeepStrictEqual(replayMatch(JSON.parse(serializeReplay(s))),s)) throw new Error('Replay mismatch');
console.log(`${s.rules}\n${s.teams.map(t=>`${t.name} ${t.score}`).join(' : ')}\n${s.turn} turns, ${s.commands.length} accepted commands, ${s.events.length} events\nExact replay verified.`);
