/** Durable, scoped offline operations for shifts, daily pay and daily cash.
 * This is deliberately separate from Firestore's cache: writes are replayed
 * through transactions, so conflicts are never silently last-write-wins.
 */
import {validateDay,type Shift} from './calendar.ts'

export type OfflineKind='shifts'|'dailyCash'|'dailyWages'
export type OfflineValue=Shift|number|null
export type OfflineState='pending'|'conflict'|'error'
export type OfflineEdit={
  id:string
  workspaceId:string
  kind:OfflineKind
  date:string
  before:OfflineValue
  next:OfflineValue
  state:OfflineState
  revision:number
  error?:string
  server?:OfflineValue
}
const prefix='paytakt-offline-v1:'
const validKind=(k:unknown):k is OfflineKind=>k==='shifts'||k==='dailyCash'||k==='dailyWages'
const validDate=(date:unknown)=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)
const idFor=(workspaceId:string,kind:OfflineKind,date:string)=>`${workspaceId}/${kind}/${date}`
function safeValue(kind:OfflineKind,value:OfflineValue):boolean{
  if(value===null)return true
  if(kind==='shifts'){
    try{validateDay(value as Shift);return typeof value==='object'&&value!==null}catch{return false}
  }
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=100000000000
}
export function readOfflineQueue(uid:string):OfflineEdit[]{
  if(!uid)return []
  let raw:string|null
  try{raw=localStorage.getItem(prefix+uid)}
  catch{throw Error('Локальне сховище недоступне. Офлайн-збереження неможливе.')}
  if(!raw)return []
  let items:unknown
  try{items=JSON.parse(raw)}catch{throw Error('Локальна черга пошкоджена. Не видаляй дані застосунку; збережи резервну копію.')}
  if(!Array.isArray(items)||items.length>2000||items.some(v=>{
    if(!v||typeof v!=='object')return true
    const e=v as OfflineEdit
    return typeof e.workspaceId!=='string'||!e.workspaceId||!validKind(e.kind)||
      !validDate(e.date)||e.id!==idFor(e.workspaceId,e.kind,e.date)||
      !['pending','conflict','error'].includes(e.state)||
      !Number.isSafeInteger(e.revision)||e.revision<1||
      !safeValue(e.kind,e.before)||!safeValue(e.kind,e.next)
  }))throw Error('Некоректна черга синхронізації. Збережи локальні дані перед перевстановленням.')
  return items as OfflineEdit[]
}
function persist(uid:string,items:OfflineEdit[]):OfflineEdit[]{
  if(!uid)throw Error('Для запису потрібен акаунт.')
  try{localStorage.setItem(prefix+uid,JSON.stringify(items))}
  catch{throw Error('Недостатньо місця або немає доступу до сховища. Запис не збережено!')}
  return items
}
export function enqueueOffline(
  uid:string,workspaceId:string,kind:OfflineKind,date:string,
  before:OfflineValue,next:OfflineValue,
):OfflineEdit[]{
  if(!validDate(date)||!safeValue(kind,next)||!safeValue(kind,before))throw Error('Некоректний запис дня.')
  const items=readOfflineQueue(uid)
  const id=idFor(workspaceId,kind,date),index=items.findIndex(e=>e.id===id)
  // Re-editing a queued day must keep its ORIGINAL server baseline. Otherwise
  // an unrelated edit on another device could go unnoticed.
  const existing=index<0?null:items[index]
  const nextEntry:OfflineEdit={
    id,workspaceId,kind,date,before:existing?.before??before,next,
    state:existing?.state==='conflict'?'conflict':'pending',
    revision:(existing?.revision??0)+1,
    ...(existing?.state==='conflict'?{server:existing.server,error:existing.error}:{})
  }
  if(index<0)items.push(nextEntry)
  else items[index]=nextEntry
  return persist(uid,items)
}
export function replaceOfflineEntry(
  uid:string,id:string,revision:number,change:(entry:OfflineEdit)=>OfflineEdit|null,
):OfflineEdit[]{
  const items=readOfflineQueue(uid)
  const index=items.findIndex(e=>e.id===id)
  if(index<0||items[index].revision!==revision)return items
  const updated=change(items[index])
  if(updated===null)items.splice(index,1)
  else items[index]=updated
  return persist(uid,items)
}
/** Protect a newer local edit while an older version was syncing. */
export function finalizeOfflineEdit(uid:string,committed:OfflineEdit):OfflineEdit[]{
  const items=readOfflineQueue(uid)
  const index=items.findIndex(e=>e.id===committed.id)
  if(index<0)return items
  if(items[index].revision===committed.revision)items.splice(index,1)
  else if(items[index].revision>committed.revision){
    // The earlier value was committed, so it becomes the new server baseline.
    items[index]={...items[index],before:committed.next,revision:items[index].revision+1}
  }
  return persist(uid,items)
}
export function retryOfflineErrors(uid:string):OfflineEdit[]{
  return persist(uid,readOfflineQueue(uid).map(e=>e.state==='error'?{...e,state:'pending' as const,revision:e.revision+1,error:undefined}:e))
}
export function discardOffline(uid:string,id:string):OfflineEdit[]{
  const items=readOfflineQueue(uid)
  return persist(uid,items.filter(item=>item.id!==id))
}
export function acceptOverwrite(uid:string,id:string):OfflineEdit[]{
  const items=readOfflineQueue(uid)
  const index=items.findIndex(e=>e.id===id)
  if(index<0||items[index].state!=='conflict')return items
  const current=items[index]
  items[index]={...current,before:current.server??null,state:'pending',revision:current.revision+1,error:undefined,server:undefined}
  return persist(uid,items)
}
export function offlineSummary(items:OfflineEdit[]){
  return {pending:items.filter(x=>x.state==='pending').length,
    conflicts:items.filter(x=>x.state==='conflict').length,
    errors:items.filter(x=>x.state==='error').length}
}
export function overlayShifts(server:Shift[],items:OfflineEdit[],workspaceId:string):Shift[]{
  const map=new Map(server.map(item=>[item.date,item]))
  for(const edit of items){
    if(edit.workspaceId!==workspaceId||edit.kind!=='shifts')continue
    if(edit.next===null)map.delete(edit.date)
    else map.set(edit.date,edit.next as Shift)
  }
  return [...map.values()]
}
export function overlayAmounts<T extends {date:string;amount:number}>(
 server:T[],items:OfflineEdit[],workspaceId:string,kind:'dailyCash',
):T[]{
 const map=new Map(server.map(item=>[item.date,item]))
 for(const edit of items){
   if(edit.workspaceId!==workspaceId||edit.kind!==kind)continue
   if(edit.next===null)map.delete(edit.date)
   else map.set(edit.date,{date:edit.date,amount:edit.next as number} as T)
 }
 return [...map.values()]
}
export function overlayWages(server:Record<string,number>,items:OfflineEdit[],workspaceId:string):Record<string,number>{
 const result={...server}
 for(const edit of items){
   if(edit.workspaceId!==workspaceId||edit.kind!=='dailyWages')continue
   if(edit.next===null)delete result[edit.date]
   else result[edit.date]=edit.next as number
 }
 return result
}
