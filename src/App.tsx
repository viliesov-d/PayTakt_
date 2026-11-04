import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowRight, ArrowUpRight, BriefcaseBusiness, Building2, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  LayoutDashboard, LockKeyhole, LogOut, Mail, Menu, Monitor, Moon, Plus, Save, TrendingUp,
  Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Sun, Target, Trash2, UserRound,
  UsersRound, Wallet, X, ReceiptText,
} from 'lucide-react'
import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, sendEmailVerification, reload,
  signInWithEmailAndPassword, signOut, updateProfile,
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db, firebaseReady } from './lib/firebase'
import {
  createWorkspace, deleteShift, demoShifts, ensureProfile, loadWorkspaces, subscribeTemplates, saveTemplate, deleteTemplate,
  saveShift, applyMonthlyPattern, shiftHours, shiftCount, validateDay, subscribeShifts, toDateKey, updateProfileTheme,
  type Shift, type DayType, type ShiftKind, type AdditionalShift, type ThemeChoice, type Workspace, type WorkspaceKind,
  subscribeOvertimePreset, saveOvertimePreset,
} from './lib/data'
import { generateMonthlyPattern, presetPattern, mondayOfWeek, WEEKDAY_FIVE_TWO_PRESET, workSlot, validatePattern, copyWorkdayToAll, planPatternApplication, type PatternApplyMode, type PatternApplySummary, type GeneratedCalendarDay, type ScheduleTemplate, type PatternDay, type TemplatePreset } from './lib/schedule'
import { sectors, suggestions, allSuggestions, createSelfPreset, type Sector, type JobPreset } from './lib/professions'
import { defaultPaySettings,defaultPaymentRules } from './lib/salary'
import {defaultOvertimePreset,validateOvertimePreset,segmentHours,type OvertimePreset} from './lib/calendar'
import {changeDayType, toggleWorkedDay, togglePresetOvertime} from './lib/dayActions'
import { PayPageV5, RulesPageV5 } from './components/SalaryPages'
import { type PaySettings, type MonthlySales, type MonthlyUnits, moneyUA } from './lib/salary'
import {buildMonthAnalytics,payoutsInMonth} from './lib/analytics'
import {effectiveRevenue,cashTotalsByMonth,parseCashHryvnia,defaultCashPreferences,type DailyCash,type CashPreferences} from './lib/dailyCash'
import {defaultPerformanceSettings,planTarget,performanceProgress,validatePerformanceSettings,type PerformanceSettings,type MonthlyTarget} from './lib/performance'
import {defaultCalendarLayout,readCalendarLayout,writeCalendarLayout,moveCalendarBlock,type CalendarBlockId,type CalendarLayout} from './lib/calendarLayout'
import {StatisticsPage} from './components/StatisticsPage'
import {OnboardingWizard} from './components/OnboardingWizard'
import {calendarFeatures} from './lib/featureVisibility'
import {onboardingMonthKeys,schedulePattern,onboardingCalendarDays,onboardingOvertimePreset,makeOnboardingPaySettings,makeOnboardingPerformance,validateOnboardingDraft,type OnboardingDraft} from './lib/onboarding'
import { savePaySettings, subscribePaySettings, saveMonthlySales, subscribeMonthlySales, saveMonthlyUnits, subscribeMonthlyUnits, subscribeDailyCash, saveDailyCash, removeDailyCash, subscribeCashPreferences, saveCashPreferences,subscribePerformanceSettings,savePerformanceSettings,subscribeMonthlyTargets,saveMonthlyTarget,removeMonthlyTarget,subscribeDailyWages,saveDailyWage,removeDailyWage } from './lib/data'

type Page = 'setup' | 'dashboard' | 'calendar' | 'statistics' | 'pay' | 'rules' | 'team' | 'settings'
type Session = { uid: string; email: string; name: string; demo: boolean }
const dateFormat = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
const monthFormat = new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' })
const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const defaultShift = (date: string): Shift => ({ id: date, date, start: '09:00', end: '18:00', breakMinutes: 60, status: 'planned', note: '', dayType:'work', kind:'regular', additionalShifts:[], overtimeMinutes:0, plannedWorkday:true, plannedMinutes:480 })
const nav: { id: Page; title: string; icon: typeof LayoutDashboard; companyOnly?: boolean }[] = [
  { id: 'calendar', title: 'Мій календар', icon: CalendarDays },
  { id: 'statistics', title: 'Мої гроші', icon: Wallet },
  { id: 'settings', title: 'Налаштування роботи', icon: Settings2 },
]

function friendlyError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? ''
  if (code.includes('email-already-in-use')) return 'Ця електронна адреса вже зареєстрована.'
  if (code.includes('invalid-email')) return 'Перевір правильність електронної адреси.'
  if (code.includes('weak-password')) return 'Пароль має містити щонайменше 6 символів.'
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Неправильна пошта або пароль.'
  if (code.includes('network-request-failed')) return 'Немає з’єднання з мережею. Спробуй ще раз.'
  if (code.includes('permission-denied')) return 'Firebase відхилив доступ. Перевір, що .env вказує на потрібний проєкт, правила опубліковані саме у базі (default), і ти увійшов як власник робочого простору. Не відкривай доступ усім.'
  if (code.includes('too-many-requests')) return 'Забагато спроб. Спробуй пізніше.'
  if (code.includes('operation-not-allowed')) return 'У налаштуваннях входу потрібно увімкнути Email/Password.'
  return error instanceof Error ? error.message : 'Сталася помилка. Спробуй ще раз.'
}

function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem('paytakt-theme')
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch { return 'system' }
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><div className="brand-mark"><span className="zmina-brand-symbol" aria-hidden="true">₴</span></div>{!compact && <span>paytakt<span className="mint">.</span></span>}</div>
}

function ThemeControls({ value, onChange }: { value: ThemeChoice; onChange: (v: ThemeChoice) => void }) {
  return <div className="theme-switch" role="group" aria-label="Тема оформлення">
    {([['light', Sun, 'Денна'], ['dark', Moon, 'Нічна'], ['system', Monitor, 'Автоматична']] as const).map(([name, Icon, title]) => (
      <button key={name} type="button" className={value === name ? 'theme-option active' : 'theme-option'} onClick={() => onChange(name)} title={title} aria-label={title} aria-pressed={value === name}>
        <Icon size={17}/>
      </button>
    ))}
  </div>
}

function AuthScreen({ onDemo }: { onDemo: () => void }) {
  const [variant, setVariant] = useState<'login'|'register'>('register')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(''); setNotice('')
    if (!auth || !db) { setError('Реєстрація зараз недоступна. Ти можеш переглянути демоверсію.'); return }
    setBusy(true)
    try {
      if (variant === 'register') {
        if (name.trim().length < 2) throw Error('Вкажи ім’я щонайменше з 2 символів.')
        const created = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await updateProfile(created.user, { displayName: name.trim() })
        await setDoc(doc(db, 'users', created.user.uid), {
          email: created.user.email || '', displayName: name.trim(), theme: readTheme(),
        }, { merge: true })
        // Account creation succeeds even when the verification email temporarily fails.
        try { await sendEmailVerification(created.user) } catch (mailError) { console.warn('Verification email could not be sent:', mailError) }
        // Re-read the completed profile after the initial auth callback may have loaded a fallback name.
        window.location.reload()
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
    } catch (e) { setError(friendlyError(e)) }
    finally { setBusy(false) }
  }
  const resetPassword = async () => {
    setError(''); setNotice('')
    if (!auth) { setError('Відновлення пароля зараз недоступне.'); return }
    if (!email.trim()) { setError('Спочатку введи адресу електронної пошти.'); return }
    try { await sendPasswordResetEmail(auth, email.trim()); setNotice('Якщо акаунт існує, на пошту надіслано лист для відновлення пароля.') }
    catch (e) { setError(friendlyError(e)) }
  }
  return <div className="auth-layout">
    <section className="auth-art">
      <div className="auth-art-top"><Logo/><span className="auth-caption">НОВА ПЛАТФОРМА</span></div>
      <div className="auth-art-main">
        <div className="auth-art-glow"/>
        <div className="auth-orbit orbit-one"/><div className="auth-orbit orbit-two"/>
        <span className="auth-tag"><Sparkles size={15}/> Розумні графіки та зарплата</span>
        <h1>Твій графік.<br/>Твої правила.<br/><span>Твій PayTakt.</span></h1>
        <p>Керуйте робочим часом, створюйте власні графіки та працюйте із зарплатою в одному просторі.</p>
        <div className="auth-visual">
          <div className="visual-top"><span className="visual-dot"/> Мій робочий ритм <span className="visual-small">Листопад</span></div>
          <div className="visual-bars">{[44,70,53,86,64,92,61,76,98,57].map((h,i)=><span key={i} style={{height:`${h}%`}} className={i===8?'highlight':''}/>)}</div>
          <div className="visual-caption"><span>Плануйте зміни</span><span><ArrowUpRight size={14}/> Ваш час — ваші правила</span></div>
        </div>
      </div>
      <div className="auth-art-bottom"><ShieldCheck size={17}/> Працює для особистого обліку та команд</div>
    </section>
    <section className="auth-panel">
      <div className="auth-mobile-logo"><Logo/></div>
      <div className="auth-form-wrap">
        <div className="eyebrow">ПОЧАТОК РОБОТИ</div>
        <h2>{variant === 'register' ? 'Створіть свій простір' : 'З поверненням!'}</h2>
        <p className="auth-intro">{variant === 'register' ? 'Новий акаунт для персонального обліку та управління командою.' : 'Увійдіть, щоб продовжити роботу з вашими графіками.'}</p>
        <div className="auth-tabs">
          <button type="button" className={variant==='register'?'selected':''} onClick={()=>{setVariant('register');setError('');setNotice('')}}>Реєстрація</button>
          <button type="button" className={variant==='login'?'selected':''} onClick={()=>{setVariant('login');setError('');setNotice('')}}>Вхід</button>
        </div>
        <form onSubmit={submit} className="auth-form">
          {variant === 'register' && <label>Ваше ім’я<input required value={name} maxLength={70} onChange={e=>setName(e.target.value)} placeholder="Наприклад, Олександр" autoComplete="name"/></label>}
          <label>Електронна пошта<span className="field-icon"><Mail size={17}/></span><input required value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="email" className="with-icon"/></label>
          <label>Пароль<span className="field-icon"><LockKeyhole size={17}/></span><input required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Щонайменше 6 символів" autoComplete={variant==='register'?'new-password':'current-password'} className="with-icon"/></label>
          {variant === 'login' && <button type="button" className="link-button forgot" onClick={resetPassword}>Забули пароль?</button>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-success" role="status">{notice}</p>}
          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>{busy?'Опрацьовуємо…':variant==='register'?'Створити акаунт':'Увійти'} <ArrowRight size={18}/></button>
        </form>
        <div className="auth-divider"><span>або</span></div>
        <button type="button" className="btn btn-outline demo-button" onClick={onDemo}>Переглянути демоверсію <ArrowUpRight size={17}/></button>
        {!firebaseReady && <div className="firebase-note"><CircleHelp size={17}/><span><strong>Реєстрація тимчасово недоступна.</strong> Зараз можна переглянути демоверсію.</span></div>}
      </div>
      <div className="auth-footer">© {new Date().getFullYear()} PayTakt · Створено з турботою про ваш час</div>
    </section>
  </div>
}

function SectionHeading({ eyebrow, title, detail, children }: { eyebrow?: string; title: string; detail?: string; children?: ReactNode }) {
  return <div className="section-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{detail && <p className="subtitle">{detail}</p>}</div>{children}</div>
}

function Placeholder({ icon: Icon, title, detail }: { icon: typeof Wallet; title: string; detail: string }) {
  return <div className="placeholder"><div className="placeholder-icon"><Icon size={28}/></div><h3>{title}</h3><p>{detail}</p><span className="pill soft"><Sparkles size={14}/> На наступному етапі розробки</span></div>
}

function Dashboard({ workspace, shifts, paySettings, salesByMonth, unitsByMonth, performance, monthlyTargets, cashByMonth, dailyWages, onGoCalendar, onCreateCompany, onGoPay, onGoStatistics }: { workspace: Workspace; shifts: Shift[]; paySettings: PaySettings | null; salesByMonth: Record<string,number>; unitsByMonth: Record<string,number>; performance:PerformanceSettings;monthlyTargets:Record<string,number>;cashByMonth:Record<string,number>;dailyWages:Record<string,number>; onGoCalendar: () => void; onCreateCompany: () => void; onGoPay: () => void; onGoStatistics: () => void }) {
  const today = new Date()
  const monthKey = toDateKey(today).slice(0, 7)
  const summary=useMemo(()=>buildMonthAnalytics(shifts,monthKey,paySettings,salesByMonth[monthKey]??0,unitsByMonth[monthKey]??0,performance,planTarget(monthKey,performance,monthlyTargets),cashByMonth[monthKey]??0,dailyWages),[shifts,monthKey,paySettings,salesByMonth,unitsByMonth,performance,monthlyTargets,cashByMonth,dailyWages])
  const weeks=summary.weeks.map(w=>w.worked)
  const max=Math.max(1,...weeks)
  const salary=summary.result
  const nextShifts = [...shifts].filter(s=>s.date>=toDateKey(today) && (!s.dayType || s.dayType==='work')).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4)
  return <>
    <div className="page-hero zmina-hero">
      <div className="hero-content"><span className="hero-chip"><span className="zmina-hero-dot"/> ПЛАНУЙ · ПРАЦЮЙ · ЗАРОБЛЯЙ</span><h1>Твій графік.<br/><span>Твої правила.</span></h1><p>Зміни, зарплата, плани та виплати — усе на своєму місці. Без зайвих налаштувань.</p><button className="btn btn-hero" onClick={onGoCalendar}>Перейти до календаря <ArrowUpRight size={18}/></button></div>
      <div className="hero-graphic zmina-hero-art" aria-hidden="true">
        <div className="zmina-art-orb orb-top"/><div className="zmina-art-orb orb-bottom"/>
        <div className="zmina-mini-calendar">
          <div className="zmina-mini-head"><span>МІЙ КАЛЕНДАР</span><CalendarDays size={19}/></div>
          <div className="zmina-mini-weekdays">{weekdayLabels.map(day=><span key={day}>{day}</span>)}</div>
          <div className="zmina-mini-dates">{Array.from({length:28},(_,i)=>{const offset=(new Date(today.getFullYear(),today.getMonth(),1).getDay()+6)%7;const day=i-offset+1;if(day<1)return <span key={i} className="is-empty"/>;const date=new Date(today.getFullYear(),today.getMonth(),day);const off=date.getDay()===0||date.getDay()===6;return <span key={i} className={off?'is-off':'is-work'}>{day}</span>})}</div>
          <div className="zmina-mini-foot"><span className="zmina-mini-check">✦</span> План на місяць — під контролем</div>
        </div>
        <div className="zmina-floating-coin coin-primary">₴</div><div className="zmina-floating-coin coin-secondary">✦</div>
      </div>
    </div>
    <SectionHeading eyebrow="КОРОТКИЙ ОГЛЯД" title="Підсумок місяця" detail={`${monthFormat.format(today)} · ${workspace.name}`}><button type="button" className="btn btn-outline" onClick={onGoStatistics}>Моя статистика <TrendingUp size={17}/></button></SectionHeading>
    <div className="stats-grid">
      <div className="stat-card"><div className="stat-top"><span>Заплановано змін</span><CalendarDays size={20}/></div><div className="stat-value">{summary.plannedShifts} <span>змін</span></div><div className="stat-hint">У поточному місяці</div></div>
      <div className="stat-card"><div className="stat-top"><span>Відпрацьовано</span><Clock3 size={20}/></div><div className="stat-value">{summary.workedHours.toLocaleString('uk-UA',{maximumFractionDigits:1})} <span>год</span></div><div className="stat-hint">З підтверджених вами змін</div></div>
      <div className="stat-card"><div className="stat-top"><span>Понаднормові години</span><Clock3 size={20}/></div><div className="stat-value">{summary.overtimeHours.toLocaleString('uk-UA',{maximumFractionDigits:1})} <span>год</span></div><div className="stat-hint">За підтвердженим графіком і тарифами</div></div>
      <div className="stat-card salary-stat" role="button" tabIndex={0} onClick={onGoPay} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onGoPay()}}}><div className="stat-top"><span>Попередня зарплата</span><Wallet size={20}/></div><div className="stat-value salary-dashboard-value">{salary?moneyUA(salary.gross):'—'}</div><div className="stat-hint">{salary?'До податків · натисни для деталізації':'Налаштуй правила оплати'}</div></div>
    </div>
    <div className="dashboard-stats-link"><span><TrendingUp size={17}/> Детальні години, понаднормові, динаміка за 6 місяців і календар виплат</span><button className="link-button" type="button" onClick={onGoStatistics}>Відкрити статистику <ArrowUpRight size={16}/></button></div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-title"><div><h3>Динаміка робочих годин</h3><p>Фактично відпрацьовані години за тижнями</p></div><span className="pill">Цей місяць</span></div><div className="chart-wrap">{weeks.map((h,i)=><div className="chart-column" key={i}><div className="chart-column-top">{h?Math.round(h*10)/10:''}</div><div className="chart-track"><span style={{height:`${h?Math.max(8,h/max*100):4}%`}}/></div><small>{summary.weeks[i].label}</small></div>)}</div></section>
      <section className="panel upcoming-panel"><div className="panel-title"><div><h3>Найближчі зміни</h3><p>Твої наступні робочі дні</p></div><button className="icon-button" onClick={onGoCalendar} aria-label="Перейти до календаря"><ArrowUpRight size={19}/></button></div>{nextShifts.length?nextShifts.map(s=><div className="upcoming-row" key={s.id}><div className="upcoming-date"><strong>{s.date.slice(-2)}</strong><span>{monthFormat.format(new Date(s.date+'T12:00')).split(' ')[0].slice(0,3)}</span></div><div><strong>{dateFormat.format(new Date(s.date+'T12:00'))}</strong><small>{s.start}–{s.end} · {s.status==='worked'?'Відпрацьовано':'Заплановано'}</small></div><span className="small-dot"/></div>):<div className="empty-line">Поки немає майбутніх змін. Додай першу в календарі.</div>}</section>
    </div>
    {workspace.kind==='personal' && <div className="team-banner"><div className="banner-icon"><Building2 size={26}/></div><div><strong>Керуєш командою?</strong><p>Створи окремий простір компанії, не змішуючи особисті дані з робочими.</p></div><button type="button" className="btn btn-outline" onClick={onCreateCompany}>Створити компанію <Plus size={16}/></button></div>}
  </>
}

