/** First-run onboarding: deterministic, editable recommendations. Amounts in hryvnias in the draft,
 * and in integer kopeks only after building the persisted payroll settings. */
import {defaultPaySettings,defaultPaymentRules,type PayMode,type PaySettings,type PaymentRule} from './salary.ts'
import {defaultPerformanceSettings,type PerformanceSettings,type PlanMetric} from './performance.ts'
import {mondayOfWeek,presetPattern,workSlot,offSlot,generateMonthlyPattern,validatePattern,type PatternDay,type TemplatePreset,type GeneratedCalendarDay} from './schedule.ts'
import {suggestions,type Sector} from './professions.ts'

export type OnboardingDraft={
  sector:Sector
  preset:TemplatePreset
  start:string
  end:string
  breakMinutes:number
  anchorDate:string
  customWork:number
  customOff:number
  mode:PayMode
  rate:string
  manualDailyPay:boolean
  overtimeHourlyRate:string
  overtimeMode:'none'|'quick'|'automatic'
  overtimeAfterHours:number
  overtimeHoursPerDay:number
  unitName:string
  overtime:boolean
  overtimePercent:number
  night:boolean
  cash:boolean
  plan:boolean
  planMetric:PlanMetric
  planTarget:string
  planBonus:string
  payout:'split'|'fixed'|'all'
  advance:string
  advanceDay:number
  salaryDay:number
  bonusDay:number
}
export const wizardSteps=['Сфера роботи','Графік','Оплата','Понаднормові','Години понаднормових','Додаткові можливості','Виплати','Перевірка'] as const
export const visibleWizardSteps=(mode:OnboardingDraft['overtimeMode'])=>mode==='none'?wizardSteps.filter(step=>step!=='Години понаднормових'):[...wizardSteps]
export function initialOnboardingDraft(today=new Date()):OnboardingDraft{
  const anchor=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`
  return {sector:'other',preset:'5/2-weekdays',start:'09:00',end:'18:00',breakMinutes:60,
    anchorDate:anchor,customWork:2,customOff:2,mode:'monthly',rate:'',unitName:'завдання',manualDailyPay:false,overtimeHourlyRate:'',overtimeMode:'none',overtimeAfterHours:8,overtimeHoursPerDay:2,
    overtime:false,overtimePercent:120,night:false,cash:false,plan:false,planMetric:'earnings',planTarget:'',planBonus:'',
    payout:'split',advance:'',advanceDay:25,salaryDay:10,bonusDay:15}
}
export function scheduleChoices(sector:Sector):TemplatePreset[]{
  // The user can always choose any schedule; the first choices are industry recommendations.
  const common:TemplatePreset[]=['5/2-weekdays','2/2','4/2','3/3','5/2','day-night-48','duty-24-72','custom']
  return [...new Set([...suggestions[sector].map(item=>item.shift),...common])]
}
export function payChoices(sector:Sector):PayMode[]{
  return [...new Set([...suggestions[sector].map(item=>item.mode), 'monthly','hourly','per_shift','per_unit'] as PayMode[])]
}
export function hryvniasToKopeks(value:string):number{
  const raw=value.trim().replace(/\s/g,'').replace(',','.')
  if(!/^\d{1,9}(\.\d{1,2})?$/.test(raw))throw Error('Вкажи коректну суму у гривнях (до двох знаків після коми).')
  const [whole,fraction='']=raw.split('.')
  const result=Number(whole)*100+Number(fraction.padEnd(2,'0'))
  if(!Number.isSafeInteger(result)||result>100_000_000_000)throw Error('Сума завелика.')
  return result
}
export function schedulePattern(d:OnboardingDraft):PatternDay[]{
  if(d.preset==='custom'&&(!Number.isInteger(d.customWork)||!Number.isInteger(d.customOff)||d.customWork<1||d.customWork>14||d.customOff<0||d.customOff>14||d.customWork+d.customOff>28))throw Error('Власний цикл: 1–14 робочих і 0–14 вихідних.')
  const base=d.preset==='custom'?
    [...Array.from({length:d.customWork},()=>workSlot()),...Array.from({length:d.customOff},()=>offSlot())]:
    presetPattern(d.preset)
  // Keep the distinct day/night and 24-hour times from specialized presets.
  // Otherwise overriding every work slot would silently turn a night duty into a day shift.
  const specialized=['day-night-48','night-2/2','duty-24-72'].includes(d.preset)
  const pattern=base.map(slot=>slot.type==='work'&&!specialized?{...slot,start:d.start,end:d.end,breakMinutes:d.breakMinutes}:slot)
  validatePattern(pattern)
  return pattern
}

/** Hours entered in the follow-up wizard question; persisted via the calendar preset.
 * Allowed half-hour increments make the one-tap button predictable. */
export function overtimeDailyMinutes(d:OnboardingDraft):number{
  const hours=d.overtimeHoursPerDay
  if(!Number.isFinite(hours)||hours<0.5||hours>12||!Number.isInteger(hours*2))
    throw Error('Вкажи від 0,5 до 12 годин понаднормових на добу (крок — 30 хв).')
  return Math.round(hours*60)
}
function addMinutesToClock(time:string,minutes:number):string{
  const total=(Number(time.slice(0,2))*60+Number(time.slice(3))+minutes)%1440
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`
}
/** Keeps normal scheduled hours as the salary denominator, even when an automatic
 * overtime choice extends the worked shift. A 24-hour duty cannot be extended. */
