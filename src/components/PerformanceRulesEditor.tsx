import {inputCurrencyLabel,getAccountingCurrency} from '../lib/presentation'
import {useEffect,useState} from 'react'
import {ChevronDown,Target,Save,Sparkles,Plus,Trash2} from 'lucide-react'
import {validatePerformanceSettings,type PerformanceSettings,type PlanMetric} from '../lib/performance'
import {moneyUA} from '../lib/salary'

type Props={settings:PerformanceSettings;onSave:(v:PerformanceSettings)=>Promise<void>;onApplyZmina:()=>Promise<void>;demo:boolean}
const toInput=(value:number,metric:PlanMetric)=>String(metric==='units'?value:value/100)
const fromInput=(value:string,metric:PlanMetric)=>{const n=Number(value.replace(',','.'));return Number.isFinite(n)?Math.round(n*(metric==='units'?1:100)):NaN}
const name=(metric:PlanMetric)=>metric==='cash'?'каси':metric==='units'?'виконаних робіт':'особистого заробітку'
export function PerformanceRulesEditor({settings,onSave,onApplyZmina,demo}:Props){
  const [draft,setDraft]=useState<PerformanceSettings>(settings)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  useEffect(()=>{setDraft({...settings,tiers:settings.tiers.map(t=>({...t}))})},[settings])
  const change=(partial:Partial<PerformanceSettings>)=>{setDraft(v=>({...v,...partial}));setMessage('');setError('')}
  const save=async()=>{setError('');setMessage('')
    try{validatePerformanceSettings(draft);setBusy(true);await onSave(draft);setMessage(demo?'Збережено на час демосеансу.':'План і премії збережено.')}
    catch(e){setError(e instanceof Error?e.message:'Не вдалося зберегти план.')}
    finally{setBusy(false)}
  }
  const apply=async()=>{setError('');setMessage('')
    if(!window.confirm('Увімкнути шаблон «Система Зміна»? Дати виплат буде встановлено на 25, 10 і 15 число. Касу увімкнемо і використаємо замість ручної виручки для комісій. Існуючий оклад і ставки залишаться без змін.'))return
    try{setBusy(true);await onApplyZmina();setMessage('Шаблон «Система Зміна» застосовано. Вкажи місячний план в цьому розділі або у статистиці.')}
    catch(e){setError(e instanceof Error?e.message:'Не вдалося застосувати шаблон. Частина налаштувань могла зберегтися — перевір їх.')}
    finally{setBusy(false)}
  }
  return <details className="panel pay-collapse performance-editor">
    <summary className="pay-collapse-summary"><div className="pay-block-heading"><Target size={21}/><div><h3>План і премії</h3><p>Ціль за касою, заробітком або кількістю виконаних робіт</p></div></div><ChevronDown className="pay-collapse-chevron" size={19} aria-hidden="true"/></summary>
    <div className="pay-collapse-body">
      <div className="performance-toolbar"><div><strong>Готовий шаблон «Система Зміна»</strong><p>План за касою: премія {getAccountingCurrency()==='UAH'?'2 000 ₴':`2 000 ${getAccountingCurrency()}`} при 100%. Зарплата — 25-го та 10-го, премія — 15-го наступного місяця. Твої ставки не зміняться.</p></div><button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void apply()}><Sparkles size={17}/> Застосувати</button></div>
      <label className="pay-toggle"><input type="checkbox" checked={draft.enabled} onChange={e=>change({enabled:e.target.checked})}/><span><strong>Увімкнути мій план і премії</strong><small>Без цього налаштування не впливають на зарплату.</small></span></label>
      <label className="pay-toggle"><input type="checkbox" checked={draft.manualDailyPay} onChange={e=>change({manualDailyPay:e.target.checked})}/><span><strong>Ручний заробіток за кожен день</strong><small>Додасть компактне поле «Мій заробіток» у календарі. Введена сума замінює автоматичну базову оплату, але не доплати. Дні без суми отримують 0 базової оплати.</small></span></label>
    <div className="performance-fields">
        <label className="pay-field"><span><strong>Що вимірювати?</strong><small>Вибери один показник. Каса і зарплата ніколи не додаються одна до одної.</small></span><select value={draft.metric} onChange={e=>change({metric:e.target.value as PlanMetric,defaultTarget:0})}><option value="cash">Каса за робочі дні</option><option value="earnings">Мій заробіток (без премій)</option><option value="units">Кількість виконаних робіт</option></select></label>
        <label className="pay-field"><span><strong>План за замовчуванням</strong><small>Для всіх місяців; у статистиці можна змінити окремий місяць. 0 — без премії.</small></span><input className="pay-number" type="number" min="0" step={draft.metric==='units'?'1':'0.01'} value={toInput(draft.defaultTarget,draft.metric)} onChange={e=>change({defaultTarget:fromInput(e.target.value,draft.metric)})}/></label>
      </div>
      <div className="performance-tier-head"><div><strong>Преміальні пороги</strong><p>Виплачується лише найбільша досягнута премія, не всі одразу.</p></div><button type="button" className="btn btn-outline" disabled={draft.tiers.length>=4} onClick={()=>{const last=draft.tiers.at(-1);change({tiers:[...draft.tiers,{id:`tier_${Date.now()}`,thresholdBasisPoints:(last?.thresholdBasisPoints??9000)+1000,bonus:0}]})}}><Plus size={16}/> Поріг</button></div>
      <div className="performance-tier-list">{draft.tiers.map((tier,i)=><div className="performance-tier-row" key={tier.id}>
        <label><span>Виконання плану, %</span><input type="number" min="1" max="300" step="0.01" value={tier.thresholdBasisPoints/100} onChange={e=>change({tiers:draft.tiers.map((v,j)=>j===i?{...v,thresholdBasisPoints:Math.round(Number(e.target.value)*100)}:v)})}/></label>
        <label><span>Премія, {inputCurrencyLabel()}</span><input type="number" min="0" step="0.01" value={tier.bonus/100} onChange={e=>change({tiers:draft.tiers.map((v,j)=>j===i?{...v,bonus:Math.round(Number(e.target.value)*100)}:v)})}/></label>
        <button type="button" className="icon-button" aria-label="Видалити поріг" disabled={draft.tiers.length<=1} onClick={()=>change({tiers:draft.tiers.filter((_,j)=>j!==i)})}><Trash2 size={17}/></button>
      </div>)}</div>
      <p className="stats-small-note performance-note">Премія додається до нарахувань один раз і виплачується за календарем виплат. Касу внось у календарі, кількість виконаних робіт — у «Нарахуваннях».</p>
      <div className="performance-bottom"><span>При {draft.tiers[0]?.thresholdBasisPoints/100}% плану: {moneyUA(draft.tiers[0]?.bonus??0)} · джерело — {name(draft.metric)}</span><button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void save()}><Save size={17}/>{busy?'Зберігаємо…':'Зберегти план'}</button></div>
      {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="form-success" role="status">{message}</p>}
    </div>
  </details>
}