function CalendarPage({ shifts, workspace, demo, templates, initialPreset, overtimePreset, paySettings, salesByMonth, unitsByMonth, cashRecords, cashPrefs, performance, monthlyTargets, cashByMonth, dailyWages, onSaveDailyWage, onRemoveDailyWage, onSaveCash, onDeleteCash, onGoStatistics, onSaveOvertimePreset, onSave, onApplyPattern, onDelete, onSaveTemplate, onDeleteTemplate, scheduleOnly=false }: {
  shifts: Shift[]; workspace: Workspace; demo: boolean; templates: ScheduleTemplate[]; initialPreset: TemplatePreset;
  overtimePreset:OvertimePreset; paySettings:PaySettings|null; salesByMonth:Record<string,number>; unitsByMonth:Record<string,number>;
  cashRecords:DailyCash[]; cashPrefs:CashPreferences; performance:PerformanceSettings; monthlyTargets:Record<string,number>;cashByMonth:Record<string,number>;dailyWages:Record<string,number>;onSaveDailyWage:(date:string,amount:number)=>Promise<void>;onRemoveDailyWage:(date:string)=>Promise<void>;
  onSaveCash:(record:DailyCash)=>Promise<void>;onDeleteCash:(date:string)=>Promise<void>;
  onGoStatistics:()=>void; onSaveOvertimePreset:(preset:OvertimePreset)=>Promise<void>;
  onSave: (s: Shift)=>Promise<void>; onApplyPattern: (s: GeneratedCalendarDay[], mode: PatternApplyMode)=>Promise<PatternApplySummary>;
  onDelete: (date: string)=>Promise<void>;
  onSaveTemplate: (t:ScheduleTemplate)=>Promise<void>;
  onDeleteTemplate: (id:string)=>Promise<void>; scheduleOnly?:boolean;
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  // Direction only controls the visual transition, never the payroll or calendar data.
  const [monthDirection, setMonthDirection] = useState<-1 | 0 | 1>(0)
  const [selected, setSelected] = useState(toDateKey(today))
  // Keep async quick-action replies tied to the date that initiated the write.
  const selectedRef=useRef(selected)
  selectedRef.current=selected
  const [draft, setDraft] = useState<Shift>(defaultShift(toDateKey(today)))
  const [busy, setBusy] = useState(false)
  const [quickBusy, setQuickBusy] = useState(false)
  const quickLock = useRef(false)
  const [instantDay,setInstantDay] = useState<Shift|null>(null)
  const [status, setStatus] = useState('')
  const [preset, setPreset] = useState<string>(initialPreset)
  const [pattern, setPattern] = useState<PatternDay[]>(presetPattern(initialPreset))
  const [anchorDate, setAnchorDate] = useState(() => initialPreset === WEEKDAY_FIVE_TWO_PRESET
    ? mondayOfWeek(toDateKey(new Date(today.getFullYear(),today.getMonth(),1)))
    : toDateKey(new Date(today.getFullYear(),today.getMonth(),1)))
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [templateName, setTemplateName] = useState('Мій графік')
  const [templateMessage, setTemplateMessage] = useState('')
  const [templateBusy, setTemplateBusy] = useState(false)
  const [cycleMessage, setCycleMessage] = useState('')
  const [cycleBusy, setCycleBusy] = useState(false)
  const [cycleOpen, setCycleOpen] = useState(false)
  const visible=calendarFeatures(paySettings,cashPrefs,performance)
  const historicalOvertime=shifts.some(s=>(s.overtimeMinutes??0)>0||!!s.overtimeExtra)
  const [layout,setLayout]=useState<CalendarLayout>(()=>readCalendarLayout(workspace.id))
  const [layoutOpen,setLayoutOpen]=useState(false)
  const changeLayout=(next:CalendarLayout)=>{setLayout(next);writeCalendarLayout(workspace.id,next)}
  const blockOrder=(id:CalendarBlockId)=>layout.order.indexOf(id)
  const [calendarFilter,setCalendarFilter] = useState<'all'|'worked'|'overtime'> ('all')
  const [showPayouts,setShowPayouts] = useState(true)
  const [applyMode, setApplyMode] = useState<PatternApplyMode>('update-planned')
  const [overtimeDraft,setOvertimeDraft]=useState<OvertimePreset>(overtimePreset)
  const [overtimeMessage,setOvertimeMessage]=useState('')
  const [overtimeBusy,setOvertimeBusy]=useState(false)
  const [wageDraft,setWageDraft]=useState('')
  const [moneyBusy,setMoneyBusy]=useState(false)
  const [moneyNotice,setMoneyNotice]=useState('')
  const [cashDraft,setCashDraft]=useState('')

  const [cashNotice,setCashNotice]=useState('')
  const wageEntry=dailyWages[selected]
  useEffect(()=>{setWageDraft(wageEntry===undefined?'':String(wageEntry/100));setMoneyNotice('')},[selected,wageEntry])
  const cashEntry=cashRecords.find(r=>r.date===selected)
  useEffect(()=>{setCashDraft(cashEntry?String(cashEntry.amount/100):'');setCashNotice('')},[selected,cashEntry?.amount])
  // A single Zmina-style form; empty removes the record, zero is explicitly saved.
  const saveDayMoney=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault()
    const date=selected
    if(!activeShift||(draft.dayType??'work')!=='work'){
      setMoneyNotice('Познач день робочим і збережи зміну.');return
    }
    setMoneyBusy(true);setMoneyNotice('')
    try{
      const wage=performance.manualDailyPay&&wageDraft.trim()!==''?parseCashHryvnia(wageDraft):null
      const cash=cashPrefs.enabled&&cashDraft.trim()!==''?parseCashHryvnia(cashDraft):null
      if(performance.manualDailyPay){
        if(wage!==null)await onSaveDailyWage(date,wage)
        else if(dailyWages[date]!==undefined)await onRemoveDailyWage(date)
      }
      if(cashPrefs.enabled){
        if(cash!==null)await onSaveCash({date,amount:cash})
        else if(cashRecords.some(r=>r.date===date))await onDeleteCash(date)
      }
      if(selectedRef.current===date)setMoneyNotice('Дані дня збережено.')
    }catch(error){if(selectedRef.current===date)setMoneyNotice(friendlyError(error))}
    finally{setMoneyBusy(false)}
  }
  const clearCash=async()=>{
    if(!cashEntry)return
    const date=selected
    setMoneyBusy(true);setCashNotice('')
    try{await onDeleteCash(date);if(selectedRef.current===date){setCashDraft('');setCashNotice('Касу видалено.')}}
    catch(e){if(selectedRef.current===date)setCashNotice(friendlyError(e))}finally{setMoneyBusy(false)}
  }
  useEffect(()=>setOvertimeDraft({...overtimePreset}),[overtimePreset.start,overtimePreset.end,overtimePreset.breakMinutes,overtimePreset.basisPoints])
  const saveOvertime=async()=>{
    setOvertimeBusy(true);setOvertimeMessage('')
    try{validateOvertimePreset(overtimeDraft);await onSaveOvertimePreset(overtimeDraft);setOvertimeMessage('Шаблон понаднормових збережено. Він доступний у редакторі календаря.')}
    catch(e){setOvertimeMessage(friendlyError(e))}finally{setOvertimeBusy(false)}
  }
  const quickSave = async (next:Shift, success:string) => {
    // Synchronous lock: double taps cannot send two conflicting Firestore writes.
    if (quickLock.current || busy) return
    quickLock.current=true
    setQuickBusy(true)
    setInstantDay(next) // The calendar responds before the Firebase acknowledgement.
    setDraft(next)
    setStatus('')
    try {
      validateDay(next)
      await onSave({...next,id:selected,date:selected})
      if(selectedRef.current===next.date)setStatus(success)
    } catch (error) {
      // The user may have selected a different date while Firebase was saving.
      // Never overwrite the new day's editor with a stale rollback.
      if(selectedRef.current===next.date){
        setDraft(shifts.find(s=>s.date===next.date)??defaultShift(next.date))
        setStatus(friendlyError(error))
      }
    } finally {
      setQuickBusy(false)
      setInstantDay(null)
      quickLock.current=false
    }
  }
  const quickType = (type:DayType) => {
    if (quickLock.current || busy || (draft.dayType??'work')===type) return
    if (type!=='work' && (draft.overtimeExtra || (draft.overtimeMinutes??0)>0) &&
      !window.confirm('У цей день додані понаднормові. Змінити тип дня та прибрати понаднормові?')) return
    try { void quickSave(changeDayType(draft,type),'Тип дня змінено й збережено.') }
    catch(error){setStatus(friendlyError(error))}
  }
  const quickStatus = () => {
    if (quickLock.current || busy) return
    try {
      const next=toggleWorkedDay(draft)
      void quickSave(next,next.status==='worked'?'День відмічено як відпрацьований.':'День повернуто до запланованих.')
    } catch(error){setStatus(friendlyError(error))}
  }
  const quickOvertime = () => {
    if (quickLock.current || busy) return
    try {
      const hadOvertime=!!draft.overtimeExtra
      const next=togglePresetOvertime(draft,overtimePreset)
      void quickSave(next,hadOvertime?'Понаднормові прибрано.':
        next.overtimeExtra?.start!==overtimePreset.start
          ? `Понаднормові додано після зміни: ${next.overtimeExtra?.start}–${next.overtimeExtra?.end}. Час автоматично скориговано без накладання.`
          : 'Понаднормові додано й збережено в календарі.')
    }catch(error){setStatus(friendlyError(error))}
  }
  const activeShift = shifts.find(s=>s.date===selected)
  useEffect(()=>{
    setInstantDay(null)
    setDraft(activeShift ? {...activeShift,additionalShifts:[...(activeShift.additionalShifts||[])]} : defaultShift(selected))
    setStatus('')
  },[selected,activeShift?.start,activeShift?.end,activeShift?.breakMinutes,activeShift?.status,activeShift?.note,activeShift?.kind,activeShift?.dayType,activeShift?.overtimeMinutes,JSON.stringify(activeShift?.overtimeExtra),activeShift?.plannedWorkday,activeShift?.plannedMinutes,JSON.stringify(activeShift?.additionalShifts||[])])

  const count = new Date(year,month+1,0).getDate()
  const offset = (new Date(year,month,1).getDay()+6)%7
  const cells = [...Array.from({length:offset},()=>null),...Array.from({length:count},(_,i)=>i+1)]
  const monthKey = `${year}-${String(month+1).padStart(2,'0')}`
  const monthShifts = shifts.filter(s=>s.date.startsWith(monthKey))
  const calendarMetrics = useMemo(()=>buildMonthAnalytics(shifts,monthKey,paySettings,salesByMonth[monthKey]??0,unitsByMonth[monthKey]??0,performance,planTarget(monthKey,performance,monthlyTargets),cashByMonth[monthKey]??0,dailyWages),[shifts,monthKey,paySettings,salesByMonth,unitsByMonth,performance,monthlyTargets,cashByMonth,dailyWages])
  const target=planTarget(monthKey,performance,monthlyTargets)
  const progress=performance.enabled&&calendarMetrics.result?performanceProgress(calendarMetrics.result,performance,target,cashByMonth[monthKey]??0):null
  const measure=(amount:number)=>performance.metric==='units'?amount.toLocaleString('uk-UA'):moneyUA(amount)
  const paymentMarkers = useMemo(()=>payoutsInMonth(shifts,monthKey,paySettings,salesByMonth,unitsByMonth,performance,monthlyTargets,cashByMonth,dailyWages),[shifts,monthKey,paySettings,salesByMonth,unitsByMonth,performance,monthlyTargets,cashByMonth,dailyWages])
  const paymentsByDay = useMemo(()=>{
    const map=new Map<string,typeof paymentMarkers>()
    for(const event of paymentMarkers)map.set(event.date,[...(map.get(event.date)??[]),event])
    return map
  },[paymentMarkers])
  const selectedPayments=paymentsByDay.get(selected)??[]
  const working = monthShifts.reduce((sum,s)=>sum+shiftCount(s),0)
  let generated: GeneratedCalendarDay[] = [], cycleError = ''
  try { generated = generateMonthlyPattern({month:monthKey,anchorDate,pattern}) }
  catch(e){cycleError=friendlyError(e)}
  const preview=planPatternApplication(generated, monthShifts, applyMode)
  const changeSlot = (i:number,patch:Partial<PatternDay>)=>{
    setPattern(old=>old.map((slot,index)=>index===i?{...slot,...patch}:slot))
    setPreset('custom')
    setTemplateMessage('');setCycleMessage('')
  }
  const changePreset = (value:string)=>{
    setPreset(value);setSelectedTemplate('');setTemplateMessage('');setCycleMessage('')
    if(value!=='custom')setPattern(presetPattern(value as TemplatePreset))
    // The weekday calendar must start on Monday, regardless of month or user's old anchor.
    if(value===WEEKDAY_FIVE_TWO_PRESET)setAnchorDate(mondayOfWeek(`${monthKey}-01`))
    else if(preset===WEEKDAY_FIVE_TWO_PRESET)setAnchorDate(`${monthKey}-01`)
  }
  const chooseTemplate=(id:string)=>{
    setSelectedTemplate(id);setTemplateMessage('')
    if(!id)return
    const found=templates.find(t=>t.id===id)
    if(found){setPreset('custom');setPattern(found.pattern.map(s=>({...s})));setAnchorDate(found.anchorDate);setTemplateName(found.name);setCycleMessage('')}
  }
  const storeTemplate=async()=>{
    setTemplateBusy(true);setTemplateMessage('')
    try{
      validatePattern(pattern)
      const id = selectedTemplate || (typeof crypto!=='undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `template-${Date.now()}`)
      const template={id,name:templateName.trim(),anchorDate,pattern}
      await onSaveTemplate(template)
      setSelectedTemplate(id)
      setTemplateMessage('Шаблон збережено у робочому просторі.')
    }catch(e){setTemplateMessage(friendlyError(e))}finally{setTemplateBusy(false)}
  }
  const removeTemplate=async()=>{
    if(!selectedTemplate || !window.confirm('Видалити обраний шаблон? Зміни в календарі залишаться.'))return
    setTemplateBusy(true);setTemplateMessage('')
    try{await onDeleteTemplate(selectedTemplate);setSelectedTemplate('');setTemplateMessage('Шаблон видалено. Заповнені дні залишилися.')}
    catch(e){setTemplateMessage(friendlyError(e))}finally{setTemplateBusy(false)}
  }
  const copyToWorkdays=(index:number)=>{
    try {
      const next=copyWorkdayToAll(pattern,index)
      setPattern(next);setPreset('custom');setCycleMessage('')
      setTemplateMessage(`Параметри дня ${index+1} скопійовано на всі робочі дні циклу. Натисни «Оновити календар», щоб застосувати зміни до місяця.`)
    }catch(e){setTemplateMessage(friendlyError(e))}
  }
  const applyCycle=async()=>{
    if(cycleError||!generated.length||!preview.write.length)return
    if(applyMode==='update-planned' && preview.summary.updated>0 && !window.confirm(
      `Оновити ${preview.summary.updated} запланованих днів та створити ${preview.summary.created} нових?\n`+
      'Попередні години та примітки цих запланованих днів буде замінено. Відпрацьовані зміни, відпустки, лікарняні та дні з додатковими змінами залишаться без змін.'
    ))return
    setCycleBusy(true);setCycleMessage('')
    try{
      const result=await onApplyPattern(generated,applyMode)
      setCycleMessage(`Готово: створено ${result.created}, оновлено ${result.updated}, захищено ${result.protected}, без змін ${result.unchanged}.`)
      setCycleOpen(false)
    }catch(e){setCycleMessage(friendlyError(e))}finally{setCycleBusy(false)}
  }
  const select=(day:number)=>setSelected(toDateKey(new Date(year,month,day)))
  const moveMonth=(n:number)=>{
    const date=new Date(year,month+n,1)
    setMonthDirection(n<0?-1:1)
    setYear(date.getFullYear())
    setMonth(date.getMonth())
    setSelected(toDateKey(date))
    setCycleMessage('')
  }
  const jumpToToday=()=>{
    const date=new Date()
    const currentMonthIndex=year*12+month
    const targetMonthIndex=date.getFullYear()*12+date.getMonth()
    setMonthDirection(targetMonthIndex<currentMonthIndex?-1:targetMonthIndex>currentMonthIndex?1:0)
    setYear(date.getFullYear())
    setMonth(date.getMonth())
    setSelected(toDateKey(date))
    setCycleMessage('')
  }
  const submit=async(e:FormEvent)=>{
    e.preventDefault();if(quickLock.current)return;setBusy(true);setStatus('')
    try{
      // The planned norm is independent from actually worked and overtime hours.
      // Changing worked time must never silently increase the salary denominator.
      await onSave({...draft,id:selected,date:selected,plannedMinutes:draft.plannedMinutes??0})
      setStatus(demo?'Збережено в деморежимі.':'День збережено.')
    }
    catch(err){setStatus(friendlyError(err))}finally{setBusy(false)}
  }
  const remove=async()=>{
    if(quickLock.current || busy)return
    if(!window.confirm('Видалити запис дня та всі його додаткові зміни?'))return
    setBusy(true);setStatus('')
    try{await onDelete(selected);setStatus('Запис дня видалено.')}
    catch(err){setStatus(friendlyError(err))}finally{setBusy(false)}
  }
  const addExtra=()=>{
    const extras=draft.additionalShifts||[]
    if(extras.length>=4){setStatus('Максимум п’ять змін на день.');return}
    const extra: AdditionalShift={id:(typeof crypto!=='undefined'&&'randomUUID' in crypto)?crypto.randomUUID():`extra-${Date.now()}`,
      start:'18:00',end:'22:00',breakMinutes:0,status:'planned',kind:'extra',note:''}
    setDraft({...draft,additionalShifts:[...extras,extra]});setStatus('')
  }
  const updateExtra=(id:string,patch:Partial<AdditionalShift>)=>{
    setDraft(old=>({...old,additionalShifts:(old.additionalShifts||[]).map(x=>x.id===id?{...x,...patch}:x)}))
  }
  return <>
    {scheduleOnly&&<>
    <SectionHeading eyebrow="НАЛАШТУВАННЯ РОБОТИ" title="Графік під твої правила" detail="Вибери графік, налаштуй час та застосуй до календаря.">
      <span className="pill mint-pill"><CalendarDays size={15}/> {working} змін у місяці</span>
    </SectionHeading>
    <section id="schedule-settings" className="panel cycle-panel" aria-label="Конструктор графіків">
      <div className="cycle-top"><div><div className="eyebrow">ШАБЛОН РОБОЧОГО РИТМУ</div><h3>Графік під твої правила</h3><p>{cycleOpen?'Налаштуй цикл і застосуй його до календаря.':'Шаблон застосовано або згорнуто. Календар нижче доступний для редагування.'}</p></div>
        <div className="cycle-head-actions"><span className="pill mint-pill"><Clock3 size={15}/> {pattern.length} днів у циклі</span><button className="btn btn-outline" type="button" aria-expanded={cycleOpen} aria-controls="cycle-config" onClick={()=>setCycleOpen(v=>!v)}><ChevronDown size={16} className={cycleOpen?'rotate-icon':''}/>{cycleOpen?'Згорнути':'Налаштувати графік'}</button></div></div>
      {!cycleOpen&&<p className="cycle-collapsed-summary">{preset===WEEKDAY_FIVE_TWO_PRESET?'5/2 · Пн–Пт, Сб–Нд вихідні':preset==='custom'?'Власний цикл':preset} · {pattern.filter(p=>p.type==='work').length} робочих днів у циклі. {cycleMessage||'Натисни «Налаштувати графік», щоб внести зміни.'}</p>}
      {cycleOpen&&<div id="cycle-config">
      <div className="template-toolbar">
        <label>Готовий графік
          <select value={preset} onChange={e=>changePreset(e.target.value)}>
            <option value="2/2">2/2 — дві зміни, два вихідні</option>
            <option value="4/2">4/2 — чотири зміни, два вихідні</option>
            <option value="5/2-weekdays">5/2 — Пн–Пт робочі, Сб–Нд вихідні</option>
            <option value="5/2">5/2 — змінний цикл (від дати початку)</option>
            <option value="1/1">1/1 — одна зміна, один вихідний</option>
            <option value="2/1">2/1 — дві зміни, один вихідний</option>
            <option value="1/2">1/2 — одна зміна, два вихідні</option>
            <option value="3/1">3/1 — три зміни, один вихідний</option>
            <option value="3/3">3/3 — три зміни, три вихідні</option>
            <option value="4/4">4/4 — чотири зміни, чотири вихідні</option>
            <option value="6/1">6/1 — шість змін, один вихідний</option>
            <option value="7/7">7/7 — сім змін, сім вихідних</option>
            <option value="day-night-48">День / ніч / 48 год відпочинку</option>
            <option value="night-2/2">Нічні 2/2</option>
            <option value="duty-24-72">Добова зміна / 3 вихідних</option>
            <option value="custom">Власний цикл</option>
          </select>
        </label>
        <label>Мої збережені шаблони
          <select value={selectedTemplate} onChange={e=>chooseTemplate(e.target.value)}>
            <option value="">Оберіть шаблон…</option>
            {templates.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}
          </select>
        </label>
        {preset===WEEKDAY_FIVE_TWO_PRESET
          ? <div className="weekday-schedule-help" role="note"><CheckCircle2 size={17}/><span><strong>Прив’язка до понеділка автоматична.</strong> Субота й неділя залишатимуться вихідними в будь-якому місяці. Години можна змінити нижче.</span></div>
          : <label>Перший день циклу<input type="date" value={anchorDate} onChange={e=>setAnchorDate(e.target.value)}/></label>}
      </div>
      <div className="pattern-head"><strong>Послідовність циклу</strong><span>Натискай на години й тип дня, щоб змінювати їх</span></div>
      <div className="pattern-grid">
        {pattern.map((slot,i)=><div className={`pattern-card ${slot.type==='off'?'rest':''}`} key={i}>
          <div className="pattern-card-top"><strong>{preset===WEEKDAY_FIVE_TWO_PRESET?weekdayLabels[i]:`День ${i+1}`}</strong><button type="button" className="pattern-remove" onClick={()=>{setPattern(old=>old.filter((_,idx)=>idx!==i));setPreset('custom')}} disabled={pattern.length<=1} title="Прибрати день" aria-label={`Прибрати день ${i+1}`}><X size={15}/></button></div>
          <select aria-label={`Тип дня ${i+1}`} value={slot.type} onChange={e=>{changeSlot(i,{type:e.target.value as PatternDay['type']});setPreset('custom')}}>
            <option value="work">Робочий</option><option value="off">Вихідний</option>
          </select>
          {slot.type==='work' ? <>
            <div className="pattern-times"><label>З<input type="time" value={slot.start} onChange={e=>changeSlot(i,{start:e.target.value})}/></label><label>До<input type="time" value={slot.end} onChange={e=>changeSlot(i,{end:e.target.value})}/></label></div>
            <label>Перерва, хв<input type="number" min="0" max="1439" value={slot.breakMinutes} onChange={e=>changeSlot(i,{breakMinutes:Number(e.target.value)})}/></label>
          </> : <div className="pattern-rest-label"><Moon size={16}/> День відпочинку</div>}
          <label>Назва<input maxLength={70} value={slot.label} onChange={e=>changeSlot(i,{label:e.target.value})}/></label>
          {slot.type==='work'&&pattern.filter(p=>p.type==='work').length>1&&<button type="button" className="pattern-copy" onClick={()=>copyToWorkdays(i)} title="Скопіювати час, перерву та назву на всі робочі дні циклу"><CheckCircle2 size={15}/> Застосувати до всіх робочих днів</button>}
        </div>)}
        {pattern.length<28 && <button type="button" className="pattern-add" onClick={()=>{setPattern(old=>[...old,workSlot()]);setPreset('custom')}}><Plus size={23}/><span>Додати день</span></button>}
      </div>
      <div className="template-save-row">
        <label>Назва шаблону<input value={templateName} onChange={e=>setTemplateName(e.target.value)} maxLength={80} placeholder="Наприклад, зміни на складі"/></label>
        <button type="button" className="btn btn-outline" disabled={templateBusy} onClick={storeTemplate}><Save size={16}/> {selectedTemplate?'Оновити шаблон':'Зберегти шаблон'}</button>
        {selectedTemplate&&<button type="button" className="btn btn-danger" disabled={templateBusy} onClick={removeTemplate}><Trash2 size={16}/> Видалити шаблон</button>}
      </div>
      {templateMessage&&<p role="status" className="save-notice">{templateMessage}</p>}
      {visible.overtimeButton&&<div className="overtime-preset-editor" aria-label="Шаблон фіксованих понаднормових">
        <div><strong>Швидкі понаднормові для календаря</strong><p>Один раз задай інтервал, неоплачувану перерву та повний тариф. Потім натискай «+ Додати понаднормові» в потрібному дні.</p></div>
        <div className="overtime-preset-grid">
          <label>Початок<input type="time" value={overtimeDraft.start} onChange={e=>setOvertimeDraft(old=>({...old,start:e.target.value}))}/></label>
          <label>Кінець<input type="time" value={overtimeDraft.end} onChange={e=>setOvertimeDraft(old=>({...old,end:e.target.value}))}/></label>
          <label>Перерва, хв<input type="number" min="0" max="1439" step="1" value={overtimeDraft.breakMinutes} onChange={e=>setOvertimeDraft(old=>({...old,breakMinutes:Number(e.target.value)}))}/></label>
          <label>Оплата, %<input type="number" min="100" max="1000" step="0.01" value={overtimeDraft.basisPoints/100} onChange={e=>setOvertimeDraft(old=>({...old,basisPoints:Math.round(Number(e.target.value)*100)}))}/></label>
        </div>
        <div className="overtime-preset-actions"><span>{segmentHours(overtimeDraft).toLocaleString('uk-UA',{maximumFractionDigits:2})} додаткових год · {overtimeDraft.basisPoints/100}% від погодинної бази</span><button type="button" className="btn btn-outline" disabled={overtimeBusy} onClick={saveOvertime}><Save size={16}/>{overtimeBusy?'Зберігаємо…':'Зберегти шаблон понаднормових'}</button></div>
        {overtimeMessage&&<p className="save-notice" role="status">{overtimeMessage}</p>}
      </div>}
      <div className="pattern-apply-settings">
        <strong>Як перенести шаблон у календар?</strong>
        <div className="apply-mode-options" role="group" aria-label="Режим застосування графіка">
          <label><input type="radio" name="pattern-apply-mode" value="update-planned" checked={applyMode==='update-planned'} onChange={()=>{setApplyMode('update-planned');setCycleMessage('')}}/> Оновити заплановані дні</label>
          <label><input type="radio" name="pattern-apply-mode" value="missing" checked={applyMode==='missing'} onChange={()=>{setApplyMode('missing');setCycleMessage('')}}/> Лише порожні дні</label>
        </div>
        <p className="apply-safety-note">Відпрацьовані зміни, відпустки, лікарняні, неоплачувані дні, підробітки та дні з додатковими змінами завжди захищені від автоматичного перезапису.</p>
      </div>
      <div className="cycle-footer"><span className="cycle-info" role="status">{cycleError||cycleMessage||`Місяць: нових ${preview.summary.created}, на оновлення ${preview.summary.updated}, захищених ${preview.summary.protected}, без змін ${preview.summary.unchanged}.`}</span>
        <button type="button" className="btn btn-primary" disabled={cycleBusy||!!cycleError||preview.write.length===0} onClick={applyCycle}><Check size={16}/>{cycleBusy?'Зберігаємо…':'Оновити календар і згорнути'}</button></div></div>}
    </section>
    </>}
    {!scheduleOnly&&<>
    <div className="calendar-layout-options">
      <button type="button" className="btn btn-outline" aria-expanded={layoutOpen} onClick={()=>setLayoutOpen(v=>!v)}><SlidersHorizontal size={19}/> {layoutOpen?'Готово':'Налаштувати блоки'}</button>
      {layoutOpen&&<div className="panel calendar-layout-editor" role="group" aria-label="Налаштування блоків календаря">
        <div className="calendar-layout-editor-head"><strong>Мій екран</strong><button type="button" className="link-button" onClick={()=>changeLayout(defaultCalendarLayout)}>За замовчуванням</button></div>
        {layout.order.map((id,i)=>{
          const titles:Record<CalendarBlockId,string>={calendar:'Календар',plan:'План і прогрес',metrics:'Показники місяця'}
          const available=id!=='plan'||performance.enabled
          return <div className="calendar-layout-editor-row" key={id}>
            <span>{titles[id]}</span>
            {id!=='calendar'&&<label><input type="checkbox" checked={layout.visible[id]} disabled={!available} onChange={e=>changeLayout({...layout,visible:{...layout.visible,[id]:e.target.checked}})}/> Показувати</label>}
            <div className="calendar-layout-movers"><button type="button" disabled={i===0} aria-label={`Підняти ${titles[id]}`} onClick={()=>changeLayout({...layout,order:moveCalendarBlock(layout.order,id,-1)})}><ChevronLeft size={17}/></button><button type="button" disabled={i===layout.order.length-1} aria-label={`Опустити ${titles[id]}`} onClick={()=>changeLayout({...layout,order:moveCalendarBlock(layout.order,id,1)})}><ChevronRight size={17}/></button></div>
          </div>
        })}
        <label className="calendar-layout-editor-row"><span>Редактор дня</span><input type="checkbox" checked={layout.visible.editor} onChange={e=>changeLayout({...layout,visible:{...layout.visible,editor:e.target.checked}})}/> Показувати</label>
        <label className="calendar-layout-editor-row"><span>Редактор зверху на комп’ютері</span><input type="checkbox" checked={layout.dayTop} onChange={e=>changeLayout({...layout,dayTop:e.target.checked})}/></label>
        <small>Зберігається на цьому пристрої окремо для кожного робочого простору.</small>
      </div>}
    </div>
    <div className={`calendar-layout calendar-custom-layout ${layout.dayTop?'day-top':''}`}>
      <div className="calendar-primary-stack">
        <div className="calendar-custom-block" style={{order:blockOrder('calendar')}}>
      <section className="panel calendar-panel"><div className="calendar-toolbar"><div><h3 aria-live="polite" aria-atomic="true">{monthFormat.format(new Date(year,month,1))}</h3></div>
        <div className="cal-arrows"><button type="button" aria-label="Попередній місяць" onClick={()=>moveMonth(-1)}><ChevronLeft size={20}/></button><button type="button" aria-label="Поточний місяць" className="cal-today" onClick={jumpToToday}>Сьогодні</button><button type="button" aria-label="Наступний місяць" onClick={()=>moveMonth(1)}><ChevronRight size={20}/></button></div></div>
        <div className="calendar-view-options" role="group" aria-label="Фільтр днів календаря">
          {([['all','Усі дні'],['worked','Відпрацьовані'],...(visible.overtimeSettings||historicalOvertime?[['overtime','Понаднормові'] as const]:[])] as const).map(([id,label])=><button type="button" key={id} className={calendarFilter===id?'active':''} onClick={()=>setCalendarFilter(id)} aria-pressed={calendarFilter===id}>{label}</button>)}
          <label className="calendar-payout-switch"><input type="checkbox" checked={showPayouts} onChange={e=>setShowPayouts(e.target.checked)}/> Дати виплат</label>
        </div>
        <div className="calendar-grid-viewport">
        <div key={monthKey} className={`cal-grid ${monthDirection===1?'month-slide-next':monthDirection===-1?'month-slide-prev':''}`} role="group" aria-label={`Календар за ${monthFormat.format(new Date(year,month,1))}`}>{weekdayLabels.map(d=><div className="cal-weekday" key={d}>{d}</div>)}{cells.map((day,i)=>{
          if(!day)return <div key={`blank-${i}`} className="cal-blank"/>
          const date=toDateKey(new Date(year,month,day)),shift=(instantDay?.date===date?instantDay:monthShifts.find(s=>s.date===date))
          const off=shift?.dayType && shift.dayType!=='work'
          const badges:Record<string,string>={off:'Вих.',vacation:'Відп.',sick:'Лік.',unpaid:'За свій'}
          const label=off?badges[shift.dayType!]:(shift?(shiftCount(shift)>1?`${shiftCount(shift)} зміни`:shift.start):'')
          const overtime=(shift?.overtimeMinutes??0)+(shift?.overtimeExtra?Math.round(segmentHours(shift.overtimeExtra)*60):0)
          const payouts=showPayouts?(paymentsByDay.get(date)??[]):[]
          const workedDay=shift&&(shift.status==='worked'||shift.additionalShifts?.some(e=>e.status==='worked'))
          const subdued=calendarFilter==='worked'?!workedDay:calendarFilter==='overtime'?overtime===0:false
          return <button type="button" key={date} className={`cal-day ${selected===date?'selected':''} ${date===toDateKey(today)?'today':''} ${shift?'has-shift':''} ${workedDay?'is-worked':''} ${off?'has-leave':''} ${subdued?'cal-day-muted':''} ${payouts.length?'cal-has-payout':''}`} onClick={()=>select(day)} aria-pressed={selected===date} aria-label={`${date}${label?' — '+label:''}${payouts.length?' · запланована виплата':''}`}><span className="day-number">{day}</span>{shift&&<span key={`${date}-${shift.status}-${shift.dayType??'work'}`} className={`shift-indicator ${off?'leave':shift.status==='worked'?'worked':''}`}>{label}</span>}{overtime>0&&<span key={`${date}-overtime-${overtime}`} className="calendar-overtime">+{(overtime/60).toLocaleString('uk-UA',{maximumFractionDigits:2})} год понадн.</span> }{performance.manualDailyPay&&dailyWages[date]!==undefined&&!off&&<span className="calendar-wage-marker" title={`Заробіток: ${moneyUA(dailyWages[date])}`}><Wallet size={14}/></span>}{cashPrefs.enabled&&cashRecords.some(r=>r.date===date)&&!off&&<span key={`${date}-cash`} className="calendar-cash-marker" title="Каса за день"><ReceiptText size={14}/></span>}{payouts.length>0&&<span key={`${date}-payout-${payouts.length}`} className="calendar-payout-marker"><Wallet size={12}/>{payouts.length>1?`${payouts.length} виплати`:'Виплата'}</span>}</button>
        })}</div>
        </div>
        <div className="cal-legend"><span><i className="legend-dot planned"/> Заплановано</span><span><i className="legend-dot worked"/> Відпрацьовано</span><span><i className="legend-dot leave"/> Вихідний / відсутність</span><span><i className="legend-border"/> Обрано</span><span><i className="legend-dot payout"/> Дата виплати</span></div>
      </section>
        </div>
        {performance.enabled&&layout.visible.plan&&<div className="calendar-custom-block" style={{order:blockOrder('plan')}}>
          <section className="panel calendar-plan-panel" aria-label="План і прогрес місяця">
            <div className="calendar-plan-heading"><span><Target size={21}/> <strong>Мій план</strong></span><b>{progress&&target>0?`${progress.percent.toLocaleString('uk-UA',{maximumFractionDigits:1})}%`:'—'}</b></div>
            <div className="calendar-plan-bar" role="progressbar" aria-label="Виконання плану" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.max(0,progress?.percent??0))}><span style={{width:`${Math.min(100,Math.max(0,progress?.percent??0))}%`}}/></div>
            <div className="calendar-plan-values"><strong>{progress?measure(progress.actual):'—'}</strong><span>із {measure(target)}</span>{progress&&progress.bonus>0&&<b>+{moneyUA(progress.bonus)} премії</b>}</div>
            {target===0&&<button type="button" className="link-button" onClick={onGoStatistics}>Встановити план</button>}
          </section>
        </div>}
        {layout.visible.metrics&&<div className="calendar-custom-block" style={{order:blockOrder('metrics')}}>
          <div className="calendar-month-highlights" key={monthKey} aria-label="Показники вибраного місяця">
            <div><span>Відпрацьовано</span><strong>{calendarMetrics.workedHours.toLocaleString('uk-UA',{maximumFractionDigits:2})} год</strong></div>
            {(visible.overtimeSettings||calendarMetrics.overtimeHours>0)&&<div><span>Понаднормові</span><strong>{calendarMetrics.overtimeHours.toLocaleString('uk-UA',{maximumFractionDigits:2})} год</strong></div>}
            <div><span>Нараховано</span><strong>{calendarMetrics.result?moneyUA(calendarMetrics.result.gross):'—'}</strong></div>
            <button type="button" onClick={onGoStatistics} className="calendar-stats-action"><TrendingUp size={19}/> Статистика <ArrowUpRight size={16}/></button>
          </div>
        </div>}
      </div>
      {layout.visible.editor&&<div className="calendar-day-slot"><section className="panel editor-panel day-editor-v2" aria-label="Редактор дня">
        <div className="panel-title day-editor-header">
          <div><div className="eyebrow">ОБРАНИЙ ДЕНЬ</div><h3 key={selected}>{dateFormat.format(new Date(selected+'T12:00'))}</h3></div>
          <div className="editor-icon"><CalendarDays size={22}/></div>
        </div>
        {selectedPayments.length>0&&showPayouts&&<div className="editor-payouts"><strong><Wallet size={16}/> Заплановані виплати</strong>{selectedPayments.map(item=><div key={item.id}><span>{item.title}<small>За {item.sourceMonth}</small></span><b>{item.amount===null?'Ще без суми':moneyUA(item.amount)}</b></div>)}<small>Прогноз, а не підтверджена виплата.</small></div>}
        <div className="day-editor-simplified">
          <div className="day-action-section">
            <strong className="day-action-label">Який це день?</strong>
            <div className="day-type-buttons" role="group" aria-label="Тип дня">
              {([['work','Робочий'],['off','Вихідний'],['vacation','Відпустка'],['sick','Лікарняний'],['unpaid','За свій рахунок']] as const).map(([type,label])=>
                <button key={type} type="button" disabled={quickBusy||busy} onClick={()=>quickType(type)}
                  className={`day-type-button ${(draft.dayType??'work')===type?'active':''}`} aria-pressed={(draft.dayType??'work')===type}>{label}</button>
              )}
            </div>
          </div>
          {(draft.dayType??'work')==='work'&&<>
            <div className="day-action-section">
              <strong className="day-action-label">Відпрацював цю зміну?</strong>
              <button type="button" className={`day-worked-toggle ${draft.status==='worked'?'is-worked':''}`}
                disabled={quickBusy||busy} aria-pressed={draft.status==='worked'} onClick={quickStatus}>
                {draft.status==='worked'?<CheckCircle2 size={22}/>:<Check size={22}/>}
                <span><strong>{draft.status==='worked'?'Відпрацьовано':'Позначити як відпрацьовано'}</strong>
                  </span>
              </button>
            </div>
            {visible.overtimeButton&&<div className="day-action-section">
              <strong className="day-action-label">Понаднормові</strong>
              <button type="button" className={`day-ot-toggle ${draft.overtimeExtra?'is-added':''}`}
                disabled={quickBusy||busy} aria-pressed={!!draft.overtimeExtra} onClick={quickOvertime}>
                {draft.overtimeExtra?<CheckCircle2 size={21}/>:<Plus size={21}/>}
                <span><strong>{draft.overtimeExtra?'Понаднормові додано':`Додати +${segmentHours(overtimePreset).toLocaleString('uk-UA',{maximumFractionDigits:2})} год`}</strong>
                  <small>{draft.overtimeExtra?
                    `${draft.overtimeExtra.start}–${draft.overtimeExtra.end} · ${draft.overtimeExtra.basisPoints/100}% · Натисни, щоб прибрати`:
                    `${overtimePreset.start}–${overtimePreset.end} · ${overtimePreset.basisPoints/100}% · Збереження одним натисканням`}</small></span>
              </button>
              
            </div>}
          </>}
          {(performance.manualDailyPay||cashPrefs.enabled)&&(draft.dayType??'work')==='work'&&<form className="day-money-entry" onSubmit={saveDayMoney}>
            <div className="day-money-heading"><Wallet size={19}/><strong>Заробіток і каса</strong></div>
            <div className="day-money-fields">
              {performance.manualDailyPay&&<label><span>Мій заробіток, ₴</span><input inputMode="decimal" type="text" value={wageDraft} placeholder="0,00" onChange={e=>setWageDraft(e.target.value)} disabled={moneyBusy||!activeShift}/></label>}
              {cashPrefs.enabled&&<label><span>Каса за день, ₴</span><input inputMode="decimal" type="text" value={cashDraft} placeholder="0,00" onChange={e=>setCashDraft(e.target.value)} disabled={moneyBusy||!activeShift}/></label>}
            </div>
            <button type="submit" className="btn btn-primary" disabled={moneyBusy||!activeShift}><Save size={18}/>{moneyBusy?'Зберігаємо…':'Зберегти суми'}</button>
            {!activeShift&&<small>Спочатку відміть робочий день.</small>}
            {moneyNotice&&<p role="status" className="save-notice">{moneyNotice}</p>}
          </form>}
          {cashPrefs.enabled&&(draft.dayType??'work')!=='work'&&cashEntry&&<div className="cash-source-note">Для цього дня збережено касу {moneyUA(cashEntry.amount)}, але після позначення вихідного чи відсутності вона <strong>не входить у місячні підсумки</strong>. <button type="button" className="link-button" disabled={moneyBusy} onClick={()=>void clearCash()}>Видалити запис каси</button></div>}
          {cashNotice&&<p className="save-notice" role="status">{cashNotice}</p>}
          {quickBusy&&<p className="day-save-pending" role="status">Зберігаємо зміни…</p>}
          {status&&<p className="save-notice" role="status">{status}</p>}
        </div>
        <details className="day-advanced">
          <summary><Settings2 size={17}/> Додаткові параметри <ChevronDown size={17} className="details-chevron"/></summary>
          <form onSubmit={submit} className="editor-form">
            {(draft.dayType??'work')==='work'&&<>
              <div className="day-editor-title"><strong>Час основної зміни</strong><span>{shiftHours({...draft,additionalShifts:[]}).toLocaleString('uk-UA',{maximumFractionDigits:2})} год</span></div>
              <div className="form-row"><label>Початок<input type="time" required value={draft.start} onChange={e=>setDraft({...draft,start:e.target.value})}/></label><label>Завершення<input type="time" required value={draft.end} onChange={e=>setDraft({...draft,end:e.target.value})}/></label></div>
              <label>Перерва, хв<input type="number" min="0" max="1439" required value={draft.breakMinutes} onChange={e=>setDraft({...draft,breakMinutes:Number(e.target.value)})}/></label>
              <label>Планова норма дня, год<input type="number" min="0.25" max="24" step="0.25" value={(draft.plannedMinutes??480)/60} onChange={e=>setDraft({...draft,plannedWorkday:true,plannedMinutes:Math.round(Number(e.target.value)*60)})}/></label>
              {(visible.overtimeSettings||(draft.overtimeMinutes??0)>0)&&<><label>Позначені понаднормові всередині зміни, год<input type="number" min="0" max="120" step="0.25" value={(draft.overtimeMinutes??0)/60} onChange={e=>setDraft({...draft,overtimeMinutes:Math.round(Number(e.target.value)*60)})}/></label>
              <p className="day-action-hint">Це поле не додає години. Використовуй його лише якщо години вже входять до основної зміни. Для окремих годин є кнопка вище.</p></>}
              {draft.overtimeExtra&&<div className="overtime-extra-card">
                <strong>Точне редагування доданих понаднормових</strong>
                <div className="form-row"><label>Початок<input type="time" value={draft.overtimeExtra.start} onChange={e=>setDraft(old=>({...old,overtimeExtra:old.overtimeExtra?{...old.overtimeExtra,start:e.target.value}:undefined}))}/></label><label>Кінець<input type="time" value={draft.overtimeExtra.end} onChange={e=>setDraft(old=>({...old,overtimeExtra:old.overtimeExtra?{...old.overtimeExtra,end:e.target.value}:undefined}))}/></label></div>
                <div className="form-row"><label>Перерва, хв<input type="number" min="0" max="1439" value={draft.overtimeExtra.breakMinutes} onChange={e=>setDraft(old=>({...old,overtimeExtra:old.overtimeExtra?{...old.overtimeExtra,breakMinutes:Number(e.target.value)}:undefined}))}/></label><label>Тариф, %<input type="number" min="100" max="1000" step="0.01" value={draft.overtimeExtra.basisPoints/100} onChange={e=>setDraft(old=>({...old,overtimeExtra:old.overtimeExtra?{...old.overtimeExtra,basisPoints:Math.round(Number(e.target.value)*100)}:undefined}))}/></label></div>
              </div>}
              <label>Вид зміни<select value={draft.kind||'regular'} onChange={e=>setDraft({...draft,kind:e.target.value as ShiftKind})}><option value="regular">Звичайна</option><option value="extra">Підробіток / додаткова</option><option value="replacement">Заміна</option></select></label>
              <div className="day-editor-title"><strong>Додаткові зміни</strong><button type="button" className="link-button" onClick={addExtra} disabled={(draft.additionalShifts?.length||0)>=4}><Plus size={15}/> Додати</button></div>
              {(draft.additionalShifts||[]).map((extra,i)=><div className="extra-shift" key={extra.id}>
                <div className="extra-top"><strong>Додаткова зміна {i+1}</strong><button type="button" onClick={()=>setDraft({...draft,additionalShifts:draft.additionalShifts?.filter(x=>x.id!==extra.id)})} aria-label={`Видалити додаткову зміну ${i+1}`}><Trash2 size={16}/></button></div>
                <div className="form-row"><label>З<input type="time" value={extra.start} onChange={e=>updateExtra(extra.id,{start:e.target.value})}/></label><label>До<input type="time" value={extra.end} onChange={e=>updateExtra(extra.id,{end:e.target.value})}/></label></div>
                <label>Перерва, хв<input type="number" min="0" max="1439" value={extra.breakMinutes} onChange={e=>updateExtra(extra.id,{breakMinutes:Number(e.target.value)})}/></label>
                <button type="button" className={`day-worked-toggle compact ${extra.status==='worked'?'is-worked':''}`} onClick={()=>updateExtra(extra.id,{status:extra.status==='worked'?'planned':'worked'})} aria-pressed={extra.status==='worked'}>
                  <CheckCircle2 size={17}/><span><strong>{extra.status==='worked'?'Додаткова зміна відпрацьована':'Позначити додаткову зміну відпрацьованою'}</strong></span>
                </button>
                <label>Тип<select value={extra.kind} onChange={e=>updateExtra(extra.id,{kind:e.target.value as ShiftKind})}><option value="extra">Додаткова</option><option value="replacement">Заміна</option><option value="regular">Звичайна</option></select></label>
                <label>Примітка<input value={extra.note} maxLength={400} onChange={e=>updateExtra(extra.id,{note:e.target.value})}/></label>
              </div>)}
            </>}
            <label>Примітка до дня<textarea rows={2} maxLength={400} value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})} placeholder="Необов’язково"/></label>
            <button type="submit" disabled={busy||quickBusy} className="btn btn-primary full"><Save size={17}/>{busy?'Зберігаємо…':'Зберегти додаткові параметри'}</button>
            {activeShift&&<button type="button" disabled={busy||quickBusy} className="btn btn-danger full" onClick={remove}><Trash2 size={16}/> Видалити запис дня</button>}
          </form>
        </details>

      </section></div>}
    </div>
    </>}
  </>
}

