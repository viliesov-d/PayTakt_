import {useMemo,useState} from 'react'
import {ArrowUpRight,CalendarDays,ChevronLeft,ChevronRight,Clock3,Info,Timer,Wallet,ReceiptText,ChevronDown} from 'lucide-react'
import {buildMonthAnalytics,payoutsInMonth,recentMonths,shiftMonth} from '../lib/analytics'
import {moneyUA,type PaySettings} from '../lib/salary'
import {tr,locale} from '../lib/presentation'
import type {Shift} from '../lib/calendar'
import {toDateKey} from '../lib/data'
import {activeDailyCash,estimatedDailyBaseWage,type DailyCash,type CashPreferences} from '../lib/dailyCash'
import {type PerformanceSettings} from '../lib/performance'
import {PerformanceSummary} from './PerformanceSummary'

type Props={shifts:Shift[];workspaceName:string;settings:PaySettings|null;cashRecords:DailyCash[];cashPrefs:CashPreferences;performance:PerformanceSettings;monthlyTargets:Record<string,number>;dailyWages:Record<string,number>;onSaveTarget:(month:string,amount:number)=>Promise<void>;onResetTarget:(month:string)=>Promise<void>;salesByMonth:Record<string,number>;unitsByMonth:Record<string,number>;
  onCalendar:()=>void;onRules:()=>void;onPay:()=>void}
