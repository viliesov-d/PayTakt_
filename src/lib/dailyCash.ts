/** Optional daily cash ledger. Amounts are integer minor units of the workspace currency; they are NOT wages.
 * Zero can be stored; an absent record is different from recorded zero cash.
 */
import {segmentHours,type Shift} from './calendar.ts'
import {calendarSalaryNorm,type PaySettings} from './salary.ts'
export type DailyCash = {date:string;amount:number}
export type CashPreferences = {enabled:boolean;useForSales:boolean}
export const defaultCashPreferences:CashPreferences={enabled:false,useForSales:false}
const DATE=/^(19\d\d|20\d\d|2100)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
export function validateDailyCash(record:DailyCash):void{
  if(!record || !DATE.test(record.date) || Number.isNaN(Date.parse(record.date+'T12:00:00')) ||
    new Date(record.date+'T12:00:00').toISOString().slice(0,10)!==record.date ||
    !Number.isSafeInteger(record.amount) || record.amount<0 || record.amount>100_000_000_000)
    throw Error('Каса: введи коректну дату та суму від 0 до 1 млрд одиниць валюти простору.')
}
export function validateCashPreferences(p:CashPreferences):void{
  if(typeof p.enabled!=='boolean'||typeof p.useForSales!=='boolean'||(p.useForSales&&!p.enabled))
    throw Error('Неправильні налаштування каси.')
}
/** Exclude cancelled, unpaid and other nonworking days. A missing shift is not cash work. */
export function activeDailyCash(records:readonly DailyCash[],shifts:readonly Shift[]):DailyCash[]{
  const active=new Set(shifts.filter(s=>(s.dayType??'work')==='work').map(s=>s.date))
  return records.filter(r=>active.has(r.date)).sort((a,b)=>a.date.localeCompare(b.date))
}
export function cashTotalsByMonth(records:readonly DailyCash[],shifts:readonly Shift[]):Record<string,number>{
  const result:Record<string,number>={}
  for(const item of activeDailyCash(records,shifts)){
    const month=item.date.slice(0,7)
    result[month]=(result[month]??0)+item.amount
  }
  return result
}
/** Explicit choice: use daily cash totals INSTEAD OF manually entered monthly revenue.
 * Never add the two sources, which would double count sales commissions.
 */
export function effectiveRevenue(manual:Record<string,number>,records:readonly DailyCash[],shifts:readonly Shift[],prefs:CashPreferences):Record<string,number>{
  if(!prefs.enabled||!prefs.useForSales)return manual
  return cashTotalsByMonth(records,shifts)
}
/** Legacy function name; parse user-entered major currency units into integer hundredths. */
export function parseCashHryvnia(input:string):number{
  const normalized=input.trim().replace(',','.')
  if(!/^(?:\d+)(?:\.\d{1,2})?$/.test(normalized))throw Error('Введи суму каси у валюті робочого простору, наприклад 12500,50.')
  const [whole,frac='']=normalized.split('.')
  const amount=Number(whole)*100+Number(frac.padEnd(2,'0'))
  if(!Number.isSafeInteger(amount)||amount>100_000_000_000)throw Error('Сума каси завелика.')
  return amount
}

/** Daily BASE pay estimate for the cash journal (never a final payroll amount).
 * Bonuses, tier multipliers, sales commissions, night/overtime and per-unit
 * allocations must be read from the full monthly pay calculation instead.
 */
export function estimatedDailyBaseWage(date:string,shifts:readonly Shift[],settings:PaySettings|null):number|null{
  if(!settings)return null
  const shift=shifts.find(s=>s.date===date)
  if(!shift || (shift.dayType??'work')!=='work')return null
  const confirmed=[shift,...(shift.additionalShifts??[])].filter(s=>s.status==='worked')
  if(!confirmed.length)return null
  const regularHours=confirmed.reduce((sum,s)=>sum+segmentHours(s),0)
  if(settings.mode==='per_unit')return null // unit sales are stored by month, not allocated per day
  if(settings.mode==='hourly')return Math.round(regularHours*settings.hourlyRate)
  if(settings.mode==='per_shift')return confirmed.length*settings.shiftRate
  const norm=settings.monthlyNormSource==='calendar'
    ? calendarSalaryNorm(shifts,date.slice(0,7),settings)
    : {days:settings.monthlyNormDays,minutes:settings.monthlyNormDays*settings.monthlyBaseMinutesPerDay}
  if(settings.monthlyAccrualBasis==='days')return norm.days>0?Math.round(settings.monthlySalary/norm.days):null
  const paidMinutes=Math.max(0,Math.round(regularHours*60)-(settings.overtimeEntryMode==='marked'?(shift.overtimeMinutes??0):0))
  const cap=settings.monthlyNormSource==='calendar'?(shift.plannedMinutes??0):settings.monthlyBaseMinutesPerDay
  return norm.minutes>0?Math.round(settings.monthlySalary*Math.min(paidMinutes,cap)/norm.minutes):null
}
