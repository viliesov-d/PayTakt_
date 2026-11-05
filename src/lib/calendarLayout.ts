/** UI-only calendar preferences; never changes Firestore, shifts or payroll. */
export type CalendarBlockId='calendar'|'plan'|'metrics'
export type CalendarLayout={order:CalendarBlockId[];visible:{plan:boolean;metrics:boolean;editor:boolean};dayTop:boolean}
export const defaultCalendarLayout:CalendarLayout={order:['calendar','plan','metrics'],visible:{plan:true,metrics:true,editor:true},dayTop:false}
const ids:CalendarBlockId[]=['calendar','plan','metrics']
const key=(workspace:string)=>`paytakt-layout:v1:${workspace}`
export function sanitizeCalendarLayout(value:unknown):CalendarLayout{
 const obj=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
 const maybeOrder=Array.isArray(obj.order)?obj.order:[]
 const order:CalendarBlockId[]=[]
 for(const id of maybeOrder){if(ids.includes(id as CalendarBlockId)&&!order.includes(id as CalendarBlockId))order.push(id as CalendarBlockId)}
 for(const id of ids){if(!order.includes(id))order.push(id)}
 const v=obj.visible&&typeof obj.visible==='object'&&!Array.isArray(obj.visible)?obj.visible as Record<string,unknown>:{}
 return {order,visible:{plan:typeof v.plan==='boolean'?v.plan:true,metrics:typeof v.metrics==='boolean'?v.metrics:true,editor:typeof v.editor==='boolean'?v.editor:true},dayTop:obj.dayTop===true}
}
export function moveCalendarBlock(order:readonly CalendarBlockId[],id:CalendarBlockId,by:-1|1):CalendarBlockId[]{
 const next=sanitizeCalendarLayout({order}).order
 const index=next.indexOf(id),other=index+by
 if(index<0||other<0||other>=next.length)return next
 ;[next[index],next[other]]=[next[other],next[index]]
 return next
}
export function readCalendarLayout(workspace:string):CalendarLayout{
 try{const v=localStorage.getItem(key(workspace));return sanitizeCalendarLayout(v?JSON.parse(v):null)}
 catch{return sanitizeCalendarLayout(null)}
}
export function writeCalendarLayout(workspace:string,value:CalendarLayout):boolean{
 try{localStorage.setItem(key(workspace),JSON.stringify(sanitizeCalendarLayout(value)));return true}
 catch{return false}
}
export type CalendarLayoutPreset='full'|'compact'|'calendar'
export function makeCalendarLayoutPreset(preset:CalendarLayoutPreset):CalendarLayout {
 const original=sanitizeCalendarLayout(defaultCalendarLayout)
 if(preset==='compact')return {...original,visible:{...original.visible,metrics:false}}
 if(preset==='calendar')return {...original,visible:{plan:false,metrics:false,editor:false}}
 return original
}
export function isCalendarLayoutPreset(current:CalendarLayout,preset:CalendarLayoutPreset):boolean{
 const expected=makeCalendarLayoutPreset(preset)
 return JSON.stringify(sanitizeCalendarLayout(current))===JSON.stringify(expected)
}
