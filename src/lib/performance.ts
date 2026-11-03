/** Optional performance / plan module. No duplicate salary base or stacked plan bonuses. */
import {calculatePay, type PayResult, type PaySettings, type MonthlyUnits, type MonthlySales, type PayLine} from './salary.ts'
import type {Shift} from './calendar.ts'
export type PlanMetric='cash'|'earnings'|'units'
export type PerformanceTier={id:string;thresholdBasisPoints:number;bonus:number}
export type PerformanceSettings={version:1;enabled:boolean;manualDailyPay:boolean;metric:PlanMetric;defaultTarget:number;tiers:PerformanceTier[]}
export type MonthlyTarget={month:string;amount:number}
export const defaultPerformanceSettings:PerformanceSettings={version:1,enabled:false,manualDailyPay:false,metric:'cash',defaultTarget:0,tiers:[{id:'goal100',thresholdBasisPoints:10000,bonus:200000}]}
export const zminaPerformancePreset:PerformanceSettings={version:1,enabled:true,manualDailyPay:false,metric:'cash',defaultTarget:0,tiers:[{id:'goal100',thresholdBasisPoints:10000,bonus:200000}]}
const MAX=100_000_000_000
const monthPattern=/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/
const safe=(n:number,max=MAX)=>Number.isSafeInteger(n)&&n>=0&&n<=max
export function validatePerformanceSettings(p:PerformanceSettings):void{
  if(!p || p.version!==1 || typeof p.enabled!=='boolean' || typeof p.manualDailyPay!=='boolean' || !['cash','earnings','units'].includes(p.metric) || !safe(p.defaultTarget) ||
    !Array.isArray(p.tiers)||p.tiers.length<1||p.tiers.length>4)throw Error('План і премії: перевір показник, суму плану та кількість порогів.')
  let previous=0
  const ids=new Set<string>()
  for(const t of p.tiers){
    if(!t || !/^[a-zA-Z0-9_-]{1,40}$/.test(t.id)||ids.has(t.id)||!safe(t.bonus)||!safe(t.thresholdBasisPoints,30000)||t.thresholdBasisPoints<100||t.thresholdBasisPoints<=previous)
      throw Error('Пороги премій мають зростати, бути унікальними та мати коректні суми.')
    ids.add(t.id);previous=t.thresholdBasisPoints
  }
}
/** Decode only supported Firestore fields, including manualDailyPay.
 * A document saved before this option existed may omit it; that means false.
 * Unknown fields such as updatedAt are ignored, but invalid present values are rejected.
 */
export function parsePerformanceSettings(raw:unknown):PerformanceSettings{
  if(!raw || typeof raw!=='object' || Array.isArray(raw))
    throw Error('Некоректний документ модуля «План і премії».')
  const doc=raw as Record<string,unknown>
  const value:PerformanceSettings={
    version:doc.version as 1,
    enabled:doc.enabled as boolean,
    manualDailyPay:(Object.prototype.hasOwnProperty.call(doc,'manualDailyPay')?doc.manualDailyPay:false) as boolean,
    metric:doc.metric as PlanMetric,
    defaultTarget:doc.defaultTarget as number,
    tiers:doc.tiers as PerformanceTier[],
  }
  validatePerformanceSettings(value)
  return value
}
export function validateMonthlyTarget(target:MonthlyTarget):void{
  if(!target||!monthPattern.test(target.month)||!safe(target.amount))throw Error('Некоректний місячний план.')
}
export function planTarget(month:string,p:PerformanceSettings,targets:Record<string,number>):number{
  if(!monthPattern.test(month))throw Error('Некоректний місяць.')
  return targets[month]??p.defaultTarget
}
export type PerformanceProgress={actual:number;target:number;percent:number;remaining:number;bonus:number;qualifiedTier:string|null;metric:PlanMetric}
export function performanceProgress(base:PayResult,p:PerformanceSettings,target:number,cash:number):PerformanceProgress{
  validatePerformanceSettings(p)
  if(!safe(target)||!safe(cash))throw Error('Некоректна сума плану або каси.')
  // Earnings goal measures normal earnings, not any monthly/target/custom bonus.
  const nonBonus=base.lines.filter(x=>!['month','unit-plan','sales-plan','performance-plan'].includes(x.code)&&!x.code.startsWith('custom:'))
    .reduce((sum,x)=>sum+x.amount,0)
  const actual=p.metric==='cash'?cash:p.metric==='units'?base.unitsCount:nonBonus
  const percent=target>0?actual/target*100:0
  const qualified=p.enabled&&target>0?p.tiers.filter(t=>actual*10000>=target*t.thresholdBasisPoints).at(-1):undefined
  return {actual,target,percent,remaining:Math.max(0,target-actual),bonus:qualified?.bonus??0,qualifiedTier:qualified?.id??null,metric:p.metric}
}
/** Reuses the single PayTakt engine. Old per-sales/per-unit plan rewards are suppressed
 * when this module is active, but commissions and ordinary/custom bonuses remain.
 */
