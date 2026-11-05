import {tr,inputCurrencyLabel} from '../lib/presentation'
import {useEffect,useMemo,useState,type FormEvent} from 'react'
import {Clock3,Wallet,ShieldCheck,Save,CheckCircle2,Info,Sparkles,Moon,Timer,Target,TrendingUp,Plus,Trash2,ChevronDown} from 'lucide-react'
import type {Shift} from '../lib/calendar'
import {calculatePayWithPerformance,type PerformanceSettings} from '../lib/performance'
import {PerformanceRulesEditor} from './PerformanceRulesEditor'
import {PaymentScheduleEditor} from './PaymentScheduleEditor'
import {calculatePaymentForecast} from '../lib/payments'
import {defaultPaySettings,moneyUA,validatePaySettings,validateMonthlySales,type PaySettings,type CustomRule,type MonthlySales,type MonthlyUnits,type BandPeriod,validateMonthlyUnits,allocateBands,calendarSalaryNorm} from '../lib/salary'

type RuleProps={workspaceName:string;shifts:Shift[];settings:PaySettings|null;loaded:boolean;demo:boolean;onSave:(settings:PaySettings)=>Promise<void>;performance:PerformanceSettings;onSavePerformance:(settings:PerformanceSettings)=>Promise<void>;onApplyZmina:()=>Promise<void>}
type PayProps={workspaceName:string;shifts:Shift[];settings:PaySettings|null;loaded:boolean;demo:boolean;performance:PerformanceSettings;targets:Record<string,number>;cashByMonth:Record<string,number>;dailyWages:Record<string,number>;salesFromCash:boolean;salesByMonth:Record<string,number>;onSaveMonthlySales:(record:MonthlySales)=>Promise<void>;unitsByMonth:Record<string,number>;onSaveMonthlyUnits:(record:MonthlyUnits)=>Promise<void>;goToRules:()=>void}
const currentMonth=()=>new Date().toLocaleDateString('sv-SE',{year:'numeric',month:'2-digit'})
const validMonth=/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/
const amountValue=(n:number)=>String(n/100)
const readAmount=(value:string)=>{const n=Number(value.replace(',','.'));return Number.isFinite(n)?Math.round(n*100):NaN}
const percentValue=(basisPoints:number)=>String(basisPoints/100)
const readPercent=(value:string)=>{const n=Number(value.replace(',','.'));return Number.isFinite(n)?Math.round(n*100):NaN}
const moneyFields=[
  ['hourlyRate','Погодинна ставка','Оплата за одну фактично відпрацьовану годину'],
  ['shiftRate','Позмінна ставка','Оплата за підтверджену зміну'],
  ['monthlySalary','Місячний оклад','Сума за повну норму днів'],
  ['unitRate','Ставка за одиницю роботи','Скільки оплачують за одну доставку, виріб чи завдання'],
] as const
const bonuses=[
  ['workdayBonus','За відпрацьований день','Один раз за день із виконаною зміною'],
  ['extraShiftBonus','За додаткову / замінну зміну','За кожну додаткову або замінну відпрацьовану зміну'],
  ['monthlyBonus','Місячна премія','Один раз, якщо є відпрацьовані зміни'],
] as const
const ruleTypes=[
  ['hours_at_least','Оплачених годин за місяць не менше'],
  ['days_at_least','Відпрацьованих днів за місяць не менше'],
  ['shifts_at_least','Відпрацьованих змін за місяць не менше'],
  ['units_at_least','Виконаних одиниць роботи за місяць не менше'],
] as const
function MoneyField({label,help,value,onChange}: {label:string;help?:string;value:number;onChange:(n:number)=>void}) {
  return <label className="pay-field"><span><strong>{label}</strong>{help&&<small>{help}</small>}</span><div className="pay-money-input"><input type="number" aria-label={label} min="0" max="1000000000" step="0.01" required value={Number.isFinite(value)?amountValue(value):''} onChange={e=>onChange(readAmount(e.target.value))}/><span>{inputCurrencyLabel()}</span></div></label>
}
function PercentField({label,value,onChange}: {label:string;value:number;onChange:(n:number)=>void}) {
  return <label className="pay-field"><span><strong>{label}</strong><small>{tr("Від 0 до 1000%")}</small></span><div className="pay-money-input"><input type="number" min="0" max="1000" step="0.01" required value={Number.isFinite(value)?percentValue(value):''} onChange={e=>onChange(readPercent(e.target.value))}/><span>%</span></div></label>
}
const newRule=():CustomRule=>({id:`rule_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,title:'Мій бонус',trigger:'hours_at_least',threshold:9600,bonus:0})
export function RulesPageV5({workspaceName,shifts,settings,loaded,demo,onSave,performance,onSavePerformance,onApplyZmina}:RuleProps){
  const [draft,setDraft]=useState<PaySettings>(settings??defaultPaySettings)
  const referenceMonth=currentMonth()
  const calendarNorm=calendarSalaryNorm(shifts,referenceMonth,draft)
  const scheduledMinutes=calendarNorm.minutes
  const normDays=draft.monthlyNormSource==='calendar'?calendarNorm.days:draft.monthlyNormDays
  const normMinutes=draft.monthlyNormSource==='calendar'?scheduledMinutes:draft.monthlyNormDays*draft.monthlyBaseMinutesPerDay
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  useEffect(()=>{setDraft(settings??defaultPaySettings)},[settings])
  const change=<K extends keyof PaySettings>(key:K,value:PaySettings[K])=>{setDraft(old=>({...old,[key]:value}));setMessage('');setError('')}
  const changeRule=(id:string,patch:Partial<CustomRule>)=>change('customRules',draft.customRules.map(r=>r.id===id?{...r,...patch}:r))
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setError('');setMessage('')
    try{validatePaySettings(draft)}catch(err){setError(err instanceof Error?err.message:'Невірні правила');return}
    setBusy(true)
    try{await onSave(draft);setMessage(demo?'Правила збережено на час демосеансу.':'Правила оплати збережено.')}
    catch(err){setError(err instanceof Error?err.message:'Помилка збереження.')}
    finally{setBusy(false)}
  }
  return <div className="salary-page">
    <div className="section-head"><div><div className="eyebrow">{tr("КОНСТРУКТОР ОПЛАТИ")}</div><h2>{tr("Мої правила зарплати")}</h2><p>Оплата для будь-якої роботи: години, зміни, оклад, виробіток та власні правила · {workspaceName}</p></div></div>
    <div className="salary-note"><ShieldCheck size={20}/><div><strong>{tr("Прогноз, а не офіційна зарплатна відомість")}</strong><p>Правила діють для поточного робочого простору. Вони не замінюють положення про оплату праці, трудове законодавство чи розрахунок податків. Підсумки можуть перераховувати минулі місяці.</p></div></div>
    {!loaded?<div className="panel">{tr("Завантажуємо налаштування…")}</div>:<form className="salary-form" onSubmit={submit} noValidate>
      <details className="panel pay-collapse" open><summary className="pay-collapse-summary"><div className="pay-block-heading"><Wallet size={21}/><div><h3>{tr("Основна оплата")}</h3><p>{tr("Один спосіб нарахування базової суми за роботу")}</p></div></div><ChevronDown className="pay-collapse-chevron" size={19} aria-hidden="true"/></summary><div className="pay-collapse-body">
        <div className="pay-methods">{([['hourly','Погодинна','За фактичні оплачувані хвилини'],['per_shift','Позмінна','За кожну відпрацьовану зміну'],['monthly','Оклад','За визначену норму робочих днів'],['per_unit','За виконану роботу','За доставку, виріб, послугу чи завдання']] as const).map(([mode,title,help])=><label key={mode} className={`pay-method ${draft.mode===mode?'is-selected':''}`}><input type="radio" name="payMode" checked={draft.mode===mode} onChange={()=>change('mode',mode)}/><strong>{title}</strong><small>{help}</small></label>)}</div>
        {moneyFields.filter(([key])=>(draft.mode==='hourly'&&key==='hourlyRate')||(draft.mode==='per_shift'&&key==='shiftRate')||(draft.mode==='monthly'&&key==='monthlySalary')||(draft.mode==='per_unit'&&key==='unitRate')).map(([key,label,help])=><MoneyField key={key} label={label} help={help} value={draft[key]} onChange={v=>change(key,v)}/>)}
        {draft.mode==='monthly'&&<div className="monthly-salary-editor">
          <label className="pay-field"><span><strong>{tr("Звідки брати норму місяця")}</strong><small>{tr("Рекомендовано: із запланованих робочих днів і годин календаря")}</small></span><select value={draft.monthlyNormSource} onChange={e=>change('monthlyNormSource',e.target.value as PaySettings['monthlyNormSource'])}><option value="calendar">{tr("Автоматично з календаря")}</option><option value="manual">{tr("Власна фіксована норма (особливі випадки)")}</option></select></label>
          <label className="pay-field"><span><strong>{tr("Як звичайні вихідні змінюють норму окладу")}</strong><small>Діє лише для норми з календаря. «Вихідний» на будній день виключається з норми; «За свій рахунок» залишається в нормі, але не оплачується. Відпустка та лікарняний також не зменшують норму автоматично.</small></span><select value={draft.monthlyOffDayNormMode} disabled={draft.monthlyNormSource!=='calendar'} onChange={e=>change('monthlyOffDayNormMode',e.target.value as PaySettings['monthlyOffDayNormMode'])}><option value="exclude_off">{tr("Вихідні зменшують норму (рекомендовано)")}</option><option value="keep_planned">{tr("Завжди використовувати первинний план")}</option></select></label>
          {draft.monthlyNormSource==='manual'&&<label className="pay-field"><span><strong>{tr("Ручна норма робочих днів за місяць")}</strong><small>{tr("Тільки для особливих умов, за замовчуванням не потрібна")}</small></span><input className="pay-number" type="number" min="1" max="31" value={draft.monthlyNormDays} onChange={e=>change('monthlyNormDays',Number(e.target.value))}/></label>}
          <p className="norm-preview"><strong>Автоматична норма за {referenceMonth}:</strong> {calendarNorm.days} днів · {(scheduledMinutes/60).toLocaleString('uk-UA',{maximumFractionDigits:2})} год. {calendarNorm.days===0?'Спочатку застосуй шаблон у календарі.':'Вихідні за обраним правилом змінюють норму; «За свій рахунок» — ні.'}</p>
          <label className="pay-field"><span><strong>{tr("Нормальні оплачувані години на день")}</strong><small>{tr("Наприклад, 8 годин; перерви не враховуються")}</small></span><input className="pay-number" type="number" min="0.25" max="24" step="0.25" required value={draft.monthlyBaseMinutesPerDay/60} onChange={e=>change('monthlyBaseMinutesPerDay',Math.round(Number(e.target.value)*60))}/></label>
          <label className="pay-field"><span><strong>{tr("Як нараховувати оклад")}</strong><small>{tr("За повний день або пропорційно фактичним нормальним годинам")}</small></span><select value={draft.monthlyAccrualBasis} onChange={e=>change('monthlyAccrualBasis',e.target.value as PaySettings['monthlyAccrualBasis'])}><option value="days">{tr("За кількістю відпрацьованих днів")}</option><option value="hours">{tr("За нормальними оплачуваними годинами")}</option></select></label>
          <label className="pay-toggle"><input type="checkbox" checked={draft.monthlyAutoHourlyRate} onChange={e=>change('monthlyAutoHourlyRate',e.target.checked)}/> {tr("Автоматично визначати погодинну базу для доплат з окладу")}</label>
          {!draft.monthlyAutoHourlyRate&&<MoneyField label="Погодинна база для доплат" value={draft.hourlyRate} onChange={v=>change('hourlyRate',v)}/>}
          <div className="salary-calc-preview"><strong>Оклад за плановий день: {normDays?moneyUA(Math.round(draft.monthlySalary/normDays)):'Спочатку заповни графік'}</strong><span>Погодинна база: {normMinutes?moneyUA(Math.round((draft.monthlyAutoHourlyRate?draft.monthlySalary*60/normMinutes:draft.hourlyRate))):'—'}</span></div>
        </div>}
      </div></details>
      <details className="panel pay-collapse"><summary className="pay-collapse-summary"><div className="pay-block-heading"><Sparkles size={21}/><div><h3>{tr("Постійні доплати")}</h3><p>{tr("Необов'язкові доплати за робочі дні, додаткові зміни та місяць")}</p></div></div><ChevronDown className="pay-collapse-chevron" size={19} aria-hidden="true"/></summary><div className="pay-collapse-body">
        <div className="pay-fields">{bonuses.map(([key,label,help])=><MoneyField key={key} label={label} help={help} value={draft[key]} onChange={v=>change(key,v)}/>)}</div>
      </div></details>
      <details className="panel pay-collapse"><summary className="pay-collapse-summary"><div className="pay-block-heading"><Moon size={21}/><div><h3>{tr("Нічні години")}</h3><p>{tr("Додаткова виплата за оплачуваний час у вибраному інтервалі")}</p></div></div><ChevronDown className="pay-collapse-chevron" size={19} aria-hidden="true"/></summary><div className="pay-collapse-body">
        <label className="pay-toggle"><input type="checkbox" checked={draft.nightEnabled} onChange={e=>change('nightEnabled',e.target.checked)}/> {tr("Увімкнути нічну доплату")}</label>
        {draft.nightEnabled&&<div className="advanced-pay-grid"><label>{tr("Початок нічного періоду")}<input type="time" required value={draft.nightStart} onChange={e=>change('nightStart',e.target.value)}/></label><label>{tr("Завершення нічного періоду")}<input type="time" required value={draft.nightEnd} onChange={e=>change('nightEnd',e.target.value)}/></label><PercentField label="Додатковий відсоток" value={draft.nightBonusBasisPoints} onChange={v=>change('nightBonusBasisPoints',v)}/></div>}
      </div></details>
      <details className="panel pay-collapse"><summary className="pay-collapse-summary"><div className="pay-block-heading"><Timer size={21}/><div><h3>{tr("Як визначати понаднормові")}</h3><p>Пороги або години всередині зміни. Окремі години, додані кнопкою календаря, оплачуються незалежно за власним тарифом.</p></div></div><ChevronDown className="pay-collapse-chevron" size={19} aria-hidden="true"/></summary><div className="pay-collapse-body">
        <label className="pay-field"><span><strong>{tr("Режим понаднормових")}</strong><small>{tr("Вручну — кількість годин у кожному дні календаря; автоматично — пороги нижче")}</small></span><select value={draft.overtimeEntryMode} onChange={e=>change('overtimeEntryMode',e.target.value as PaySettings['overtimeEntryMode'])}><option value="automatic">{tr("Автоматично за тарифними ступенями")}</option><option value="marked">{tr("Години, позначені в календарі")}</option></select></label>
        {draft.overtimeEntryMode==='marked'&&<><PercentField label="Оплата позначених понаднормових (%)" value={draft.markedOvertimeBasisPoints} onChange={v=>change('markedOvertimeBasisPoints',v)}/><p className="pay-hint">При погодинній оплаті базові 100% уже враховані: для 120% система додасть лише 20%. Для окладу в режимі повного тарифу буде додано 120% понад базовий оклад.</p>{draft.mode==='monthly'&&<label className="pay-field"><span><strong>{tr("Для окладу")}</strong></span><select value={draft.monthlyOvertimeMode} onChange={e=>change('monthlyOvertimeMode',e.target.value as PaySettings['monthlyOvertimeMode'])}><option value="full">{tr("Повні 120% понад оклад")}</option><option value="premium">{tr("Лише надбавка 20%")}</option></select></label>}</>}
      </div></details>
      <details className="panel pay-collapse"><summary className="pay-collapse-summary"><div className="pay-block-heading"><Timer size={21}/><div><h3>{tr("Ступені оплати за години")}</h3><p>Встановлюй свої пороги та тарифи. Наприклад: перші 8 годин — 100%, з 9-ї — 120%, після 12-ї — 150%.</p></div></div><ChevronDown className="pay-collapse-chevron" size={19} aria-hidden="true"/></summary><div className="pay-collapse-body">
        {draft.overtimeEntryMode==='automatic'&&<><label className="pay-toggle"><input type="checkbox" checked={draft.bandEnabled} onChange={e=>change('bandEnabled',e.target.checked)}/> {tr("Увімкнути ступінчасті тарифи")}</label>
        {draft.bandEnabled&&<>
          <div className="advanced-pay-grid"><label>{tr("Коли скидати лічильник годин")}<select value={draft.bandPeriod} onChange={e=>change('bandPeriod',e.target.value as BandPeriod)}><option value="shift">{tr("Кожна окрема зміна")}</option><option value="day">{tr("Кожен робочий день")}</option><option value="week">{tr("Календарний тиждень (з понеділка)")}</option><option value="month">{tr("Календарний місяць")}</option></select></label></div>
          {draft.mode==='monthly'&&<div className="monthly-salary-editor">
            <label className="pay-field"><span><strong>{tr("Як оплачувати години понад поріг")}</strong><small>120% означає повну оплату додаткової години, +20% — лише надбавку</small></span><select value={draft.monthlyOvertimeMode} onChange={e=>change('monthlyOvertimeMode',e.target.value as PaySettings['monthlyOvertimeMode'])}><option value="full">{tr("Повний тариф (наприклад, 120%) поверх окладу")}</option><option value="premium">{tr("Тільки надбавка понад 100% (наприклад, +20%)")}</option></select></label>
          </div>}
          <div className="band-presets"><button type="button" className="btn btn-outline" onClick={()=>setDraft(old=>({...old,bandPeriod:'day',monthlyBaseMinutesPerDay:480,monthlyOvertimeMode:'full',bands:[{id:'base',afterMinutes:0,multiplierBasisPoints:10000},{id:'after8h',afterMinutes:480,multiplierBasisPoints:12000}]}))}>{tr("8 год × 100%, далі 120%")}</button><button type="button" className="btn btn-outline" onClick={()=>setDraft(old=>({...old,bandPeriod:'day',bands:[{id:'base',afterMinutes:0,multiplierBasisPoints:10000},{id:'after8h',afterMinutes:480,multiplierBasisPoints:12000},{id:'after12h',afterMinutes:720,multiplierBasisPoints:15000}]}))}>{tr("8 / 12 год · 120% / 150%")}</button><button type="button" className="btn btn-outline" onClick={()=>setDraft(old=>({...old,bandPeriod:'week',bands:[{id:'base',afterMinutes:0,multiplierBasisPoints:10000},{id:'after40h',afterMinutes:2400,multiplierBasisPoints:12500}]}))}>{tr("40 год/тиждень, далі 125%")}</button></div>
          <div className="bands-editor">{draft.bands.map((band,index)=><div className="band-row" key={band.id}>
            <label>{tr("Починаючи після (год)")}<input type="number" min="0" max="744" step="0.25" disabled={index===0} value={band.afterMinutes/60} onChange={e=>change('bands',draft.bands.map(b=>b.id===band.id?{...b,afterMinutes:Math.round(Number(e.target.value)*60)}:b))}/></label>
            <label>{tr("Оплата від ставки (%)")}<input type="number" min="100" max="1000" step="0.01" value={band.multiplierBasisPoints/100} onChange={e=>change('bands',draft.bands.map(b=>b.id===band.id?{...b,multiplierBasisPoints:readPercent(e.target.value)}:b))}/></label>
            {index>0&&<button type="button" className="btn btn-outline" aria-label="Прибрати поріг" onClick={()=>change('bands',draft.bands.filter(b=>b.id!==band.id))}><Trash2 size={17}/></button>}
          </div>)}</div>
          <button type="button" className="btn btn-outline" disabled={draft.bands.length>=8} onClick={()=>change('bands',[...draft.bands,{id:`tier_${Date.now()}`,afterMinutes:draft.bands[draft.bands.length-1].afterMinutes+60,multiplierBasisPoints:12000}])}><Plus size={16}/> {tr("Додати поріг")}</button>
          <div className="band-example"><strong>Приклад: 10 оплачених годин за один обліковий період</strong><span>{(()=>{try{const groups=allocateBands([600],draft.bands);return groups.map((mins,i)=>`${(mins/60).toLocaleString('uk-UA')} год × ${draft.bands[i].multiplierBasisPoints/100}%`).filter(x=>!x.startsWith('0 год')).join(' + ')}catch{return 'Виправ пороги для перегляду'}})()}</span><strong>{(()=>{try{return 'Разом (погодинна модель): '+moneyUA(allocateBands([600],draft.bands).reduce((sum,minutes,i)=>sum+Math.round(minutes*(draft.mode==='monthly'&&draft.monthlyAutoHourlyRate ? draft.monthlySalary*60/Math.max(1,normMinutes):draft.hourlyRate)*draft.bands[i].multiplierBasisPoints/600000),0))}catch{return 'Некоректні пороги'}})()}</strong><small>120% означає повну оплату 1,2 × ставку, а не додаткові 120%. Для окладу можна обрати повну додаткову ставку (120%) або лише надбавку (+20%).</small></div>
          {draft.bandPeriod==='week'&&<p className="pay-hint">Поки що тижневі пороги рахуються лише за години в обраному місяці. На межі місяців потрібен окремий облік повного тижня.</p>}
        </>}</>}
      </div></details>
      {draft.mode!=='hourly'&&draft.mode!=='monthly'&&<details className="panel pay-collapse"><summary className="pay-collapse-summary"><div className="pay-block-heading"><Info size={20}/><div><h3>{tr("Погодинна база для доплат")}</h3><p>Для позмінної або відрядної оплати, коли додаються додаткові години</p></div></div><ChevronDown className="pay-collapse-chevron" size={19} aria-hidden="true"/></summary><div className="pay-collapse-body"><p className="pay-hint">Додаткові години з кнопки календаря оплачуються повним тарифом (наприклад, 120%) поверх основного заробітку.</p><MoneyField label="Погодинна база для доплат" value={draft.hourlyRate} onChange={v=>change('hourlyRate',v)}/></div></details>}
      <details className="panel pay-collapse"><summary className="pay-collapse-summary"><div className="pay-block-heading"><Target size={21}/><div><h3>{tr("Оплата за обсяг роботи")}</h3><p>Додаткова або основна оплата за доставку, замовлення, виріб, послугу чи виконане завдання.</p></div></div><ChevronDown className="pay-collapse-chevron" size={19} aria-hidden="true"/></summary><div className="pay-collapse-body">
        <label className="pay-field"><span><strong>{tr("Назва одиниці роботи")}</strong><small>{tr("В однині: доставка, виріб, замовлення, послуга…")}</small></span><input required maxLength={40} value={draft.unitName} onChange={e=>change('unitName',e.target.value)}/></label>
        {draft.mode!=='per_unit'&&<label className="pay-toggle"><input type="checkbox" checked={draft.unitBonusEnabled} onChange={e=>change('unitBonusEnabled',e.target.checked)}/> {tr("Додавати оплату за виконану роботу поверх основної зарплати")}</label>}
        {draft.mode!=='per_unit'&&draft.unitBonusEnabled&&<MoneyField label={`За одну одиницю: ${draft.unitName}`} value={draft.unitRate} onChange={v=>change('unitRate',v)}/>}
        <div className="pay-fields"><label className="pay-field"><span><strong>{tr("План за місяць (одиниць)")}</strong><small>{tr("0 — вимкнути премію за план")}</small></span><input type="number" className="pay-number" min="0" max="1000000000" step="1" value={draft.unitPlan} onChange={e=>change('unitPlan',Number(e.target.value))}/></label><MoneyField label="Премія за виконання плану" value={draft.unitPlanBonus} onChange={v=>change('unitPlanBonus',v)}/></div>
      </div></details>
      <details className="panel pay-optional"><summary><TrendingUp size={21}/> {tr("Додатково: відсоток від виручки (необов'язково)")}</summary><p>Цей блок лише для робіт, де винагорода залежить від грошового обороту. Для решти професій залиш 0.</p>
        <PercentField label="Відсоток від виручки" value={draft.salesCommissionBasisPoints} onChange={v=>change('salesCommissionBasisPoints',v)}/>
        <MoneyField label="Місячний план виручки" value={draft.salesPlan} onChange={v=>change('salesPlan',v)}/>
        <MoneyField label="Бонус за виконання плану" value={draft.salesPlanBonus} onChange={v=>change('salesPlanBonus',v)}/>
      </details>
      <details className="panel pay-collapse"><summary className="pay-collapse-summary"><div className="pay-block-heading"><Target size={21}/><div><h3>{tr("Власні правила")}</h3><p>До 10 разових місячних бонусів за умову: кількість годин, днів або змін</p></div></div><ChevronDown className="pay-collapse-chevron" size={19} aria-hidden="true"/></summary><div className="pay-collapse-body">
        {draft.customRules.map(rule=><div className="custom-rule" key={rule.id}>
          <div className="custom-rule-head"><strong>{tr("Бонус за умову")}</strong><button type="button" className="btn btn-outline" aria-label={`Видалити правило ${rule.title}`} onClick={()=>change('customRules',draft.customRules.filter(x=>x.id!==rule.id))}><Trash2 size={16}/></button></div>
          <label>{tr("Назва правила")}<input required maxLength={80} value={rule.title} onChange={e=>changeRule(rule.id,{title:e.target.value})}/></label>
          <label>{tr("Коли нарахувати")}<select value={rule.trigger} onChange={e=>changeRule(rule.id,{trigger:e.target.value as CustomRule['trigger'],threshold: e.target.value==='hours_at_least'?60:1})}>{ruleTypes.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>
          <label>Мінімум {rule.trigger==='hours_at_least'?'годин':'одиниць'}<input type="number" required min={rule.trigger==='hours_at_least'?'0.016667':'1'} max={rule.trigger==='hours_at_least'?'1666':'100000'} step={rule.trigger==='hours_at_least'?'0.25':'1'} value={rule.trigger==='hours_at_least'?rule.threshold/60:rule.threshold} onChange={e=>changeRule(rule.id,{threshold:rule.trigger==='hours_at_least'?Math.round(Number(e.target.value)*60):Number(e.target.value)})}/></label>
          <MoneyField label="Сума разового бонусу" value={rule.bonus} onChange={v=>changeRule(rule.id,{bonus:v})}/>
        </div>)}
        <button type="button" className="btn btn-outline" disabled={draft.customRules.length>=10} onClick={()=>change('customRules',[...draft.customRules,newRule()])}><Plus size={16}/> {tr("Додати власне правило")}</button>
      </div></details>
      <PaymentScheduleEditor value={draft.paymentRules} onChange={rules=>change('paymentRules',rules)}/>
      {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="form-success" role="status">{message}</p>}
      <div className="pay-form-actions"><p><Info size={16}/> Нічні години приблизні, якщо невідоме розташування перерв. Тарифи за ступенями — персональна формула, а не автоматичне застосування законодавства.</p><button type="submit" className="btn btn-primary" disabled={busy}><Save size={17}/>{busy?'Зберігаємо…':'Зберегти правила'}</button></div>
    </form>}
    <PerformanceRulesEditor settings={performance} onSave={onSavePerformance} onApplyZmina={onApplyZmina} demo={demo}/>
  </div>
}
export function PayPageV5({workspaceName,shifts,settings,loaded,demo,salesFromCash,salesByMonth,onSaveMonthlySales,unitsByMonth,onSaveMonthlyUnits,goToRules,performance,targets,cashByMonth,dailyWages}:PayProps){
  const [month,setMonth]=useState(currentMonth)
  const [salesDraft,setSalesDraft]=useState('0')
  const [unitsDraft,setUnitsDraft]=useState('0')
  const [unitsMessage,setUnitsMessage]=useState('')
  const [unitsError,setUnitsError]=useState('')
  const [busy,setBusy]=useState(false)
  const [salesMessage,setSalesMessage]=useState('')
  const [salesError,setSalesError]=useState('')
  useEffect(()=>{setSalesDraft(String((salesByMonth[month]??0)/100));setSalesMessage('');setSalesError('')},[month,salesByMonth])
  useEffect(()=>{setUnitsDraft(String(unitsByMonth[month]??0));setUnitsMessage('');setUnitsError('')},[month,unitsByMonth])
  const result=useMemo(()=>{
    if(!loaded||!settings||!validMonth.test(month))return null
    try{return {value:calculatePayWithPerformance(shifts,month,settings,{month,amount:salesByMonth[month]??0},{month,count:unitsByMonth[month]??0},performance,targets[month]??performance.defaultTarget,cashByMonth[month]??0,dailyWages),error:''}}
    catch(e){return {value:null,error:e instanceof Error?e.message:'Помилка обчислення'}}
  },[shifts,month,settings,loaded,salesByMonth,unitsByMonth,performance,targets,cashByMonth,dailyWages])
  const saveSales=async(e:FormEvent)=>{
    e.preventDefault();setSalesError('');setSalesMessage('')
    const record={month,amount:readAmount(salesDraft)}
    try{validateMonthlySales(record)}catch(err){setSalesError(err instanceof Error?err.message:'Некоректна сума');return}
    setBusy(true)
    try{await onSaveMonthlySales(record);setSalesMessage(demo?'Збережено для поточного демосеансу.':'Суму продажів збережено.')}
    catch(err){setSalesError(err instanceof Error?err.message:'Помилка збереження.')}finally{setBusy(false)}
  }
  const saveUnits=async(e:FormEvent)=>{
    e.preventDefault();setUnitsError('');setUnitsMessage('')
    const record:MonthlyUnits={month,count:Number(unitsDraft)}
    try{validateMonthlyUnits(record)}catch(err){setUnitsError(err instanceof Error?err.message:'Некоректна кількість');return}
    setBusy(true)
    try{await onSaveMonthlyUnits(record);setUnitsMessage(demo?'Збережено в демосеансі.':'Обсяг роботи збережено.')}
    catch(err){setUnitsError(err instanceof Error?err.message:'Помилка збереження.')}
    finally{setBusy(false)}
  }
  const current=result?.value
  const paymentForecast=useMemo(()=>{
    if(!current||!settings)return null
    try{
      const firstHalf=performance.manualDailyPay?
        calculatePayWithPerformance(shifts.map(s=>s.date.slice(0,7)===month&&s.date.slice(-2)>'15'?
          {...s,status:'planned' as const,additionalShifts:s.additionalShifts?.map(x=>({...x,status:'planned' as const}))}:s),month,settings,
          {month,amount:0},{month,count:0},performance,0,0,dailyWages):undefined
      return {value:calculatePaymentForecast(shifts,month,settings,current,firstHalf),error:''}
    }
    catch(err){return {value:null,error:err instanceof Error?err.message:'Помилка календаря виплат'}}
  },[shifts,month,settings,current,performance,dailyWages])
  return <div className="salary-page">
    <div className="section-head"><div><div className="eyebrow">{tr("РОЗРАХУНОК ЗАРПЛАТИ · v0.8")}</div><h2>{tr("Нарахування")}</h2><p>Попередній розрахунок за фактично відпрацьованими змінами · {workspaceName}</p></div></div>
    <div className="salary-note"><Info size={20}/><div><strong>{tr("Це прогноз, а не зарплатна відомість")}</strong><p>Для погодинної, позмінної та окладної оплати враховуються зміни «Відпрацьовано». Обсяг виконаної роботи й виручку можна вводити окремо. Без податків, лікарняних і юридичної перевірки. Довгі зміни відносяться до місяця початку. Нічні години приблизні, якщо не задано час перерви.</p></div></div>
    <section className="panel pay-summary"><div className="pay-summary-top"><div><span className="eyebrow">{tr("ОБРАНИЙ ПЕРІОД")}</span><h3>{tr("Зарплата за місяць")}</h3></div><input aria-label="Місяць зарплати" type="month" value={month} min="1900-01" max="2100-12" onChange={e=>setMonth(e.target.value)}/></div>
      {!loaded?<p className="pay-empty">{tr("Завантажуємо налаштування й показники…")}</p>:!settings?<div className="pay-empty"><Wallet size={28}/><h3>{tr("Ще немає правил оплати")}</h3><p>{tr("Налаштуй систему оплати у розділі «Правила оплати».")}</p><button type="button" className="btn btn-primary" onClick={goToRules}>{tr("Налаштувати зарплату")}</button></div>:result?.error?<div className="form-error" role="alert">{result.error}</div>:current&&<>
        <div className="salary-total"><span>{tr("Попередньо нараховано")}</span><strong>{moneyUA(current.gross)}</strong><small>{tr("До утримань і податків")}</small></div>
        <div className="pay-kpis"><div><Clock3 size={19}/><strong>{(current.workedMinutes/60).toLocaleString('uk-UA',{maximumFractionDigits:2})} год</strong><span>{tr("Відпрацьовано")}</span></div><div><Moon size={19}/><strong>{(current.nightPaidMinutes/60).toLocaleString('uk-UA',{maximumFractionDigits:2})} год</strong><span>{tr("Нічних оплачуваних годин")}</span></div><div><CheckCircle2 size={19}/><strong>{current.workedSegments}</strong><span>{tr("Відпрацьованих змін")}</span></div></div>
        {settings.monthlyNormSource==='calendar'&&settings.mode==='monthly'&&<p className="norm-preview">Норма за графіком: {current.scheduledDays} днів · {(current.scheduledMinutes/60).toLocaleString('uk-UA',{maximumFractionDigits:2})} год</p>}
        {settings.overtimeEntryMode==='marked'&&<p className="norm-preview">Позначено понаднормових: {(current.markedOvertimeMinutes/60).toLocaleString('uk-UA',{maximumFractionDigits:2})} год · оплата за вашими правилами</p>}
        <div className="pay-lines"><h3>{tr("Деталізація нарахувань")}</h3>{current.lines.map(line=><div className="pay-line" key={line.code}><div><strong>{line.title}</strong><small>{line.details}</small></div><strong>{moneyUA(line.amount)}</strong></div>)}<div className="pay-line pay-line-total"><strong>{tr("Загалом")}</strong><strong>{moneyUA(current.gross)}</strong></div></div>
        <button type="button" className="btn btn-outline" onClick={goToRules}>{tr("Редагувати правила")}</button>
      </>}
    </section>
    {paymentForecast?.error&&<p className="form-error" role="alert">{paymentForecast.error}</p>}
    {paymentForecast?.value&&<section className="panel payment-forecast"><div className="pay-block-heading"><Wallet size={21}/><div><h3>{tr("Календар очікуваних виплат")}</h3><p>Окремо від нарахувань · для місяця {month}</p></div></div>
      <div className="pay-kpis"><div><strong>{moneyUA(paymentForecast.value.earnings)}</strong><span>{tr("Зарплатні нарахування")}</span></div><div><strong>{moneyUA(paymentForecast.value.bonuses)}</strong><span>{tr("Премії")}</span></div><div><strong>{moneyUA(paymentForecast.value.firstHalfEarnings)}</strong><span>{tr("За 1–15 число (оцінка)")}</span></div></div>
      <div className="pay-lines">{paymentForecast.value.events.map(event=><div className="pay-line" key={event.id}><div><strong>{event.date} · {event.title}</strong><small>{event.source==='bonus'?'Премії':'Основні нарахування'} · {event.method==='fixed'?'Фіксована сума':event.method==='percent'?'Відсоток':event.method==='first_half'?'Зароблено за 1–15 число':'Залишок'}{event.shortfall>0?` · Запитано ${moneyUA(event.requested)}, але доступно менше`:''}</small></div><strong>{moneyUA(event.amount)}</strong></div>)}</div>
      {(paymentForecast.value.unallocatedEarnings>0||paymentForecast.value.unallocatedBonuses>0)&&<p className="form-error">Частина суми не розподілена за виплатами: зарплата {moneyUA(paymentForecast.value.unallocatedEarnings)}, премії {moneyUA(paymentForecast.value.unallocatedBonuses)}.</p>}
      <p className="pay-hint">Це прогноз за відпрацьованими змінами, а не підтвердження реальних переказів. Податки та фактичні аванси не враховані.</p>
    </section>}
    <section className="panel"><div className="pay-block-heading"><Target size={21}/><div><h3>Обсяг виконаної роботи за {month}</h3><p>Введи кількість: {settings?.unitName??'завдання'}. Це працює для будь-якої професії, а не лише для продажів.</p></div></div>
      <form onSubmit={saveUnits}><label className="pay-field"><span><strong>Виконано одиниць ({settings?.unitName??'завдання'})</strong><small>{tr("Ціле невід’ємне число, 0 — також допустимо")}</small></span><input type="number" className="pay-number" min="0" max="1000000000" step="1" required value={unitsDraft} onChange={e=>{setUnitsDraft(e.target.value);setUnitsMessage('')}}/></label>
        <div className="pay-form-actions"><p><Info size={16}/> Оплата та премія застосуються лише тоді, коли відповідні правила ввімкнені.</p><button type="submit" className="btn btn-primary" disabled={busy||!validMonth.test(month)}><Save size={17}/>{busy?'Зберігаємо…':'Зберегти обсяг роботи'}</button></div>
        {unitsError&&<p className="form-error" role="alert">{unitsError}</p>}{unitsMessage&&<p className="form-success" role="status">{unitsMessage}</p>}
      </form>
    </section>
    {(settings?.salesCommissionBasisPoints||settings?.salesPlan)?<details className="panel pay-optional"><summary><TrendingUp size={21}/> Додатково: виручка за {month}</summary><p>Лише для робіт із відсотком від обороту.</p>
      {salesFromCash?<div className="cash-source-note"><strong>{tr("Джерело: щоденна каса")}</strong><p>У розрахунку використано {moneyUA(salesByMonth[month]??0)} із записів календаря. Щоб редагувати суми, відкрий робочий день і запиши його касу. Ручне введення місячної виручки вимкнено, щоб уникнути подвійного підрахунку.</p></div>:<form onSubmit={saveSales}><MoneyField label="Виручка за місяць" value={readAmount(salesDraft)} onChange={value=>{setSalesDraft(Number.isFinite(value)?String(value/100):'');setSalesMessage('')}}/>
        <div className="pay-form-actions"><p><Info size={16}/> Значення, введене вручну, не є підтвердженою касою.</p><button type="submit" className="btn btn-primary" disabled={busy||!validMonth.test(month)}><Save size={17}/>{busy?'Зберігаємо…':'Зберегти виручку'}</button></div>
        {salesError&&<p className="form-error" role="alert">{salesError}</p>}{salesMessage&&<p className="form-success" role="status">{salesMessage}</p>}
      </form>}
    </details>:null}
  </div>
}
