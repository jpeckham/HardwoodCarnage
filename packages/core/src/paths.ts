import { distance, neighbors, same, type Position } from './court.js';
import { player, validCell } from './match.js';
import type { Command, MatchState } from './types.js';
export function movementPaths(s:MatchState,id:string):Position[][] {
  const p=player(s,id);
  if(p.team!==s.current||p.used||p.offCourt||p.status!=='standing'||s.pending||s.over||(s.active&&s.active!==id))return [];
  const budget=p.fire?390:Math.max(0,p.ma+2-p.moved),paths:Position[][]=[];
  const queue:{pos:Position;path:Position[]}[]=[{pos:p.pos,path:[]}],seen=new Set([`${p.pos.x},${p.pos.y}`]);
  for(let i=0;i<queue.length;i++) {
    const entry=queue[i]!;if(entry.path.length>=budget)continue;
    for(const pos of neighbors(entry.pos)) {
      const key=`${pos.x},${pos.y}`;
      if(seen.has(key)||!validCell(s,pos))continue;
      seen.add(key);const path=[...entry.path,pos];paths.push(path);queue.push({pos,path});
    }
  }
  return paths;
}
export function reachableMoves(s:MatchState,id:string):Extract<Command,{type:'run'}>[] {
  return movementPaths(s,id).map(path=>({type:'run',playerId:id,to:path.at(-1)!}));
}
export function pathTo(s:MatchState,id:string,to:Position):Position[] {
  const path=movementPaths(s,id).find(path=>same(path.at(-1)!,to));
  if(!path)throw new Error('Destination is out of reach or blocked');return path;
}
