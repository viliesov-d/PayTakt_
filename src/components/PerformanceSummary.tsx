import {useEffect,useState} from 'react'
import {Target,ChevronDown,Save} from 'lucide-react'
import {moneyUA,type PayResult} from '../lib/salary'
import {performanceProgress,type PerformanceSettings} from '../lib/performance'
const num=(n:number,units:boolean)=>units?String(n):String(n/100)
const display=(n:number,units:boolean)=>units?n.toLocaleString('uk-UA'):moneyUA(n)
type Props={month:string;performance:PerformanceSettings;target:number;hasOverride:boolean;payResult:PayResult|null;cashTotal:number;onSaveTarget:(m:string,v:number)=>Promise<void>;onResetTarget:(m:string)=>Promise<void>;onRules:()=>void}
export function PerformanceSummary({month,performance,target,hasOverride,payResult,cashTotal,onSaveTarget,onResetTarget,onRules}:Props){
 const units=performance.metric==='units'
 const [draft,setDraft]=useState(num(target,units))
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 useEffect(()=>{setDraft(num(target,units));setMessage('')},[month,target,units])
 if(!performance.enabled || (performance.manualDailyPay && target===0 && !hasOverride))return null
 const progress=payResult?performanceProgress(payResult,performance,target,cashTotal):null
 const save=async()=>{const value=Number(draft.replace(',','.'))*(units?1:100);if(!Number.isSafeInteger(value)||value<0||value>100_000_000_000){setMessage('Введи коректну суму або кількість.');return}
   try{setBusy(true);await onSaveTarget(month,value);setMessage('План цього місяця збережено.')}catch(e){setMessage(e instanceof Error?e.message:'Не вдалося зберегти план.')}finally{setBusy(false)}
 }
 return <details className="panel performance-summary" open>
  <summary><span className="cash-journal-summary"><Target size={20}/><span><strong>Мій план і премії</strong><small>{performance.metric==='cash'?'За касою':units?'За кількістю робіт':'За заробітком'} · {month}</small></span></span><ChevronDown size={18}/></summary>
  <div className="performance-content">
    <div className="performance-numbers"><span>Результат <strong>{progress?display(progress.actual,units):'—'}</strong></span><span>Мета <strong>{display(target,units)}</strong></span><span>Премія <strong>{progress?moneyUA(progress.bonus):'—'}</strong></span></div>
    <div className="cash-progress"><span style={{width:`${Math.min(100,Math.max(0,progress?.percent??0))}%`}}/></div>
    <p className="stats-small-note">{target===0?'Встанови місячний план, щоб увімкнути премію.':progress?`Виконано ${progress.percent.toLocaleString('uk-UA',{maximumFractionDigits:1})}%. До цілі: ${display(progress.remaining,units)}. Премія виплачується за календарем виплат.`:'Для розрахунку спочатку налаштуй базову оплату.'}</p>
    <div className="performance-goal-row"><label><span>План на {month} {units?'(одиниць)':'(грн)'}</span><input type="number" min="0" step={units?'1':'0.01'} value={draft} onChange={e=>setDraft(e.target.value)}/></label><button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void save()}><Save size={15}/> Зберегти</button>{hasOverride&&<button type="button" className="btn btn-outline" disabled={busy} onClick={async()=>{try{setBusy(true);await onResetTarget(month);setMessage('Використовується загальний план.')}catch(e){setMessage(e instanceof Error?e.message:'Помилка')}finally{setBusy(false)}}}>Загальний план</button>}</div>
    <button type="button" className="link-button" onClick={onRules}>Змінити показник і пороги премій</button>
    {message&&<p className="stats-small-note" role="status">{message}</p>}
  </div>
 </details>
}
