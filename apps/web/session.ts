import { replayMatch, serializeReplay, type MatchState } from '../../packages/core/src/index.js';
export type Mode='solo'|'hotseat'|'demo';
const KEY='hardwood-carnage-session-v1';
export function encodeSession(state:MatchState,mode:Mode):string {return JSON.stringify({mode,replay:JSON.parse(serializeReplay(state))});}
export function decodeSession(raw:string):{state:MatchState;mode:Mode} {
  const data=JSON.parse(raw) as {mode:Mode;replay:unknown};
  if(!data || !['solo','hotseat','demo'].includes(data.mode)) throw new Error('Invalid saved game');
  return {mode:data.mode,state:replayMatch(data.replay)};
}
export function readSession(storage:Pick<Storage,'getItem'>):ReturnType<typeof decodeSession>|null {
  try {const raw=storage.getItem(KEY);return raw?decodeSession(raw):null;} catch {return null;}
}
export function writeSession(storage:Pick<Storage,'setItem'>,state:MatchState,mode:Mode):boolean {
  try {storage.setItem(KEY,encodeSession(state,mode));return true;} catch {return false;}
}
