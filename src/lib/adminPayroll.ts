/** Read-only monthly payroll inspection for Firebase custom-claim administrators.
 * REST requests intentionally bypass the persistent Firestore cache.
 */
import {auth,firebaseApp} from './firebase'
import {decodeShift} from './data'
import {workedHours,overtimeExtraMinutes,type Shift} from './calendar'
import {calculatePayWithPerformance,parsePerformanceSettings,defaultPerformanceSettings} from './performance'
import {normalizePaySettings,type PayLine} from './salary'
import {effectiveRevenue,defaultCashPreferences,validateCashPreferences,type DailyCash} from './dailyCash'
import type {AdminUser} from './adminStats'

export type AdminDayRow={
  date:string;status:string;kind:string;shifts:number;hours:number;overtimeMinutes:number;
  wage:number|null;note:string
}
export type AdminWorkspaceMonth={
  id:string;name:string;kind:string;currency:string;
  shifts:number;hours:number;overtimeMinutes:number|null;
  gross:number|null;bonus:number|null;lines:PayLine[];days:AdminDayRow[];
  error?:string
}
export type AdminUserMonth={
  uid:string;workspaces:AdminWorkspaceMonth[];shifts:number;hours:number;
  byCurrency:Record<string,number>;incomplete:boolean;error?:string
}
export type AdminOverview={users:number;workspaces:number}

type Fields=Record<string,unknown>
type Wire={fields?:Record<string,unknown>;name?:string}
type Api={
  parent:string
  run:(body:unknown,path?:string)=>Promise<Wire[]>
  get:(path:string)=>Promise<Fields|null>
  count:(collectionId:'users'|'workspaces')=>Promise<number>
}
const validMonth=/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/
const validUid=(uid:string)=>uid.length>0&&uid.length<=256&&!uid.includes('/')