function SetupPage({settings,loaded,onChoose}:{settings:PaySettings|null;loaded:boolean;onChoose:(sector:Sector,preset:JobPreset)=>Promise<void>}) {
  const [sector,setSector]=useState<Sector>((sectors.find(x=>x.id===settings?.sector)?.id??'other'))
  const [presetId,setPresetId]=useState('')
  const [showAll,setShowAll]=useState(false)
  const [search,setSearch]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const allOptions=showAll?allSuggestions:suggestions[sector]
  const options=allOptions.filter(x=>`${x.name} ${x.description} ${x.shift} ${x.unitName}`.toLocaleLowerCase('uk-UA').includes(search.toLocaleLowerCase('uk-UA').trim()))
  const selected=presetId==='create-self'?createSelfPreset:allOptions.find(x=>x.id===presetId)??suggestions[sector][0]
  const next=async()=>{
    if(selected.id!=='create-self'&&settings&&!window.confirm('Підготувати обраний шаблон? Графік відкриється для редагування. Налаштування зарплати не зміняться, доки ти сам не збережеш їх у «Правилах оплати».'))return
    setBusy(true);setError('')
    try{await onChoose(sector,selected)}catch(e){setError(friendlyError(e))}finally{setBusy(false)}
  }
  return <div className="setup-page">
    <SectionHeading eyebrow="ПОКРОКОВЕ НАЛАШТУВАННЯ" title="Підлаштуй PayTakt під свою роботу" detail="Спочатку сфера, потім редагований графік, далі правила зарплати. Шаблони — лише стартові приклади."/>
    <div className="setup-progress"><span className="current">1. Сфера роботи</span><span className="current">2. Шаблон</span><span>3. Графік</span><span>4. Оплата</span></div>
    <section className="panel setup-panel"><h3>1. Де ти працюєш?</h3><p className="muted-setup">Це впливає лише на рекомендовані шаблони. Будь-яке поле можна змінити вручну.</p>
      <div className="sector-grid">{sectors.map(x=><button key={x.id} type="button" aria-pressed={sector===x.id} className={`sector-card ${sector===x.id?'chosen':''}`} onClick={()=>{setSector(x.id);setPresetId('');setShowAll(false);setSearch('');setError('')}}><strong>{x.label}</strong><small>{x.description}</small></button>)}</div>
    </section>
    <section className="panel setup-panel"><h3>2. Обери приклад графіка й оплати</h3><p className="muted-setup">Шаблон заповнює лише початкові параметри. Години, цикли, ставки, бонуси й дати виплат будуть редагуватися далі.</p>
      <div className="setup-filter-row">
        <label className="setup-search">Знайти графік або спосіб оплати<input type="search" placeholder="Наприклад: 3/3, нічна, оклад, рейс…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <button type="button" className="btn btn-outline" aria-pressed={showAll} onClick={()=>{setShowAll(v=>!v);setSearch('');setPresetId('')}}>{showAll?'Лише моя сфера':'Показати всі шаблони'}</button>
      </div>
      <p className="muted-setup">{showAll?'Усі приклади для різних професій. Можна вибрати будь-який, незалежно від сфери.':`Рекомендовано для вибраної сфери: ${suggestions[sector].length} прикладів.`} Жоден не підходить? Обирай «Створи сам».</p>
      <div className="job-presets">
        <button type="button" aria-pressed={selected.id==='create-self'} className={`job-preset job-preset-custom ${selected.id==='create-self'?'chosen':''}`} onClick={()=>{setPresetId('create-self');setError('')}}><span><strong>＋ Створи сам</strong><small>Почни з одного дня, редагуй власний цикл та правила оплати без автоматичного перезапису ставок.</small></span><span className="pill">Власний</span></button>
        {options.map(x=><button key={x.id} type="button" aria-pressed={selected.id===x.id} className={`job-preset ${selected.id===x.id?'chosen':''}`} onClick={()=>{setPresetId(x.id);setError('')}}><span><strong>{x.name}</strong><small>{x.description}</small></span><span className="pill">{x.shift}</span></button>)}
      </div>
      {options.length===0&&<p className="muted-setup">За цим запитом немає готових шаблонів. Можна скористатися «Створи сам».</p>}
      <p className="setup-preview">{selected.id==='create-self'?<><strong>Власне налаштування:</strong> відкриється конструктор з одним робочим днем, до якого можна додати будь-які робочі та вихідні дні. Чинні ставки й правила зарплати залишаться без змін. Налаштуй їх окремо після графіка.</>:<><strong>Що буде застосовано:</strong> графік {selected.shift} (можна змінити кожен день), тип оплати {selected.mode==='monthly'?'оклад':selected.mode==='hourly'?'погодинна':selected.mode==='per_shift'?'позмінна':'за виконану роботу'}, понаднормові — за позначеними в календарі годинами. Суми зарплати не встановлюються автоматично. Шаблон оплати буде лише чернеткою до натискання «Зберегти» в правилах.</>}</p>
      {error&&<p role="alert" className="form-error">{error}</p>}
      <button type="button" className="btn btn-primary" disabled={busy||!loaded} onClick={next}><Check size={17}/>{busy?'Застосовуємо…':selected.id==='create-self'?'Створити власний графік':'Далі: редагувати графік'}</button>
    </section>
  </div>
}

