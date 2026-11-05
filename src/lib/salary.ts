/** PayTakt v0.7: deterministic *estimated* gross pay engine. Money is integer kopeks.
 * Night-hours split assumes unpaid break time is distributed proportionally across a shift;
 * it cannot identify exact unpaid-break placement without more time-entry fields.
 * DST and jurisdiction-specific payroll rules are NOT implemented.
 */
import {validateDay, overtimeExtraMinutes, type Shift, type AdditionalShift} from './calendar.ts'
import {formatMoney} from './presentation.ts'

export type PayMode = 'hourly' | 'per_shift' | 'monthly' | 'per_unit'
export type BandPeriod = 'shift' | 'day' | 'week' | 'month'
export type HourBand = { id: string; afterMinutes: number; multiplierBasisPoints: number }
export type MonthlyUnits = { month: string; count: number }
/** Ordered forecast allocations. Each source has its own balance. 'remainder' must be last per source. */
export type PaymentSource = 'earnings' | 'bonus'
export type PaymentMethod = 'fixed' | 'percent' | 'first_half' | 'remainder'
export type PaymentRule = {
  id:string
  title:string
  source:PaymentSource
  method:PaymentMethod
  amount:number // kopeks for fixed, basis points (10000=100%) for percent, 0 otherwise
  day:number // 1..31, clamped to last day of target month
  monthOffset:number // 0 = accrual month, 1..3 = future months
  enabled:boolean
}
export const defaultPaymentRules:PaymentRule[] = [
  {id:'advance',title:'Аванс за першу половину',source:'earnings',method:'first_half',amount:0,day:25,monthOffset:0,enabled:true},
  {id:'salary',title:'Залишок зарплати',source:'earnings',method:'remainder',amount:0,day:10,monthOffset:1,enabled:true},
  {id:'bonus',title:'Премії',source:'bonus',method:'remainder',amount:0,day:15,monthOffset:1,enabled:true},
]
export function validatePaymentRules(rules:PaymentRule[]):void {
  if (!Array.isArray(rules) || rules.length<1 || rules.length>12) throw Error('Календар виплат: від 1 до 12 подій.')
  const ids = new Set<string>()
  const remainderSeen = new Set<PaymentSource>()
  for (const item of rules) {
    if (!item || typeof item.id!=='string' || !/^[a-zA-Z0-9_-]{1,70}$/.test(item.id) || ids.has(item.id) ||
        typeof item.title!=='string' || !item.title.trim() || item.title.length>80 ||
        !['earnings','bonus'].includes(item.source) || !['fixed','percent','first_half','remainder'].includes(item.method) ||
        typeof item.enabled!=='boolean' || !Number.isInteger(item.day) || item.day<1 || item.day>31 ||
        !Number.isInteger(item.monthOffset) || item.monthOffset<0 || item.monthOffset>3 ||
        !Number.isSafeInteger(item.amount) || item.amount<0 || item.amount>(item.method==='percent'?10000:100_000_000_000) ||
        (item.method==='first_half' && item.source!=='earnings'))
      throw Error('Перевір тип, дату, суму та назву події виплати.')
    ids.add(item.id)
    if(!item.enabled)continue
    if(remainderSeen.has(item.source)) throw Error('Виплата залишку повинна бути останньою активною подією для відповідної категорії.')
    if(item.method==='remainder')remainderSeen.add(item.source)
  }
  if(!remainderSeen.has('earnings')) throw Error('Додай активну подію для виплати залишку зарплати.')
  if(!remainderSeen.has('bonus')) throw Error('Додай активну подію для виплати залишку премій.')
}
export type CustomRule = {
  id: string
  title: string
  trigger: 'hours_at_least' | 'days_at_least' | 'shifts_at_least' | 'units_at_least'
  threshold: number // integer paid minutes for hours_at_least; otherwise count
  bonus: number // fixed kopeks, once per calendar month when triggered
}
export type PaySettings = {
  version: 5
  mode: PayMode
  sector: string
  hourlyRate: number // also the reference hourly rate for night/overtime supplements
  shiftRate: number
  monthlySalary: number
  monthlyNormDays: number // legacy/manual fallback
  monthlyNormSource: 'calendar' | 'manual'
  /** Calendar-norm rule: exclude user-marked ordinary days off, but keep unpaid leave in denominator. */
  monthlyOffDayNormMode: 'exclude_off' | 'keep_planned'
  overtimeEntryMode: 'automatic' | 'marked'
  markedOvertimeBasisPoints: number // 12000=120% of hourly reference
  monthlyBaseMinutesPerDay: number // standard paid minutes (e.g. 480)
  monthlyAccrualBasis: 'days' | 'hours' // full workday or capped hours for each calendar day
  monthlyAutoHourlyRate: boolean // derive reference rate from salary/norm/day-hours
  monthlyOvertimeMode: 'full' | 'premium' // full 120% vs extra +20%
  paymentRules: PaymentRule[]
  workdayBonus: number
  extraShiftBonus: number
  monthlyBonus: number
  nightEnabled: boolean
  nightStart: string
  nightEnd: string
  nightBonusBasisPoints: number // 3000 = 30% additional hourly reference pay
  overtimeEnabled: boolean
  overtimeThresholdMinutes: number // monthly threshold in paid minutes
  overtimeBonusBasisPoints: number // deprecated v2 compatibility only, never used for v3 calculation
  bandEnabled: boolean
  bandPeriod: BandPeriod
  bands: HourBand[] // first band at minute 0; subsequent thresholds relative to period
  unitName: string // "доставка", "виріб", "завдання"...
  unitRate: number // kopeks / completed unit
  unitBonusEnabled: boolean // pay per unit in addition to hourly, shift or salary
  unitPlan: number // count threshold
  unitPlanBonus: number // kopeks once at goal
  salesCommissionBasisPoints: number // 500 = 5% of reported monthly sales
  salesPlan: number // sales target in kopeks; zero disables sales target award
  salesPlanBonus: number // fixed award when sales >= target
  customRules: CustomRule[]
}
export type MonthlySales = { month: string; amount: number }
export type PayLine = { code: string; title: string; details: string; amount: number }
export type PayResult = {
  month: string
  workedMinutes: number
  scheduledDays: number
  scheduledMinutes: number
  markedOvertimeMinutes: number
  nightPaidMinutes: number
  overtimeMinutes: number
  workedDays: number
  workedSegments: number
  extraSegments: number
  salesAmount: number
  salesPlanReached: boolean
  unitsCount: number
  unitPlanReached: boolean
  lines: PayLine[]
  gross: number
}
export const defaultPaySettings: PaySettings = {
  version:5, mode:'hourly', sector:'other', hourlyRate:0, shiftRate:0, monthlySalary:0,
  monthlyNormDays:20, monthlyNormSource:'calendar', monthlyOffDayNormMode:'exclude_off', overtimeEntryMode:'automatic', markedOvertimeBasisPoints:12000, monthlyBaseMinutesPerDay:480, monthlyAccrualBasis:'days', monthlyAutoHourlyRate:true, monthlyOvertimeMode:'full',
  paymentRules:defaultPaymentRules.map(rule=>({...rule})), workdayBonus:0, extraShiftBonus:0, monthlyBonus:0,
  nightEnabled:false, nightStart:'22:00', nightEnd:'06:00', nightBonusBasisPoints:3000,
  overtimeEnabled:false, overtimeThresholdMinutes:9600, overtimeBonusBasisPoints:5000,
  bandEnabled:false, bandPeriod:'day', bands:[
    {id:'base', afterMinutes:0, multiplierBasisPoints:10000},
    {id:'after8h', afterMinutes:480, multiplierBasisPoints:12000},
  ],
  unitName:'завдання', unitRate:0, unitBonusEnabled:false, unitPlan:0, unitPlanBonus:0,
  salesCommissionBasisPoints:0, salesPlan:0, salesPlanBonus:0, customRules:[],
}
const MAX_AMOUNT = 100_000_000_000
const MAX_BASIS_POINTS = 100_000 // 1000%
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
const monthPattern = /^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/
const roundMoney = (value: number): number => {
  if (!Number.isFinite(value) || Math.abs(value)>Number.MAX_SAFE_INTEGER) throw Error('Занадто велика сума для розрахунку.')
  return Math.round(value)
}
const minutesOf = (clock: string): number => {
  if (!timePattern.test(clock)) throw Error('Некоректний час зміни або нічного періоду.')
  return Number(clock.slice(0,2))*60 + Number(clock.slice(3))
}
const isMoney = (n: number) => Number.isSafeInteger(n) && n>=0 && n<=MAX_AMOUNT
const isBasisPoints = (n: number) => Number.isSafeInteger(n) && n>=0 && n<=MAX_BASIS_POINTS
export function validateMonthlyUnits(record:MonthlyUnits):void {
  if (!monthPattern.test(record.month) || !Number.isSafeInteger(record.count) || record.count<0 || record.count>1000000000)
    throw Error('Кількість виконаних одиниць повинна бути від 0 до 1 млрд.')
}
export function validateMonthlySales(record:MonthlySales):void {
  if (!monthPattern.test(record.month) || !isMoney(record.amount)) throw Error('Некоректні дані продажів за місяць.')
}
/** v1-v3 policies migrate in memory; only explicit save writes v4. */
export function normalizePaySettings(raw:unknown):PaySettings {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) throw Error('Некоректні налаштування зарплати.')
  const source=raw as Record<string,unknown>
  if (![1,2,3,4,5].includes(Number(source.version))) throw Error('Непідтримувана версія правил зарплати.')
  let merged:PaySettings
  if (source.version===1) {
    const keep=['mode','hourlyRate','shiftRate','monthlySalary','monthlyNormDays','workdayBonus','extraShiftBonus','monthlyBonus'] as const
    const picked:Record<string,unknown>={}
    for(const k of keep) picked[k]=source[k]
    merged={...defaultPaySettings,...picked} as PaySettings
  } else if(source.version===2) {
    merged={...defaultPaySettings,...source} as PaySettings
    if(source.overtimeEnabled===true){
      const threshold=Number(source.overtimeThresholdMinutes)
      const supplement=Number(source.overtimeBonusBasisPoints)
      merged={...merged,bandEnabled:true,bandPeriod:'month',bands:[
        {id:'base',afterMinutes:0,multiplierBasisPoints:10000},
        {id:'migrated_overtime',afterMinutes:threshold,multiplierBasisPoints:10000+supplement},
      ]}
    }
  } else {
    merged={...defaultPaySettings,...source} as PaySettings
  }
  // Preserve v3 non-hourly tier meaning (+20%, not the full 120%). New policies default to full overtime.
  if(source.version!==4 && source.version!==5){
    merged.monthlyOvertimeMode='premium'
    merged.monthlyAutoHourlyRate=false // preserve previous explicitly configured rate when upgrading
  }
  if(source.version!==5){
    merged.monthlyNormSource='manual' // preserve already-saved historical salary amounts until user opts into calendar norm
    merged.overtimeEntryMode='automatic'
    merged.markedOvertimeBasisPoints=12000
    merged.sector='other'
  }
  // Preserve historical rates for saved v1-v5 documents that predate the opt-in off-day rule.
  if (!('monthlyOffDayNormMode' in source)) merged.monthlyOffDayNormMode='keep_planned'
  const value={...merged,version:5 as const}
  validatePaySettings(value)
  return value
}
export function validatePaySettings(value:PaySettings):void {
  if (value.version!==5 || typeof value.sector !== 'string' || value.sector.length>40 || !['hourly','per_shift','monthly','per_unit'].includes(value.mode)) throw Error('Невідомий тип оплати.')
  for (const key of ['hourlyRate','shiftRate','monthlySalary','workdayBonus','extraShiftBonus','monthlyBonus','salesPlan','salesPlanBonus','unitRate','unitPlanBonus'] as const) {
    if (!isMoney(value[key])) throw Error('Усі суми повинні бути додатними числами з точністю до копійки.')
  }
  if(!Number.isInteger(value.monthlyNormDays) || value.monthlyNormDays<1 || value.monthlyNormDays>31) throw Error('Норма робочих днів повинна бути від 1 до 31.')
  if(!Number.isSafeInteger(value.monthlyBaseMinutesPerDay) || value.monthlyBaseMinutesPerDay<1 || value.monthlyBaseMinutesPerDay>1440 ||
      !['days','hours'].includes(value.monthlyAccrualBasis) || typeof value.monthlyAutoHourlyRate!=='boolean' ||
      !['full','premium'].includes(value.monthlyOvertimeMode)) throw Error('Перевір норму годин за день та тип оплати понаднормових.')
  if(!['manual','calendar'].includes(value.monthlyNormSource) || !['exclude_off','keep_planned'].includes(value.monthlyOffDayNormMode) || !['automatic','marked'].includes(value.overtimeEntryMode) ||
    !Number.isSafeInteger(value.markedOvertimeBasisPoints) || value.markedOvertimeBasisPoints<10000 || value.markedOvertimeBasisPoints>100000)
    throw Error('Перевір джерело норми та правила понаднормових годин.')
  validatePaymentRules(value.paymentRules)
  for(const key of ['nightBonusBasisPoints','overtimeBonusBasisPoints','salesCommissionBasisPoints'] as const) {
    if(!isBasisPoints(value[key])) throw Error('Відсоток повинен бути від 0 до 1000%.')
  }
  if (typeof value.nightEnabled!=='boolean' || typeof value.overtimeEnabled!=='boolean') throw Error('Некоректний перемикач надбавок.')
  const nightStart=minutesOf(value.nightStart), nightEnd=minutesOf(value.nightEnd)
  if(nightStart===nightEnd) throw Error('Нічний період не може мати однаковий початок і кінець.')
  if(!Number.isInteger(value.overtimeThresholdMinutes) || value.overtimeThresholdMinutes<1 || value.overtimeThresholdMinutes>744*60)
    throw Error('Поріг понаднормових годин має бути від 1 хвилини до 744 годин.')
  if (typeof value.bandEnabled!=='boolean' || !['shift','day','week','month'].includes(value.bandPeriod)) throw Error('Невідомий період тарифних ступенів.')
  if (!Array.isArray(value.bands) || value.bands.length<1 || value.bands.length>8) throw Error('Можна встановити від 1 до 8 тарифних ступенів.')
  const bandIds=new Set<string>()
  let prev=-1
  for(const band of value.bands){
    if(!band || typeof band.id!=='string' || !/^[a-zA-Z0-9_-]{1,70}$/.test(band.id) || bandIds.has(band.id)
      || !Number.isSafeInteger(band.afterMinutes) || band.afterMinutes<=prev || band.afterMinutes>44640
      || !Number.isSafeInteger(band.multiplierBasisPoints) || band.multiplierBasisPoints<10000 || band.multiplierBasisPoints>100000)
      throw Error('Перевір пороги та відсотки тарифних ступенів: пороги мають зростати, відсоток 100–1000%.')
    prev=band.afterMinutes;bandIds.add(band.id)
  }
  if(value.bands[0].afterMinutes!==0)throw Error('Перший тарифний ступінь починається з 0 годин.')
  if (typeof value.unitName!=='string' || !value.unitName.trim() || value.unitName.length>40)
    throw Error('Назва одиниці роботи має містити від 1 до 40 символів.')
  if(typeof value.unitBonusEnabled!=='boolean' || !Number.isSafeInteger(value.unitPlan) || value.unitPlan<0 || value.unitPlan>1000000000)
    throw Error('Некоректна кількість або налаштування виробітку.')
  if(!Array.isArray(value.customRules) || value.customRules.length>10) throw Error('Не більше 10 власних правил.')
  const ids=new Set<string>()
  for(const rule of value.customRules) {
    if(!rule || typeof rule.id!=='string' || !/^[a-zA-Z0-9_-]{1,70}$/.test(rule.id) || ids.has(rule.id) ||
      typeof rule.title!=='string' || !rule.title.trim() || rule.title.length>80 ||
      !['hours_at_least','days_at_least','shifts_at_least','units_at_least'].includes(rule.trigger) ||
      !Number.isSafeInteger(rule.threshold) || rule.threshold<1 || rule.threshold>100000 || !isMoney(rule.bonus))
      throw Error('Перевір назву, умову, поріг і суму власного правила.')
    ids.add(rule.id)
  }
}
function segmentDuration(part:Pick<AdditionalShift,'start'|'end'|'breakMinutes'>):{start:number;end:number;duration:number;paid:number} {
  const start=minutesOf(part.start),endClock=minutesOf(part.end)
  const duration=(endClock-start+1440)%1440 || 1440
  if(!Number.isInteger(part.breakMinutes) || part.breakMinutes<0 || part.breakMinutes>=duration)
    throw Error('Перерва має бути коротша за зміну.')
  return {start,end:start+duration,duration,paid:duration-part.breakMinutes}
}
/** Returns fraction of paid minutes in night window; proportional unpaid breaks estimate. */
function nightMinutes(part:Pick<AdditionalShift,'start'|'end'|'breakMinutes'>,nightStart:number,nightEnd:number):number {
  const s=segmentDuration(part)
  const span=(nightEnd-nightStart+1440)%1440
  let wallNight=0
  for(let day=-1;day<=1;day++) {
    const begin=nightStart+day*1440
    wallNight+=Math.max(0,Math.min(s.end,begin+span)-Math.max(s.start,begin))
  }
  return wallNight*s.paid/s.duration
}
function weekStart(date:string):string {
  const d=new Date(`${date}T00:00:00Z`)
  const day=(d.getUTCDay()+6)%7
  d.setUTCDate(d.getUTCDate()-day)
  return d.toISOString().slice(0,10)
}
export function tierBuckets(parts:readonly {date:string;key:string;paid:number}[],period:BandPeriod):number[]{
  const totals=new Map<string,number>()
  for(const part of parts){
    const group=period==='shift'?part.key:period==='day'?part.date:period==='week'?weekStart(part.date):part.date.slice(0,7)
    totals.set(group,(totals.get(group)??0)+part.paid)
  }
  return [...totals.values()]
}
/** Allocate each group's payable minutes among consecutive tiers; no minute is counted twice. */
export function allocateBands(groups:readonly number[],bands:readonly HourBand[]):number[]{
  const allocated=bands.map(()=>0)
  for(const total of groups){
    if(!Number.isSafeInteger(total)||total<0)throw Error('Невірні години для тарифних ступенів.')
    for(let i=0;i<bands.length;i++){
      const from=bands[i].afterMinutes
      const until=bands[i+1]?.afterMinutes??Infinity
      allocated[i]+=Math.max(0,Math.min(total,until)-from)
    }
  }
  return allocated
}
/** Which days contribute to the calendar-based monthly salary denominator.
 * A manually selected ordinary day off is excluded only when the user enables the new rule.
 * Unpaid leave, sickness and vacation retain the original planned day/minutes so
 * absence does not silently inflate the hourly/day rate. Manual norms are unchanged.
 */
