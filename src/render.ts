import type {Game} from './game';
const C='#55ffff', M='#ff55ff', W='#ffffff', B='#000000';
export function render(canvas:HTMLCanvasElement,g:Game,title:boolean){
 const c=canvas.getContext('2d')!;c.imageSmoothingEnabled=false;
 const rect=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h)};
 rect(0,0,320,200,B);
 for(let x=0;x<320;x+=4){rect(x,0,2,1,C);rect(x,199,2,1,C)}
 const b=g.board,size=20,ox=Math.floor((320-b.width*size)/2),oy=Math.floor((200-b.height*size)/2);
 for(let y=0;y<b.height;y++)for(let x=0;x<b.width;x++){
 const p=y*b.width+x,X=ox+x*size,Y=oy+y*size;
 if(b.walls.has(p)){rect(X,Y,19,19,C);rect(X+1,Y+1,17,1,W);rect(X,Y+9,20,1,B);rect(X+9,Y,1,9,B);rect(X+4,Y+10,1,10,B);rect(X+1,Y+17,17,2,B)}
 else{rect(X+3,Y+3,1,1,C);rect(X+13,Y+13,1,1,C);if(b.goals.has(p)){rect(X+5,Y+5,10,10,M);rect(X+7,Y+7,6,6,B);rect(X+9,Y+9,2,2,W)}}
 if(g.state.boxes.includes(p)){const color=b.goals.has(p)?C:M;rect(X+2,Y+2,16,16,color);rect(X+4,Y+4,12,12,B);rect(X+5,Y+5,10,10,color);for(let i=0;i<10;i++){rect(X+5+i,Y+5+i,1,1,B);rect(X+14-i,Y+5+i,1,1,B)}rect(X+3,Y+3,13,1,W);if(b.goals.has(p)){rect(X+7,Y+8,2,4,W);rect(X+9,Y+10,4,2,W)}}
 if(g.state.player===p){rect(X+6,Y+2,8,3,M);rect(X+4,Y+5,12,2,M);rect(X+6,Y+7,8,5,W);rect(X+11,Y+8,2,2,B);rect(X+5,Y+12,10,5,C);rect(X+3,Y+12,2,3,W);rect(X+15,Y+12,2,3,W);rect(X+5,Y+17,4,2,W);rect(X+11,Y+17,4,2,W)}
 }
 if(title){rect(19,47,282,105,B);c.strokeStyle=M;c.strokeRect(20.5,48.5,279,102);c.font='bold 46px monospace';c.textAlign='center';c.fillStyle=M;c.fillText('BOX//86',162,102);c.fillStyle=W;c.fillText('BOX//86',159,99);c.font='10px monospace';c.fillStyle=C;c.fillText('WAREHOUSE SHIFT • EST. 1987',160,122);c.fillStyle=W;c.fillText('10 ROOMS. ONE FORKLIFT-FREE HERO.',160,139)}
}
