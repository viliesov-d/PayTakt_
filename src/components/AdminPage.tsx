import {useEffect,useMemo,useRef,useState} from 'react'
import {
  ArrowLeft,RefreshCw,ShieldCheck,Download,UsersRound,
} from 'lucide-react'
import {loadAdminUsers,type AdminUser} from '../lib/adminStats'
import {
  loadAdminOverview,loadAdminMonthlyUsers,formatAdminMoney,
  type AdminOverview,type AdminUserMonth,type AdminWorkspaceMonth,
} from '../lib/adminPayroll'
import '../styles/admin.css'

type Kind='cash'|'wage'
type DayPoint={day:number;cash:number;wage:number}
type Sort='cash'|'wage'|'plan'|'name'
type Filter='all'|'worked'|'empty'|'error'
const nowMonth=()=>{
  const today=new Date()
  return today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')
}
const num=(value:number)=>new Intl.NumberFormat('uk-UA',{maximumFractionDigits:1}).format(value)
const money=(value:number|null|undefined,currency:string)=>
  value===null||value===undefined?'—':formatAdminMoney(value,currency)
const identity=(user:AdminUser)=>user.name||user.email||'Користувач'
const percent=(actual:number|null,target:number|null)=>
  target!==null&&target>0&&actual!==null?actual/target*100:null
const percentText=(value:number|null)=>value===null?'—':num(value)+'%'
const userTotal=(row:AdminUserMonth|undefined,key:'gross'|'cash'|'bonus',currency:string):number|null=>{
  if(!row||row.error)return null
  const source=key==='gross'?row.byCurrency:key==='cash'?row.cashByCurrency:row.bonusByCurrency
  return source[currency]??0
}
const wsPlan=(workspace:AdminWorkspaceMonth|undefined)=>
  workspace?percent(workspace.planActual,workspace.target):null
