import {useEffect,useMemo,useState} from 'react'
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Clock3,CalendarDays,BriefcaseBusiness,Sparkles,ShieldCheck} from 'lucide-react'
import {sectors,suggestions} from '../lib/professions'
import {type PayMode} from '../lib/salary'
import {type TemplatePreset} from '../lib/schedule'
import {type PlanMetric} from '../lib/performance'
import {isCashRelevantSector} from '../lib/featureVisibility'
import {visibleWizardSteps,initialOnboardingDraft,scheduleChoices,payChoices,previewOnboardingSchedule,validateOnboardingDraft,hryvniasToKopeks,overtimeDailyMinutes,type OnboardingDraft} from '../lib/onboarding'

const scheduleLabels:Record<TemplatePreset,string>={
  '5/2-weekdays':'5/2 — Пн–Пт робочі','2/2':'2 робочі / 2 вихідні','4/2':'4 робочі / 2 вихідні',
  '5/2':'5 робочих / 2 вихідні (цикл)','1/1':'День через день','2/1':'2/1','1/2':'1/2',
  '3/1':'3/1','3/3':'3/3','4/4':'4/4','6/1':'6/1','7/7':'7/7',
  'day-night-48':'День / ніч / 48 годин','night-2/2':'Нічні 2/2','duty-24-72':'Доба / 3 вихідні','custom':'Створи власний графік',
}
const payLabels:Record<PayMode,{title:string;sub:string;unit:string}>={
  monthly:{title:'Оклад за місяць',sub:'Ставка розподіляється на заплановані робочі дні',unit:'грн / місяць'},
  hourly:{title:'Оплата за годину',sub:'Залежить від фактично відпрацьованого часу',unit:'грн / год'},
  per_shift:{title:'За робочу зміну',sub:'Фіксована сума за підтверджену зміну',unit:'грн / зміну'},
  per_unit:{title:'За виконану роботу',sub:'За доставку, послугу, виріб чи іншу одиницю',unit:'грн / одиницю'},
}
function readDraft(key:string):OnboardingDraft {
  const base=initialOnboardingDraft()
  try{
    const raw=localStorage.getItem(key)
    if(!raw)return base
    const value=JSON.parse(raw) as Partial<OnboardingDraft>
    if(!value || typeof value!=='object'||!sectors.some(x=>x.id===value.sector))return base
    const next={...base,...value}
    if(value.overtimeMode===undefined&&value.overtime===true)next.overtimeMode='quick'
    if(!scheduleChoices(next.sector).includes(next.preset))next.preset=scheduleChoices(next.sector)[0]
    if(!payChoices(next.sector).includes(next.mode))next.mode=payChoices(next.sector)[0]
    return next
  }catch{return base}
}
const number=(value:string)=>Number(value.replace(',','.').replace(/\s/g,''))||0
const cash=(value:string)=>number(value).toLocaleString('uk-UA',{maximumFractionDigits:2})
const scheduleSummary=(d:OnboardingDraft)=>scheduleLabels[d.preset]||'Власний графік'

