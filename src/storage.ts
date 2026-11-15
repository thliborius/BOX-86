export interface Progress {version:1; lastLevel:string; completed:Record<string,{moves:number;pushes:number}>}
export const KEY='box86.progress';
export const empty=():Progress=>({version:1,lastLevel:'box86-001',completed:{}});
export function load(storage:Pick<Storage,'getItem'>):Progress {
 try {const p=JSON.parse(storage.getItem(KEY)??'null');if(p?.version!==1||typeof p.lastLevel!=='string'||!p.completed||typeof p.completed!=='object'||Array.isArray(p.completed))return empty();
 const completed:Progress['completed']={};for(const [id,v] of Object.entries(p.completed)){const s=v as {moves:number;pushes:number};if(s&&Number.isInteger(s.moves)&&Number.isInteger(s.pushes)&&s.moves>=0&&s.pushes>=0&&s.pushes<=s.moves)completed[id]=s;}return {version:1,lastLevel:p.lastLevel,completed};}catch{return empty();}
}
export function save(storage:Pick<Storage,'setItem'>,p:Progress){try{storage.setItem(KEY,JSON.stringify(p));return true}catch{return false}}