function monthDays(month:string):number{
  const [y,m]=month.split('-').map(Number)
  return new Date(y,m,0).getDate()
}
function daysFor(workspaces:AdminWorkspaceMonth[],month:string):DayPoint[]{
  const length=monthDays(month)
  const days=Array.from({length},(_,index)=>({day:index+1,cash:0,wage:0}))
  for(const workspace of workspaces){
    for(const entry of workspace.days){
      if(!entry.date.startsWith(month+'-'))continue
      const index=Number(entry.date.slice(8))-1
      if(index<0||index>=length)continue
      days[index].cash+=entry.cash??0
      // Only manually entered daily wages are known by date.
      days[index].wage+=entry.wage??0
    }
  }
  return days
}
function Trend({points,kind,label}:{points:DayPoint[];kind:Kind;label:string}){
  const amounts=points.map(p=>p[kind]/100)
  if(!amounts.length||!amounts.some(n=>n>0))
    return <div className="admin-chart-empty">Немає внесених сум за днями</div>
  const width=590,height=180,left=43,right=13,top=12,bottom=31
  const plotW=width-left-right,plotH=height-top-bottom
  const highest=Math.max(1,...amounts)
  const coords=amounts.map((amount,i)=>({
    x:left+i/Math.max(1,amounts.length-1)*plotW,
    y:top+(1-amount/highest)*plotH,
  }))
  const line=coords.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ')
  const area=line+' L '+(width-right)+' '+(top+plotH)+' L '+left+' '+(top+plotH)+' Z'
  const color=kind==='cash'?'#70ab4c':'#8072d4'
  const ticks=[0,Math.round((amounts.length-1)/4),Math.round((amounts.length-1)/2),
    Math.round((amounts.length-1)*.75),amounts.length-1]
  return <svg viewBox="0 0 590 180" preserveAspectRatio="xMidYMid meet"
      role="img" aria-label={label}>
    {[0,1,2].map(i=><g key={i}>
      <line x1={left} x2={width-right} y1={top+plotH*i/2} y2={top+plotH*i/2}
        stroke="#e9eef2" strokeDasharray="4 5"/>
      <text x={left-6} y={top+plotH*i/2+3} fill="#8d9ca9" fontSize="10"
        textAnchor="end">{num(highest*(1-i/2))}</text>
    </g>)}
    <path d={area} fill={kind==='cash'?'#dff2d3':'#eeeafa'} opacity=".75"/>
    <path d={line} fill="none" stroke={color} strokeWidth="2.7"
      strokeLinejoin="round" strokeLinecap="round"/>
    {[...new Set(ticks)].map(index=><text key={index} x={coords[index].x}
      y={height-9} textAnchor="middle" fontSize="10" fill="#8d9ca9">
      {index+1}</text>)}
  </svg>
}
function download(filename:string,content:string,mime:string){
  const blob=new Blob([content],{type:mime})
  const url=URL.createObjectURL(blob)
  const anchor=document.createElement('a')
  anchor.href=url;anchor.download=filename
  document.body.appendChild(anchor);anchor.click();anchor.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function csvCell(value:unknown){
  const raw=String(value??'')
  // Prevent spreadsheet formula injection from names, emails or notes.
  const safe=/^[=+\-@\t\r]/.test(raw)?"'"+raw:raw
  return '"'+safe.replaceAll('"','""')+'"'
}
function exportTeam(users:AdminUser[],records:Record<string,AdminUserMonth>,currency:string,month:string){
  const header=['Користувач','Email','Валюта','Каса','Зарплата','Премії','Зміни','Години','Стан']
  const rows=users.map(user=>{
    const record=records[user.uid]
    return [identity(user),user.email,currency,
      record?.cashByCurrency[currency]===undefined?'':(record.cashByCurrency[currency]/100).toFixed(2),
      record?.byCurrency[currency]===undefined?'':(record.byCurrency[currency]/100).toFixed(2),
      record?.bonusByCurrency[currency]===undefined?'':(record.bonusByCurrency[currency]/100).toFixed(2),
      record?.shifts??'',record?num(record.hours):'',
      !record?'Завантаження':record.error?'Помилка':record.incomplete?'Часткові дані':'Готово',
    ]
  })
  download('paytakt-admin-'+month+'-'+currency+'.csv',
    '\ufeff'+[header,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n'),
    'text/csv;charset=utf-8')
}
function dataFilter(row:AdminUserMonth|undefined,filter:Filter):boolean{
  if(filter==='all')return true
  if(filter==='error')return Boolean(row?.error||row?.incomplete)
  if(filter==='worked')return Boolean(row&&row.shifts>0)
  return Boolean(row&&!row.error&&row.shifts===0)
}
/** Sidebar, KPI cards, leader list, charts and employee card use the visual
 * structure of the original Zmina admin, not the former PayTakt table layout. */
export function AdminPage({onBack}:{onBack:()=>void}){
  const [overview,setOverview]=useState<AdminOverview|null>(null)
  const [users,setUsers]=useState<AdminUser[]>([])
  const [rows,setRows]=useState<Record<string,AdminUserMonth>>({})
  const [month,setMonth]=useState(nowMonth)
  const [currency,setCurrency]=useState('UAH')
  const [query,setQuery]=useState('')
  const [filter,setFilter]=useState<Filter>('all')
  const [sort,setSort]=useState<Sort>('cash')
  const [selected,setSelected]=useState<string|null>(null)
  const [workspaceId,setWorkspaceId]=useState('')
  const [loading,setLoading]=useState(false)
  const [calculating,setCalculating]=useState(false)
  const [error,setError]=useState('')
  const [monthError,setMonthError]=useState('')
  const [partialDirectory,setPartialDirectory]=useState(false)
  const version=useRef(0),monthVersion=useRef(0)
  const detailRef=useRef<HTMLElement>(null)

  async function refresh(){
    const id=++version.current
    ++monthVersion.current
    setLoading(true);setError('');setRows({});setOverview(null);setSelected(null)
    try{
      const overviewPromise=loadAdminOverview()
      const all:AdminUser[]=[]
      let next:string|undefined,more=false
      // Do not silently truncate large user directories or trigger unbounded
      // reads. A search by name/email still works across fetched profiles.
      for(let page=0;page<20;page++){
        const result=await loadAdminUsers(next)
        if(id!==version.current)return
        all.push(...result.users)
        next=result.next
        if(!next)break
        if(page===19)more=true
      }
      const summary=await overviewPromise
      if(id!==version.current)return
      setOverview(summary)
      setPartialDirectory(more)
      setUsers(all)
      setSelected(all[0]?.uid??null)
    }catch(e){
      if(id!==version.current)return
      setUsers([]);setError(e instanceof Error?e.message:'Не вдалося завантажити профілі.')
    }finally{if(id===version.current)setLoading(false)}
  }
  useEffect(()=>{void refresh();return()=>{++version.current;++monthVersion.current}},[])
  useEffect(()=>{
    const id=++monthVersion.current
    setRows({});setMonthError('')
    if(!users.length){setCalculating(false);return}
    setCalculating(true)
    void loadAdminMonthlyUsers(users,month,item=>{
      if(id===monthVersion.current)setRows(prev=>({...prev,[item.uid]:item}))
    }).catch(e=>{
      if(id===monthVersion.current)setMonthError(e instanceof Error?e.message:'Немає доступу до нарахувань.')
    }).finally(()=>{if(id===monthVersion.current)setCalculating(false)})
    return()=>{++monthVersion.current}
  },[users,month])

  const resolved=users.map(user=>rows[user.uid]).filter((r):r is AdminUserMonth=>Boolean(r))
  const currencies=useMemo(()=>{
    const values=new Set<string>()
    for(const entry of Object.values(rows))for(const ws of entry.workspaces)values.add(ws.currency)
    return values.size?[...values].sort():['UAH']
  },[rows])
  const activeCurrency=currencies.includes(currency)?currency:currencies[0]
  const cashTotal=resolved.reduce((sum,r)=>sum+(r.cashByCurrency[activeCurrency]??0),0)
  const wageTotal=resolved.reduce((sum,r)=>sum+(r.byCurrency[activeCurrency]??0),0)
  const bonusTotal=resolved.reduce((sum,r)=>sum+(r.bonusByCurrency[activeCurrency]??0),0)
  const currencyWorkspaces=resolved.flatMap(r=>r.workspaces.filter(w=>w.currency===activeCurrency))
  const plans=currencyWorkspaces.filter(w=>w.target!==null&&w.target>0)
  const achieved=plans.filter(w=>(w.planActual??0)>=(w.target??Infinity)).length
  const completeness=resolved.length+'/'+users.length
  const incomplete=resolved.some(r=>r.incomplete||Boolean(r.error))
  const teamChart=daysFor(currencyWorkspaces,month)
  const ranking=users.filter(u=>rows[u.uid]&&!rows[u.uid].error).sort((a,b)=>
    (userTotal(rows[b.uid],'cash',activeCurrency)??0)-(userTotal(rows[a.uid],'cash',activeCurrency)??0))
    .filter(u=>(userTotal(rows[u.uid],'cash',activeCurrency)??0)>0).slice(0,5)
  const topCash=Math.max(1,...ranking.map(u=>userTotal(rows[u.uid],'cash',activeCurrency)??0))
  const filtered=users.filter(user=>
    (identity(user)+' '+user.email).toLocaleLowerCase('uk-UA')
      .includes(query.trim().toLocaleLowerCase('uk-UA'))&&dataFilter(rows[user.uid],filter))
    .sort((a,b)=>{
      if(sort==='name')return identity(a).localeCompare(identity(b),'uk-UA')
      const value=(user:AdminUser)=>{
        const row=rows[user.uid]
        if(sort==='cash')return userTotal(row,'cash',activeCurrency)??-1
        if(sort==='wage')return userTotal(row,'gross',activeCurrency)??-1
        const target=row?.workspaces.filter(w=>w.currency===activeCurrency).find(w=>w.target)
        return wsPlan(target)??-1
      }
      return value(b)-value(a)||identity(a).localeCompare(identity(b),'uk-UA')
    })
  const currentUser=users.find(u=>u.uid===selected)
  const currentRow=selected?rows[selected]:undefined
  const availableWorkspaces=currentRow?.workspaces??[]
  const selectedWorkspace=availableWorkspaces.find(w=>w.id===workspaceId) ??
    availableWorkspaces.find(w=>w.currency===activeCurrency)??availableWorkspaces[0]
  const personDays=daysFor(selectedWorkspace?[selectedWorkspace]:[],month)
  const personCash=selectedWorkspace?.cash??null
  const personWage=selectedWorkspace?.gross??null
  const personPlan=wsPlan(selectedWorkspace)
  const hasData=resolved.length>0
  const currentMonthLabel=(()=>{
    const [y,m]=month.split('-').map(Number)
    return new Date(y,m-1,1).toLocaleDateString('uk-UA',{month:'long',year:'numeric'})
  })()
  const choose=(uid:string)=>{
    setSelected(uid);setWorkspaceId('')
    if(window.matchMedia('(max-width:960px)').matches)
      window.requestAnimationFrame(()=>detailRef.current?.scrollIntoView({behavior:'smooth',block:'start'}))
  }
  const safeMonth=/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/
  return <div className="pt-zmina-admin admin-main admin-dashboard">
    <section className="admin-hero">
      <div>
        <button className="admin-back-link" onClick={onBack} type="button"><ArrowLeft size={15}/> До календаря</button>
        <div className="admin-hero-eyebrow">✦ АНАЛІТИКА КОМАНДИ</div>
        <h1>Панель <span>керування</span></h1>
        <p>Каса, зарплата, премії та виконання планів — в одному місці.</p>
      </div>
      <div className="admin-toolbar">
        <label className="admin-toolbar-label" htmlFor="admin-month">Звітний місяць</label>
        <input className="admin-month" id="admin-month" type="month"
          min="1900-01" max="2100-12" value={month}
          onChange={e=>{if(safeMonth.test(e.target.value)){setMonth(e.target.value);setWorkspaceId('')}}}/>
        <label className="admin-toolbar-label" htmlFor="admin-currency">Валюта</label>
        <select id="admin-currency" className="admin-month" value={activeCurrency}
          onChange={e=>{setCurrency(e.target.value);setWorkspaceId('')}}>
          {currencies.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <button className="admin-refresh" type="button" onClick={()=>void refresh()} disabled={loading}>
          <RefreshCw size={15}/> Оновити дані</button>
      </div>
    </section>
    {error&&<p className="admin-live-message error" role="alert">{error}</p>}
    {!error&&<p className="admin-live-message" role="status">
      {loading?'Завантажуємо профілі…':calculating?'Розраховуємо дані '+completeness+'…':
        'Дані з Firestore · '+completeness+' профілів оброблено'}
      {partialDirectory&&' · Показано перші 500 профілів; не всі користувачі'}
      {incomplete&&' · Є неповні дані'}
      {monthError&&' · '+monthError}
    </p>}

    <div className="admin-section-heading">
      <div><div className="section-kicker">ЗАГАЛЬНИЙ ОГЛЯД</div>
        <h2>Команда за <span>{currentMonthLabel}</span></h2></div>
      <span className="admin-coverage">Дані {completeness} · {activeCurrency}</span>
    </div>
    <div className="admin-overview-grid">
      <article className="admin-overview-card featured">
        <span>Загальна каса</span><strong>{hasData?money(cashTotal,activeCurrency):'—'}</strong>
        <small>Внесена каса за день · обрана валюта</small><i aria-hidden="true">↗</i>
      </article>
      <article className="admin-overview-card">
        <span>Зарплата команди</span><strong>{hasData?money(wageTotal,activeCurrency):'—'}</strong>
        <small>Прогноз за чинними правилами</small>
      </article>
      <article className="admin-overview-card">
        <span>Виконали план</span><strong>{hasData?achieved+' із '+plans.length:'—'}</strong>
        <small>Робочих просторів із заданим планом</small>
      </article>
      <article className="admin-overview-card">
        <span>Нараховані премії</span><strong>{hasData?money(bonusTotal,activeCurrency):'—'}</strong>
        <small>Бонуси за правилами оплати</small>
      </article>
      <article className="admin-overview-card">
        <span>Користувачів</span><strong>{overview?.users.toLocaleString('uk-UA')??'—'}</strong>
        <small>Профілів у Firestore · просторів {overview?.workspaces??'—'}</small>
      </article>
    </div>

    <div className="admin-analytics-grid">
      <section className="admin-panel admin-trends">
        <div className="admin-card-heading">
          <div><div className="section-kicker">ДИНАМІКА ЗА ДНЯМИ</div><h2>Результати команди</h2></div>
          <span className="admin-subtag">{activeCurrency} · {month}</span>
        </div>
        <div className="admin-chart-columns">
          <div className="admin-chart-group"><div className="admin-chart-label">
            <span className="admin-chart-spot cash"/> Каса <span className="admin-chart-unit">за день</span></div>
            <div className="admin-svg-chart"><Trend points={teamChart} kind="cash" label="Внесена каса команди за днями"/></div></div>
          <div className="admin-chart-group"><div className="admin-chart-label">
            <span className="admin-chart-spot wage"/> Зарплата <span className="admin-chart-unit">ручні суми за день</span></div>
            <div className="admin-svg-chart"><Trend points={teamChart} kind="wage" label="Введена вручну зарплата команди за днями"/></div></div>
        </div>
      </section>
      <section className="admin-panel admin-leaders">
        <div className="admin-card-heading">
          <div><div className="section-kicker">ТОП ЗА КАСОЮ</div><h2>Лідери місяця</h2></div>
        </div>
        <div className="admin-leader-list">
          {ranking.length?ranking.map((user,index)=>{
            const amount=userTotal(rows[user.uid],'cash',activeCurrency)??0
            return <button type="button" key={user.uid} className="admin-leader"
              onClick={()=>choose(user.uid)}>
              <span className="admin-leader-top"><span className="admin-leader-name">{index+1}. {identity(user)}</span>
                <strong>{money(amount,activeCurrency)}</strong></span>
              <span className="admin-mini-track"><span className="admin-mini-fill"
                style={{width:Math.min(100,amount/topCash*100)+'%'}}/></span>
            </button>
          }):<p className="admin-muted">Ще немає даних каси за місяць.</p>}
        </div>
      </section>
    </div>

    <div className="admin-section-heading admin-people-heading">
      <div><div className="section-kicker">ОСОБИСТІ ПОКАЗНИКИ</div><h2>Працівники</h2></div>
      <button className="admin-text-action" type="button" disabled={!hasData}
        onClick={()=>exportTeam(filtered,rows,activeCurrency,month)}>
        <Download size={14}/> Звіт CSV за місяць</button>
    </div>
    <div className="admin-layout admin-workspace">
      <section className="admin-panel admin-staff-panel" aria-label="Список працівників">
        <label className="admin-sr-only" htmlFor="admin-search">Пошук за іменем або email</label>
        <input id="admin-search" className="admin-filter" type="search" value={query}
          onChange={e=>setQuery(e.target.value)} placeholder="⌕  Пошук працівника…"/>
        <div className="admin-people-controls">
          <label><span>Записи</span><select value={filter} onChange={e=>setFilter(e.target.value as Filter)}>
            <option value="all">Усі</option><option value="worked">Є зміни</option>
            <option value="empty">Без змін</option><option value="error">Неповні дані</option>
          </select></label>
          <label><span>Сортування</span><select value={sort} onChange={e=>setSort(e.target.value as Sort)}>
            <option value="cash">За касою ↓</option><option value="wage">За зарплатою ↓</option>
            <option value="plan">За % плану ↓</option><option value="name">За ім’ям А–Я</option>
          </select></label>
        </div>
        <div className="admin-list-count">Знайдено: {filtered.length} із {users.length}</div>
        <div className="admin-user-list">
          {!filtered.length&&<p className="admin-muted admin-empty-list">Нічого не знайдено.</p>}
          {filtered.map(user=>{
            const row=rows[user.uid]
            const cash=userTotal(row,'cash',activeCurrency)
            const target=row?.workspaces.filter(w=>w.currency===activeCurrency).find(w=>w.target)
            const progress=wsPlan(target)
            return <button key={user.uid} type="button"
              className={'admin-person-row'+(selected===user.uid?' active':'')}
              aria-pressed={selected===user.uid} onClick={()=>choose(user.uid)}>
              <span className="admin-person-head">
                <span className="admin-avatar">{identity(user).trim().slice(0,1).toLocaleUpperCase('uk-UA')}</span>
                <span className="admin-person-ident"><strong>{identity(user)}</strong><small>{user.email||user.uid}</small></span>
                <span className={'admin-employee-status'+(row?.incomplete?' paused':'')}>
                  {!row?'…':row.error?'Помилка':row.incomplete?'Частково':'Дані'}
                </span>
              </span>
              <span className="admin-person-figures">
                <span>Каса: {money(cash,activeCurrency)}</span><strong>{progress===null?'План —':percentText(progress)}</strong>
              </span>
              <span className="admin-mini-track"><span className="admin-mini-fill"
                style={{width:Math.min(100,Math.max(0,progress??0))+'%'}}/></span>
            </button>
          })}
        </div>
      </section>
      <section className="admin-panel admin-detail-panel" ref={detailRef} id="admin-person-detail">
        <div className="admin-detail-top">
          <div><div className="section-kicker">КАРТКА ПРАЦІВНИКА</div>
            <h2>{currentUser?identity(currentUser):'Оберіть працівника'}</h2>
            <p className="admin-user-details">{currentUser?currentUser.email:'Оберіть ім’я ліворуч, щоб переглянути дані.'}</p>
          </div>
          <span className="admin-state-pill">{currentRow?.error?'Помилка':currentRow?.incomplete?'Часткові дані':'Лише перегляд'}</span>
        </div>
        {availableWorkspaces.length>1&&<label className="admin-workspace-switch">
          Робочий простір
          <select value={selectedWorkspace?.id??''} onChange={e=>setWorkspaceId(e.target.value)}>
            {availableWorkspaces.map(ws=><option key={ws.id} value={ws.id}>
              {ws.name} · {ws.currency}</option>)}</select>
        </label>}
        {selectedWorkspace&&<p className="admin-workspace-caption">{selectedWorkspace.name} · {selectedWorkspace.currency}</p>}
        <div className="admin-person-kpis">
          <div><small>Зарплата за місяць</small><strong>{money(personWage,selectedWorkspace?.currency??activeCurrency)}</strong></div>
          <div><small>Каса за місяць</small><strong>{money(personCash,selectedWorkspace?.currency??activeCurrency)}</strong></div>
          <div><small>Виконання плану</small><strong>{percentText(personPlan)}</strong></div>
          <div><small>Відпрацьовано змін</small><strong>{selectedWorkspace?.shifts??'—'}</strong></div>
        </div>
        <div className="admin-progress-block">
          <div className="admin-progress-head"><span>План {selectedWorkspace?.targetMetric==='earnings'?'заробітку':
            selectedWorkspace?.targetMetric==='units'?'обсягу роботи':'каси'}</span>
            <strong>{selectedWorkspace?.target!==null&&selectedWorkspace?.target!==undefined?
              selectedWorkspace.targetMetric==='units'?num(selectedWorkspace.target):
                money(selectedWorkspace.target,selectedWorkspace.currency):'Не задано'}</strong></div>
          <div className="admin-progress-track"><div className="admin-progress-fill"
            style={{width:Math.min(100,Math.max(0,personPlan??0))+'%'}}/></div>
          <div className="admin-bonus-note">{personPlan===null?'У цьому просторі немає налаштованого плану.':
            'Виконано '+percentText(personPlan)+'. Нараховані премії: '+
            money(selectedWorkspace?.bonus,selectedWorkspace?.currency??activeCurrency)}</div>
        </div>
        <div className="admin-person-trends">
          <h3>Динаміка за місяць</h3><div className="admin-chart-columns">
            <div className="admin-chart-group"><div className="admin-chart-label">
              <span className="admin-chart-spot cash"/> Каса</div>
              <div className="admin-svg-chart"><Trend points={personDays} kind="cash" label="Каса працівника за днями"/></div>
            </div>
            <div className="admin-chart-group"><div className="admin-chart-label">
              <span className="admin-chart-spot wage"/> Зарплата за день (вручну)</div>
              <div className="admin-svg-chart"><Trend points={personDays} kind="wage" label="Ручні записи зарплати за днями"/></div>
            </div>
          </div>
        </div>
        <div className="admin-person-bottom"><h3>Журнал змін</h3><span>{selectedWorkspace?.days.length??0} записів</span></div>
        <div className="admin-table-wrap">
          <table className="admin-table"><thead><tr>
            <th>Дата</th><th>Тип зміни</th><th>Години</th><th>Каса</th><th>Заробіток за день</th>
          </tr></thead><tbody>
            {!selectedWorkspace?.days.length&&<tr><td colSpan={5}>За місяць записів немає</td></tr>}
            {selectedWorkspace?.days.map(day=><tr key={day.date}>
              <td><strong>{day.date.slice(8)}.{day.date.slice(5,7)}</strong>{day.note&&<small>{day.note}</small>}</td>
              <td>{day.status}{day.shifts>1?' · '+day.shifts+' змін':''}</td>
              <td>{num(day.hours)}</td>
              <td>{money(day.cash,selectedWorkspace.currency)}</td>
              <td>{money(day.wage,selectedWorkspace.currency)}</td>
            </tr>)}
          </tbody></table>
        </div>
        {selectedWorkspace?.error&&<p className="admin-live-message error" role="alert">{selectedWorkspace.error}</p>}
        {selectedWorkspace&&<div className="admin-pay-breakdown">
          <h3>Нарахування й доплати</h3>
          {selectedWorkspace.lines.length?selectedWorkspace.lines.map(line=><div key={line.code}>
            <span><strong>{line.title}</strong><small>{line.details}</small></span>
            <b>{money(line.amount,selectedWorkspace.currency)}</b>
          </div>):<p className="admin-muted">Немає розрахованих рядків зарплати.</p>}
        </div>}
        <div className="admin-person-actions">
          <button type="button" className="admin-text-action" disabled={!currentRow}
            onClick={()=>{
              if(!currentRow||!currentUser)return
              download('paytakt-user-'+currentUser.uid+'-'+month+'.json',
                JSON.stringify({user:currentUser,month,report:currentRow},null,2),'application/json')
            }}><Download size={14}/> Експорт JSON</button>
        </div>
        <p className="admin-notice">Дані завантажені з Firestore лише для перегляду. Місячна зарплата
          перерахована за чинними правилами; графік денної зарплати показує тільки введені вручну суми.
          Права редагування користувачів не змінено.</p>
      </section>
    </div>
    <p className="admin-bottom-note"><ShieldCheck size={15}/> Захищено Firebase Custom Claims.
      Статистика надійде тільки адміністратору. {partialDirectory?'Частину профілів не завантажено.':''}</p>
  </div>
}
