import type { Position } from './court.js';

/** Cells touched by a center-to-center line, grouped by first contact time. */
export function supercoverLine(from:Position,to:Position):Position[][] {
  const dx=Math.abs(to.x-from.x),dy=Math.abs(to.y-from.y);
  const sx=Math.sign(to.x-from.x),sy=Math.sign(to.y-from.y);
  let {x,y}=from,ix=0,iy=0;
  const groups=[[{x,y}]];
  while(ix<dx||iy<dy) {
    // Compare the next boundary crossings without fractional arithmetic.
    const nextX=(2*ix+1)*dy,nextY=(2*iy+1)*dx;
    if(nextX<nextY) {x+=sx;ix++;groups.push([{x,y}]);}
    else if(nextY<nextX) {y+=sy;iy++;groups.push([{x,y}]);}
    else {
      // At a corner both side cells and the diagonal are touched simultaneously.
      groups.push([{x:x+sx,y},{x,y:y+sy},{x:x+sx,y:y+sy}]);
      x+=sx;y+=sy;ix++;iy++;
    }
  }
  return groups;
}
