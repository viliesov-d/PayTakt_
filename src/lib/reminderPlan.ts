/** PayTakt Mobile v0.8. All settings are opt-in and local to one account/workspace.
 * Android schedules upcoming reminders so they fire while the app is closed.
 * Scheduling is renewed when the application next opens or resumes.
 */
import {paymentDate} from './payments.ts'
import type {Shift} from './calendar.ts'
import type {PaySettings} from './salary.ts'

export type ReminderPreferences={
  enabled:boolean
  shiftStart:boolean
  tomorrow:boolean
  payday:boolean
  leadMinutes:15|30|60|120
  tomorrowHour:number
  paydayHour:number
}
export const defaultReminders:ReminderPreferences={
  enabled:false,shiftStart:true,tomorrow:true,payday:true,
  leadMinutes:60,tomorrowHour:19,paydayHour:9,
}
const KEY='paytakt-reminders-v1:'
const keyFor=(uid:string,workspaceId:string)=>KEY+uid+':'+workspaceId
export function readReminderSettings(uid:string,workspaceId:string):ReminderPreferences {
  try{
    const raw=localStorage.getItem(keyFor(uid,workspaceId))
    if(!raw)return {...defaultReminders}
    const value=JSON.parse(raw) as Partial<ReminderPreferences>
    return {
      enabled:value.enabled===true,
      shiftStart:value.shiftStart!==false,
      tomorrow:value.tomorrow!==false,
      payday:value.payday!==false,
      leadMinutes:([15,30,60,120] as const).includes(value.leadMinutes as 15)?value.leadMinutes as 15|30|60|120:60,
      tomorrowHour:Number.isInteger(value.tomorrowHour)&&value.tomorrowHour!>=0&&value.tomorrowHour!<=23?value.tomorrowHour!:19,
      paydayHour:Number.isInteger(value.paydayHour)&&value.paydayHour!>=0&&value.paydayHour!<=23?value.paydayHour!:9,
    }
  }catch{return {...defaultReminders}}
}
export function saveReminderSettings(uid:string,workspaceId:string,prefs:ReminderPreferences):ReminderPreferences {
  if(!uid||!workspaceId)throw Error('Спочатку увійди до свого робочого простору.')
  // Never claim a setting was saved when WebView storage rejects the write.
  try{localStorage.setItem(keyFor(uid,workspaceId),JSON.stringify(prefs))}
  catch{throw Error('Не вдалося зберегти налаштування нагадувань на пристрої.')}
  return prefs
}
export type PlannedReminder={
  id:number
  title:string
  body:string
  at:Date
  eventKey:string
}
const MIN_ID=1_400_000_000,SPAN=200_000_000
// Stable Android int32 ids, no localStorage dependency on restart.
export function reminderId(key:string):number {
  let h=2166136261
  for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619)}
  return MIN_ID+(h>>>0)%SPAN
}
export function isPayTaktReminderId(id:number):boolean {
  return Number.isInteger(id)&&id>=MIN_ID&&id<MIN_ID+SPAN
}
function asLocalDate(date:string,hour:number,minute=0):Date {
  const [y,m,d]=date.split('-').map(Number)
  return new Date(y,m-1,d,hour,minute,0,0)
}
function monthKey(date:Date):string{
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
}
function monthPlus(ym:string,delta:number):string {
  const [y,m]=ym.split('-').map(Number)
  const x=new Date(y,m-1+delta,1)
  return monthKey(x)
}
/** Plan a bounded next-28-days window; no recurring duplicates on reopening. */
export function buildReminderPlan(
  uid:string,workspaceId:string,workspaceName:string,
  shifts:readonly Shift[],pay:PaySettings|null,prefs:ReminderPreferences,
  now:Date=new Date(),
):PlannedReminder[]{
  if(!prefs.enabled)return []
  const max=new Date(now.getTime()+28*24*60*60*1000)
  const result:PlannedReminder[]=[]
  const used=new Set<number>()
  const add=(key:string,title:string,body:string,at:Date)=>{
    if(!Number.isFinite(at.getTime())||at<=now||at>max)return
    const eventKey=uid+':'+workspaceId+':'+key
    const id=reminderId(eventKey)
    if(used.has(id))return
    used.add(id)
    result.push({id,eventKey,title,body,at})
  }
  for(const s of shifts){
    if((s.dayType??'work')!=='work'||s.status!=='planned')continue
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start))continue
    const [hour,min]=s.start.split(':').map(Number)
    const starting=asLocalDate(s.date,hour,min)
    if(prefs.shiftStart){
      const lead=new Date(starting.getTime()-prefs.leadMinutes*60000)
      add('start:'+s.date,'Незабаром робоча зміна',`${workspaceName} · початок о ${s.start}`,lead)
    }
    if(prefs.tomorrow){
      const prior=asLocalDate(s.date,prefs.tomorrowHour)
      prior.setDate(prior.getDate()-1)
      add('tomorrow:'+s.date,'Завтра робочий день',`${workspaceName} · початок о ${s.start}`,prior)
    }
  }
  if(pay&&prefs.payday){
    const view=monthKey(now)
    for(let offset=-3;offset<=2;offset++){
      const earningMonth=monthPlus(view,offset)
      for(const rule of pay.paymentRules){
        if(!rule.enabled)continue
        const date=paymentDate(earningMonth,rule.monthOffset,rule.day)
        add('pay:'+earningMonth+':'+rule.id,'Запланована виплата',
          `${workspaceName} · ${rule.title}`,asLocalDate(date,prefs.paydayHour))
      }
    }
  }
  return result.sort((a,b)=>a.at.getTime()-b.at.getTime()||a.id-b.id).slice(0,64)
}
