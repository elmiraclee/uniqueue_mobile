export type MonitorTicket={queue_number:string;eta_label?:string|null;type?:string|null};
export type MonitorWindow={id:number;name:string;status:string;is_paused:boolean|number;queue_type?:string|null;current:MonitorTicket|null;next:MonitorTicket|null;waiting:MonitorTicket[];waiting_count:number;last:MonitorTicket|null};
export type MonitorOffice={id:number;name:string;windows:MonitorWindow[]};
/** Ignore ETA clock drift; react to actual queue and window-state changes. */
export function monitorSnapshots(offices:MonitorOffice[]):Record<string,string>{
 const out:Record<string,string>={};for(const o of offices)for(const w of o.windows)out[`${o.id}:${w.id}`]=JSON.stringify([w.status,Number(w.is_paused)||0,w.current?.queue_number||null,w.next?.queue_number||null,(w.waiting||[]).map(t=>t.queue_number),w.waiting_count,w.last?.queue_number||null]);return out;
}
export function changedVisibleWindows(before:Record<string,string>|null,after:Record<string,string>,hidden:number[]):string[]{
 if(!before)return [];return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>!hidden.includes(Number(key.split(':')[0]))&&before[key]!==after[key]);
}
export type MonitorPreferences={hidden:number[];active:number};
export function parseMonitorPreferences(raw:string|null):MonitorPreferences{
 try{const p=JSON.parse(raw||'{}');return {hidden:Array.isArray(p.hidden)?p.hidden.filter((n:unknown)=>typeof n==='number'&&Number.isInteger(n)&&n>0):[],active:Number.isInteger(p.active)&&p.active>0?p.active:0}}catch{return {hidden:[],active:0}}
}
