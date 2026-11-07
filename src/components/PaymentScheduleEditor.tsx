import {inputCurrencyLabel} from '../lib/presentation'
import {CalendarClock,Plus,Trash2,ArrowUp,ArrowDown,Info,ChevronDown} from 'lucide-react'
import {SmoothPayAccordion} from './SmoothPayAccordion'
import {defaultPaymentRules,type PaymentRule,type PaymentSource,type PaymentMethod} from '../lib/salary'

const fixedAdvance=(amount=1000000):PaymentRule[] => [
  {id:'advance',title:'Фіксований аванс',source:'earnings',method:'fixed',amount,day:20,monthOffset:0,enabled:true},
  {id:'salary',title:'Залишок зарплати',source:'earnings',method:'remainder',amount:0,day:10,monthOffset:1,enabled:true},
  {id:'bonus',title:'Премія разом із зарплатою',source:'bonus',method:'remainder',amount:0,day:10,monthOffset:1,enabled:true},
]
const percentAdvance=():PaymentRule[]=>[
  {id:'advance',title:'Аванс 40%',source:'earnings',method:'percent',amount:4000,day:20,monthOffset:0,enabled:true},
  {id:'salary',title:'Залишок зарплати',source:'earnings',method:'remainder',amount:0,day:5,monthOffset:1,enabled:true},
  {id:'bonus',title:'Премія',source:'bonus',method:'remainder',amount:0,day:5,monthOffset:1,enabled:true},
]
const asCurrency=(value:number)=>String(value/100)
const parseCurrency=(value:string)=>{const n=Number(value.replace(',','.'));return Number.isFinite(n)?Math.round(n*100):NaN}
const newId=()=>`payment_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
export function PaymentScheduleEditor({value,onChange}:{value:PaymentRule[];onChange:(rules:PaymentRule[])=>void}){
  const edit=(id:string,patch:Partial<PaymentRule>)=>onChange(value.map(item=>item.id===id?{...item,...patch}:item))
  const add=(source:PaymentSource)=>{
    if(value.length>=12)return
    const item:PaymentRule={id:newId(),title:source==='bonus'?'Частина премії':'Додатковий аванс',source,method:'fixed',amount:0,day:20,monthOffset:0,enabled:true}
    // Always insert before the last remainder for this source.
    const index=value.findIndex(r=>r.source===source&&r.method==='remainder')
    const next=[...value];next.splice(index<0?next.length:index,0,item);onChange(next)
  }
  const move=(index:number,direction:number)=>{
    const other=index+direction
    if(other<0||other>=value.length||value[index].source!==value[other].source)return
    const next=[...value];[next[index],next[other]]=[next[other],next[index]];onChange(next)
  }
  return <SmoothPayAccordion className="panel payment-schedule-panel pay-collapse">
    <summary className="pay-collapse-summary"><div className="pay-block-heading"><CalendarClock size={22}/><div><h3>Календар виплат</h3><p>Коли та з яких нарахувань приходять аванс, зарплата й премії. Порядок правил визначає розподіл суми.</p></div></div><ChevronDown className="pay-collapse-chevron" size={19} aria-hidden="true"/></summary><div className="pay-collapse-body">
    <div className="payment-presets">
      <button type="button" className="btn btn-outline" onClick={()=>onChange(defaultPaymentRules.map(x=>({...x})))}>За половинами</button>
      <button type="button" className="btn btn-outline" onClick={()=>onChange(fixedAdvance())}>Фіксований аванс + зарплата та премія разом</button>
      <button type="button" className="btn btn-outline" onClick={()=>onChange(percentAdvance())}>40% аванс, решта наступного місяця</button>
    </div>
    <p className="pay-hint"><Info size={15}/> Можна змінювати назви, дні (1–31), зсув на 0–3 місяці, суми, відсотки, додавати кілька авансів і часткових премій. Останнє активне правило кожної категорії має бути «Весь залишок».</p>
    <div className="payment-rule-list">{value.map((item,index)=><div className="payment-rule-card" key={item.id}>
      <div className="payment-rule-heading"><label className="pay-toggle"><input type="checkbox" checked={item.enabled} onChange={e=>edit(item.id,{enabled:e.target.checked})}/><strong>{item.source==='earnings'?'Зарплата / аванс':'Премії'}</strong></label>
        <div className="payment-rule-actions">
          <button type="button" className="btn btn-outline" aria-label="Перемістити вище" disabled={index===0||value[index-1].source!==item.source||item.method==='remainder'} onClick={()=>move(index,-1)}><ArrowUp size={15}/></button>
          <button type="button" className="btn btn-outline" aria-label="Перемістити нижче" disabled={index===value.length-1||value[index+1].source!==item.source||value[index+1].method==='remainder'} onClick={()=>move(index,1)}><ArrowDown size={15}/></button>
          <button type="button" className="btn btn-outline" aria-label="Видалити подію" disabled={item.method==='remainder'} onClick={()=>onChange(value.filter(x=>x.id!==item.id))}><Trash2 size={15}/></button>
        </div>
      </div>
      <div className="payment-rule-fields">
        <label>Назва події<input maxLength={80} required value={item.title} onChange={e=>edit(item.id,{title:e.target.value})}/></label>
        <label>Розрахунок суми<select value={item.method} onChange={e=>edit(item.id,{method:e.target.value as PaymentMethod,amount:0})}>
          <option value="fixed">Фіксована сума</option><option value="percent">Відсоток від нарахувань</option>
          {item.source==='earnings'&&<option value="first_half">Нараховано за 1–15 число</option>}
          <option value="remainder">Весь залишок</option>
        </select></label>
        {(item.method==='fixed'||item.method==='percent')&&<label>{item.method==='fixed'?`Сума, ${inputCurrencyLabel()}`:'Відсоток, %'}<input type="number" required min="0" max={item.method==='fixed'?"1000000000":"100"} step="0.01" value={Number.isFinite(item.amount)?item.method==='fixed'?asCurrency(item.amount):String(item.amount/100):''} onChange={e=>edit(item.id,{amount:item.method==='fixed'?parseCurrency(e.target.value):Math.round(Number(e.target.value)*100)})}/></label>}
        <label>Число місяця<input type="number" required min="1" max="31" step="1" value={item.day} onChange={e=>edit(item.id,{day:Number(e.target.value)})}/></label>
        <label>Коли виплачують<select value={item.monthOffset} onChange={e=>edit(item.id,{monthOffset:Number(e.target.value)})}>
          <option value={0}>Цього місяця</option><option value={1}>Наступного місяця</option><option value={2}>Через 2 місяці</option><option value={3}>Через 3 місяці</option>
        </select></label>
      </div>
    </div>)}</div>
    <div className="payment-add-buttons"><button type="button" className="btn btn-outline" disabled={value.length>=12} onClick={()=>add('earnings')}><Plus size={16}/> Додати аванс / частину зарплати</button><button type="button" className="btn btn-outline" disabled={value.length>=12} onClick={()=>add('bonus')}><Plus size={16}/> Додати частину премії</button></div>
    <p className="pay-hint">Якщо число 31 не існує в місяці виплати, обирається його останній день. Прогноз не є підтвердженням банківського переказу.</p>
  </div></SmoothPayAccordion>
}
