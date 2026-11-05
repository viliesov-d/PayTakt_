import {Bell,BellOff,Clock3,CalendarDays,Wallet,AlertCircle} from 'lucide-react'
import type {ReminderPreferences} from '../lib/reminderPlan.ts'
import {tr} from '../lib/presentation.ts'

type Props={
  supported:boolean
  prefs:ReminderPreferences
  scheduled:number
  busy:boolean
  error:string
  onEnable:()=>Promise<void>
  onChange:(prefs:ReminderPreferences)=>void
}
export function NotificationSettings({supported,prefs,scheduled,busy,error,onEnable,onChange}:Props){
  const toggle=(key:'shiftStart'|'tomorrow'|'payday',value:boolean)=>{
    onChange({...prefs,[key]:value})
  }
  return <section className="panel settings-panel settings-wide paytakt-reminders">
    <div className="settings-heading"><Bell size={22}/><div>
      <h3>{tr('Нагадування Android')}</h3>
      <p>{tr('Про зміни та заплановані виплати, навіть коли застосунок закритий.')}</p>
    </div></div>
    {!supported&&<p className="paytakt-reminder-note">{tr('Нагадування доступні у встановленому Android-застосунку PayTakt. У браузері вони не плануються.')}</p>}
    {supported&&!prefs.enabled&&<button type="button" className="btn btn-primary paytakt-reminder-enable" disabled={busy} onClick={()=>void onEnable()}>
      <Bell size={17}/>{busy?tr('Налаштовуємо…'):tr('Увімкнути нагадування')}
    </button>}
    {supported&&prefs.enabled&&<>
      <div className="paytakt-reminder-summary"><span><Bell size={15}/>{tr('Нагадування ввімкнено')}</span>
        <span>{tr('Заплановано')}: {scheduled}</span></div>
      <label className="paytakt-reminder-option"><span><Clock3 size={19}/><span><strong>{tr('Перед початком зміни')}</strong><small>{tr('Завчасно перед запланованим робочим днем')}</small></span></span>
        <input type="checkbox" checked={prefs.shiftStart} disabled={busy} onChange={e=>toggle('shiftStart',e.target.checked)}/>
      </label>
      {prefs.shiftStart&&<label className="paytakt-reminder-field">{tr('Нагадати за')}
        <select value={prefs.leadMinutes} disabled={busy} onChange={e=>onChange({...prefs,leadMinutes:Number(e.target.value) as ReminderPreferences['leadMinutes']})}>
          <option value="15">15 {tr('хвилин')}</option>
          <option value="30">30 {tr('хвилин')}</option>
          <option value="60">1 {tr('годину')}</option>
          <option value="120">2 {tr('години')}</option>
        </select>
      </label>}
      <label className="paytakt-reminder-option"><span><CalendarDays size={19}/><span><strong>{tr('Про завтрашню зміну')}</strong><small>{tr('Нагадування напередодні робочого дня')}</small></span></span>
        <input type="checkbox" checked={prefs.tomorrow} disabled={busy} onChange={e=>toggle('tomorrow',e.target.checked)}/>
      </label>
      {prefs.tomorrow&&<label className="paytakt-reminder-field">{tr('Час нагадування')}
        <select value={prefs.tomorrowHour} disabled={busy} onChange={e=>onChange({...prefs,tomorrowHour:Number(e.target.value)})}>
          {Array.from({length:24},(_,h)=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
        </select>
      </label>}
      <label className="paytakt-reminder-option"><span><Wallet size={19}/><span><strong>{tr('Про виплату зарплати')}</strong><small>{tr('За встановленими датами виплат у правилах оплати')}</small></span></span>
        <input type="checkbox" checked={prefs.payday} disabled={busy} onChange={e=>toggle('payday',e.target.checked)}/>
      </label>
      {prefs.payday&&<label className="paytakt-reminder-field">{tr('Час нагадування')}
        <select value={prefs.paydayHour} disabled={busy} onChange={e=>onChange({...prefs,paydayHour:Number(e.target.value)})}>
          {Array.from({length:24},(_,h)=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
        </select>
      </label>}
      <button type="button" className="btn btn-outline paytakt-reminder-disable" disabled={busy}
        onClick={()=>onChange({...prefs,enabled:false})}><BellOff size={17}/>{tr('Вимкнути всі нагадування')}</button>
    </>}
    {error&&<p className="form-error" role="alert"><AlertCircle size={15}/>{error}</p>}
    <p className="paytakt-reminder-note">
      {tr('Дозвіл запитується лише під час увімкнення. Плануємо події на найближчі 28 днів і оновлюємо їх при відкритті застосунку. Android може показати нагадування із затримкою.')}
    </p>
  </section>
}