export function calculatePayWithPerformance(
  shifts:readonly Shift[],month:string,paySettings:PaySettings,
  sales:MonthlySales={month,amount:0},units:MonthlyUnits={month,count:0},
  performance:PerformanceSettings=defaultPerformanceSettings,target=0,cash=0,dailyWages:Record<string,number>={},
):PayResult{
  const pay=performance.enabled?{...paySettings,salesPlanBonus:0,unitPlanBonus:0}:paySettings
  let base=calculatePay(shifts,month,pay,sales,units)
  if(!performance.enabled && !performance.manualDailyPay)return base
  if(performance.manualDailyPay){
    // Only confirmed working days may count; zero is a valid entered amount.
    const worked=new Set(shifts.filter(s=>s.date.startsWith(month+'-')&&(s.dayType??'work')==='work'&&
      (s.status==='worked'||s.additionalShifts?.some(x=>x.status==='worked'))).map(s=>s.date))
    const sum=Object.entries(dailyWages).reduce((total,[date,amount])=>{
      if(!worked.has(date))return total
      if(!safe(amount))throw Error('Некоректна ручна оплата за день.')
      return total+amount
    },0)
    if(!Number.isSafeInteger(sum))throw Error('Завелика сума ручної оплати.')
    // For hourly tier rates, retain only the EXTRA premium over 100%, not a second base wage.
    // For non-hourly modes, tier rows already represent supplements and are preserved.
    const hourly=paySettings.mode==='hourly'
    const removedLines=base.lines.filter(l=>l.code==='base'||(hourly&&l.code.startsWith('tier:')))
    const removed=removedLines.reduce((n,l)=>n+l.amount,0)
    const lines=base.lines.filter(l=>!removedLines.includes(l))
    if(hourly && paySettings.bandEnabled && paySettings.overtimeEntryMode==='automatic'){
      const regularMinutes=shifts.filter(s=>s.date.startsWith(month+'-')&&(s.dayType??'work')==='work')
        .reduce((sum,s)=>sum+[s,...(s.additionalShifts??[])].filter(p=>p.status==='worked').reduce((n,p)=>{
          const start=Number(p.start.slice(0,2))*60+Number(p.start.slice(3))
          let end=Number(p.end.slice(0,2))*60+Number(p.end.slice(3))
          if(end<=start)end+=1440
          return n+end-start-p.breakMinutes
        },0),0)
      const regularBase=Math.round(regularMinutes*paySettings.hourlyRate/60)
      const premium=Math.max(0,removed-regularBase)
      if(premium>0)lines.push({code:'manual-tier-premium',title:'Надбавка за понаднормові ступені',details:'Понад 100% погодинної ставки, без повторної базової оплати',amount:premium})
    }
    lines.unshift({code:'manual-day',title:'Заробіток за днями (вручну)',details:`${[...worked].filter(date=>date in dailyWages).length} днів із введеною сумою; решта — без базової оплати`,amount:sum})
    base={...base,lines,gross:base.gross-removed+sum+(lines.find(l=>l.code==='manual-tier-premium')?.amount??0)}
  }
  if(!performance.enabled)return base
  const progress=performanceProgress(base,performance,target,cash)
  if(progress.target===0)return base
  const title=performance.metric==='cash'?'Премія за план каси':performance.metric==='units'?'Премія за обсяг роботи':'Премія за план заробітку'
  const line:PayLine={code:'performance-plan',title,details:`План ${progress.target} · результат ${progress.actual} · ${progress.percent.toFixed(1)}% · найвищий досягнутий поріг`,amount:progress.bonus}
  const gross=base.gross+line.amount
  if(!Number.isSafeInteger(gross))throw Error('Занадто велика підсумкова сума зарплати.')
  return {...base,lines:[...base.lines,line],gross}
}
