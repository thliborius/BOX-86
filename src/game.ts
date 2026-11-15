export interface Level { id:string; name:string; map:string }
export interface Board { width:number; height:number; walls:Set<number>; goals:Set<number>; floors:Set<number>; player:number; boxes:number[] }
export interface State { player:number; boxes:number[]; moves:number; pushes:number }
export function parse(map:string):Board {
 const rows=map.split('\n'); const width=rows[0].length;
 if(!width || rows.some(r=>r.length!==width)) throw Error('Nicht rechteckig');
 const b:Board={width,height:rows.length,walls:new Set(),goals:new Set(),floors:new Set(),player:-1,boxes:[]}; let players=0;
 rows.forEach((r,y)=>[...r].forEach((c,x)=>{const p=y*width+x;
 if(!'# .@$*+'.includes(c)) throw Error('Unbekanntes Zeichen');
 if(c==='#') b.walls.add(p); else {b.floors.add(p); if(x===0||y===0||x===width-1||y===rows.length-1) throw Error('Offener Rand');}
 if('.+*'.includes(c)) b.goals.add(p); if('$*'.includes(c)) b.boxes.push(p); if('@+'.includes(c)){b.player=p;players++;}
 }));
 if(players!==1||!b.boxes.length||b.boxes.length!==b.goals.size) throw Error('Ungültige Figuren'); return b;
}
export const initial=(b:Board):State=>({player:b.player,boxes:[...b.boxes],moves:0,pushes:0});
export const won=(b:Board,s:State)=>s.boxes.every(p=>b.goals.has(p));
export function move(b:Board,s:State,dx:number,dy:number):State {
 if(Math.abs(dx)+Math.abs(dy)!==1) return s;
 const p=s.player+dx+dy*b.width; if(!b.floors.has(p)||Math.abs(p%b.width-s.player%b.width)>1) return s;
 const i=s.boxes.indexOf(p), boxes=[...s.boxes];
 if(i>=0){const q=p+dx+dy*b.width;if(!b.floors.has(q)||boxes.includes(q))return s;boxes[i]=q;}
 return {player:p,boxes,moves:s.moves+1,pushes:s.pushes+(i>=0?1:0)};
}
export class Game {
 state:State; history:State[]=[];
 constructor(public board:Board){this.state=initial(board)}
 step(dx:number,dy:number){const next=move(this.board,this.state,dx,dy);if(next!==this.state){this.history.push(this.state);this.state=next;}}
 undo(){this.state=this.history.pop()??this.state}
 restart(){this.state=initial(this.board);this.history=[]}
}
