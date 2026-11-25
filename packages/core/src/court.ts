export interface Position { x: number; y: number }
export type CourtMode='classic'|'arcade';
type Context={config:{court?:CourtMode}};
export function courtSize(context?:Context) {
  return context?.config.court==='arcade'
    ?{width:9,length:16,center:4,paintDepth:4,paintLeft:3,paintRight:5,arc:4,runUp:2,dunkRange:8,throwRange:8,turnsPerHalf:6}
    :{width:15,length:26,center:7,paintDepth:6,paintLeft:5,paintRight:9,arc:6,runUp:3,dunkRange:3,throwRange:6,turnsPerHalf:8};
}
export function inBounds(p: Position,context?:Context): boolean {
  const c=courtSize(context);
  return Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < c.width && p.y >= 0 && p.y < c.length;
}
export const distance=(a:Position,b:Position):number=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
export const same=(a:Position,b:Position):boolean=>a.x===b.x && a.y===b.y;
export function isRim(p:Position,context?:Context):boolean {const c=courtSize(context);return p.x===c.center && (p.y===1||p.y===c.length-2);}
export function inPaint(p:Position,context?:Context):boolean {const c=courtSize(context);return p.x>=c.paintLeft&&p.x<=c.paintRight&&(p.y<c.paintDepth||p.y>=c.length-c.paintDepth);}
export function rim(team:'A'|'B',half:number,context?:Context):Position {const c=courtSize(context);return {x:c.center,y:(team==='A')===(half===1)?c.length-2:1};}
export function shotPoints(p:Position,target:Position,context?:Context):number {
  return (p.x-target.x)**2+(p.y-target.y)**2>courtSize(context).arc**2?3:2;
}
export function clampToCourt(p:Position,context?:Context):Position {const c=courtSize(context);return {x:Math.max(0,Math.min(c.width-1,p.x)),y:Math.max(0,Math.min(c.length-1,p.y))};}
export function neighbors(p:Position):Position[] {
  const cells:Position[]=[];
  for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) if(x || y) cells.push({x:p.x+x,y:p.y+y});
  return cells;
}