function TeamPage({workspace}:{workspace:Workspace}) {
  return <><SectionHeading eyebrow="КОМАНДА" title="Співробітники компанії" detail={`Простір «${workspace.name}» · зараз доступний власнику акаунта.`}/><div className="panel team-owner"><div className="avatar large"><UserRound size={24}/></div><div><h3>Власник простору</h3><p>Повний доступ до власних налаштувань і календаря</p></div><span className="pill mint-pill">Власник</span></div><Placeholder icon={UsersRound} title="Запрошення співробітників — наступний етап" detail="Після налаштування корпоративних ролей тут з’являться запрошення, відділи та доступи. Зараз ніхто інший не може переглядати дані вашого простору."/></>
}

function SettingsPage({ session, workspace, workspaces, theme, setTheme, onCreate, emailVerified, onVerify, onRefreshVerification }: {session: Session; workspace: Workspace; workspaces: Workspace[]; theme: ThemeChoice; setTheme: (v:ThemeChoice)=>void; onCreate:()=>void; emailVerified:boolean; onVerify:()=>Promise<void>; onRefreshVerification:()=>Promise<void>}) {
  return <><SectionHeading eyebrow="ПЕРСОНАЛІЗАЦІЯ" title="Налаштування" detail="Зовнішній вигляд, профіль та робочі простори."/>
    {!session.demo&&<div className={`verification-card ${emailVerified?'verified':''}`}><div><div className="verification-title"><ShieldCheck size={19}/><strong>{emailVerified?'Електронну пошту підтверджено':'Підтвердь електронну пошту'}</strong></div><p>{emailVerified?'Твій акаунт має підтверджену email-адресу.':'Ми рекомендуємо підтвердити email, щоб захистити доступ до акаунта й відновлення пароля.'}</p></div>{!emailVerified&&<div className="verification-actions"><button className="btn btn-outline" type="button" onClick={()=>void onVerify()}><Mail size={16}/> Надіслати лист</button><button className="btn btn-outline" type="button" onClick={()=>void onRefreshVerification()}><Check size={16}/> Я підтвердив</button></div>}</div>}
    <div className="settings-grid"><section className="panel settings-panel"><div className="settings-heading"><Sun size={22}/><div><h3>Тема оформлення</h3><p>Обирай вигляд, який комфортний саме тобі.</p></div></div><div className="theme-card-grid">{([['light',Sun,'Денна','Світла й повітряна'],['dark',Moon,'Нічна','Глибокі темні відтінки'],['system',Monitor,'Авто','Як на твоєму пристрої']] as const).map(([value,Icon,label,sub])=><button type="button" key={value} className={`theme-card ${theme===value?'chosen':''}`} onClick={()=>setTheme(value)}><Icon size={24}/><strong>{label}</strong><span>{sub}</span>{theme===value&&<Check size={16} className="theme-check"/>}</button>)}</div></section><section className="panel settings-panel"><div className="settings-heading"><UserRound size={22}/><div><h3>Мій профіль</h3><p>Акаунт PayTakt</p></div></div><div className="setting-info"><span>Ім’я</span><strong>{session.name}</strong></div><div className="setting-info"><span>Електронна пошта</span><strong>{session.email || 'Деморежим'}</strong></div><div className="setting-info"><span>Тип входу</span><strong>{session.demo?'Демонстрація':'Електронна пошта'}</strong></div></section><section className="panel settings-panel settings-wide"><div className="settings-heading"><BriefcaseBusiness size={22}/><div><h3>Робочі простори</h3><p>Особисті записи та компанії не змішуються.</p></div></div><div className="workspace-rows">{workspaces.map(w=><div className="workspace-row" key={w.id}><div className="workspace-symbol">{w.kind==='company'?<Building2 size={19}/>:<UserRound size={19}/>}</div><div><strong>{w.name}</strong><small>{w.kind==='company'?'Компанія':'Особистий простір'}</small></div>{w.id===workspace.id&&<span className="pill mint-pill">Активний</span>}</div>)}</div><button type="button" className="btn btn-outline" onClick={onCreate}><Plus size={17}/> Додати компанію</button></section></div>
  </>
}