export function onboardingCalendarDays(d:OnboardingDraft,month:string,anchorDate:string):GeneratedCalendarDay[]{
  const days=generateMonthlyPattern({month,anchorDate,pattern:schedulePattern(d)})
  if(d.overtimeMode!=='automatic')return days
  const extra=overtimeDailyMinutes(d)
  return days.map(day=>{
    if(day.dayType!=='work')return day
    const total=day.plannedMinutes+day.breakMinutes+extra
    if(total>1440)throw Error('Добова зміна не може вмістити стільки понаднормових. Обери меншу кількість або режим кнопки.')
    return {...day,end:addMinutesToClock(day.end,extra),note:`${day.note} · +${d.overtimeHoursPerDay} год понаднормових`}
  })
}
/** Preset visible in the calendar and in advanced settings. No invented clock time. */
export function onboardingOvertimePreset(d:OnboardingDraft){
  const first=schedulePattern(d).find(day=>day.type==='work')!
  return {start:first.end,end:addMinutesToClock(first.end,overtimeDailyMinutes(d)),breakMinutes:0,basisPoints:d.overtimePercent*100}
}

export function onboardingMonthKeys(today=new Date()):string[]{
  return [0,1].map(offset=>{
    const date=new Date(today.getFullYear(),today.getMonth()+offset,1)
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
  })
}
export function previewOnboardingSchedule(d:OnboardingDraft,today=new Date()):GeneratedCalendarDay[]{
  const month=onboardingMonthKeys(today)[0]
  const anchor=d.preset==='5/2-weekdays'?mondayOfWeek(`${month}-01`):d.anchorDate
  return onboardingCalendarDays(d,month,anchor)
}
export function makeOnboardingPaySettings(d:OnboardingDraft):PaySettings{
  const rate=d.manualDailyPay?0:hryvniasToKopeks(d.rate)
  if(!d.manualDailyPay && rate<=0)throw Error('Вкажи свою ставку або оклад. Суму можна змінити пізніше.')
  const overtimeOn=d.overtimeMode!=='none'||d.overtime
  if(d.manualDailyPay&&(overtimeOn||d.night)&&!d.overtimeHourlyRate.trim())throw Error('Для доплат із ручною оплатою вкажи базову ставку за годину.')
  const referenceRate=d.manualDailyPay&&(overtimeOn||d.night)?hryvniasToKopeks(d.overtimeHourlyRate):0
  if(d.manualDailyPay&&(overtimeOn||d.night)&&referenceRate<=0)throw Error('Для доплат із ручною оплатою вкажи базову ставку за годину.')
  if(overtimeOn)overtimeDailyMinutes(d)
  if(overtimeOn&&(!Number.isInteger(d.overtimeAfterHours)||d.overtimeAfterHours<1||d.overtimeAfterHours>23))throw Error('Поріг понаднормових: від 1 до 23 годин.')
  if(overtimeOn&&(!Number.isInteger(d.overtimePercent)||d.overtimePercent<100||d.overtimePercent>1000))
    throw Error('Коефіцієнт понаднормових: від 100% до 1000%.')
  if(d.mode==='per_unit'&&(!d.unitName.trim()||d.unitName.trim().length>40))throw Error('Назви одиницю роботи (наприклад, доставка).')
  const rules:PaymentRule[]=defaultPaymentRules.map(rule=>({...rule}))
  if(d.payout==='fixed'){
    const advance=hryvniasToKopeks(d.advance)
    rules[0]={...rules[0],method:'fixed',amount:advance,day:d.advanceDay}
  }else if(d.payout==='all'){
    rules[0]={...rules[0],enabled:false}
    rules[1]={...rules[1],monthOffset:0,day:d.salaryDay}
  }
  if(d.payout!=='all')rules[1]={...rules[1],day:d.salaryDay}
  rules[2]={...rules[2],day:d.bonusDay}
  const pay:PaySettings={...defaultPaySettings,sector:d.sector,
    mode:d.manualDailyPay?'hourly':d.mode,
    hourlyRate:d.manualDailyPay?referenceRate:d.mode==='hourly'?rate:0,shiftRate:d.manualDailyPay?0:d.mode==='per_shift'?rate:0,
    monthlySalary:d.manualDailyPay?0:d.mode==='monthly'?rate:0,unitRate:d.manualDailyPay?0:d.mode==='per_unit'?rate:0,unitName:d.unitName.trim()||'завдання',
    monthlyNormSource:'calendar',monthlyBaseMinutesPerDay:Math.max(1,(()=>{const first=schedulePattern(d).find(x=>x.type==='work');return first?paidMinutes(first.start,first.end,first.breakMinutes):480})()),monthlyAutoHourlyRate:true,
    overtimeEnabled:overtimeOn, overtimeThresholdMinutes:d.overtimeAfterHours*60, overtimeEntryMode:d.overtimeMode==='automatic'?'automatic':'marked',markedOvertimeBasisPoints:d.overtimePercent*100,
    bandEnabled:d.overtimeMode==='automatic',bandPeriod:'day',
    bands:d.overtimeMode==='automatic'?[{id:'base',afterMinutes:0,multiplierBasisPoints:10000},{id:'overtime',afterMinutes:d.overtimeAfterHours*60,multiplierBasisPoints:d.overtimePercent*100}]:defaultPaySettings.bands,
    nightEnabled:d.night,paymentRules:rules,
  }
  return pay
}
function paidMinutes(start:string,end:string,breakM:number){
  const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3))
  return ((minutes(end)-minutes(start)+1440)%1440||1440)-breakM
}
export function makeOnboardingPerformance(d:OnboardingDraft):PerformanceSettings{
  if(!d.plan)return {...defaultPerformanceSettings,manualDailyPay:d.manualDailyPay}
  const target=d.planMetric==='units'?Number(d.planTarget):hryvniasToKopeks(d.planTarget)
  if(!Number.isSafeInteger(target)||target<=0||target>100_000_000_000)
    throw Error('Вкажи місячний план більше нуля.')
  const bonus=hryvniasToKopeks(d.planBonus)
  return {...defaultPerformanceSettings,enabled:true,manualDailyPay:d.manualDailyPay,metric:d.planMetric,defaultTarget:target,
    tiers:[{id:'goal100',thresholdBasisPoints:10000,bonus}]}
}
export function validateOnboardingDraft(d:OnboardingDraft):void{
  if(!suggestions[d.sector])throw Error('Обери сферу роботи.')
  if(d.preset==='custom'&&(!Number.isInteger(d.customWork)||d.customWork<1||d.customWork>14||!Number.isInteger(d.customOff)||d.customOff<0||d.customOff>14||d.customWork+d.customOff>28))throw Error('Власний цикл: 1–14 робочих і 0–14 вихідних.')
  if(!/^\d{4}-\d\d-\d\d$/.test(d.anchorDate)||Number.isNaN(Date.parse(d.anchorDate)))throw Error('Перевір дату початку графіка.')
  schedulePattern(d)
  if(d.overtimeMode==='automatic'){
    const month=onboardingMonthKeys()[0]
    onboardingCalendarDays(d,month,d.preset==='5/2-weekdays'?mondayOfWeek(`${month}-01`):d.anchorDate)
  }
  if(!['none','quick','automatic'].includes(d.overtimeMode))throw Error('Обери спосіб обліку понаднормових.')
  if(!d.cash && d.plan && d.planMetric==='cash')throw Error('Для плану за касою потрібно ввімкнути касу.')
  makeOnboardingPaySettings(d)
  makeOnboardingPerformance(d)
  for(const day of [d.advanceDay,d.salaryDay,d.bonusDay])if(!Number.isInteger(day)||day<1||day>31)throw Error('День виплати має бути від 1 до 31.')
}