export function countsTowardMonthlyNorm(shift:Pick<Shift,'plannedWorkday'|'dayType'>,settings:Pick<PaySettings,'monthlyOffDayNormMode'>):boolean {
  if (settings.monthlyOffDayNormMode==='exclude_off' && shift.dayType==='off') return false
  return shift.plannedWorkday ?? ((shift.dayType??'work')==='work')
}
export function calendarSalaryNorm(shifts:readonly Shift[], month:string,settings:Pick<PaySettings,'monthlyOffDayNormMode'>):{days:number;minutes:number} {
  let days=0,minutes=0
  for (const shift of shifts) {
    if(!shift.date.startsWith(month+'-') || !countsTowardMonthlyNorm(shift,settings)) continue
    days++
    minutes+=shift.plannedMinutes??Math.round(segmentDuration(shift).paid)
  }
  return {days,minutes}
}
export function calculatePay(shifts:readonly Shift[],month:string,settings:PaySettings,sales:MonthlySales={month,amount:0}, units:MonthlyUnits={month,count:0}):PayResult {
  validatePaySettings(settings)
  validateMonthlySales(sales)
  validateMonthlyUnits(units)
  if(!monthPattern.test(month) || sales.month!==month || units.month!==month) throw Error('Некоректний або невідповідний місяць.')
  let minutes=0, nightPaid=0, segments=0, extras=0, days=0, markedMinutes=0
  let scheduledDays=0, scheduledMinutes=0
  let addedOvertimeMinutes=0, addedOvertimeKopeksWeighted=0
  const normMinutesByDay=new Map<string,number>()
  const workedMinutesByDay=new Map<string,number>()
  const workedParts:{date:string;key:string;paid:number}[]=[]
  const seen=new Set<string>(),nightStart=minutesOf(settings.nightStart),nightEnd=minutesOf(settings.nightEnd)
  for(const shift of shifts) {
    if(!shift.date.startsWith(month+'-')) continue
    if(seen.has(shift.date)) throw Error('Знайдено дублікати днів у календарі.')
    seen.add(shift.date)
    validateDay(shift)
    const scheduled = countsTowardMonthlyNorm(shift,settings)
    if (scheduled) {
      scheduledDays++
      const planned=shift.plannedMinutes??Math.round(segmentDuration(shift).paid)
      scheduledMinutes+=planned
      normMinutesByDay.set(shift.date,planned)
    }
    if ((shift.dayType??'work')!=='work') continue
    if(shift.overtimeExtra?.status==='worked'){
      const overtimeMinutes=overtimeExtraMinutes(shift)
      addedOvertimeMinutes+=overtimeMinutes
      addedOvertimeKopeksWeighted+=overtimeMinutes*shift.overtimeExtra.basisPoints
      if(settings.nightEnabled) nightPaid+=nightMinutes(shift.overtimeExtra,nightStart,nightEnd)
      // The overtime segment is not added to base wage bands or the salary norm.
    }
    let hadWork=false
    const parts=[shift,...(shift.additionalShifts??[])]
    for(const [partIndex,part] of parts.entries()) {
      if(part.status!=='worked') continue
      const item=segmentDuration(part)
      minutes+=item.paid
      workedMinutesByDay.set(shift.date,(workedMinutesByDay.get(shift.date)??0)+item.paid)
      workedParts.push({date:shift.date,key:`${shift.date}-${partIndex}`,paid:item.paid})
      if(settings.nightEnabled) nightPaid+=nightMinutes(part,nightStart,nightEnd)
      segments++
      hadWork=true
      if(part.kind==='extra' || part.kind==='replacement') extras++
    }
    if(hadWork){
      if(settings.overtimeEntryMode==='marked' && (shift.overtimeMinutes??0)>(workedMinutesByDay.get(shift.date)??0))
        throw Error('Понаднормові за день перевищують фактично відпрацьовані години.')
      days++
      if(settings.overtimeEntryMode==='marked')markedMinutes+=(shift.overtimeMinutes??0)
    }
  }
  const lines:PayLine[]=[]
  const add=(code:string,title:string,details:string,amount:number)=>lines.push({code,title,details,amount:roundMoney(amount)})
  const normDays=settings.monthlyNormSource==='calendar'?scheduledDays:settings.monthlyNormDays
  const normPaidMinutes=settings.monthlyNormSource==='calendar'?scheduledMinutes:settings.monthlyNormDays*settings.monthlyBaseMinutesPerDay
  if(settings.mode==='monthly' && (normDays===0 || normPaidMinutes===0))
    throw Error('Спочатку заповни календар робочим графіком на цей місяць — це потрібно для автоматичної норми окладу.')
  const referenceHourlyRate=(settings.mode==='monthly' && settings.monthlyAutoHourlyRate)
    ? settings.monthlySalary*60/normPaidMinutes
    : settings.hourlyRate
  // Explicitly marked hours supersede automatic tariff thresholds to prevent double payment.
  const groups=tierBuckets(workedParts,settings.bandPeriod)
  const autoBands=settings.bandEnabled && settings.overtimeEntryMode==='automatic'
  const bandMinutes=autoBands?allocateBands(groups,settings.bands):[]
  if(settings.mode==='hourly') {
    if(autoBands){
      settings.bands.forEach((tier,i)=>{
        const time=bandMinutes[i]
        const percent=tier.multiplierBasisPoints/100
        add(`tier:${tier.id}`,`Погодинний тариф ${percent}%`,`${(time/60).toLocaleString('uk-UA',{maximumFractionDigits:2})} год × ${moneyUA(settings.hourlyRate)} × ${percent}%`,time*settings.hourlyRate*tier.multiplierBasisPoints/(60*10000))
      })
    } else {
      add('base','Погодинна оплата',`${(minutes/60).toLocaleString('uk-UA',{maximumFractionDigits:2})} год × ${moneyUA(settings.hourlyRate)}`,roundMoney(minutes*settings.hourlyRate/60))
    }
  }else if(settings.mode==='per_shift') {
    add('base','Позмінна оплата',`${segments} відпрацьованих змін`,segments*settings.shiftRate)
  }else if(settings.mode==='monthly') {
    if(settings.monthlyAccrualBasis==='days'){
      const counted=Math.min(normDays,days)
      add('base','Оклад (за відпрацьовані дні)',`${counted} / ${normDays} робочих днів за ${settings.monthlyNormSource==='calendar'?'календарем':'ручним нормативом'}`,roundMoney(settings.monthlySalary*counted/normDays))
    }else{
      const normalPaid=[...workedMinutesByDay.entries()].reduce((sum,[date,m])=>sum+Math.min(
        Math.max(0,m-(settings.overtimeEntryMode==='marked'?(shifts.find(s=>s.date===date)?.overtimeMinutes??0):0)),
        settings.monthlyNormSource==='calendar'?(normMinutesByDay.get(date)??0):settings.monthlyBaseMinutesPerDay),0)
      const norm=normPaidMinutes
      const counted=Math.min(norm,normalPaid)
      add('base','Оклад (за нормальні години)',`${(counted/60).toLocaleString('uk-UA',{maximumFractionDigits:2})} / ${norm/60} нормативних год`,roundMoney(settings.monthlySalary*counted/norm))
    }
  }else{
    add('base','Відрядна оплата',`${units.count} × ${moneyUA(settings.unitRate)} за ${settings.unitName}`,units.count*settings.unitRate)
  }
  if(autoBands && settings.mode!=='hourly'){
    settings.bands.forEach((tier,i)=>{
      const isFull=i>0 && settings.mode==='monthly' && settings.monthlyOvertimeMode==='full'
      const multiplier=isFull?tier.multiplierBasisPoints:tier.multiplierBasisPoints-10000
      if(multiplier<=0)return
      const label=isFull?`${tier.multiplierBasisPoints/100}% повної ставки`:`+${multiplier/100}% надбавки`
      add(`tier:${tier.id}`,`Понаднормові: ${label}`,`${(bandMinutes[i]/60).toLocaleString('uk-UA',{maximumFractionDigits:2})} год · ${label} · ${moneyUA(referenceHourlyRate)} за годину`,bandMinutes[i]*referenceHourlyRate*multiplier/(60*10000))
    })
  }
  if(addedOvertimeMinutes>0){
    add('added-overtime','Додаткові понаднормові за шаблоном',
      `${(addedOvertimeMinutes/60).toLocaleString('uk-UA',{maximumFractionDigits:2})} год · особисті тарифи за збереженим часом`,
      addedOvertimeKopeksWeighted*referenceHourlyRate/(60*10000))
  }
  if(settings.workdayBonus>0)add('workday','Доплата за відпрацьований день',`${days} днів`,days*settings.workdayBonus)
  if(settings.extraShiftBonus>0)add('extra','Доплата за додаткову / замінну зміну',`${extras} змін`,extras*settings.extraShiftBonus)
  if(settings.monthlyBonus>0)add('month','Місячна премія',days>0?'За наявності відпрацьованих змін':'Немає відпрацьованих змін',days>0?settings.monthlyBonus:0)
  const nightPaidMinutes=Math.round(nightPaid*100)/100
  if(settings.nightEnabled) {
    add('night','Нічна доплата (попередня)',`${(nightPaidMinutes/60).toLocaleString('uk-UA',{maximumFractionDigits:2})} оплачених год · ${settings.nightBonusBasisPoints/100}% від погодинної бази`,roundMoney(nightPaid*referenceHourlyRate*settings.nightBonusBasisPoints/(60*10000)))
  }
  const overtimeMinutes=autoBands?bandMinutes.slice(1).reduce((sum,n)=>sum+n,0):markedMinutes
  if(settings.overtimeEntryMode==='marked' && markedMinutes>0){
    const pct=settings.markedOvertimeBasisPoints
    // Hourly base already pays 100% for all worked hours, so only the premium is added.
    // Monthly days/hours base excludes overtime, therefore full rate is added on top.
    const delta=settings.mode==='monthly'? (settings.monthlyOvertimeMode==='full'?pct:pct-10000) :
      settings.mode==='hourly'?pct-10000:pct-10000
    add('marked-overtime','Понаднормові, позначені в календарі',
      `${(markedMinutes/60).toLocaleString('uk-UA',{maximumFractionDigits:2})} год × ${pct/100}% (доплата ${delta/100}%)`,
      markedMinutes*referenceHourlyRate*delta/(60*10000))
  }
  if(settings.mode!=='per_unit' && settings.unitBonusEnabled && units.count>0){
    add('units','Оплата за обсяг роботи',`${units.count} × ${moneyUA(settings.unitRate)} за ${settings.unitName}`,units.count*settings.unitRate)
  }
  const unitPlanReached=settings.unitPlan>0 && units.count>=settings.unitPlan
  if(settings.unitPlan>0 && settings.unitPlanBonus>0){
    add('unit-plan','Бонус за обсяг роботи',`${units.count} / ${settings.unitPlan} ${settings.unitName}`,unitPlanReached?settings.unitPlanBonus:0)
  }
  if(settings.salesCommissionBasisPoints>0) {
    add('commission','Відсоток від продажів',`${moneyUA(sales.amount)} × ${settings.salesCommissionBasisPoints/100}%`,roundMoney(sales.amount*settings.salesCommissionBasisPoints/10000))
  }
  const salesPlanReached=settings.salesPlan>0 && sales.amount>=settings.salesPlan
  if(settings.salesPlan>0 && settings.salesPlanBonus>0) {
    add('sales-plan','Премія за виконання плану',`${moneyUA(sales.amount)} / ${moneyUA(settings.salesPlan)} · ${salesPlanReached?'план виконано':'план не виконано'}`,salesPlanReached?settings.salesPlanBonus:0)
  }
  for(const rule of settings.customRules) {
    const actual=rule.trigger==='hours_at_least'?minutes+addedOvertimeMinutes:rule.trigger==='days_at_least'?days:rule.trigger==='units_at_least'?units.count:segments
    const unitsLabel=rule.trigger==='hours_at_least'?'хв оплачуваного часу':rule.trigger==='days_at_least'?'відпрацьованих днів':rule.trigger==='units_at_least'?settings.unitName:'відпрацьованих змін'
    add(`custom:${rule.id}`,rule.title,`${actual} / ${rule.threshold} ${unitsLabel} · ${actual>=rule.threshold?'умову виконано':'умову не виконано'}`,actual>=rule.threshold?rule.bonus:0)
  }
  const gross=lines.reduce((sum,item)=>sum+item.amount,0)
  if(!Number.isSafeInteger(gross)||gross>Number.MAX_SAFE_INTEGER)throw Error('Зарплата виходить за межі допустимого діапазону.')
  return {month,workedMinutes:minutes+addedOvertimeMinutes,scheduledDays,scheduledMinutes,markedOvertimeMinutes:markedMinutes,nightPaidMinutes,overtimeMinutes:overtimeMinutes+addedOvertimeMinutes,workedDays:days,workedSegments:segments,extraSegments:extras,salesAmount:sales.amount,salesPlanReached,unitsCount:units.count,unitPlanReached,lines,gross}
}
// Legacy public name retained for existing consumers. Converted display amounts
// are approximate; stored engine values remain integer UAH kopeks.
export const moneyUA=(kopeks:number):string=>formatMoney(kopeks)
