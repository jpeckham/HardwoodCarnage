import { isPossessionGame, replayMatch, serializeReplay, type MatchState } from '../../packages/core/src/index.js';
export type Mode='solo'|'hotseat'|'demo';
const LEGACY_KEY='hardwood-carnage-session-v1';
const KEY='hardwood-carnage-possession-session-v1';
export function encodeSession(state:MatchState,mode:Mode):string {return JSON.stringify({mode,replay:JSON.parse(serializeReplay(state))});}
export function decodeSession(raw:string):{state:MatchState;mode:Mode} {
  const data=JSON.parse(raw) as {mode:Mode;replay:unknown};
  if(!data || !['solo','hotseat','demo'].includes(data.mode)) throw new Error('Invalid saved game');
  return {mode:data.mode,state:replayMatch(data.replay)};
}
function readSlot(storage:Pick<Storage,'getItem'>,key:string):ReturnType<typeof decodeSession>|null {
  try {const raw=storage.getItem(key);return raw?decodeSession(raw):null;} catch {return null;}
}
export function readSession(storage:Pick<Storage,'getItem'>):ReturnType<typeof decodeSession>|null {
  return readSlot(storage,KEY)??readSlot(storage,LEGACY_KEY);
}
export function readLegacySession(storage:Pick<Storage,'getItem'>):ReturnType<typeof decodeSession>|null {
  const old=readSlot(storage,LEGACY_KEY);
  return old&&!isPossessionGame(old.state)?old:null;
}
export function writeSession(storage:Pick<Storage,'setItem'>,state:MatchState,mode:Mode):boolean {
  if(!isPossessionGame(state))return false;
  try {storage.setItem(KEY,encodeSession(state,mode));return true;} catch {return false;}
}