export function OnboardingWizard({workspaceKey,workspaceName,isExisting,onComplete,onCancel}:{
  workspaceKey:string;workspaceName:string;isExisting:boolean;
  onComplete:(draft:OnboardingDraft)=>Promise<void>;onCancel?:()=>void
}){
  const draftKey=`paytakt-wizard-v2:${workspaceKey}`
  const [draft,setDraft]=useState<OnboardingDraft>(()=>readDraft(draftKey))
  const [step,setStep]=useState(0)
  const activeSteps=useMemo(()=>visibleWizardSteps(draft.overtimeMode),[draft.overtimeMode])
  const currentStep=activeSteps[step]??'Перевірка'
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [showAll,setShowAll]=useState(false)
  const [showAllSectors,setShowAllSectors]=useState(false)
  const [showOtherFeatures,setShowOtherFeatures]=useState(false)
  const update=(next:Partial<OnboardingDraft>)=>{setDraft(old=>({...old,...next}));setError('')}
  useEffect(()=>{try{localStorage.setItem(draftKey,JSON.stringify(draft))}catch{/* Draft persistence is best-effort. */}},[draftKey,draft])
  const suggested=suggestions[draft.sector]
  const schedules=useMemo(()=>scheduleChoices(draft.sector),[draft.sector])
  const suggestedSchedules=[...new Set(suggested.map(x=>x.shift))]
  const shownSchedules=(showAll?schedules:suggestedSchedules.concat('custom' as const)).filter((x,i,arr)=>arr.indexOf(x)===i)
  const payModes=payChoices(draft.sector)
  const canUseCash=isCashRelevantSector(draft.sector)||showOtherFeatures||draft.cash
  const month=useMemo(()=>{try{return previewOnboardingSchedule(draft)}catch{return []}},[draft])
  const workDays=month.filter(x=>x.dayType==='work').length
  const stepNext=()=>{
    setError('')
    try{
      if(currentStep==='Графік')previewOnboardingSchedule(draft)
      if(currentStep==='Оплата'&&!draft.manualDailyPay){if(!draft.rate.trim()||hryvniasToKopeks(draft.rate)===0)throw Error('Вкажи суму оплати, щоб PayTakt міг рахувати зарплату.')}
      if(currentStep==='Понаднормові'&&draft.overtimeMode!=='none'){if(draft.manualDailyPay){if(!draft.overtimeHourlyRate.trim()||hryvniasToKopeks(draft.overtimeHourlyRate)===0)throw Error('Вкажи погодинну базу для понаднормових.')}if(draft.overtimePercent<100||draft.overtimePercent>1000)throw Error('Відсоток понаднормових: від 100% до 1000%.')}
      if(currentStep==='Години понаднормових'){overtimeDailyMinutes(draft);if(draft.overtimeMode==='automatic')previewOnboardingSchedule(draft)}
      if(currentStep==='Додаткові можливості'){if(draft.plan){const target=draft.planMetric==='units'?Number(draft.planTarget):hryvniasToKopeks(draft.planTarget);if(!Number.isSafeInteger(target)||target<=0)throw Error('Вкажи місячний план більше нуля.');hryvniasToKopeks(draft.planBonus)}}
      if(currentStep==='Виплати')validateOnboardingDraft(draft)
      setStep(i=>Math.min(i+1,activeSteps.length-1))
    }catch(e){setError(e instanceof Error?e.message:'Перевір відповіді на цьому кроці.')}
  }
  const finish=async()=>{
    setError('')
    try{
      validateOnboardingDraft(draft)
      setBusy(true)
      await onComplete(draft)
      try{localStorage.removeItem(draftKey)}catch{/* Optional cleanup. */}
    }catch(e){setError(e instanceof Error?e.message:'Не вдалося завершити налаштування. Твої відповіді залишилися.')}finally{setBusy(false)}
  }
  return <div className="onboard-shell">
    <header className="onboard-header">
      <div className="onboard-logo"><span>₴</span><strong>paytakt<span className="onboard-accent">.</span></strong></div>
      <span className="onboard-workspace"><BriefcaseBusiness size={15}/>{workspaceName}</span>
      {onCancel&&<button className="onboard-skip" onClick={onCancel} type="button">До календаря</button>}
    </header>
    <main className="onboard-main">
      <div className="onboard-heading"><span className="onboard-eyebrow"><Sparkles size={15}/> ПЕРСОНАЛЬНЕ НАЛАШТУВАННЯ</span>
        <h1>{({
          'Сфера роботи':'Де ти працюєш?', 'Графік':'Як виглядає твій графік?',
          'Оплата':'Як тобі платять?', 'Понаднормові':'Чи бувають у тебе понаднормові?',
          'Години понаднормових':'Скільки понаднормових годин на добу?',
          'Додаткові можливості':'Що ще потрібно для твоєї роботи?',
          'Виплати':'Коли ти отримуєш гроші?', 'Перевірка':'Перевірмо твої правила',
        } as Record<string,string>)[currentStep]}</h1>
        <p>{({
          'Сфера роботи':'Ми підберемо потрібні варіанти під твою професію. Інші завжди будуть доступні.',
          'Графік':'Обери готовий ритм або створи власний. Відразу покажемо, як виглядатиме місяць.',
          'Оплата':'Тільки один головний спосіб оплати. Премії та понаднормові додамо далі.',
          'Понаднормові':'Обери спосіб обліку додаткових годин. Якщо їх немає — цей крок буде пропущено.',
          'Години понаднормових':'Один раз задай тривалість — ми використаємо її у календарі та додаткових налаштуваннях.',
          'Додаткові можливості':'Залишимо тільки ті функції, якими ти користуєшся.',
          'Виплати':'Ці дати можна буде змінити в будь-який момент.',
          'Перевірка':'Нічого не буде збережено, доки ти не натиснеш «Створити мій календар».',
        } as Record<string,string>)[currentStep]}</p>
      </div>
      <div className="onboard-progress-label"><strong>Крок {step+1} із {activeSteps.length}</strong><span>{currentStep}</span></div>
      <div className="onboard-progress" role="progressbar" aria-label="Прогрес налаштування" aria-valuenow={step+1} aria-valuemin={1} aria-valuemax={activeSteps.length}><span style={{width:`${(step+1)/activeSteps.length*100}%`}}/></div>
      <section className="onboard-card" key={currentStep}>
      {currentStep==='Сфера роботи'&&<>
        <div className="onboard-row between"><h2>Обери свою сферу</h2><button className="onboard-link" type="button" onClick={()=>setShowAllSectors(v=>!v)}>{showAllSectors?"Показати основні":"Показати всі сфери"}</button></div>
        <div className="onboard-choice-grid sectors">
          {sectors.filter(s=>showAllSectors||["office","retail","hospitality","manufacturing","logistics","healthcare","service","freelance","other"].includes(s.id)).map(s=><button key={s.id} type="button" className={`onboard-choice ${draft.sector===s.id?'selected':''}`} aria-pressed={draft.sector===s.id} onClick={()=>{const preset=suggestions[s.id][0];update({sector:s.id,preset:preset.shift,mode:preset.mode,unitName:preset.unitName,planMetric:preset.mode==='per_unit'?'units':'earnings',manualDailyPay:false,cash:false,plan:false,night:false,overtime:false,overtimeMode:'none'});setShowAll(false);setShowOtherFeatures(false)}}>
            <span className="onboard-choice-top"><strong>{s.label}</strong>{draft.sector===s.id&&<CheckCircle2 size={20}/>}</span><small>{s.description}</small>
          </button>)}
        </div>
      </>}
      {currentStep==='Графік'&&<>
        <div className="onboard-row between"><h2>Рекомендовані графіки</h2><button type="button" className="onboard-link" onClick={()=>setShowAll(x=>!x)}>{showAll?'Показати рекомендовані':'Усі графіки'}</button></div>
        <div className="onboard-choice-grid">
          {shownSchedules.map(id=><button type="button" key={id} className={`onboard-choice ${draft.preset===id?'selected':''}`} aria-pressed={draft.preset===id} onClick={()=>update({preset:id})}>
            <span className="onboard-choice-top"><strong>{scheduleLabels[id]}</strong>{draft.preset===id&&<CheckCircle2 size={20}/>}</span>
            <small>{id==='5/2-weekdays'?'Субота та неділя завжди вихідні':id==='custom'?'Самостійно задай кількість робочих і вихідних':'Графік повторюється від вибраної дати'}</small>
          </button>)}
        </div>
        <div className="onboard-subpanel">
          <h3>Робочий час</h3>
          {(['day-night-48','night-2/2','duty-24-72'].includes(draft.preset))&&<p className="onboard-hint">Цей шаблон має різний час для денних, нічних або добових змін. Години вже налаштовані для кожного дня циклу; їх можна змінити в розширеному редакторі календаря.</p>}
          <div className="onboard-fields">
            {!(['day-night-48','night-2/2','duty-24-72'].includes(draft.preset))&&<>
            <label>Початок<input type="time" value={draft.start} onChange={e=>update({start:e.target.value})}/></label>
            <label>Завершення<input type="time" value={draft.end} onChange={e=>update({end:e.target.value})}/></label>
            <label>Перерва, хв<input type="number" min="0" max="1439" value={draft.breakMinutes} onChange={e=>update({breakMinutes:Number(e.target.value)})}/></label></>}
            {draft.preset!=='5/2-weekdays'&&<label>Перший день циклу<input type="date" value={draft.anchorDate} onChange={e=>update({anchorDate:e.target.value})}/></label>}
            {draft.preset==='custom'&&<><label>Робочих у циклі<input type="number" min="1" max="14" value={draft.customWork} onChange={e=>update({customWork:Number(e.target.value)})}/></label><label>Вихідних у циклі<input type="number" min="0" max="14" value={draft.customOff} onChange={e=>update({customOff:Number(e.target.value)})}/></label></>}
          </div>
          {month.length>0&&<p className="onboard-hint"><CalendarDays size={16}/> У поточному місяці: {workDays} робочих днів, {month.length-workDays} вихідних.</p>}
        </div>
      </>}
      {currentStep==='Оплата'&&<>
        <h2>Вибери основний спосіб оплати</h2>
        <div className="onboard-choice-grid">
          {payModes.map(id=><button type="button" key={id} className={`onboard-choice ${!draft.manualDailyPay&&draft.mode===id?'selected':''}`} aria-pressed={!draft.manualDailyPay&&draft.mode===id} onClick={()=>update({mode:id,manualDailyPay:false,unitName:id==='per_unit'?suggestions[draft.sector].find(x=>x.mode==='per_unit')?.unitName||'завдання':draft.unitName,planMetric:id==='per_unit'?'units':draft.planMetric})}>
            <span className="onboard-choice-top"><strong>{payLabels[id].title}</strong>{!draft.manualDailyPay&&draft.mode===id&&<CheckCircle2 size={20}/>}</span><small>{payLabels[id].sub}</small>
          </button>)}
          <button type="button" className={`onboard-choice ${draft.manualDailyPay?'selected':''}`} aria-pressed={draft.manualDailyPay} onClick={()=>update({manualDailyPay:true,mode:'hourly'})}>
            <span className="onboard-choice-top"><strong>Вводжу заробіток сам</strong>{draft.manualDailyPay&&<CheckCircle2 size={20}/>}</span>
            <small>Після зміни введу суму в календарі. Кожен день може мати іншу оплату.</small>
          </button>
        </div>
        {draft.manualDailyPay?<div className="onboard-subpanel"><strong>Оплату за день вноситимеш у календарі</strong><p className="onboard-hint">Після підтвердження робочого дня з’явиться поле «Мій заробіток». Якщо не введеш суму, базова оплата за цей день не нарахується. 0 грн — теж запис.</p></div>:<div className="onboard-subpanel"><div className="onboard-fields"><label>{payLabels[draft.mode].unit}<input inputMode="decimal" type="text" value={draft.rate} onChange={e=>update({rate:e.target.value})} placeholder="Наприклад, 31000"/></label>
          {draft.mode==='per_unit'&&<label>Що саме ти виконуєш?<input value={draft.unitName} maxLength={40} onChange={e=>update({unitName:e.target.value})} placeholder="Доставка, виріб, послуга…"/></label>}
        </div><p className="onboard-hint"><ShieldCheck size={16}/> Ставка використовується для розрахунку, але без виконаної роботи зарплата не нараховується.</p></div>}
      </>}
      {currentStep==='Понаднормові'&&<>
        <h2>Як рахувати понаднормові години?</h2>
        <div className="onboard-choice-grid">
          {([
            ['none','Немає понаднормових','У календарі не буде кнопки понаднормових'],
            ['quick','Додаю кнопкою','У календарі буде кнопка для додаткових годин зі своїм тарифом'],
            ['automatic','Автоматично після норми','Наприклад, після 8 годин — 120% від погодинної ставки'],
          ] as const).map(([id,title,sub])=><button type="button" key={id} className={`onboard-choice ${draft.overtimeMode===id?'selected':''}`} aria-pressed={draft.overtimeMode===id} onClick={()=>update({overtimeMode:id,overtime:id!=='none'})}>
            <span className="onboard-choice-top"><strong>{title}</strong>{draft.overtimeMode===id&&<CheckCircle2 size={20}/>}</span><small>{sub}</small>
          </button>)}
        </div>
        {draft.overtimeMode!=='none'&&<div className="onboard-subpanel"><div className="onboard-fields">
          {draft.overtimeMode==='automatic'&&<label>Після скількох годин за день?<input type="number" min="1" max="23" value={draft.overtimeAfterHours} onChange={e=>update({overtimeAfterHours:Number(e.target.value)})}/></label>}
          <label>Оплата понаднормових, %<input type="number" min="100" max="1000" step="1" value={draft.overtimePercent} onChange={e=>update({overtimePercent:Number(e.target.value)})}/></label>
          {draft.manualDailyPay&&<label>Базова ставка за годину для доплат, грн<input inputMode="decimal" value={draft.overtimeHourlyRate} placeholder="Наприклад, 150" onChange={e=>update({overtimeHourlyRate:e.target.value})}/></label>}
        </div><p className="onboard-hint">{draft.overtimeMode==='quick'?'Кнопка швидкого додавання з’явиться в календарі. Тривалість додаткових годин зможеш змінити у шаблоні.':'PayTakt застосує поріг і відсоток до підтверджених годин. Окремої кнопки не буде.'}</p></div>}
      </>}
      {currentStep==='Години понаднормових'&&<>
        <h2>Скільки годин понаднормових на добу?</h2>
        <p className="onboard-hint onboard-question-hint">Вибери типову кількість або введи свою. Це можна змінити пізніше.</p>
        <div className="onboard-choice-grid onboard-hours-grid">
          {[1,2,3,4].map(hours=><button type="button" key={hours} className={`onboard-choice onboard-hours-choice ${draft.overtimeHoursPerDay===hours?'selected':''}`} aria-pressed={draft.overtimeHoursPerDay===hours} onClick={()=>update({overtimeHoursPerDay:hours})}>
            <span className="onboard-choice-top"><strong>+{hours} {hours===1?'година':'години'} на день</strong>{draft.overtimeHoursPerDay===hours&&<CheckCircle2 size={20}/>}</span>
          </button>)}
        </div>
        <div className="onboard-subpanel"><div className="onboard-fields">
          <label>Своя кількість годин<input type="number" min="0.5" max="12" step="0.5" value={draft.overtimeHoursPerDay} onChange={e=>update({overtimeHoursPerDay:Number(e.target.value)})}/></label>
          <div className="onboard-overtime-preview"><strong>+{Number.isFinite(draft.overtimeHoursPerDay)?draft.overtimeHoursPerDay:0} год</strong><span>за {draft.overtimePercent}%</span></div>
        </div><p className="onboard-hint">{draft.overtimeMode==='quick'?'Календар отримає кнопку, яка додаватиме цю кількість годин після звичайної зміни.':'PayTakt додасть цю тривалість у запланований робочий час; базова норма окладу залишиться без змін. Доплата буде після обраного порогу.'}</p></div>
      </>}
      {currentStep==='Додаткові можливості'&&<>
        <h2>Вибери тільки потрібні можливості</h2>
        <div className="onboard-toggles">
          <label className="onboard-toggle"><span><strong>Нічні доплати</strong><small>Якщо працюєш уночі. Час можна змінити пізніше.</small></span><input type="checkbox" checked={draft.night} onChange={e=>update({night:e.target.checked})}/></label>
          {canUseCash&&<label className="onboard-toggle"><span><strong>Каса за день</strong><small>Виручка магазину, ресторану або інших продажів</small></span><input type="checkbox" checked={draft.cash} onChange={e=>update({cash:e.target.checked,...(!e.target.checked&&draft.planMetric==='cash'?{planMetric:'earnings' as PlanMetric}:{})})}/></label>}
          <label className="onboard-toggle"><span><strong>План і премія</strong><small>За результат роботи, виручку чи виконані завдання</small></span><input type="checkbox" checked={draft.plan} onChange={e=>update({plan:e.target.checked})}/></label>
        </div>
        {draft.manualDailyPay&&draft.night&&draft.overtimeMode==='none'&&<div className="onboard-subpanel"><label className="onboard-small-field">Базова ставка за годину для нічних доплат, грн<input inputMode="decimal" value={draft.overtimeHourlyRate} onChange={e=>update({overtimeHourlyRate:e.target.value})} placeholder="Наприклад, 150"/></label></div>}
        {!canUseCash&&<button className="onboard-link onboard-extra-link" type="button" onClick={()=>setShowOtherFeatures(true)}>Потрібна каса, хоча вона нетипова для моєї роботи</button>}
        {draft.plan&&<div className="onboard-subpanel"><div className="onboard-fields">
          <label>За чим рахуємо план?<select value={draft.planMetric} onChange={e=>update({planMetric:e.target.value as PlanMetric,cash:e.target.value==='cash'?true:draft.cash})}>{canUseCash&&<option value="cash">Каса / виручка</option>}<option value="units">Кількість виконаних робіт</option><option value="earnings">Особистий заробіток</option></select></label>
          <label>Місячний план {draft.planMetric==='units'?'(одиниць)':'(грн)'}<input inputMode="decimal" value={draft.planTarget} onChange={e=>update({planTarget:e.target.value})} placeholder="Наприклад, 100000"/></label>
          <label>Премія при 100%, грн<input inputMode="decimal" value={draft.planBonus} onChange={e=>update({planBonus:e.target.value})} placeholder="Наприклад, 2000"/></label>
        </div></div>}
      </>}
      {currentStep==='Виплати'&&<>
        <h2>Вибери порядок виплат</h2>
        <div className="onboard-choice-grid">
          {([['split','Аванс за першу половину','За 1–15 число, решта наступного місяця'],['fixed','Фіксований аванс','Суму авансу задаєш вручну'],['all','Уся зарплата одним платежем','Один платіж у вибраний день']] as const).map(([id,title,sub])=><button key={id} className={`onboard-choice ${draft.payout===id?'selected':''}`} aria-pressed={draft.payout===id} onClick={()=>update({payout:id})} type="button"><span className="onboard-choice-top"><strong>{title}</strong>{draft.payout===id&&<CheckCircle2 size={20}/>}</span><small>{sub}</small></button>)}
        </div>
        <div className="onboard-subpanel"><div className="onboard-fields">
          {draft.payout==='fixed'&&<label>Аванс, грн<input value={draft.advance} inputMode="decimal" placeholder="Наприклад, 10000" onChange={e=>update({advance:e.target.value})}/></label>}
          {draft.payout!=='all'&&<label>Аванс — число місяця<input type="number" min="1" max="31" value={draft.advanceDay} onChange={e=>update({advanceDay:Number(e.target.value)})}/></label>}
          <label>{draft.payout==='all'?'Зарплата — число місяця':'Залишок зарплати — число'}<input type="number" min="1" max="31" value={draft.salaryDay} onChange={e=>update({salaryDay:Number(e.target.value)})}/></label>
          <label>Премія — число місяця<input type="number" min="1" max="31" value={draft.bonusDay} onChange={e=>update({bonusDay:Number(e.target.value)})}/></label>
        </div><p className="onboard-hint"><Clock3 size={16}/> {draft.payout==='all'?'Зарплата — цього місяця.': 'Залишок зарплати й премії — наступного місяця.'} Після налаштування всі дати можна редагувати.</p></div>
      </>}
      {currentStep==='Перевірка'&&<>
        <div className="onboard-review-head"><CheckCircle2 size={30}/><div><h2>Майже готово!</h2><p>Ось що ми налаштуємо для тебе. За потреби повернися й зміни відповідь.</p></div></div>
        <div className="onboard-review">
          <div><span>Сфера роботи</span><strong>{sectors.find(s=>s.id===draft.sector)?.label}</strong></div>
          <div><span>Графік</span><strong>{scheduleSummary(draft)} · {workDays} робочих днів цього місяця</strong></div>
          <div><span>Основна оплата</span><strong>{draft.manualDailyPay?'Вношу заробіток сам за кожен день':`${payLabels[draft.mode].title} · ${cash(draft.rate)} ₴`}</strong></div>
          <div><span>Понаднормові</span><strong>{draft.overtimeMode==='none'?'Не використовую':draft.overtimeMode==='quick'?`Кнопка +${draft.overtimeHoursPerDay} год · ${draft.overtimePercent}%`:`Після ${draft.overtimeAfterHours} год · +${draft.overtimeHoursPerDay} год/день · ${draft.overtimePercent}%`}</strong></div>
          <div><span>Інші можливості</span><strong>{draft.cash?'Каса': 'Без каси'} · {draft.plan?'План і премія':'Без плану'} · {draft.night?'Нічні':'Без нічних'}</strong></div>
          <div><span>Виплати</span><strong>{draft.payout==='all'?'Одним платежем':draft.payout==='fixed'?'Фіксований аванс':'Аванс за пів місяця'}</strong></div>
        </div>
        {isExisting&&<p className="onboard-warning">У цьому просторі вже є дані. Нові правила зарплати замінять чинні. Календар заповниться лише там, де ще немає записів: відпрацьовані дні не буде стерто.</p>}
        <p className="onboard-hint"><ShieldCheck size={16}/> Графік заповниться на поточний і наступний місяці. Інші місяці можна додавати в календарі. Усі правила залишаться доступними для редагування.</p>
      </>}
      {error&&<p className="onboard-error" role="alert">{error}</p>}
      </section>
      <div className="onboard-footer">
        <button type="button" className="btn btn-outline" disabled={step===0||busy} onClick={()=>{setStep(i=>Math.max(0,i-1));setError('')}}><ArrowLeft size={17}/> Назад</button>
        {step<activeSteps.length-1?
          <button type="button" className="btn onboard-next" onClick={stepNext}>Далі <ArrowRight size={17}/></button>:
          <button type="button" disabled={busy} className="btn onboard-next" onClick={()=>void finish()}>{busy?'Зберігаємо…':'Створити мій календар'}<Check size={17}/></button>}
      </div>
      <p className="onboard-bottom-note">Відповіді зберігаються як чернетка у цьому браузері. Усе можна буде змінити пізніше.</p>
    </main>
  </div>
}
