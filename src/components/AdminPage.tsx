import {useEffect,useRef,useState,type FormEvent} from 'react'
import {ArrowLeft,RefreshCw,ShieldCheck,UsersRound} from 'lucide-react'
import {loadAdminStats,loadAdminUsers,type AdminStats,type AdminUser} from '../lib/adminStats'
import '../styles/admin.css'
const date=(value:string|null)=>value?new Date(value).toLocaleString('uk-UA'):'Немає даних'
export function AdminPage({onBack}:{onBack:()=>void}){
  const [stats,setStats]=useState<AdminStats|null>(null),[users,setUsers]=useState<AdminUser[]>([])
  const [busy,setBusy]=useState(true),[error,setError]=useState(''),[next,setNext]=useState<string>()
  const [input,setInput]=useState(''),[search,setSearch]=useState('')
  const request=useRef(0)
  async function refresh(){
    const id=++request.current;setBusy(true);setError('');setStats(null);setUsers([]);setNext(undefined);setSearch('');setInput('')
    try{const [s,u]=await Promise.all([loadAdminStats(),loadAdminUsers()]);if(id===request.current){setStats(s);setUsers(u.users);setNext(u.next)}}
    catch(e){if(id===request.current)setError((e as Error).message)}
    finally{if(id===request.current)setBusy(false)}
  }
  async function list(query:string,after?:string){
    const id=++request.current;setBusy(true);setError('');setUsers([]);setNext(undefined);setSearch(query)
    try{const result=await loadAdminUsers(after,query);if(id===request.current){setUsers(result.users);setNext(result.next)}}
    catch(e){if(id===request.current){setStats(null);setError((e as Error).message)}}
    finally{if(id===request.current)setBusy(false)}
  }
  useEffect(()=>{void refresh();return()=>{request.current++}},[])
  const submit=(event:FormEvent)=>{event.preventDefault();void list(input.trim())}
  const cards=stats?[['Користувачів',stats.total],['Нових за 7 днів',stats.new7],['Активні за 24 години',stats.active1],['Активні за 7 днів',stats.active7],['Активні за 30 днів',stats.active30],['З даними активності',stats.tracked]]:[]
  return <div className="pt-admin" aria-busy={busy}>
    <div className="pt-admin-heading"><div><button type="button" className="btn btn-outline" onClick={onBack}><ArrowLeft size={16}/> До календаря</button><h1><ShieldCheck/> Адмінпанель</h1><p>Користувачі та використання PayTakt</p></div><button type="button" className="btn btn-primary" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={16}/> Оновити</button></div>
    {busy&&<p role="status">Завантажуємо дані…</p>}
    {error&&<div className="form-error" role="alert">{error} <button type="button" className="btn btn-outline" onClick={()=>void refresh()}>Повторити</button></div>}
    {stats&&<><div className="pt-admin-cards">{cards.map(([label,value])=><article className="panel" key={label}><span>{label}</span><strong>{Number(value).toLocaleString('uk-UA')}</strong></article>)}</div>
      <div className="pt-admin-charts"><section className="panel"><h2>Реєстрації за 7 календарних днів</h2><p>Часовий пояс: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Сьогодні — неповний день.</p><div className="pt-admin-bars">{stats.days.map(day=><div key={day.label}><strong>{day.count}</strong><div className="pt-admin-bar-track"><div style={{height:`${day.count/Math.max(1,...stats.days.map(d=>d.count))*100}%`}}/></div><span>{day.label}</span></div>)}</div></section>
      <section className="panel"><h2>Остання використана платформа</h2>{['Сайт / PWA','Android','iOS'].map((p,i)=><div className="pt-admin-platform" key={p}><span>{p}</span><strong>{stats.platforms[i]}</strong></div>)}<div className="pt-admin-platform"><span>Без даних про платформу</span><strong>{Math.max(0,stats.total-stats.platforms.reduce((a,b)=>a+b,0))}</strong></div><p>Один користувач враховується на одній, останній платформі.</p></section></div>
      <p className="pt-admin-note">Джерело — профілі Firestore. Активність: застосунок відкритий на передньому плані з інтернетом; оновлення приблизно раз на 5 хвилин. Історичні входи до встановлення цього оновлення невідомі. Оновлено: {date(stats.updatedAt)}.</p>
    </>}
    <section className="panel"><h2><UsersRound size={20}/> Користувачі</h2><form className="pt-admin-search" onSubmit={submit}><label htmlFor="admin-email">Пошук за повною адресою електронної пошти</label><div><input id="admin-email" type="search" value={input} onChange={e=>setInput(e.target.value)} placeholder="name@example.com"/><button className="btn btn-primary" disabled={busy}>Знайти</button><button type="button" className="btn btn-outline" disabled={busy} onClick={()=>{setInput('');void list('')}}>Скинути</button></div></form>
      {!busy&&!error&&users.length===0&&<p>Користувачів не знайдено.</p>}
      {users.length>0&&<div className="pt-admin-table"><table><thead><tr><th>Користувач</th><th>Реєстрація</th><th>Остання активність</th><th>Платформа / версія</th></tr></thead><tbody>{users.map(u=><tr key={u.uid}><td><strong>{u.name}</strong><span>{u.email}</span><small>{u.uid}</small></td><td>{date(u.createdAt)}</td><td>{date(u.lastSeenAt)}</td><td>{u.platform}<span>{u.version}</span></td></tr>)}</tbody></table></div>}
      <div className="pt-admin-pages"><span>До 25 профілів на сторінці · порядок за UID</span><button className="btn btn-outline" type="button" disabled={busy} onClick={()=>void list(search)}>На початок</button><button className="btn btn-outline" type="button" disabled={busy||!next} onClick={()=>void list(search,next)}>Далі</button></div>
    </section>
  </div>
}