const monthLabel=(key:string)=>new Intl.DateTimeFormat(locale(),{month:'long',year:'numeric'}).format(new Date(`${key}-01T12:00:00`))
const shortMonth=(key:string)=>new Intl.DateTimeFormat(locale(),{month:'short'}).format(new Date(`${key}-01T12:00:00`))
const fmt=(value:number)=>value.toLocaleString('uk-UA',{maximumFractionDigits:2})
export function StatisticsPage({shifts,workspaceName,settings,cashRecords,cashPrefs,salesByMonth,unitsByMonth,onCalendar,onRules,onPay,performance,monthlyTargets,onSaveTarget,onResetTarget,dailyWages}:Props){
  const [month,setMonth]=useState(toDateKey(new Date()).slice(0,7))
  const cashByMonth=useMemo(()=>{const totals:Record<string,number>={};for(const entry of activeDailyCash(cashRecords,shifts))totals[entry.date.slice(0,7)]=(totals[entry.date.slice(0,7)]??0)+entry.amount;return totals},[cashRecords,shifts])
  const metrics=useMemo(()=>buildMonthAnalytics(shifts,month,settings,salesByMonth[month]??0,unitsByMonth[month]??0,performance,monthlyTargets[month]??performance.defaultTarget,cashByMonth[month]??0,dailyWages),[shifts,month,settings,salesByMonth,unitsByMonth,performance,monthlyTargets,cashByMonth,dailyWages])
  const payments=useMemo(()=>payoutsInMonth(shifts,month,settings,salesByMonth,unitsByMonth,performance,monthlyTargets,cashByMonth,dailyWages),[shifts,month,settings,salesByMonth,unitsByMonth,performance,monthlyTargets,cashByMonth,dailyWages])
  const trend=useMemo(()=>recentMonths(month).map(m=>buildMonthAnalytics(shifts,m,settings,salesByMonth[m]??0,unitsByMonth[m]??0,performance,monthlyTargets[m]??performance.defaultTarget,cashByMonth[m]??0,dailyWages)),[month,shifts,settings,salesByMonth,unitsByMonth,performance,monthlyTargets,cashByMonth,dailyWages])
  const journal=useMemo(()=>activeDailyCash(cashRecords,shifts).filter(r=>r.date.startsWith(month)).sort((a,b)=>b.date.localeCompare(a.date)),[cashRecords,shifts,month])
  const cashTotal=journal.reduce((sum,r)=>sum+r.amount,0)
  const cashPlan=performance.enabled&&performance.metric==='cash'?(monthlyTargets[month]??performance.defaultTarget):(settings?.salesPlan??0)
  const cashProgress=cashPlan>0?Math.min(100,Math.floor(cashTotal/cashPlan*100)):0
  const shiftType=(date:string)=>{
    const shift=shifts.find(s=>s.date===date)
    return shift?.kind==='replacement'?'Заміна':shift?.kind==='extra'?'Додаткова':'Робоча'
  }
  const maxHours=Math.max(1,...metrics.weeks.flatMap(w=>[w.worked,w.planned]))
  const trendMax=Math.max(1,...trend.map(m=>m.result?.gross??0))
  const plannedPayment=payments.reduce((sum,e)=>sum+(e.amount??0),0)
  return <>
    <div className="section-head stats-section-head"><div><div className="eyebrow">{tr("АНАЛІТИКА ЧАСУ Й ОПЛАТИ")}</div><h2>{tr("Моя статистика")}</h2><p className="subtitle">{workspaceName} · усі показники з календаря й налаштувань зарплати</p></div>
      <div className="stats-month-nav"><button type="button" aria-label="Попередній місяць" onClick={()=>setMonth(v=>shiftMonth(v,-1))}><ChevronLeft size={18}/></button><label><span>{tr("Період")}</span><input type="month" aria-label="Місяць статистики" min="1900-01" max="2100-12" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value)}}/></label><button type="button" aria-label="Наступний місяць" onClick={()=>setMonth(v=>shiftMonth(v,1))}><ChevronRight size={18}/></button></div>
    </div>
    <div className="stats-v09-grid">
      <div className="stat-card"><div className="stat-top"><span>{tr("Відпрацьовано")}</span><Clock3 size={19}/></div><div className="stat-value">{fmt(metrics.workedHours)} <span>{tr("год")}</span></div><div className="stat-hint">{metrics.workedDays} підтверджених днів · {metrics.workedShifts} змін</div></div>
      {(settings?.overtimeEnabled || metrics.overtimeHours>0)&&<div className="stat-card"><div className="stat-top"><span>{tr("Понаднормові")}</span><Timer size={19}/></div><div className="stat-value">{fmt(metrics.overtimeHours)} <span>{tr("год")}</span></div><div className="stat-hint">{tr("За правилами оплати та підтвердженими змінами")}</div></div>}
      <div className="stat-card"><div className="stat-top"><span>{tr("Норма з календаря")}</span><CalendarDays size={19}/></div><div className="stat-value">{fmt(metrics.scheduledHours)} <span>{tr("год")}</span></div><div className="stat-hint">{metrics.plannedDays} планових днів</div></div>
      <div className="stat-card salary-stat"><div className="stat-top"><span>{tr("Нараховано до податків")}</span><Wallet size={19}/></div><div className="stat-value salary-dashboard-value">{metrics.result?moneyUA(metrics.result.gross):'—'}</div><button type="button" className="link-button" onClick={metrics.result?onPay:onRules}>{metrics.result?'Деталі нарахувань':'Налаштувати оплату'} <ArrowUpRight size={14}/></button></div>
    </div>
    {metrics.payError&&<p className="stats-explainer" role="status"><Info size={18}/>{metrics.payError} <button type="button" className="link-button" onClick={onRules}>{tr("Відкрити правила")}</button></p>}
    <div className="stats-v09-split">
      <section className="panel"><div className="panel-title"><div><h3>{tr("Час за тижнями")}</h3><p>{monthLabel(month)} · план і фактично відпрацьовано</p></div></div>
        <div className="stats-weeks" role="img" aria-label="Години роботи за календарними тижнями">
          {metrics.weeks.map((week,i)=><div className="stats-week" key={i}><span className="stats-week-value">{fmt(week.worked)} год</span><div className="stats-week-track"><div className="stats-week-plan" style={{height:`${week.planned/maxHours*100}%`}}/><div className="stats-week-work" style={{height:`${week.worked/maxHours*100}%`}}/></div><span className="stats-week-label">{week.label}</span></div>)}
        </div><div className="stats-legend"><span><i className="stats-dot is-plan"/> {tr("План")}</span><span><i className="stats-dot is-work"/> {tr("Відпрацьовано")}</span></div>
      </section>
      <section className="panel"><div className="panel-title"><div><h3>{tr("Дні за статусами")}</h3><p>{tr("Лише дні, які ти позначив у календарі")}</p></div></div>
        <div className="stats-status-list">{[
          ['Відпрацьовані',metrics.workedDays,'worked'],['Вихідні',metrics.offDays,'off'],['Відпустка',metrics.vacationDays,'vacation'],['Лікарняні',metrics.sickDays,'sick'],['За свій рахунок',metrics.unpaidDays,'unpaid'],
        ].map(([label,value,type])=><div className="stats-status-row" key={type}><span><i className={`stats-dot ${type}`}/>{label}</span><strong>{value}</strong></div>)}</div>
        <button type="button" className="btn btn-outline full" onClick={onCalendar}>{tr("Редагувати календар")} <ArrowUpRight size={16}/></button>
      </section>
    </div>
    <PerformanceSummary month={month} performance={performance} target={monthlyTargets[month]??performance.defaultTarget} hasOverride={Object.prototype.hasOwnProperty.call(monthlyTargets,month)} payResult={metrics.result} cashTotal={cashByMonth[month]??0} onSaveTarget={onSaveTarget} onResetTarget={onResetTarget} onRules={onRules}/>
    {performance.manualDailyPay&&<details className="panel cash-journal-panel">
      <summary><span className="cash-journal-summary"><Wallet size={20}/><span><strong>{tr("Особистий заробіток за днями")}</strong><small>Вручну · {monthLabel(month)}</small></span></span><span className="cash-journal-amount">{moneyUA(Object.entries(dailyWages).filter(([date])=>date.startsWith(month)&&shifts.some(s=>s.date===date&&(s.dayType??'work')==='work'&&(s.status==='worked'||s.additionalShifts?.some(a=>a.status==='worked')))).reduce((sum,[,amount])=>sum+amount,0))}</span><ChevronDown size={18}/></summary>
      <div className="cash-journal-content"><p className="stats-small-note">Це введена базова оплата, а не вся зарплата. Понаднормові й премії показуються в загальних нарахуваннях. Якщо не вказати суму за відпрацьований день, базова оплата цього дня дорівнює нулю.</p>
        <div className="cash-journal-list">{shifts.filter(s=>s.date.startsWith(month)&&(s.dayType??'work')==='work'&&(s.status==='worked'||s.additionalShifts?.some(a=>a.status==='worked'))).sort((a,b)=>b.date.localeCompare(a.date)).map(s=><div className="cash-journal-row" key={s.date}><span><strong>{s.date.slice(8)}.{s.date.slice(5,7)}</strong><small>{s.kind==='replacement'?'Заміна':s.kind==='extra'?'Додаткова зміна':'Робочий день'}</small></span><span className="cash-row-amount"><strong>{Object.prototype.hasOwnProperty.call(dailyWages,s.date)?moneyUA(dailyWages[s.date]):'Не введено'}</strong><small>{tr("Особиста базова оплата")}</small></span></div>)}</div>
      </div>
    </details>}
    {cashPrefs.enabled&&<details className="panel cash-journal-panel">
      <summary><span className="cash-journal-summary"><ReceiptText size={20}/><span><strong>{tr("Каса за день · журнал")}</strong><small>{monthLabel(month)} · {journal.length} записів</small></span></span><span className="cash-journal-amount">{moneyUA(cashTotal)}</span><ChevronDown size={18}/></summary>
      <div className="cash-journal-content">
        <p className="stats-small-note">{tr("Каса — оборот робочих змін,")} <strong>{tr("не особиста зарплата")}</strong>{tr(". Заробіток і понаднормові розраховуються окремо в календарі.")}</p>
        {cashPrefs.useForSales?<p className="cash-source-note">Для відсотка від виручки та премії за план використовується сума цих денних записів замість ручної місячної виручки.</p>:<p className="cash-source-note">Каса зараз не впливає на зарплату. Зв’язок із планом і відсотком можна ввімкнути в календарі → «Налаштування каси».</p>}
        {cashPlan>0&&<div className="cash-target"><div><span>{tr("План виручки")}</span><strong>{moneyUA(cashTotal)} / {moneyUA(cashPlan)}</strong></div><div className="cash-progress"><span style={{width:`${cashProgress}%`}}/></div><small>{Math.round(cashTotal/cashPlan*100)}% виконано</small></div>}
        {journal.length>0?<div className="cash-journal-list">{journal.map(r=>{const wage=performance.manualDailyPay?(dailyWages[r.date]??null):estimatedDailyBaseWage(r.date,shifts,settings);return <div className="cash-journal-row" key={r.date}><span><strong>{r.date.slice(8)}.{r.date.slice(5,7)}</strong><small>{shiftType(r.date)}</small></span><span className="cash-row-amount"><strong>Каса: {moneyUA(r.amount)}</strong><small>Базова оплата: {wage===null?'—':moneyUA(wage)}</small></span></div>})}</div>:<p className="stats-small-note">{tr("За цей місяць ще немає записів каси. Відкрий робочий день у календарі й натисни «Каса за день».")}</p>}
        <p className="stats-small-note">Базова оплата за день — лише оцінка за ставкою без нічних, понаднормових, премій та інших правил. Точні загальні нарахування дивись у розділі «Нарахування».</p>
        <button type="button" className="btn btn-outline" onClick={onCalendar}>{tr("Перейти до календаря")} <ArrowUpRight size={16}/></button>
      </div>
    </details>}
    <section className="panel"><div className="panel-title"><div><h3>{tr("Заробіток за 6 місяців")}</h3><p>{tr("Оцінка за підтвердженими змінами, до податків")}</p></div></div>
      <div className="stats-trend" role="img" aria-label="Порівняння нарахувань за шість місяців">{trend.map(item=><div className="stats-trend-col" key={item.month}>
        <span className="stats-trend-value">{item.result?moneyUA(item.result.gross):'—'}</span><div className="stats-trend-track"><div className="stats-trend-fill" style={{height:`${item.result?Math.max(3,item.result.gross/trendMax*100):0}%`}}/></div><span>{shortMonth(item.month)}</span></div>)}</div>
      <p className="stats-small-note">Історія розрахована за поточними правилами оплати. Зміна ставки змінить оцінки минулих місяців — це не архів бухгалтерських виплат.</p>
    </section>
    <section className="panel"><div className="panel-title"><div><h3>{tr("Календар очікуваних виплат")}</h3><p>Аванс, зарплата та премії, що заплановані на {monthLabel(month)}</p></div><span className="pill mint-pill">{payments.length} подій</span></div>
      {payments.length? <><div className="stats-payout-list">{payments.map(p=><div className="stats-payout-row" key={p.id}><div className="stats-payout-date"><strong>{p.date.slice(-2)}</strong><small>{shortMonth(p.date.slice(0,7))}</small></div><div className="stats-payout-info"><strong>{p.title}</strong><small>За {monthLabel(p.sourceMonth)} · {p.source==='bonus'?'премія':'зарплата'}</small></div><strong className="stats-payout-value">{p.amount===null?'Сума ще невідома':moneyUA(p.amount)}</strong></div>)}</div><div className="stats-payout-total"><span>{tr("Прогноз сум із доступними нарахуваннями")}</span><strong>{moneyUA(plannedPayment)}</strong></div></>:<p className="stats-small-note">{tr("На цей місяць немає запланованих виплат. Перевір дати в «Правилах оплати».")}</p>}
      <p className="stats-small-note">Це прогноз за графіком виплат, а не підтвердження надходження грошей. Не включає податки та фактично отримані суми.</p>
    </section>
  </>
}
