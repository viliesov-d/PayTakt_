import {useEffect,useRef,useState,type FormEvent} from 'react'
import {ArrowLeft,RefreshCw,ShieldCheck,UsersRound,CalendarDays,Clock3,Wallet,ChevronDown} from 'lucide-react'
import {loadAdminUsers,type AdminUser} from '../lib/adminStats'
import {
  loadAdminOverview,loadAdminMonthlyUsers,formatAdminMoney,
  type AdminOverview,type AdminUserMonth,type AdminWorkspaceMonth,
} from '../lib/adminPayroll'
import '../styles/admin.css'

const currentMonth=()=>new Date().toLocaleDateString('sv-SE',{year:'numeric',month:'2-digit'})
const hours=(n:number)=>new Intl.NumberFormat('uk-UA',{maximumFractionDigits:2}).format(n)
function moneyValues(values:Record<string,number>):string[]{
  return Object.entries(values).sort(([a],[b])=>a.localeCompare(b)).map(([currency,value])=>formatAdminMoney(value,currency))
}
function UserHistory({data}:{data:AdminWorkspaceMonth}){
  return <section className="pt-admin-workspace">
    <div className="pt-admin-workspace-title">
      <div><h3>{data.name}</h3><p>{data.kind==='company'?'Компанія':'Особистий простір'} · {data.currency}</p></div>
      <strong>{data.gross===null?'Немає розрахунку':formatAdminMoney(data.gross,data.currency)}</strong>
    </div>
    <div className="pt-admin-facts">
      <span>Змін: <b>{data.shifts}</b></span><span>Годин: <b>{hours(data.hours)}</b></span>
      <span>Понаднормових: <b>{data.overtimeMinutes===null?'—':hours(data.overtimeMinutes/60)+' год'}</b></span>
      <span>Премій: <b>{data.bonus===null?'—':formatAdminMoney(data.bonus,data.currency)}</b></span>
    </div>
    {data.error&&<p className="pt-admin-warning" role="status">{data.error}</p>}
    <div className="pt-admin-detail-cols">
      <div><h4>Історія змін за місяць</h4>
        {data.days.length===0?<p>За цей місяць записів немає.</p>:<div className="pt-admin-table"><table>
          <thead><tr><th>Дата</th><th>Статус</th><th>Зміни</th><th>Години</th><th>Понаднормові</th><th>Вручну за день</th></tr></thead>
          <tbody>{data.days.map(day=><tr key={day.date}>
            <td><strong>{day.date}</strong>{day.note&&<small>{day.note}</small>}</td>
            <td>{day.status}</td><td>{day.shifts}</td><td>{hours(day.hours)}</td>
            <td>{hours(day.overtimeMinutes/60)}</td>
            <td>{day.wage===null?'—':formatAdminMoney(day.wage,data.currency)}</td>
          </tr>)}</tbody>
        </table></div>}
      </div>
      <div><h4>Нарахування за чинними правилами</h4>
        {data.gross===null?<p>Немає підтвердженого розрахунку.</p>:data.lines.length===0?<p>Нарахувань немає.</p>:
          <div className="pt-admin-paylines">{data.lines.map(line=><div key={line.code}>
            <span><strong>{line.title}</strong><small>{line.details}</small></span>
            <b>{formatAdminMoney(line.amount,data.currency)}</b>
          </div>)}</div>}
      </div>
    </div>
  </section>
}