/** Decode Firestore REST typed values without losing integer monetary amounts. */
export function decodeFirestoreValue(value:unknown):unknown{
  if(!value||typeof value!=='object')return undefined
  const v=value as Record<string,any>
  if('nullValue'in v)return null
  if('stringValue'in v)return v.stringValue
  if('timestampValue'in v)return v.timestampValue
  if('booleanValue'in v)return v.booleanValue
  if('integerValue'in v)return Number(v.integerValue)
  if('doubleValue'in v)return Number(v.doubleValue)
  if('mapValue'in v)return decodeFirestoreFields(v.mapValue?.fields??{})
  if('arrayValue'in v)return (v.arrayValue?.values??[]).map(decodeFirestoreValue)
  return undefined
}
export function decodeFirestoreFields(fields:Record<string,unknown>):Fields{
  const out:Fields={}
  for(const [key,value] of Object.entries(fields))out[key]=decodeFirestoreValue(value)
  return out
}
export function formatAdminMoney(value:number,currency:string):string{
  if(!Number.isSafeInteger(value))return '—'
  const name=['UAH','EUR','USD','PLN','GBP'].includes(currency)?currency:'UAH'
  return new Intl.NumberFormat('uk-UA',{style:'currency',currency:name}).format(value/100)
}
function failure(status:number):Error{
  if(status===403||status===401)return Error('Немає доступу до фінансових даних. Опублікуй нові Firestore Rules і перевір роль адміністратора.')
  return Error('Не вдалося отримати дані Firestore (HTTP '+status+'). Перевір інтернет та повтори спробу.')
}
async function adminApi():Promise<Api>{
  const user=auth?.currentUser
  const project=firebaseApp?.options.projectId
  if(!user||!project)throw Error('Увійди під обліковим записом адміністратора.')
  const token=await user.getIdTokenResult(true)
  if(token.claims.admin!==true)throw Error('Доступ лише для адміністратора.')
  const parent='projects/'+project+'/databases/(default)/documents'
  const root='https://firestore.googleapis.com/v1/'+parent
  const headers={Authorization:'Bearer '+token.token,'Content-Type':'application/json',Accept:'application/json'}
  const pathUrl=(path:string)=>path.split('/').map(encodeURIComponent).join('/')
  async function request(url:string,init:RequestInit):Promise<Response>{
    const response=await fetch(url,{...init,cache:'no-store',headers})
    if(!response.ok)throw failure(response.status)
    return response
  }
  return {
    parent,
    async run(body,path=''){
      const response=await request(root+(path?'/'+pathUrl(path):'')+':runQuery',{method:'POST',body:JSON.stringify(body)})
      const rows=await response.json()
      if(!Array.isArray(rows))throw Error('Некоректна відповідь Firestore.')
      return rows.filter((x:Record<string,unknown>)=>x.document).map((x:{document:Wire})=>x.document)
    },
    async get(path){
      const response=await fetch(root+'/'+pathUrl(path),{method:'GET',headers,cache:'no-store'})
      if(response.status===404)return null
      if(!response.ok)throw failure(response.status)
      const data=await response.json() as Wire
      return decodeFirestoreFields(data.fields??{})
    },
    async count(collectionId){
      const body={structuredAggregationQuery:{
        structuredQuery:{from:[{collectionId}]},
        aggregations:[{alias:'total',count:{}}],
      }}
      const response=await request(root+':runAggregationQuery',{method:'POST',body:JSON.stringify(body)})
      const data=await response.json()
      const value=Array.isArray(data)?data.find(x=>x.result)?.result?.aggregateFields?.total?.integerValue:undefined
      if(value===undefined)throw Error('Firestore не повернув кількість записів.')
      return Number(value)
    },
  }
}
export async function loadAdminOverview():Promise<AdminOverview>{
  const api=await adminApi()
  const [users,workspaces]=await Promise.all([api.count('users'),api.count('workspaces')])
  return {users,workspaces}
}
const ownerFilter=(uid:string)=>({fieldFilter:{
  field:{fieldPath:'ownerUid'},op:'EQUAL',value:{stringValue:uid},
}})
const monthQuery=(api:Api,wsid:string,collectionId:string,month:string)=>({
  structuredQuery:{
    from:[{collectionId}],
    orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],
    startAt:{values:[{referenceValue:api.parent+'/workspaces/'+wsid+'/'+collectionId+'/'+month+'-01'}],before:true},
    endAt:{values:[{referenceValue:api.parent+'/workspaces/'+wsid+'/'+collectionId+'/'+month+'-31'}],before:false},
    limit:33,
  },
})
async function monthDocuments(api:Api,wsid:string,name:string,month:string){
  const docs=await api.run(monthQuery(api,wsid,name,month),'workspaces/'+wsid)
  if(docs.length>31)throw Error('Занадто багато записів для одного календарного місяця.')
  return docs.map(item=>({id:item.name?.split('/').pop()??'',data:decodeFirestoreFields(item.fields??{})}))
}
const number=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0
const cleanCurrency=(value:unknown)=>typeof value==='string'&&['UAH','USD','EUR','PLN','GBP'].includes(value)?value:'UAH'
function shiftDay(shift:Shift,wages:Record<string,number>):AdminDayRow{
  const active=(shift.dayType??'work')==='work'
  const parts=active?[shift,...(shift.additionalShifts??[])].filter(s=>s.status==='worked'):[]
  const worked=parts.length>0
  const overtime=overtimeExtraMinutes(shift)+(worked?(shift.overtimeMinutes??0):0)
  return {date:shift.date,
    status:!active?(shift.dayType??'off'):worked?'Відпрацьовано':'Заплановано',
    kind:shift.kind??'regular',shifts:parts.length,
    hours:workedHours(shift),overtimeMinutes:overtime,
    wage:Object.prototype.hasOwnProperty.call(wages,shift.date)?wages[shift.date]:null,
    note:shift.note??'',
  }
}
async function workspaceMonth(api:Api,workspace:Wire,month:string):Promise<AdminWorkspaceMonth>{
  const id=workspace.name?.split('/').pop()??''
  const raw=decodeFirestoreFields(workspace.fields??{})
  const result:AdminWorkspaceMonth={
    id,name:typeof raw.name==='string'?raw.name:'Робочий простір',
    kind:raw.kind==='company'?'company':'personal',currency:cleanCurrency(raw.currency),
    shifts:0,hours:0,overtimeMinutes:null,gross:null,bonus:null,lines:[],days:[],
  }
  try{
    const path='workspaces/'+id+'/'
    const [shiftsRaw,wagesRaw,cashRaw,payRaw,perfRaw,cashPrefRaw,salesRaw,unitsRaw,targetRaw]=await Promise.all([
      monthDocuments(api,id,'shifts',month),
      monthDocuments(api,id,'dailyWages',month),
      monthDocuments(api,id,'dailyCash',month),
      api.get(path+'paySettings/current'),
      api.get(path+'settings/performance'),
      api.get(path+'settings/cash'),
      api.get(path+'monthlySales/'+month),
      api.get(path+'monthlyUnits/'+month),
      api.get(path+'monthlyTargets/'+month),
    ])
    const shifts=shiftsRaw.map(row=>decodeShift(row.id,row.data))
    const wages=Object.fromEntries(wagesRaw.map(row=>[row.id,number(row.data.amount)]))
    const cash:DailyCash[]=cashRaw.map(row=>({date:row.id,amount:number(row.data.amount)}))
    result.days=shifts.map(s=>shiftDay(s,wages)).sort((a,b)=>b.date.localeCompare(a.date))
    result.shifts=result.days.reduce((sum,d)=>sum+d.shifts,0)
    result.hours=result.days.reduce((sum,d)=>sum+d.hours,0)
    if(!payRaw){
      result.error='Немає збережених правил оплати: зарплату розрахувати неможливо.'
      return result
    }
    const pay=normalizePaySettings(payRaw)
    const performance=perfRaw?parsePerformanceSettings(perfRaw):defaultPerformanceSettings
    const cashPrefs=cashPrefRaw?{
      enabled:cashPrefRaw.enabled as boolean,useForSales:cashPrefRaw.useForSales as boolean,
    }:defaultCashPreferences
    validateCashPreferences(cashPrefs)
    const sales=effectiveRevenue({[month]:number(salesRaw?.amount)},cash,shifts,cashPrefs)[month]??0
    const amount=calculatePayWithPerformance(
      shifts,month,pay,{month,amount:sales},{month,count:number(unitsRaw?.count)},
      performance,number(targetRaw?.amount??performance.defaultTarget),
      cash.filter(c=>shifts.some(s=>s.date===c.date&&(s.dayType??'work')==='work')).reduce((sum,c)=>sum+c.amount,0),wages)
    result.gross=amount.gross
    result.overtimeMinutes=amount.overtimeMinutes
    result.lines=amount.lines
    const bonusCodes=new Set(['month','unit-plan','sales-plan','performance-plan'])
    result.bonus=amount.lines.filter(l=>bonusCodes.has(l.code)||l.code.startsWith('custom:'))
      .reduce((sum,l)=>sum+l.amount,0)
  }catch(error){
    result.error=error instanceof Error?error.message:'Невідома помилка отримання даних.'
  }
  return result
}
async function userMonth(api:Api,uid:string,month:string):Promise<AdminUserMonth>{
  if(!validUid(uid)||!validMonth.test(month))throw Error('Некоректний користувач або місяць.')
  const where=ownerFilter(uid)
  const workspaces=await api.run({structuredQuery:{
    from:[{collectionId:'workspaces'}],where,limit:101,
  }})
  if(workspaces.length>100)throw Error('У користувача понад 100 робочих просторів. Дані не показано частково.')
  const entries:AdminWorkspaceMonth[]=[]
  // Do not create a burst of database reads if the user owns many workspaces.
  for(let i=0;i<workspaces.length;i+=3){
    entries.push(...await Promise.all(workspaces.slice(i,i+3).map(w=>workspaceMonth(api,w,month))))
  }
  const byCurrency:Record<string,number>={}
  for(const w of entries)if(w.gross!==null)byCurrency[w.currency]=(byCurrency[w.currency]??0)+w.gross
  return {uid,workspaces:entries,
    shifts:entries.reduce((n,w)=>n+w.shifts,0),
    hours:entries.reduce((n,w)=>n+w.hours,0),
    byCurrency,incomplete:entries.some(w=>w.gross===null),
  }
}
/** Bound concurrency and report each user separately to keep the table responsive. */
export async function loadAdminMonthlyUsers(
  users:AdminUser[],month:string,onResult:(value:AdminUserMonth)=>void,
):Promise<void>{
  if(!validMonth.test(month))throw Error('Некоректний місяць для статистики.')
  const api=await adminApi()
  let next=0
  await Promise.all(Array.from({length:Math.min(3,users.length)},async()=>{
    while(next<users.length){
      const user=users[next++]
      try{onResult(await userMonth(api,user.uid,month))}
      catch(error){
        onResult({uid:user.uid,workspaces:[],shifts:0,hours:0,byCurrency:{},incomplete:true,
          error:error instanceof Error?error.message:'Помилка даних користувача.'})
      }
    }
  }))
}
