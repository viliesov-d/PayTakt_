/** Read-only analytics for the existing salary/calendar data. No new Firebase documents.
 * Money is kept in integer kopeks. Forecasts are NOT recorded bank payments.
 */
import {overtimeExtraMinutes,segmentHours,shiftCount,workedHours,type Shift} from './calendar.ts'
import {countsTowardMonthlyNorm,type MonthlySales,type MonthlyUnits,type PayResult,type PaySettings} from './salary.ts'
import {calculatePayWithPerformance,defaultPerformanceSettings,type PerformanceSettings} from './performance.ts'
import {calculatePaymentForecast,paymentDate,firstHalfOnlyShifts,type PaymentForecast} from './payments.ts'

export type WeeklyActivity={label:string;worked:number;planned:number;overtime:number}
export type MonthAnalytics={
  month:string; plannedDays:number; plannedShifts:number; workedDays:number; workedShifts:number;
  scheduledHours:number; workedHours:number; overtimeHours:number;
  offDays:number; vacationDays:number; sickDays:number; unpaidDays:number;
  weeks:WeeklyActivity[]; result:PayResult|null; forecast:PaymentForecast|null; payError:string|null
}
export type PayoutMarker={id:string;date:string;title:string;sourceMonth:string;source:'earnings'|'bonus';amount:number|null}

export function shiftMonth(month:string,delta:number):string {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(delta) || Math.abs(delta)>1200)throw Error('Некоректний місяць.')
  const [year,number]=month.split('-').map(Number)
  const date=new Date(Date.UTC(year,number-1+delta,1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`
}
const numberOfDays=(month:string):number=>{
  const [y,m]=month.split('-').map(Number)
  return new Date(Date.UTC(y,m,0)).getUTCDate()
}
const mondayOffset=(month:string):number=>{
  const [y,m]=month.split('-').map(Number)
  return (new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7
}
const hasWork=(s:Shift):boolean=>(s.dayType??'work')==='work'
const roundHours=(n:number):number=>Math.round(n*100)/100

export function buildMonthAnalytics(shifts:readonly Shift[],month:string,settings:PaySettings|null,
  salesAmount=0,unitsCount=0,performance:PerformanceSettings=defaultPerformanceSettings,goal=0,cash=0,dailyWages:Record<string,number>={}):MonthAnalytics {
  const monthShifts=shifts.filter(s=>s.date.slice(0,7)===month)
  const monthDays=numberOfDays(month)
  const offset=mondayOffset(month)
  const weekCount=Math.ceil((monthDays+offset)/7)
  const weeks:WeeklyActivity[]=Array.from({length:weekCount},(_,i)=>({
    label:`${Math.max(1,i*7-offset+1)}–${Math.min(monthDays,(i+1)*7-offset)}`,
    worked:0,planned:0,overtime:0,
  }))
  let plannedDays=0,plannedShifts=0,workedDays=0,workedShifts=0,scheduledHours=0,hours=0,otHours=0
  let offDays=0,vacationDays=0,sickDays=0,unpaidDays=0
  for(const s of monthShifts){
    const dayType=s.dayType??'work'
    const planned=settings?countsTowardMonthlyNorm(s,settings):(s.plannedWorkday??hasWork(s))
    const plannedMinutes=planned?(s.plannedMinutes??(hasWork(s)?Math.round(segmentHours(s)*60):0)):0
    const plannedDayHours=plannedMinutes/60
    const week=Math.floor((Number(s.date.slice(-2))+offset-1)/7)
    const item=weeks[week]
    if(dayType==='off')offDays++
    else if(dayType==='vacation')vacationDays++
    else if(dayType==='sick')sickDays++
    else if(dayType==='unpaid')unpaidDays++
    if(planned){plannedDays++;scheduledHours+=plannedDayHours;item.planned+=plannedDayHours}
    if(!hasWork(s))continue
    plannedShifts+=shiftCount(s)
    const worked=workedHours(s)
    if(worked>0){workedDays++;hours+=worked;item.worked+=worked}
    workedShifts+=(s.status==='worked'?1:0)+(s.additionalShifts??[]).filter(x=>x.status==='worked').length
    const overtime=(s.status==='worked'?(s.overtimeMinutes??0):0)+overtimeExtraMinutes(s)
    otHours+=overtime/60
    item.overtime+=overtime/60
  }
  let result:PayResult|null=null,forecast:PaymentForecast|null=null,payError:string|null=null
  if(settings){
    try {
      result=calculatePayWithPerformance(shifts,month,settings,{month,amount:salesAmount} satisfies MonthlySales,
        {month,count:unitsCount} satisfies MonthlyUnits,performance,goal,cash,dailyWages)
      // Keep the first-half advance consistent with manually entered daily base wages.
      const firstHalfShifts=firstHalfOnlyShifts(shifts,month)
      const firstHalfResult=performance.manualDailyPay?
        calculatePayWithPerformance(firstHalfShifts,month,settings,{month,amount:0},{month,count:0},performance,0,0,dailyWages):undefined
      forecast=calculatePaymentForecast(shifts,month,settings,result,firstHalfResult)
    }catch(error){payError=error instanceof Error?error.message:'Не вдалося розрахувати зарплату.'}
  }
  return {month,plannedDays,plannedShifts,workedDays,workedShifts,
    scheduledHours:roundHours(scheduledHours),workedHours:roundHours(hours),
    overtimeHours:roundHours(result?result.overtimeMinutes/60:otHours),
    offDays,vacationDays,sickDays,unpaidDays,
    weeks:weeks.map(w=>({...w,planned:roundHours(w.planned),worked:roundHours(w.worked),overtime:roundHours(w.overtime)})),
    result,forecast,payError}
}

/** Collect all rules whose planned payment date falls in `viewMonth`, including past accrual months.
 * A null amount means the earning month couldn't be evaluated yet; it is not zero income.
 */
export function payoutsInMonth(shifts:readonly Shift[],viewMonth:string,settings:PaySettings|null,
  salesByMonth:Record<string,number>,unitsByMonth:Record<string,number>,performance:PerformanceSettings=defaultPerformanceSettings,goals:Record<string,number>={},cashByMonth:Record<string,number>={},dailyWages:Record<string,number>={}):PayoutMarker[]{
  if(!settings)return []
  const events:PayoutMarker[]=[]
  for(let back=0;back<=3;back++){
    const earningMonth=shiftMonth(viewMonth,-back)
    const matching=settings.paymentRules.filter(rule=>rule.enabled&&paymentDate(earningMonth,rule.monthOffset,rule.day).startsWith(viewMonth))
    if(!matching.length)continue
    const analytics=buildMonthAnalytics(shifts,earningMonth,settings,salesByMonth[earningMonth]??0,unitsByMonth[earningMonth]??0,performance,goals[earningMonth]??performance.defaultTarget,cashByMonth[earningMonth]??0,dailyWages)
    for(const rule of matching){
      const detail=analytics.forecast?.events.find(event=>event.id===rule.id)
      events.push({id:`${earningMonth}:${rule.id}`,date:paymentDate(earningMonth,rule.monthOffset,rule.day),
        title:rule.title,sourceMonth:earningMonth,source:rule.source,amount:detail?.amount??null})
    }
  }
  return events.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title))
}

export function recentMonths(viewMonth:string,count=6):string[]{
  if(!Number.isInteger(count)||count<1||count>24)throw Error('Некоректна кількість місяців.')
  return Array.from({length:count},(_,i)=>shiftMonth(viewMonth,i-count+1))
}
