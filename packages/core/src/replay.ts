import { applyCommand, validateCommand } from './actions.js';
import { ARCADE_RULES, createMatch, RULES, validateConfig } from './match.js';
import type { MatchState, Replay } from './types.js';

export function serializeReplay(s:MatchState):string {
  return JSON.stringify({schema:1,rules:s.rules,config:s.config,seed:s.seed,commands:s.commands} satisfies Replay,null,2);
}
export function replayMatch(input:unknown):MatchState {
  if(!input || typeof input!=='object' || Array.isArray(input)) throw new Error('Invalid replay');
  const r=input as Replay;
  if(r.schema!==1 || ![RULES,ARCADE_RULES].includes(r.rules)) throw new Error('Unsupported replay schema or rules version');
  validateConfig(r.config);
  if(!Array.isArray(r.commands) || r.commands.length>10000) throw new Error('Invalid replay commands (limit 10000)');
  let s=createMatch(r.config,r.seed);
  if(s.rules!==r.rules)throw new Error('Replay rules and court mode do not match');
  for(let i=0;i<r.commands.length;i++) {
    try {validateCommand(r.commands[i]);s=applyCommand(s,r.commands[i]!);}
    catch(error) {throw new Error(`Replay command ${i+1}: ${error instanceof Error?error.message:'invalid command'}`);}
  }
  return s;
}