function CreateWorkspaceDialog({onClose,onCreate}:{onClose:()=>void;onCreate:(kind:WorkspaceKind,name:string)=>Promise<void>}){
  const [name,setName]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await onCreate('company',name.trim());onClose()}catch(err){setError(friendlyError(err))}finally{setBusy(false)}}
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div className="modal-icon"><Building2 size={22}/></div><button className="icon-button" type="button" aria-label="Закрити" onClick={onClose}><X size={20}/></button></div><h2 id="modal-title">Нова компанія</h2><p>Створи окремий робочий простір для графіка команди. Запрошення працівників додамо пізніше.</p><form onSubmit={submit}><label>Назва компанії<input autoFocus required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Наприклад, Моя команда"/></label>{error&&<p role="alert" className="form-error">{error}</p>}<button type="submit" disabled={busy||name.trim().length<2} className="btn btn-primary full">{busy?'Створюємо…':'Створити простір'}<ArrowRight size={17}/></button></form></div></div>
}

export default function App(){
  const [theme,setTheme]=useState<ThemeChoice>(readTheme)
  const [session,setSession]=useState<Session|null>(null)
  const [loading,setLoading]=useState(firebaseReady)
  const [demo,setDemo]=useState(false)
  const [error,setError]=useState('')
  const [workspaces,setWorkspaces]=useState<Workspace[]>([])
  const [workspace,setWorkspace]=useState<Workspace|null>(null)
  const [shifts,setShifts]=useState<Shift[]>([])
  const [shiftsLoaded,setShiftsLoaded]=useState(false)
  const [forceWizard,setForceWizard]=useState(false)
  const [templates,setTemplates]=useState<ScheduleTemplate[]>([])
  const [overtimePreset,setOvertimePreset]=useState<OvertimePreset>(defaultOvertimePreset)
  const [overtimePresetError,setOvertimePresetError]=useState('')
  const [paySettings,setPaySettings]=useState<PaySettings|null>(null)
  const [demoPaySettings,setDemoPaySettings]=useState<Record<string,PaySettings>>({})
  const [payLoaded,setPayLoaded]=useState(false)
  const [payError,setPayError]=useState('')
  const [performance,setPerformance]=useState<PerformanceSettings>(defaultPerformanceSettings)
  const [performanceError,setPerformanceError]=useState('')
  const [performanceLoaded,setPerformanceLoaded]=useState(false)
  const [dailyWages,setDailyWages]=useState<Record<string,number>>({})
  const [wagesLoaded,setWagesLoaded]=useState(false)
  const [monthlyTargets,setMonthlyTargets]=useState<Record<string,number>>({})
  const [targetsLoaded,setTargetsLoaded]=useState(false)
  const [cashRecords,setCashRecords]=useState<DailyCash[]>([])
  const [cashPrefs,setCashPrefs]=useState<CashPreferences>(defaultCashPreferences)
  const [cashError,setCashError]=useState('')
  const [cashLoaded,setCashLoaded]=useState(false)
  const [salesByMonth,setSalesByMonth]=useState<Record<string,number>>({})
  const [demoSalesByWorkspace,setDemoSalesByWorkspace]=useState<Record<string,Record<string,number>>>({})
  const [salesLoaded,setSalesLoaded]=useState(false)
  const [salesError,setSalesError]=useState('')
  const [unitsByMonth,setUnitsByMonth]=useState<Record<string,number>>({})
  const [demoUnitsByWorkspace,setDemoUnitsByWorkspace]=useState<Record<string,Record<string,number>>>({})
  const [unitsLoaded,setUnitsLoaded]=useState(false)
  const [unitsError,setUnitsError]=useState('')
  const [page,setPage]=useState<Page>('calendar')
  const [suggestedPreset,setSuggestedPreset]=useState<TemplatePreset>('2/2')
  const [setupPayDraft,setSetupPayDraft]=useState<PaySettings|null>(null)
  const [mobileMenu,setMobileMenu]=useState(false)
  const [workspaceMenu,setWorkspaceMenu]=useState(false)
  const [createOpen,setCreateOpen]=useState(false)
  const [shiftsError,setShiftsError]=useState('')
  const [emailVerified,setEmailVerified]=useState(false)
  const [verificationMessage,setVerificationMessage]=useState('')

  const setThemeChoice=useCallback((value:ThemeChoice)=>{
    setTheme(value)
    try{localStorage.setItem('paytakt-theme',value)}catch{/* non-critical */}
    if(session && !session.demo)updateProfileTheme(session.uid,value).catch(()=>undefined)
  },[session])
  useEffect(()=>{
    const mq=window.matchMedia('(prefers-color-scheme: dark)')
    const apply=()=>{
      const dark=theme==='dark'||(theme==='system'&&mq.matches)
      document.documentElement.dataset.theme=dark?'dark':'light'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#0c1425':'#f4f7fb')
    }
    apply();mq.addEventListener('change',apply);return()=>mq.removeEventListener('change',apply)
  },[theme])
  useEffect(()=>{
    if(demo || !auth){setLoading(false);return}
    let live=true
    const unsubscribe=onAuthStateChanged(auth,async user=>{
      if(!live)return
      if(!user){setSession(null);setWorkspace(null);setWorkspaces([]);setEmailVerified(false);setLoading(false);return}
      setLoading(true);setError('')
      try{
        setEmailVerified(user.emailVerified)
        const profile=await ensureProfile(user)
        if(!live)return
        const userSession={uid:user.uid,email:user.email||'',name:profile.name,demo:false}
        setSession(userSession)
        if(profile.theme==='light'||profile.theme==='dark'||profile.theme==='system'){
          setTheme(profile.theme)
          try{localStorage.setItem('paytakt-theme',profile.theme)}catch{/* local setting optional */}
        }
        let list=await loadWorkspaces(user.uid)
        if(!list.length){const personal=await createWorkspace(user.uid,'personal','Мій особистий простір');list=[personal]}
        if(!live)return
        setWorkspaces(list)
        let wanted=''
        try{wanted=localStorage.getItem(`paytakt-workspace:${user.uid}`)||''}catch{/* optional */}
        const selectedWorkspace=list.find(x=>x.id===wanted)||list[0]
        setWorkspace(selectedWorkspace)
        // Persist initial selection as well as explicit menu choices. Without this,
        // a refreshed session may choose a different workspace from unordered reads.
        try{localStorage.setItem(`paytakt-workspace:${user.uid}`,selectedWorkspace.id)}catch{/* optional */}
      }catch(err){if(live)setError(friendlyError(err))}finally{if(live)setLoading(false)}
    },err=>{if(live){setError(friendlyError(err));setLoading(false)}})
    return()=>{live=false;unsubscribe()}
  },[demo])
  useEffect(()=>{
    if(!session||!workspace){setShiftsLoaded(false);return}
    if(session.demo){setShifts(demoShifts());setShiftsLoaded(true);setShiftsError('');return}
    setShifts([]);setShiftsLoaded(false);setShiftsError('')
    return subscribeShifts(workspace.id,items=>{setShifts(items);setShiftsLoaded(true)},err=>{setShiftsError(friendlyError(err));setShiftsLoaded(true)})
  },[session?.uid,workspace?.id])

  useEffect(()=>{
    if(!session||!workspace)return
    if(session.demo){setTemplates([]);return}
    setTemplates([])
    return subscribeTemplates(workspace.id,setTemplates,err=>setShiftsError(friendlyError(err)))
  },[session?.uid,workspace?.id])
  useEffect(()=>{
    if(!session||!workspace){setOvertimePreset(defaultOvertimePreset);return}
    if(session.demo){setOvertimePreset(defaultOvertimePreset);return}
    setOvertimePreset(defaultOvertimePreset);setOvertimePresetError('')
    return subscribeOvertimePreset(workspace.id,preset=>setOvertimePreset(preset??defaultOvertimePreset),e=>setOvertimePresetError(friendlyError(e)))
  },[session?.uid,workspace?.id])
  useEffect(()=>{
    if(!session||!workspace){setPaySettings(null);setPayLoaded(false);return}
    if(session.demo){setPaySettings(demoPaySettings[workspace.id]??null);setPayLoaded(true);setPayError('');return}
    setPaySettings(null);setPayLoaded(false);setPayError('')
    return subscribePaySettings(workspace.id,value=>{setPaySettings(value);setPayLoaded(true)},err=>{setPayError(friendlyError(err));setPayLoaded(true)})
  },[session?.uid,workspace?.id])
  useEffect(()=>{
    if(!session||!workspace){setSalesByMonth({});setSalesLoaded(false);return}
    if(session.demo){setSalesByMonth(demoSalesByWorkspace[workspace.id]??{});setSalesLoaded(true);setSalesError('');return}
    setSalesByMonth({});setSalesLoaded(false);setSalesError('')
    return subscribeMonthlySales(workspace.id,items=>{setSalesByMonth(items);setSalesLoaded(true)},err=>{setSalesError(friendlyError(err));setSalesLoaded(true)})
  },[session?.uid,workspace?.id])
  useEffect(()=>{
    if(!session||!workspace){setUnitsByMonth({});setUnitsLoaded(false);return}
    if(session.demo){setUnitsByMonth(demoUnitsByWorkspace[workspace.id]??{});setUnitsLoaded(true);setUnitsError('');return}
    setUnitsByMonth({});setUnitsLoaded(false);setUnitsError('')
    return subscribeMonthlyUnits(workspace.id,items=>{setUnitsByMonth(items);setUnitsLoaded(true)},err=>{setUnitsError(friendlyError(err));setUnitsLoaded(true)})
  },[session?.uid,workspace?.id])
  useEffect(()=>{
    if(!session||!workspace){setCashRecords([]);setCashPrefs(defaultCashPreferences);setCashLoaded(false);return}
    if(session.demo){setCashLoaded(true);setCashError('');return}
    setCashRecords([]);setCashPrefs(defaultCashPreferences);setCashLoaded(false);setCashError('')
    const offRecords=subscribeDailyCash(workspace.id,setCashRecords,e=>setCashError(friendlyError(e)))
    const offSettings=subscribeCashPreferences(workspace.id,p=>{setCashPrefs(p);setCashLoaded(true)},e=>{setCashError(friendlyError(e));setCashLoaded(true)})
    return()=>{offRecords();offSettings()}
  },[session?.uid,workspace?.id])
  useEffect(()=>{
    if(!session||!workspace){setPerformance(defaultPerformanceSettings);setMonthlyTargets({});setDailyWages({});setWagesLoaded(false);setPerformanceLoaded(false);setTargetsLoaded(false);return}
    if(session.demo){setPerformance(defaultPerformanceSettings);setMonthlyTargets({});setDailyWages({});setWagesLoaded(true);setPerformanceLoaded(true);setTargetsLoaded(true);return}
    setPerformance(defaultPerformanceSettings);setMonthlyTargets({});setDailyWages({});setWagesLoaded(false);setPerformanceLoaded(false);setTargetsLoaded(false);setPerformanceError('')
    const offSettings=subscribePerformanceSettings(workspace.id,v=>{setPerformance(v);setPerformanceError('');setPerformanceLoaded(true)},e=>{setPerformanceError(friendlyError(e));setPerformanceLoaded(true)})
    const offTargets=subscribeMonthlyTargets(workspace.id,v=>{setMonthlyTargets(v);setTargetsLoaded(true)},e=>{setPerformanceError(friendlyError(e));setTargetsLoaded(true)})
    const offWages=subscribeDailyWages(workspace.id,v=>{setDailyWages(v);setWagesLoaded(true)},e=>{setPerformanceError(friendlyError(e));setWagesLoaded(true)})
    return()=>{offSettings();offTargets();offWages()}
  },[session?.uid,workspace?.id])
  const cashByMonth=useMemo(()=>cashTotalsByMonth(cashRecords,shifts),[cashRecords,shifts])
  const onSavePerformance=async(next:PerformanceSettings)=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    validatePerformanceSettings(next)
    if(!session.demo)await savePerformanceSettings(workspace.id,next)
    setPerformance(next)
  }
  const onSaveDailyWage=async(date:string,amount:number)=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    if(!session.demo)await saveDailyWage(workspace.id,{date,amount})
    setDailyWages(old=>({...old,[date]:amount}))
  }
  const onRemoveDailyWage=async(date:string)=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    if(!session.demo)await removeDailyWage(workspace.id,date)
    setDailyWages(old=>{const next={...old};delete next[date];return next})
  }
  const onSaveTarget=async(month:string,amount:number)=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    const target:MonthlyTarget={month,amount}
    if(!session.demo)await saveMonthlyTarget(workspace.id,target)
    setMonthlyTargets(old=>({...old,[month]:amount}))
  }
  const onResetTarget=async(month:string)=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    if(!session.demo)await removeMonthlyTarget(workspace.id,month)
    setMonthlyTargets(old=>{const next={...old};delete next[month];return next})
  }
  // Keep the ordinary month sales and the optional cash register separate by default.
  const effectiveSales=useMemo(()=>effectiveRevenue(salesByMonth,cashRecords,shifts,cashPrefs),[salesByMonth,cashRecords,shifts,cashPrefs])
  // Brand-new workspaces enter the guided wizard only after both relevant subscriptions load.
  // Existing calendars and existing payroll settings are never forced through onboarding.
  const onSaveMonthlyUnits=async(record:MonthlyUnits)=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    if(session.demo){
      setDemoUnitsByWorkspace(old=>({...old,[workspace.id]:{...(old[workspace.id]??{}),[record.month]:record.count}}))
      setUnitsByMonth(old=>({...old,[record.month]:record.count}))
      return
    }
    await saveMonthlyUnits(workspace.id,record)
  }
  const onSaveMonthlySales=async(record:MonthlySales)=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    if(session.demo){
      setDemoSalesByWorkspace(old=>({...old,[workspace.id]:{...(old[workspace.id]??{}),[record.month]:record.amount}}))
      setSalesByMonth(old=>({...old,[record.month]:record.amount}))
      return
    }
    await saveMonthlySales(workspace.id,record)
  }
  const onChangeCashPrefs=async(p:CashPreferences)=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    if(!session.demo)await saveCashPreferences(workspace.id,p)
    setCashPrefs(p)
  }
  const onSaveCash=async(record:DailyCash)=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    if(!session.demo)await saveDailyCash(workspace.id,record)
    setCashRecords(old=>[...old.filter(x=>x.date!==record.date),record])
  }
  const onDeleteCash=async(date:string)=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    if(!session.demo)await removeDailyCash(workspace.id,date)
    setCashRecords(old=>old.filter(x=>x.date!==date))
  }
  const onSavePay=async(settings:PaySettings)=>{
    if(!workspace||!session)throw Error('Робочий простір не обрано')
    if(session.demo){setDemoPaySettings(old=>({...old,[workspace.id]:settings}));setPaySettings(settings);setPayLoaded(true);setSetupPayDraft(null);return}
    await savePaySettings(workspace.id,settings)
    setSetupPayDraft(null)
  }
  const onApplyZmina=async()=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    // Preserve personal salary rates. Only replace payday dates and activate the optional module.
    const pay={...(paySettings??defaultPaySettings),paymentRules:defaultPaymentRules.map(rule=>({...rule}))}
    await onSavePay(pay)
    await onChangeCashPrefs({enabled:true,useForSales:true})
    await onSavePerformance({version:1,enabled:true,manualDailyPay:false,metric:'cash',defaultTarget:0,tiers:[{id:'goal100',thresholdBasisPoints:10000,bonus:200000}]})
  }
  const onSaveOvertimePreset=async(preset:OvertimePreset)=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    validateOvertimePreset(preset)
    if(!session.demo)await saveOvertimePreset(workspace.id,preset)
    setOvertimePreset({...preset})
  }
  const onSaveTemplate=async(template:ScheduleTemplate)=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    if(session.demo){setTemplates(old=>[...old.filter(t=>t.id!==template.id),template]);return}
    await saveTemplate(workspace.id,template)
  }
  const onDeleteTemplate=async(id:string)=>{
    if(!session||!workspace)throw Error('Робочий простір не обрано')
    if(session.demo){setTemplates(old=>old.filter(t=>t.id!==id));return}
    await deleteTemplate(workspace.id,id)
  }
  const chooseSetup=async(sector:Sector,preset:JobPreset)=>{
    if(preset.id==='create-self'){
      // Creating a custom schedule does not require a pay-settings write. The user
      // can choose a salary model later without changing existing pay settings.
      setSetupPayDraft(null)
      setSuggestedPreset('custom')
      setPage('calendar')
      return
    }
    const newRules:PaySettings={...(paySettings??defaultPaySettings),mode:preset.mode,sector,
      unitName:preset.unitName,monthlyNormSource:'calendar',overtimeEntryMode:'marked',markedOvertimeBasisPoints:12000,bandEnabled:false}
    // Only stage the chosen salary mode locally. Applying a schedule template
    // must not write paySettings/current (which may be denied by deployed rules).
    // The user reviews and saves salary rules explicitly on the Rules page.
    setSetupPayDraft(newRules)
    setSuggestedPreset(preset.shift)
    setPage('calendar')
  }
  const enterDemo=()=>{
    const personal={id:'demo-personal',name:'Мій особистий простір',kind:'personal' as const,role:'owner' as const}
    const company={id:'demo-company',name:'Демо-компанія',kind:'company' as const,role:'owner' as const}
    setDemo(true);setSession({uid:'demo',email:'',name:'Гість',demo:true});setWorkspaces([personal,company]);setWorkspace(personal);setPage('dashboard');setLoading(false)
  }
  const logout=async()=>{
    setSetupPayDraft(null)
    setMobileMenu(false);setWorkspaceMenu(false);setForceWizard(false);setPage('calendar')
    if(session?.demo){setDemo(false);setSession(null);setWorkspaces([]);setWorkspace(null);setShifts([]);setPaySettings(null);setSalesByMonth({});setUnitsByMonth({});return}
    if(auth){try{await signOut(auth)}catch(e){setError(friendlyError(e))}}
  }
  const selectWorkspace=(w:Workspace)=>{setPayLoaded(false);setShiftsLoaded(false);setSetupPayDraft(null);setWorkspace(w);setWorkspaceMenu(false);setMobileMenu(false);setForceWizard(false);setPage('calendar');try{localStorage.setItem(`paytakt-workspace:${session?.uid}`,w.id)}catch{/* optional */}}
  const createCompany=async(kind:WorkspaceKind,name:string)=>{
    if(!session)throw Error('Увійди в акаунт')
    let created:Workspace
    if(session.demo){created={id:`demo-company-${Date.now()}`,name,kind,role:'owner'}}
    else created=await createWorkspace(session.uid,kind,name)
    setWorkspaces(old=>[...old,created]);selectWorkspace(created)
  }
  const onSave=async(shift:Shift)=>{
    if(!workspace||!session)throw Error('Робочий простір не обрано')
    validateDay(shift)
    if(session.demo){setShifts(old=>[...old.filter(x=>x.date!==shift.date),shift]);return}
    await saveShift(workspace.id,shift)
  }
  const onApplyPattern=async(generated:GeneratedCalendarDay[],mode:PatternApplyMode):Promise<PatternApplySummary>=>{
    if(!workspace||!session)throw Error('Робочий простір не обрано')
    if(session.demo){
      const planned=planPatternApplication(generated,shifts,mode)
      if(planned.write.length){
        const dates=new Set(planned.write.map(s=>s.date))
        setShifts(old=>[...old.filter(s=>!dates.has(s.date)),...planned.write])
      }
      return planned.summary
    }
    return applyMonthlyPattern(workspace.id,generated,mode)
  }
  const resendVerification=async()=>{
    if(!auth?.currentUser)return
    try{await sendEmailVerification(auth.currentUser);setVerificationMessage('Лист підтвердження відправлено. Перевір пошту та папку «Спам».')}
    catch(e){setVerificationMessage(friendlyError(e))}
  }
  const refreshVerification=async()=>{
    if(!auth?.currentUser)return
    try{await reload(auth.currentUser);setEmailVerified(auth.currentUser.emailVerified);setVerificationMessage(auth.currentUser.emailVerified?'Email підтверджено.':'Підтвердження ще не отримано.')}
    catch(e){setVerificationMessage(friendlyError(e))}
  }
  const onDelete=async(date:string)=>{
    if(!workspace||!session)throw Error('Робочий простір не обрано')
    if(session.demo){setShifts(old=>old.filter(s=>s.date!==date));return}
    await deleteShift(workspace.id,date)
  }
  const finishOnboarding=async(draft:OnboardingDraft)=>{
    if(!session||!workspace)throw Error('Обери робочий простір.')
    validateOnboardingDraft(draft)
    const salary=makeOnboardingPaySettings(draft)
    const plan=makeOnboardingPerformance(draft)
    const pattern=schedulePattern(draft)
    const monthKeys=onboardingMonthKeys()
    const anchor=draft.preset===WEEKDAY_FIVE_TWO_PRESET?mondayOfWeek(`${monthKeys[0]}-01`):draft.anchorDate
    // Apply only missing days. Never overwrite recorded shifts, leaves or previously confirmed work.
    for(const month of monthKeys){
      const generated=onboardingCalendarDays(draft,month,anchor)
      await onApplyPattern(generated,'missing')
    }
    await onSaveTemplate({id:'onboarding-main',name:'Мій основний графік',anchorDate:anchor,pattern})
    await onChangeCashPrefs({enabled:draft.cash||draft.plan&&draft.planMetric==='cash',useForSales:false})
    await onSavePerformance(plan)
    if(draft.overtimeMode!=='none'){
      // The wizard's duration and percentage must reach the real calendar preset,
      // including when the calendar hides its one-tap button in automatic mode.
      await onSaveOvertimePreset(onboardingOvertimePreset(draft))
    }
    // Write pay settings last. An unsuccessful setup never silently marks itself completed.
    await onSavePay(salary)
    setPaySettings(salary)
    setPayLoaded(true)
    setSuggestedPreset(draft.preset)
    setForceWizard(false)
    setPage('calendar')
  }
  let wizardDraftPresent=false
  if(session&&workspace){try{wizardDraftPresent=Boolean(localStorage.getItem(`paytakt-wizard-v2:${session.uid}:${workspace.id}`))}catch{/* no local storage */}}
  const newWorkspaceNeedsWizard=payLoaded&&shiftsLoaded&&!paySettings&&!payError&&!shiftsError&&(shifts.length===0||wizardDraftPresent)
  const allowedNav=useMemo(()=>nav.filter(n=>!n.companyOnly||workspace?.kind==='company'),[workspace?.kind])
  const navigate=(p:Page)=>{setPage(p);setMobileMenu(false)}
  if(loading)return <div className="loading-screen"><Logo/><div className="spinner"/><p>Готуємо твій робочий простір…</p></div>
  if(!session)return <AuthScreen onDemo={enterDemo}/>
  if(!workspace)return <div className="loading-screen"><Logo/><div className="firebase-note wide">{error||'Не вдалося відкрити робочий простір. Перевір доступ до акаунта.'}</div><button type="button" className="btn btn-outline" onClick={logout}>Вийти з акаунта</button></div>
  if(!session.demo&&(!payLoaded||!shiftsLoaded))return <div className="loading-screen"><Logo/><div className="spinner"/><p>Завантажуємо графік і правила роботи…</p></div>
  if(forceWizard||newWorkspaceNeedsWizard)return <OnboardingWizard key={`${session.uid}:${workspace.id}`} workspaceKey={`${session.uid}:${workspace.id}`} workspaceName={workspace.name} isExisting={Boolean(paySettings||shifts.length)} onComplete={finishOnboarding} onCancel={forceWizard?()=>setForceWizard(false):undefined}/>
  return <div className="app-shell zmina-shell">
    <header className="zmina-site-header">
      <div className="zmina-header-main">
        <button type="button" className="zmina-brand-home" onClick={()=>navigate('dashboard')} aria-label="PayTakt — головна"><Logo/></button>
        <div className="zmina-workspace-switcher">
          <button className="workspace-picker" type="button" onClick={()=>setWorkspaceMenu(v=>!v)} aria-expanded={workspaceMenu} aria-label="Обрати робочий простір">
            <span className="workspace-icon">{workspace.kind==='company'?<Building2 size={18}/>:<BriefcaseBusiness size={18}/>}</span>
            <span className="workspace-name"><strong>{workspace.name}</strong><small>{workspace.kind==='company'?'Компанія':'Особистий простір'}</small></span>
            <ChevronDown size={15}/>
          </button>
          {workspaceMenu&&<div className="workspace-popover">{workspaces.map(w=><button type="button" key={w.id} className={workspace.id===w.id?'current':''} onClick={()=>selectWorkspace(w)}>{w.kind==='company'?<Building2 size={16}/>:<UserRound size={16}/>}<span>{w.name}</span>{workspace.id===w.id&&<Check size={15}/>}</button>)}<button type="button" className="create-space" onClick={()=>{setWorkspaceMenu(false);setCreateOpen(true)}}><Plus size={16}/> Нова компанія</button></div>}
        </div>
        <div className="zmina-header-tools">
          <ThemeControls value={theme} onChange={setThemeChoice}/>
          <button type="button" className="zmina-profile-btn" onClick={()=>navigate('settings')} aria-label="Налаштування профілю" title={session.name}><UserRound size={19}/></button>
          <button type="button" className="zmina-logout-btn" onClick={logout} aria-label="Вийти" title="Вийти"><LogOut size={18}/></button>
          <button type="button" className="zmina-nav-toggle" onClick={()=>setMobileMenu(v=>!v)} aria-expanded={mobileMenu} aria-controls="zmina-primary-nav" aria-label={mobileMenu?'Згорнути меню':'Відкрити меню'}>{mobileMenu?<X size={22}/>:<Menu size={22}/>}</button>
        </div>
      </div>
      <nav id="zmina-primary-nav" className={`zmina-primary-nav ${mobileMenu?'expanded':''}`} aria-label="Основна навігація">{allowedNav.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} onClick={()=>navigate(item.id)} className={page===item.id?'active':''} aria-current={page===item.id?'page':undefined}><Icon size={17}/><span>{item.title}</span></button>})}</nav>
    </header>
    <div className="main-column">
      <main className="main-content">{session.demo&&<div className="demo-banner"><Sparkles size={16}/><span><strong>Демоверсія.</strong> Зміни календаря й налаштування зарплати тут тимчасові.</span><button type="button" onClick={logout}>До реєстрації <ArrowRight size={15}/></button></div>}{error&&<div className="alert-banner" role="alert">{error}</div>}{overtimePresetError&&<div className="alert-banner" role="alert">Налаштування понаднормових: {overtimePresetError}</div>}{shiftsError&&<div className="alert-banner" role="alert">Не вдалося прочитати зміни: {shiftsError}</div>}{payError&&<div className="alert-banner" role="alert">Налаштування зарплати: {payError}</div>}{salesError&&<div className="alert-banner" role="alert">Показники продажів: {salesError}</div>}{cashError&&<div className="alert-banner" role="alert">Каса: {cashError}</div>}{verificationMessage&&<div className="alert-banner" role="status">{verificationMessage}<button className="small-dismiss" onClick={()=>setVerificationMessage('')} type="button" aria-label="Закрити повідомлення"><X size={16}/></button></div>}
        {setupPayDraft&&<div className="alert-banner" role="status">Ти вибрав шаблон оплати, але його правила ще не збережено. Після налаштування графіка відкрий «Правила оплати», перевір ставку й натисни «Зберегти». <button type="button" className="btn btn-outline" onClick={()=>navigate('rules')}>Відкрити правила оплати</button></div>}
        <div className="page-motion" key={`${workspace.id}:${page}`}>
        {page==='setup'&&<SetupPage key={workspace.id} settings={paySettings} loaded={payLoaded} onChoose={chooseSetup}/>}
        {page==='dashboard'&&<Dashboard workspace={workspace} shifts={shifts} paySettings={payLoaded?paySettings:null} performance={performance} monthlyTargets={monthlyTargets} cashByMonth={cashByMonth} dailyWages={dailyWages} salesByMonth={effectiveSales} unitsByMonth={unitsByMonth} onGoCalendar={()=>navigate('calendar')} onCreateCompany={()=>setCreateOpen(true)} onGoPay={()=>navigate('pay')} onGoStatistics={()=>navigate('statistics')}/>}
        {page==='calendar'&&<CalendarPage key={`${workspace.id}-${suggestedPreset}`} initialPreset={suggestedPreset} shifts={shifts} workspace={workspace} demo={session.demo} templates={templates} overtimePreset={overtimePreset} paySettings={payLoaded?paySettings:null} cashRecords={cashRecords} cashPrefs={cashPrefs} performance={performance} monthlyTargets={monthlyTargets} cashByMonth={cashByMonth} dailyWages={dailyWages} onSaveDailyWage={onSaveDailyWage} onRemoveDailyWage={onRemoveDailyWage} onSaveCash={onSaveCash} onDeleteCash={onDeleteCash} salesByMonth={effectiveSales} unitsByMonth={unitsByMonth} onGoStatistics={()=>navigate('statistics')} onSaveOvertimePreset={onSaveOvertimePreset} onSaveTemplate={onSaveTemplate} onDeleteTemplate={onDeleteTemplate} onSave={onSave} onApplyPattern={onApplyPattern} onDelete={onDelete}/>}
        {page==='statistics'&&<StatisticsPage key={workspace.id} workspaceName={workspace.name} shifts={shifts} settings={payLoaded?paySettings:null} cashRecords={cashRecords} cashPrefs={cashPrefs} performance={performance} monthlyTargets={monthlyTargets} onSaveTarget={onSaveTarget} onResetTarget={onResetTarget} dailyWages={dailyWages} salesByMonth={effectiveSales} unitsByMonth={unitsByMonth} onCalendar={()=>navigate('calendar')} onRules={()=>navigate('rules')} onPay={()=>navigate('pay')}/>}
        {performanceError&&<div className="alert-banner" role="alert">{performanceError}</div>}
        {page==='pay'&&unitsError&&<p className="form-error" role="alert">{unitsError}</p>}
        {page==='pay'&&<PayPageV5 key={workspace.id} workspaceName={workspace.name} shifts={shifts} settings={paySettings} performance={performance} targets={monthlyTargets} cashByMonth={cashByMonth} dailyWages={dailyWages} loaded={payLoaded&&salesLoaded&&unitsLoaded&&cashLoaded&&performanceLoaded&&targetsLoaded&&wagesLoaded} salesFromCash={cashPrefs.enabled&&cashPrefs.useForSales} salesByMonth={effectiveSales} onSaveMonthlySales={onSaveMonthlySales} unitsByMonth={unitsByMonth} onSaveMonthlyUnits={onSaveMonthlyUnits} demo={session.demo} goToRules={()=>navigate('rules')}/>}
        {page==='rules'&&<RulesPageV5 key={workspace.id} shifts={shifts} workspaceName={workspace.name} settings={setupPayDraft??paySettings} loaded={payLoaded} demo={session.demo} onSave={onSavePay} performance={performance} onSavePerformance={onSavePerformance} onApplyZmina={onApplyZmina}/>}
        {page==='team'&&workspace.kind==='company'&&<TeamPage workspace={workspace}/>}
        {page==='settings'&&<section className="panel v2-settings-actions">
          <div className="v2-settings-head"><div><h3>Налаштування твоєї роботи</h3><p>Персональний майстер або точні правила — обирай зручний спосіб.</p></div></div>
          <div className="v2-settings-links">
            <button type="button" className="btn btn-primary" onClick={()=>setForceWizard(true)}><Sparkles size={17}/> Пройти майстер</button>
            <button type="button" className="btn btn-outline" onClick={()=>navigate('rules')}><SlidersHorizontal size={17}/> Правила оплати</button>
            <a className="btn btn-outline" href="#schedule-settings"><CalendarDays size={17}/> Графік роботи</a>
            <button type="button" className="btn btn-outline" onClick={()=>navigate('pay')}>Деталі нарахувань</button>
          </div>
          <details className="v2-extra-features"><summary><span className="v2-extra-heading"><strong>Інші можливості, якщо вони потрібні</strong><small>Додаткові інструменти та поточні налаштування</small></span><ChevronDown size={19} className="v2-extra-chevron"/></summary>
            <div className="v2-extra-content">
              <p>Показуємо лише те, що ти обрав у майстрі. За потреби додаткові інструменти можна ввімкнути тут.</p>
              <div className="v2-extra-state">
                <span><strong>Понаднормові</strong><small>{!paySettings?.overtimeEnabled?'Не використовуються':paySettings.overtimeEntryMode==='marked'?`Кнопка · ${segmentHours(overtimePreset).toLocaleString('uk-UA',{maximumFractionDigits:2})} год · ${overtimePreset.basisPoints/100}%`:`Автоматично після ${paySettings.overtimeThresholdMinutes/60} год / день · ${paySettings.markedOvertimeBasisPoints/100}%`}</small></span>
                <span><strong>План і премії</strong><small>{performance.enabled?'Увімкнено':'Вимкнено'}</small></span>
                <span><strong>Оплата за день</strong><small>{performance.manualDailyPay?'Вводжу вручну':'Рахується автоматично'}</small></span>
              </div>
              <label className="onboard-toggle"><span><strong>Каса за день</strong></span><input type="checkbox" checked={cashPrefs.enabled} onChange={e=>void onChangeCashPrefs({enabled:e.target.checked,useForSales:e.target.checked?cashPrefs.useForSales:false})}/></label>
              {cashPrefs.enabled&&<label className="onboard-toggle"><span><strong>Каса впливає на % від виручки</strong></span><input type="checkbox" checked={cashPrefs.useForSales} onChange={e=>void onChangeCashPrefs({...cashPrefs,useForSales:e.target.checked})}/></label>}
              <button className="onboard-link" type="button" onClick={()=>navigate('rules')}>Змінити доплати, план і зарплату в правилах оплати</button>
            </div>
          </details>
        </section>}
        {page==='settings'&&<CalendarPage scheduleOnly key={`${workspace.id}-schedule-${suggestedPreset}`} initialPreset={suggestedPreset} shifts={shifts} workspace={workspace} demo={session.demo} templates={templates} overtimePreset={overtimePreset} paySettings={payLoaded?paySettings:null} cashRecords={cashRecords} cashPrefs={cashPrefs} performance={performance} monthlyTargets={monthlyTargets} cashByMonth={cashByMonth} dailyWages={dailyWages} onSaveDailyWage={onSaveDailyWage} onRemoveDailyWage={onRemoveDailyWage} onSaveCash={onSaveCash} onDeleteCash={onDeleteCash} salesByMonth={effectiveSales} unitsByMonth={unitsByMonth} onGoStatistics={()=>navigate('statistics')} onSaveOvertimePreset={onSaveOvertimePreset} onSaveTemplate={onSaveTemplate} onDeleteTemplate={onDeleteTemplate} onSave={onSave} onApplyPattern={onApplyPattern} onDelete={onDelete}/>}
        {page==='settings'&&<SettingsPage session={session} workspace={workspace} workspaces={workspaces} theme={theme} setTheme={setThemeChoice} onCreate={()=>setCreateOpen(true)} emailVerified={emailVerified} onVerify={resendVerification} onRefreshVerification={refreshVerification}/>}
        </div>
        <footer className="main-footer"><span>© {new Date().getFullYear()} PayTakt. Твій графік. Твої правила.</span><span>Версія 2.0.0 beta 4</span></footer>
      </main>
    </div>
    {createOpen&&<CreateWorkspaceDialog onClose={()=>setCreateOpen(false)} onCreate={createCompany}/>}
  </div>
}