export function AdminPage({onBack}:{onBack:()=>void}){
  const [overview,setOverview]=useState<AdminOverview|null>(null)
  const [users,setUsers]=useState<AdminUser[]>([])
  const [entries,setEntries]=useState<Record<string,AdminUserMonth>>({})
  const [month,setMonth]=useState(currentMonth)
  const [busy,setBusy]=useState(false)
  const [loadingMonth,setLoadingMonth]=useState(false)
  const [error,setError]=useState('')
  const [monthError,setMonthError]=useState('')
  const [next,setNext]=useState<string>()
  const [cursor,setCursor]=useState<string>()
  const [history,setHistory]=useState<(string|undefined)[]>([])
  const [input,setInput]=useState('')
  const [search,setSearch]=useState('')
  const [selected,setSelected]=useState<string|null>(null)
  const request=useRef(0),monthRequest=useRef(0)
  async function load(query='',after?:string,stack:(string|undefined)[]=[]){
    const id=++request.current
    ++monthRequest.current // Cancel display of responses from previous pages.
    setBusy(true);setError('');setSelected(null)
    try{
      const [overviewResult,result]=await Promise.all([loadAdminOverview(),loadAdminUsers(after,query)])
      if(id!==request.current)return
      setOverview(overviewResult);setUsers(result.users);setNext(result.next)
      setCursor(after);setHistory(stack);setSearch(query);setEntries({})
    }catch(e){
      if(id!==request.current)return
      setUsers([]);setEntries({});setOverview(null);setError(e instanceof Error?e.message:'Не вдалося отримати дані.')
    }finally{if(id===request.current)setBusy(false)}
  }
  useEffect(()=>{void load();return()=>{request.current++;monthRequest.current++}},[])
  useEffect(()=>{
    const id=++monthRequest.current
    setEntries({});setMonthError('');setLoadingMonth(users.length>0&&!busy)
    if(busy||users.length===0){setLoadingMonth(false);return}
    void loadAdminMonthlyUsers(users,month,item=>{
      if(id===monthRequest.current)setEntries(old=>({...old,[item.uid]:item}))
    }).catch(e=>{
      if(id===monthRequest.current)setMonthError(e instanceof Error?e.message:'Не вдалося завантажити показники.')
    }).finally(()=>{if(id===monthRequest.current)setLoadingMonth(false)})
    return()=>{monthRequest.current++}
  },[users,month,busy])

  const submit=(event:FormEvent)=>{event.preventDefault();void load(input.trim())}
  const resolved=users.map(user=>entries[user.uid]).filter((item):item is AdminUserMonth=>Boolean(item))
  const totalShifts=resolved.reduce((sum,item)=>sum+item.shifts,0)
  const totalHours=resolved.reduce((sum,item)=>sum+item.hours,0)
  const totals:Record<string,number>={}
  resolved.forEach(user=>Object.entries(user.byCurrency).forEach(([currency,amount])=>{
    totals[currency]=(totals[currency]??0)+amount
  }))
  const incomplete=resolved.some(item=>item.incomplete)
  const active=selected?users.find(u=>u.uid===selected):null
  const activeMonth=selected?entries[selected]:null
  return <div className="pt-admin" aria-busy={busy}>
    <div className="pt-admin-heading">
      <div><button type="button" className="btn btn-outline" onClick={onBack}><ArrowLeft size={16}/> До календаря</button>
        <h1><ShieldCheck size={25}/> Адмінпанель</h1>
        <p>Місячна статистика користувачів, зміни та нарахування</p></div>
      <button type="button" className="btn btn-primary" onClick={()=>void load(search,cursor,history)} disabled={busy}>
        <RefreshCw size={16}/> Оновити</button>
    </div>
    <div className="panel pt-admin-month"><label htmlFor="admin-month"><CalendarDays size={18}/> Місяць статистики</label>
      <input id="admin-month" type="month" min="2020-01" max="2100-12" value={month}
        onChange={event=>{setSelected(null);setMonth(event.target.value)}}/>
      <p>Суми є прогнозом нарахувань за поточними правилами, а не історією фактично виплачених коштів.</p>
    </div>
    {busy&&<p role="status">Завантажуємо список користувачів…</p>}
    {error&&<div className="form-error" role="alert">{error} <button className="btn btn-outline" type="button" onClick={()=>void load()}>Повторити</button></div>}
    {overview&&<div className="pt-admin-cards">
      <article className="panel"><span>Усього профілів</span><strong>{overview.users.toLocaleString('uk-UA')}</strong></article>
      <article className="panel"><span>Робочих просторів</span><strong>{overview.workspaces.toLocaleString('uk-UA')}</strong></article>
      <article className="panel"><span>Змін на сторінці</span><strong>{totalShifts}</strong></article>
      <article className="panel"><span>Годин на сторінці</span><strong>{hours(totalHours)}</strong></article>
    </div>}
    <section className="panel">
      <div className="pt-admin-section-head"><h2><UsersRound size={20}/> Користувачі</h2>
        <span>{loadingMonth?'Рахуємо… ':''}{resolved.length} / {users.length} профілів</span></div>
      <form className="pt-admin-search" onSubmit={submit}>
        <label htmlFor="admin-email">Пошук за точною адресою електронної пошти</label>
        <div><input id="admin-email" type="search" value={input} onChange={e=>setInput(e.target.value)}
          placeholder="name@example.com"/><button type="submit" className="btn btn-primary" disabled={busy}>Знайти</button>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>{setInput('');void load()}}>Скинути</button></div>
      </form>
      {monthError&&<p className="pt-admin-warning" role="alert">{monthError}</p>}
      {incomplete&&<p className="pt-admin-warning">Частину нарахувань не вдалося розрахувати. Такі суми не включено до підсумку.</p>}
      <p className="pt-admin-note">Показники змін, годин і зарплати — за користувачами <strong>на цій сторінці</strong>. Загальна кількість профілів — для всього PayTakt. Валюти не конвертуються і не змішуються.</p>
      {!busy&&users.length===0&&!error&&<p>Користувачів не знайдено.</p>}
      {users.length>0&&<div className="pt-admin-table"><table>
        <thead><tr><th>Користувач</th><th>Простори</th><th>Зміни</th><th>Години</th><th>Нараховано</th><th>Історія</th></tr></thead>
        <tbody>{users.map(user=>{
          const row=entries[user.uid]
          return <tr key={user.uid}>
            <td><strong>{user.name}</strong><span>{user.email}</span></td>
            <td>{row?row.error?'Помилка':row.workspaces.length:'…'}</td>
            <td>{row?row.error?'—':row.shifts:'…'}</td>
            <td>{row?row.error?'—':hours(row.hours):'…'}</td>
            <td>{row?(row.error?row.error:row.workspaces.length===0?'Немає просторів':
              moneyValues(row.byCurrency).length?moneyValues(row.byCurrency).map(x=><span key={x}>{x}</span>):'—'):'Обчислюємо…'}
              {row?.incomplete&&<small>Неповні дані</small>}</td>
            <td><button type="button" className="btn btn-outline pt-admin-open"
              disabled={!row||Boolean(row.error)} onClick={()=>setSelected(user.uid)}>
              Переглянути</button></td>
          </tr>
        })}</tbody>
      </table></div>}
      <div className="pt-admin-pages">
        <span>До 25 користувачів на сторінці</span>
        <button type="button" className="btn btn-outline" disabled={busy||history.length===0}
          onClick={()=>void load(search,history.at(-1),history.slice(0,-1))}>Назад</button>
        <button type="button" className="btn btn-outline" disabled={busy||!next}
          onClick={()=>void load(search,next,[...history,cursor])}>Далі</button>
      </div>
    </section>
    {overview&&<section className="panel pt-admin-summary">
      <h2><Wallet size={19}/> Нарахування за {month} на поточній сторінці</h2>
      {moneyValues(totals).length?moneyValues(totals).map(m=><strong key={m}>{m}</strong>):<p>Немає розрахованих сум.</p>}
      <small>Суми відображаються тільки для {resolved.length} завантажених профілів із {users.length} на цій сторінці.</small>
    </section>}
    {active&&activeMonth&&<section className="panel pt-admin-detail" aria-label="Історія користувача">
      <div className="pt-admin-detail-head"><div><h2><Clock3 size={19}/> {active.name}</h2>
        <p>{active.email} · {month} · тільки перегляд</p></div>
        <button className="btn btn-outline" type="button" onClick={()=>setSelected(null)}>Закрити</button></div>
      {activeMonth.workspaces.length===0?<p>У користувача немає робочих просторів.</p>:
        activeMonth.workspaces.map(workspace=><UserHistory key={workspace.id} data={workspace}/>)}
      <p className="pt-admin-note">Це реконструкція за чинними правилами та збереженими записами календаря. Якщо ставки змінювалися, минулі суми можуть відрізнятися від нарахувань на той час. Змінювати чужі записи з адмінпанелі не можна.</p>
    </section>}
  </div>
}
