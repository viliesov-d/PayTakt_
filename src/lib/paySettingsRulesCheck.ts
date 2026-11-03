/**
 * Best-effort local mirror of paySettings/current Firestore Rules v5.
 * Useful for field-level errors before a write. Only the deployed Firestore
 * security rules are authoritative: this checker cannot grant access.
 */
import {defaultPaySettings} from './salary.ts'

const topKeys = Object.keys(defaultPaySettings)
const paymentKeys = ['id','title','source','method','amount','day','monthOffset','enabled']
const bandKeys = ['id','afterMinutes','multiplierBasisPoints']
const customKeys = ['id','title','trigger','threshold','bonus']
const validId = /^[a-zA-Z0-9_-]{1,70}$/
const validTime = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
const moneyFields = ['hourlyRate','shiftRate','monthlySalary','workdayBonus','extraShiftBonus','monthlyBonus','salesPlan','salesPlanBonus','unitRate','unitPlanBonus']
const int = (v:unknown,min:number,max:number):boolean => typeof v==='number' && Number.isSafeInteger(v) && v>=min && v<=max
const oneOf = (v:unknown, choices:readonly string[]):boolean => typeof v==='string' && choices.includes(v)
const rec = (v:unknown):v is Record<string,unknown> => v!==null && typeof v==='object' && !Array.isArray(v)
const sized = (v:unknown,min:number,max:number):boolean => typeof v==='string' && v.length>=min && v.length<=max

export function verifyPaySettingsFirestoreShape(input:unknown):string[] {
  const issues:string[]=[]
  const check=(ok:boolean,path:string,message:string)=>{if(!ok)issues.push(`${path}: ${message}`)}
  if(!rec(input))return ['paySettings: потрібен документ-об’єкт']
  const data=input
  check(data.version===5,'version','очікується 5')
  check(Object.keys(data).every(k=>topKeys.includes(k)),'fields','зайві поля')
  check(topKeys.every(k=>k in data),'fields','бракує обов’язкових полів')
  check(oneOf(data.mode,['hourly','per_shift','monthly','per_unit']),'mode','невідомий тип оплати')
  check(sized(data.sector,0,40),'sector','не більше 40 символів')
  check(oneOf(data.monthlyNormSource,['calendar','manual']),'monthlyNormSource','очікується calendar/manual')
  check(oneOf(data.monthlyOffDayNormMode,['exclude_off','keep_planned']),'monthlyOffDayNormMode','очікується exclude_off/keep_planned')
  check(oneOf(data.overtimeEntryMode,['automatic','marked']),'overtimeEntryMode','очікується automatic/marked')
  check(oneOf(data.monthlyAccrualBasis,['days','hours']),'monthlyAccrualBasis','очікується days/hours')
  check(oneOf(data.monthlyOvertimeMode,['full','premium']),'monthlyOvertimeMode','очікується full/premium')
  check(oneOf(data.bandPeriod,['shift','day','week','month']),'bandPeriod','невідомий період')
  for(const key of ['nightEnabled','overtimeEnabled','bandEnabled','unitBonusEnabled','monthlyAutoHourlyRate'])
    check(typeof data[key]==='boolean',key,'потрібно true або false')
  for(const key of moneyFields)check(int(data[key],0,100000000000),key,'сума повинна бути цілим числом у копійках')
  for(const key of ['nightBonusBasisPoints','overtimeBonusBasisPoints','salesCommissionBasisPoints'])check(int(data[key],0,100000),key,'відсоток за межами 0–1000%')
  check(int(data.monthlyNormDays,1,31),'monthlyNormDays','від 1 до 31')
  check(int(data.monthlyBaseMinutesPerDay,1,1440),'monthlyBaseMinutesPerDay','від 1 до 1440 хвилин')
  check(int(data.markedOvertimeBasisPoints,10000,100000),'markedOvertimeBasisPoints','від 100% до 1000%')
  check(int(data.overtimeThresholdMinutes,1,44640),'overtimeThresholdMinutes','від 1 до 44640 хвилин')
  check(int(data.unitPlan,0,1000000000),'unitPlan','від 0 до 1 млрд')
  check(sized(data.unitName,1,40),'unitName','назва повинна мати 1–40 символів')
  check(typeof data.nightStart==='string' && validTime.test(data.nightStart),'nightStart','формат HH:MM')
  check(typeof data.nightEnd==='string' && validTime.test(data.nightEnd),'nightEnd','формат HH:MM')
  check(data.nightStart!==data.nightEnd,'nightStart/nightEnd','початок і кінець повинні відрізнятися')

  const nested=(field:string,keys:string[],min:number,max:number,verify:(obj:Record<string,unknown>,path:string,index:number)=>void)=>{
    const items=data[field]
    if(!Array.isArray(items)||items.length<min||items.length>max){issues.push(`${field}: потрібно ${min}–${max} записів`);return}
    items.forEach((item,index)=>{
      const path=`${field}[${index}]`
      if(!rec(item)){issues.push(`${path}: потрібен об’єкт`);return}
      check(Object.keys(item).every(k=>keys.includes(k)) && keys.every(k=>k in item),path,'зайві або відсутні поля')
      verify(item,path,index)
    })
  }
  nested('paymentRules',paymentKeys,1,12,(item,path)=>{
    check(typeof item.id==='string' && validId.test(item.id),`${path}.id`,'некоректний ідентифікатор')
    check(sized(item.title,1,80),`${path}.title`,'назва 1–80 символів')
    check(oneOf(item.source,['earnings','bonus']),`${path}.source`,'earnings/bonus')
    check(oneOf(item.method,['fixed','percent','first_half','remainder']),`${path}.method`,'невідомий спосіб')
    check(item.method!=='first_half' || item.source==='earnings',`${path}.method`,'first_half лише для earnings')
    check(int(item.amount,0,item.method==='percent'?10000:100000000000),`${path}.amount`,'некоректна сума або відсоток')
    check(int(item.day,1,31),`${path}.day`,'день 1–31')
    check(int(item.monthOffset,0,3),`${path}.monthOffset`,'від 0 до 3 місяців')
    check(typeof item.enabled==='boolean',`${path}.enabled`,'true або false')
  })
  nested('bands',bandKeys,1,8,(item,path,index)=>{
    check(typeof item.id==='string' && validId.test(item.id),`${path}.id`,'некоректний ідентифікатор')
    check(int(item.afterMinutes,0,44640),`${path}.afterMinutes`,'поріг від 0 до 44640 хв')
    check(int(item.multiplierBasisPoints,10000,100000),`${path}.multiplierBasisPoints`,'від 100% до 1000%')
    const bands=data.bands as Record<string,unknown>[]
    if(index===0)check(item.afterMinutes===0,`${path}.afterMinutes`,'перший ступінь повинен починатися з 0')
    if(index>0){
      const prev= bands[index-1]?.afterMinutes
      check(typeof item.afterMinutes==='number' && typeof prev==='number' && item.afterMinutes>prev,`${path}.afterMinutes`,'пороги повинні зростати')
    }
  })
  nested('customRules',customKeys,0,10,(item,path)=>{
    check(typeof item.id==='string' && validId.test(item.id),`${path}.id`,'некоректний ідентифікатор')
    check(sized(item.title,1,80),`${path}.title`,'назва 1–80 символів')
    check(oneOf(item.trigger,['hours_at_least','days_at_least','shifts_at_least','units_at_least']),`${path}.trigger`,'невідома умова')
    check(int(item.threshold,1,100000),`${path}.threshold`,'поріг 1–100000')
    check(int(item.bonus,0,100000000000),`${path}.bonus`,'некоректна сума')
  })
  return issues
}
