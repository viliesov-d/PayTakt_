/** Cash-flow forecast for one earnings month (not a record of bank payments).
 * Rules are applied in the order shown in the editor, separately for earnings and bonuses.
 */
import type {PaySettings,PayResult,PaymentRule,PaymentSource} from './salary.ts'
import {calculatePay,validatePaymentRules} from './salary.ts'
import type {Shift} from './calendar.ts'

const bonusCodes = new Set(['month','unit-plan','sales-plan','performance-plan'])
export const isBonusLine=(code:string):boolean=>bonusCodes.has(code)||code.startsWith('custom:')
export type PaymentEvent={
  id:string;title:string;date:string;source:PaymentSource;method:PaymentRule['method'];
  amount:number;requested:number;shortfall:number
}
export type PaymentForecast={
  month:string;earnings:number;bonuses:number;gross:number;
  firstHalfEarnings:number;events:PaymentEvent[];
  unallocatedEarnings:number;unallocatedBonuses:number
}

export function paymentDate(month:string,offset:number,day:number):string {
  if(!/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month) ||
    !Number.isInteger(offset)||offset<0||offset>3||!Number.isInteger(day)||day<1||day>31)
    throw Error('Некоректна дата виплати.')
  const [y,m]=month.split('-').map(Number)
  const target=new Date(Date.UTC(y,m-1+offset,1))
  const year=target.getUTCFullYear(),monthNumber=target.getUTCMonth()+1
  const last=new Date(Date.UTC(year,monthNumber,0)).getUTCDate()
  return `${year}-${String(monthNumber).padStart(2,'0')}-${String(Math.min(day,last)).padStart(2,'0')}`
}

/** Preserve the full calendar norm while excluding all work performed after the 15th.
 * Both regular shifts and independent overtime must be reset: ignoring overtimeExtra
 * here made post-15th overtime incorrectly appear in the first-half advance.
 * Original entries are never mutated.
 */
export function firstHalfOnlyShifts(shifts:readonly Shift[],month:string):Shift[] {
  return shifts.map(s=>s.date.slice(0,7)===month && Number(s.date.slice(-2))>15 ? {
    ...s,
    status:'planned' as const,
    additionalShifts:s.additionalShifts?.map(x=>({...x,status:'planned' as const})),
    overtimeExtra:s.overtimeExtra?{...s.overtimeExtra,status:'planned' as const}:undefined,
  }:s)
}

export function calculatePaymentForecast(
  shifts:readonly Shift[],month:string,settings:PaySettings,payResult:PayResult,firstHalfResult?:PayResult,
):PaymentForecast {
  validatePaymentRules(settings.paymentRules)
  if(payResult.month!==month)throw Error('Місяць зарплати та календаря виплат не збігаються.')
  const bonuses=payResult.lines.filter(x=>isBonusLine(x.code)).reduce((s,x)=>s+x.amount,0)
  const earnings=payResult.gross-bonuses
  // First-half advance estimates only shift-based earnings (no monthly sales/units/bonuses).
  // Preserve the *entire month's planned norm* while excluding post-15th worked entries.
  // Filtering out the second half would falsely inflate first-half salary under calendar-based norms.
  const firstHalfShifts=firstHalfOnlyShifts(shifts,month)
  const first=firstHalfResult??calculatePay(firstHalfShifts,month,settings)
  const firstHalfEarnings=Math.min(earnings,first.lines.filter(x=>
    x.code==='base'||x.code==='manual-day'||x.code==='manual-tier-premium'||x.code==='added-overtime'||x.code.startsWith('tier:')||x.code==='night'||x.code==='marked-overtime'||x.code==='workday'||x.code==='extra',
  ).reduce((s,x)=>s+x.amount,0))
  const remaining:Record<PaymentSource,number>={earnings,bonus:bonuses}
  const events:PaymentEvent[]=[]
  for(const rule of settings.paymentRules){
    if(!rule.enabled)continue
    const full=rule.source==='earnings'?earnings:bonuses
    const requested=rule.method==='fixed'?rule.amount
      :rule.method==='percent'?Math.round(full*rule.amount/10000)
      :rule.method==='first_half'?firstHalfEarnings
      :remaining[rule.source]
    // Clamp planned allocations to accrued gross; a large fixed advance is reported as a shortfall.
    const allocated=Math.min(remaining[rule.source],requested)
    remaining[rule.source]-=allocated
    events.push({id:rule.id,title:rule.title,date:paymentDate(month,rule.monthOffset,rule.day),
      source:rule.source,method:rule.method,amount:allocated,requested,shortfall:requested-allocated})
  }
  events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))
  return {month,earnings,bonuses,gross:payResult.gross,firstHalfEarnings,events,
    unallocatedEarnings:remaining.earnings,unallocatedBonuses:remaining.bonus}
}
