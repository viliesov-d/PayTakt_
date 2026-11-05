import {
  collection, doc, getDoc, getDocs, getDocFromServer, getDocsFromServer,
  limit, query, updateDoc, setDoc, writeBatch, runTransaction, deleteDoc,
  serverTimestamp, onSnapshot, type Unsubscribe,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db, auth } from './firebase'
import { validatePattern, isProtectedPatternDay, samePatternDay, type GeneratedCalendarDay, type PatternApplyMode, type PatternApplySummary, type ScheduleTemplate, type PatternDay } from './schedule'
import { validateDay, shiftHours, segmentHours, validateOvertimePreset, type OvertimePreset } from './calendar'
import type { Shift } from './calendar'
export { segmentHours, shiftHours, shiftCount, workedHours, validateDay } from './calendar'
export type { DayType, ShiftKind, AdditionalShift, Shift, OvertimeExtra, OvertimePreset } from './calendar'

export type WorkspaceKind = 'personal' | 'company'
/** Monetary values use the smallest unit of each workspace's accounting currency.
 * Legacy workspaces missing the currency field always mean UAH. */
export type AccountingCurrency = 'UAH' | 'USD' | 'EUR' | 'PLN' | 'GBP'
export const accountingCurrencies: readonly AccountingCurrency[] = ['UAH','USD','EUR','PLN','GBP']
export function isAccountingCurrency(value: unknown): value is AccountingCurrency {
  return typeof value === 'string' && accountingCurrencies.some(code => code === value)
}
export type Workspace = { id: string; name: string; kind: WorkspaceKind; role: 'owner'; currency?: AccountingCurrency }
export type ThemeChoice = 'light' | 'dark' | 'system'

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function dayPayload(s: Shift) {
  validateDay(s)
  return {
    date:s.date, start:s.start, end:s.end, breakMinutes:s.breakMinutes,
    status:s.status, note:s.note, dayType:s.dayType??'work',
    kind:s.kind??'regular', additionalShifts:s.additionalShifts??[],
    overtimeMinutes:s.overtimeMinutes??0, ...(s.overtimeExtra?{overtimeExtra:s.overtimeExtra}:{}), plannedWorkday:s.plannedWorkday??((s.dayType??'work')==='work'),
    plannedMinutes:s.plannedMinutes??((s.dayType??'work')==='work'?Math.round((shiftHours(s)-(s.additionalShifts||[]).reduce((v,x)=>v+segmentHours(x),0))*60):0),
    updatedAt:serverTimestamp(),
  }
}
export function demoShifts(): Shift[] {
  const now = new Date()
  const year = now.getFullYear(), month = now.getMonth()
  const count = new Date(year, month + 1, 0).getDate()
  const shifts: Shift[] = []
  for (let day = 1; day <= count; day++) {
    const date = new Date(year, month, day)
    const weekday = date.getDay()
    if (weekday === 0 || weekday === 6) continue
    if (day > now.getDate() + 4) continue
    shifts.push({
      id: toDateKey(date), date: toDateKey(date),
      start: '09:00', end: '18:00', breakMinutes: 60,
      status: day < now.getDate() ? 'worked' : 'planned',
      note: '',
    })
  }
  return shifts
}

export async function ensureProfile(user: User): Promise<{ name: string; theme?: ThemeChoice }> {
  if (!db) throw Error('Firebase не налаштовано')
  const ref = doc(db, 'users', user.uid)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) {
    const name = user.displayName || user.email?.split('@')[0] || 'Користувач'
    await setDoc(ref, {
      email: user.email || '',
      displayName: name,
      theme: 'system',
      createdAt: serverTimestamp(),
    })
    return { name, theme: 'system' }
  }
  const data = snapshot.data()
  return { name: data.displayName || user.displayName || 'Користувач', theme: data.theme }
}

export async function updateProfileTheme(uid: string, value: ThemeChoice): Promise<void> {
  if (!db) return
  await setDoc(doc(db, 'users', uid), { theme: value }, { merge: true })
}

export async function loadWorkspaces(uid: string): Promise<Workspace[]> {
  if (!db) throw Error('Firebase не налаштовано')
  const snapshot = await getDocs(collection(db, 'users', uid, 'workspaces'))
  return snapshot.docs.map(d => ({
    id: d.id,
    name: String(d.data().name || 'Робочий простір'),
    kind: d.data().kind === 'company' ? 'company' : 'personal',
    currency: isAccountingCurrency(d.data().currency) ? d.data().currency : 'UAH',
    role: 'owner',
  }))
}

export async function createWorkspace(uid: string, kind: WorkspaceKind, name: string, currency: AccountingCurrency = 'UAH'): Promise<Workspace> {
  if (!db) throw Error('Firebase не налаштовано')
  if (!navigator.onLine) throw Error('Для створення робочого простору потрібен інтернет.')
  if (!isAccountingCurrency(currency)) throw Error('Непідтримувана валюта зарплати.')
  if (name.trim().length < 2 || name.trim().length > 80) throw Error('Назва має містити від 2 до 80 символів.')
  const ws = doc(collection(db, 'workspaces'))
  const batch = writeBatch(db)
  const workspace: Workspace = { id: ws.id, kind, role: 'owner', name: name.trim(), currency }
  // Keep UAH-only creation compatible with previously deployed Firestore rules.
  // Other currencies require the reviewed currency-aware rules to be deployed.
  const currencyField = currency === 'UAH' ? {} : {currency}
  batch.set(ws, { name: workspace.name, kind, ...currencyField, ownerUid: uid, createdAt: serverTimestamp() })
  batch.set(doc(db, 'users', uid, 'workspaces', ws.id), {
    name: workspace.name, kind, ...currencyField, role: 'owner', createdAt: serverTimestamp(),
  })
  await batch.commit()
  return workspace
}


/**
 * Permanently delete one owner's workspace and every known PayTakt collection.
 * IMPORTANT: deleting a Firestore parent document does not delete its children.
 * A two-phase server-confirmed delete prevents leaving inaccessible orphans.
 *
 * The first write locks the workspace against all new writes via Firestore Rules.
 * If interrupted, it stays visible to its owner so deletion can be retried.
 * The final atomic batch deletes BOTH the root document and user's index.
 */
export async function deleteWorkspace(uid:string, workspaceId:string):Promise<void>{
  if(!db || !auth?.currentUser || auth.currentUser.uid!==uid)
    throw Error('Потрібно увійти у власний акаунт.')
  if(!navigator.onLine)throw Error('Для видалення простору потрібен інтернет.')

  const root=doc(db,'workspaces',workspaceId)
  const snap=await getDocFromServer(root)
  if(!snap.exists())throw Error('Робочий простір уже видалено.')
  if(snap.data().ownerUid!==uid)throw Error('Лише власник може видаляти простір.')

  // A deletion in progress blocks writes from other signed-in devices.
  if(snap.data().deleting!==true)await updateDoc(root,{deleting:true})

  // All Firestore subcollections used by PayTakt. Process the SERVER, never
  // cached offline snapshots, to prevent missing records and orphaned data.
  const collections=[
    'shifts','scheduleTemplates','dailyCash','dailyWages',
    'monthlyTargets','monthlySales','monthlyUnits',
  ] as const
  for(const name of collections){
    while(true){
      const docs=await getDocsFromServer(query(collection(db,'workspaces',workspaceId,name),limit(80)))
      if(docs.empty)break
      const batch=writeBatch(db)
      docs.docs.forEach(item=>batch.delete(item.ref))
      await batch.commit()
    }
  }

  // Rules intentionally prohibit listing the settings and paySettings
  // collections. Delete their known document IDs with server-confirmed reads.
  const individual=[
    ['settings','overtime'],['settings','cash'],['settings','performance'],
    ['paySettings','current'],
  ] as const
  const batch=writeBatch(db)
  for(const [name,id] of individual){
    const ref=doc(db,'workspaces',workspaceId,name,id)
    const item=await getDocFromServer(ref)
    if(item.exists())batch.delete(ref)
  }
  // Do not delete the owner index or root until every child is gone. This
  // batch is atomic; an interrupted earlier stage can always be retried.
  batch.delete(doc(db,'users',uid,'workspaces',workspaceId))
  batch.delete(root)
  await batch.commit()
}

/** Consistent decoding for listeners and transactional conflict checks. */
export function decodeShift(id:string,raw:Record<string,unknown>):Shift{
  const item=raw as Record<string,any>
      return {
        id,
        date: String(item.date || id),
        start: String(item.start || '09:00'),
        end: String(item.end || '18:00'),
        breakMinutes: Number(item.breakMinutes || 0),
        status: item.status === 'worked' ? 'worked' : 'planned',
        note: String(item.note || ''),
        dayType: ['work','off','vacation','sick','unpaid'].includes(item.dayType) ? item.dayType : 'work',
        kind: ['regular','extra','replacement'].includes(item.kind) ? item.kind : 'regular',
        overtimeMinutes: Number(item.overtimeMinutes??0),
        overtimeExtra: item.overtimeExtra && typeof item.overtimeExtra==='object' ? {
          start:String(item.overtimeExtra.start||'18:00'),end:String(item.overtimeExtra.end||'20:00'),
          breakMinutes:Number(item.overtimeExtra.breakMinutes??0),
          basisPoints:Number(item.overtimeExtra.basisPoints??12000),
          status:item.overtimeExtra.status==='worked'?'worked':'planned',
        }:undefined,
        plannedWorkday: typeof item.plannedWorkday==='boolean' ? item.plannedWorkday : item.dayType==='work' || !item.dayType,
        plannedMinutes: Number.isSafeInteger(item.plannedMinutes) ? Number(item.plannedMinutes) : undefined,
        additionalShifts: Array.isArray(item.additionalShifts) ? item.additionalShifts.map((extra: Record<string, unknown>)=>({
          id: String(extra.id || ''), start:String(extra.start || '09:00'),
          end:String(extra.end || '18:00'), breakMinutes:Number(extra.breakMinutes || 0),
          status: extra.status==='worked' ? 'worked' as const : 'planned' as const,
          kind: extra.kind==='replacement' ? 'replacement' as const : extra.kind==='regular' ? 'regular' as const : 'extra' as const,
          note:String(extra.note||''),
        })) : [],
      } as Shift
}
export function comparableShift(shift:Shift|null):string|null{
  if(shift===null)return null
  // Ignore Firestore's server-generated timestamp, compare meaningful fields.
  return JSON.stringify({...dayPayload(shift),updatedAt:undefined})
}

export function subscribeShifts(workspaceId: string, onChange: (data: Shift[]) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db) return () => undefined
  return onSnapshot(collection(db, 'workspaces', workspaceId, 'shifts'), snapshot => {
    onChange(snapshot.docs.map(d => decodeShift(d.id,d.data())))
  }, onError)
}

export async function saveShift(workspaceId: string, shift: Shift): Promise<void> {
  if (!navigator.onLine) throw Error('Для збереження потрібен інтернет. Офлайн-редагування додамо пізніше.')
  if (!db) throw Error('Firebase не налаштовано')
  await setDoc(doc(db, 'workspaces', workspaceId, 'shifts', shift.date), dayPayload(shift))
}

/** Create only missing shifts. Transactional reads prevent overwriting even after concurrent edits. */
export async function saveManyShifts(workspaceId: string, shifts: Shift[]): Promise<number> {
  // Copy the nullable module-level reference into a local constant so TypeScript
  // can safely narrow its type inside the Firestore transaction callback.
  const firestore = db
  if (!firestore) throw Error('Firebase не налаштовано')
  if (!navigator.onLine) throw Error('Для масового збереження потрібен інтернет.')
  if (shifts.length > 31) throw Error('За один раз можна заповнити не більше одного місяця.')
  shifts.forEach(validateDay)
  if (new Set(shifts.map(s => s.date)).size !== shifts.length) throw Error('Дублікати дат у графіку.')
  if (!shifts.length) return 0
  return runTransaction(firestore, async tx => {
    const refs = shifts.map(shift => doc(firestore, 'workspaces', workspaceId, 'shifts', shift.date))
    // Firestore transactions require reading all documents before the first write.
    const snapshots = await Promise.all(refs.map(ref => tx.get(ref)))
    let added = 0
    for (let i = 0; i < shifts.length; i++) {
      if (snapshots[i].exists()) continue
      const shift = shifts[i]
      tx.set(refs[i], dayPayload(shift))
      added++
    }
    return added
  })
}

/** Apply generated month in a single transaction.
 * Reads current documents at commit time, not just the UI snapshot, so a concurrent
 * confirmed shift or leave day is protected. Only planned simple days can be replaced.
 */
export async function applyMonthlyPattern(
  workspaceId: string,
  generated: GeneratedCalendarDay[],
  mode: PatternApplyMode,
): Promise<PatternApplySummary> {
  // Keep a non-null Firestore reference for the asynchronous callback below.
  const firestore = db
  if (!firestore) throw Error('Firebase не налаштовано')
  if (!navigator.onLine) throw Error('Для оновлення календаря потрібен інтернет.')
  if (!['missing','update-planned'].includes(mode)) throw Error('Невідомий режим заповнення.')
  if (generated.length < 1 || generated.length > 31) throw Error('Можна обробити лише один місяць.')
  generated.forEach(validateDay)
  if (new Set(generated.map(s=>s.date)).size !== generated.length ||
      generated.some(s=>s.date.slice(0,7)!==generated[0].date.slice(0,7)))
    throw Error('Шаблон має містити унікальні дати одного місяця.')
  return runTransaction(firestore, async tx=>{
    const refs=generated.map(day=>doc(firestore,'workspaces',workspaceId,'shifts',day.date))
    const docs=await Promise.all(refs.map(ref=>tx.get(ref)))
    const summary:PatternApplySummary={created:0,updated:0,protected:0,unchanged:0}
    for(let i=0;i<generated.length;i++){
      const next=generated[i], current=docs[i]
      if(!current.exists()){
        tx.set(refs[i],dayPayload(next));summary.created++;continue
      }
      const previous=current.data() as Shift
      if(isProtectedPatternDay(previous)){summary.protected++;continue}
      if(mode==='missing'||samePatternDay(previous,next)){summary.unchanged++;continue}
      tx.set(refs[i],dayPayload(next));summary.updated++
    }
    return summary
  })
}

export async function deleteShift(workspaceId: string, date: string): Promise<void> {
  if (!navigator.onLine) throw Error('Для видалення зміни потрібен інтернет.')
  if (!db) throw Error('Firebase не налаштовано')
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'shifts', date))
}


/** Personal and company templates remain isolated under the owning workspace. */
export function subscribeTemplates(
  workspaceId: string,
  onChange: (data: ScheduleTemplate[])=>void,
  onError:(error:Error)=>void,
): Unsubscribe {
  if (!db) return ()=>undefined
  return onSnapshot(collection(db,'workspaces',workspaceId,'scheduleTemplates'), snapshot=>{
    const templates: ScheduleTemplate[] = []
    for(const item of snapshot.docs){
      const raw=item.data()
      try {
        if(typeof raw.name!=='string'||typeof raw.anchorDate!=='string'||!Array.isArray(raw.pattern))continue
        const pattern=raw.pattern.map((p:PatternDay)=>({...p}))
        validatePattern(pattern)
        templates.push({id:item.id,name:raw.name,anchorDate:raw.anchorDate,pattern})
      }catch(error){console.warn('Skipped invalid template:',item.id,error)}
    }
    onChange(templates.sort((a,b)=>a.name.localeCompare(b.name,'uk')))
  },onError)
}
export async function saveTemplate(workspaceId: string,template:ScheduleTemplate):Promise<void> {
  if(!db)throw Error('Firebase не налаштовано')
  if(!navigator.onLine)throw Error('Для збереження шаблону потрібен інтернет.')
  validatePattern(template.pattern)
  if(!template.name.trim()||template.name.length>80)throw Error('Назва шаблону має бути до 80 символів.')
  await setDoc(doc(db,'workspaces',workspaceId,'scheduleTemplates',template.id),{
    name:template.name.trim(),anchorDate:template.anchorDate,pattern:template.pattern,
    updatedAt:serverTimestamp(),
  })
}
export async function deleteTemplate(workspaceId:string,templateId:string):Promise<void>{
  if(!db)throw Error('Firebase не налаштовано')
  if(!navigator.onLine)throw Error('Для видалення шаблону потрібен інтернет.')
  await deleteDoc(doc(db,'workspaces',workspaceId,'scheduleTemplates',templateId))
}

/** A saved one-click overtime template for each workspace. */
export function subscribeOvertimePreset(workspaceId:string,onChange:(preset:OvertimePreset|null)=>void,onError:(e:Error)=>void):Unsubscribe {
  if(!db)return ()=>undefined
  return onSnapshot(doc(db,'workspaces',workspaceId,'settings','overtime'),snap=>{
    if(!snap.exists()){onChange(null);return}
    try{
      const raw=snap.data()
      const preset:OvertimePreset={start:raw.start,end:raw.end,breakMinutes:raw.breakMinutes,basisPoints:raw.basisPoints}
      validateOvertimePreset(preset)
      onChange(preset)
    }catch(e){onError(e instanceof Error?e:new Error('Помилка шаблону понаднормових.'))}
  },onError)
}
export async function saveOvertimePreset(workspaceId:string,preset:OvertimePreset):Promise<void>{
  const firestore=db
  if(!firestore)throw Error('Firebase не налаштовано')
  if(!navigator.onLine)throw Error('Для збереження шаблону потрібен інтернет.')
  validateOvertimePreset(preset)
  await setDoc(doc(firestore,'workspaces',workspaceId,'settings','overtime'),{...preset,updatedAt:serverTimestamp()})
}

// v0.4: Pay policy belongs to exactly one workspace. Stored separately from calendar.
import { normalizePaySettings, validatePaySettings, validateMonthlySales, validateMonthlyUnits, type PaySettings, type MonthlySales, type MonthlyUnits } from './salary'
export type { PaySettings, PayResult, MonthlySales } from './salary'
export { defaultPaySettings, calculatePay, moneyUA } from './salary'
import { preparePaySettingsWrite } from './paySettingsPayload'
import { verifyPaySettingsFirestoreShape } from './paySettingsRulesCheck'

export function subscribePaySettings(
  workspaceId: string,
  onChange: (value: PaySettings | null)=>void,
  onError: (error: Error)=>void,
):Unsubscribe {
  if(!db) return ()=>undefined
  return onSnapshot(doc(db,'workspaces',workspaceId,'paySettings','current'),snapshot=>{
    if(!snapshot.exists()){ onChange(null); return }
    try {
      const next=normalizePaySettings(snapshot.data())
      onChange(next)
    }catch(err){onError(err instanceof Error?err:new Error('Некоректні налаштування зарплати.'))}
  },onError)
}

export async function savePaySettings(workspaceId:string,settings:PaySettings):Promise<void>{
  if(!db) throw Error('Firebase не налаштовано')
  if(!navigator.onLine) throw Error('Для збереження правил потрібне підключення до інтернету.')
  validatePaySettings(settings)
  try {
    // Deeply whitelist pay settings before writing. Old Firestore records may
    // contain extra fields in nested arrays; the rules reject those extras even
    // when the top-level keys are valid.
    const persisted = preparePaySettingsWrite(settings)
    // Test every value that the restrictive Firestore paySettings schema checks
    // before the request, so a malformed field has an actionable error message.
    const mismatches = verifyPaySettingsFirestoreShape(persisted)
    if (mismatches.length) throw Error(`Налаштування зарплати не відповідають Firestore Rules: ${mismatches.join('; ')}`)
    await setDoc(doc(db,'workspaces',workspaceId,'paySettings','current'),{
      ...persisted, updatedAt:serverTimestamp(),
    })
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    if (!code.includes('permission-denied')) throw error
    // A missing/mismatched workspace and a rejected pay-settings schema both look
    // like permission-denied to the client. Diagnose by reading only this workspace;
    // do NOT relax access rules or switch to a broader query.
    const project = db.app.options.projectId || '(невідомий)'
    const target = `workspaces/${workspaceId}/paySettings/current`
    let workspace
    try {
      workspace = await getDoc(doc(db, 'workspaces', workspaceId))
    } catch {
      throw Error(`Firebase (${project}): немає доступу до робочого простору ${workspaceId}. Перевір, чи акаунт є власником цього простору, а правила опубліковані для бази (default). Запис: ${target}.`)
    }
    if (!workspace.exists()) {
      throw Error(`Firebase (${project}): робочий простір не знайдено. Перевір обраний простір та відповідність Firebase-проєкту в .env.`)
    }
    if (workspace.data().ownerUid !== auth?.currentUser?.uid) {
      throw Error(`Firebase (${project}): власник робочого простору не збігається з поточним акаунтом. Доступ іншому користувачу не надається автоматично.`)
    }
    throw Error(`Firebase (${project}): запис ${target} відхилено, хоча власника підтверджено і локальна перевірка полів успішна. Це НЕ доводить, що саме структура неправильна: причина може бути в опублікованих правилах або поведінці їх перевірки. Активний workspace ID: ${workspaceId}. Для точної причини потрібен Firestore Emulator Suite → Requests або Rules Playground із повним документом. Не відкривай доступ усім.`)
  }
}


/** Sales inputs are workspace-specific, monthly, and independent of calendar shifts. */
export function subscribeMonthlySales(
  workspaceId:string,
  onChange:(items:Record<string,number>)=>void,
  onError:(error:Error)=>void,
):Unsubscribe {
  if(!db)return ()=>undefined
  return onSnapshot(collection(db,'workspaces',workspaceId,'monthlySales'),snapshot=>{
    try {
      const items:Record<string,number>={}
      for(const item of snapshot.docs){
        const record:MonthlySales={month:item.id,amount:item.data().amount}
        validateMonthlySales(record)
        items[item.id]=record.amount
      }
      onChange(items)
    }catch(err){onError(err instanceof Error?err:new Error('Помилка показників продажів.'))}
  },onError)
}
export async function saveMonthlySales(workspaceId:string,record:MonthlySales):Promise<void>{
  const firestore=db
  if(!firestore)throw Error('Firebase не налаштовано')
  if(!navigator.onLine)throw Error('Потрібен інтернет для збереження продажів.')
  validateMonthlySales(record)
  await setDoc(doc(firestore,'workspaces',workspaceId,'monthlySales',record.month),{
    amount:record.amount,updatedAt:serverTimestamp(),
  })
}

/** Generic monthly completed work counter: deliveries, items, tasks, services, etc. */
export function subscribeMonthlyUnits(
  workspaceId:string,
  onChange:(items:Record<string,number>)=>void,
  onError:(error:Error)=>void,
):Unsubscribe {
  if(!db)return ()=>undefined
  return onSnapshot(collection(db,'workspaces',workspaceId,'monthlyUnits'),snapshot=>{
    try{
      const items:Record<string,number>={}
      for(const item of snapshot.docs){
        const record:MonthlyUnits={month:item.id,count:item.data().count}
        validateMonthlyUnits(record)
        items[item.id]=record.count
      }
      onChange(items)
    }catch(err){onError(err instanceof Error?err:new Error('Помилка даних про обсяг роботи.'))}
  },onError)
}
export async function saveMonthlyUnits(workspaceId:string,record:MonthlyUnits):Promise<void>{
  const firestore=db
  if(!firestore)throw Error('Firebase не налаштовано')
  if(!navigator.onLine)throw Error('Потрібен інтернет для збереження обсягу роботи.')
  validateMonthlyUnits(record)
  await setDoc(doc(firestore,'workspaces',workspaceId,'monthlyUnits',record.month),{
    count:record.count,updatedAt:serverTimestamp(),
  })
}

// Optional daily cash; stored separately from shifts and salary so other professions remain unaffected.
import {validateDailyCash,validateCashPreferences,defaultCashPreferences,type DailyCash,type CashPreferences} from './dailyCash'
export type {DailyCash,CashPreferences} from './dailyCash'
export function subscribeDailyCash(workspaceId:string,onChange:(records:DailyCash[])=>void,onError:(e:Error)=>void):Unsubscribe{
  if(!db)return ()=>undefined
  return onSnapshot(collection(db,'workspaces',workspaceId,'dailyCash'),snap=>{
    try{
      const records=snap.docs.map(item=>({date:item.id,amount:item.data().amount}))
      records.forEach(validateDailyCash)
      onChange(records)
    }catch(e){onError(e instanceof Error?e:new Error('Помилка журналу каси.'))}
  },onError)
}
export async function saveDailyCash(workspaceId:string,record:DailyCash):Promise<void>{
  if(!db)throw Error('Firebase не налаштовано')
  if(!navigator.onLine)throw Error('Для збереження каси потрібен інтернет.')
  validateDailyCash(record)
  await setDoc(doc(db,'workspaces',workspaceId,'dailyCash',record.date),{amount:record.amount,updatedAt:serverTimestamp()})
}
export async function removeDailyCash(workspaceId:string,date:string):Promise<void>{
  if(!db)throw Error('Firebase не налаштовано')
  if(!navigator.onLine)throw Error('Для видалення каси потрібен інтернет.')
  validateDailyCash({date,amount:0})
  await deleteDoc(doc(db,'workspaces',workspaceId,'dailyCash',date))
}
export function subscribeCashPreferences(workspaceId:string,onChange:(value:CashPreferences)=>void,onError:(e:Error)=>void):Unsubscribe{
  if(!db)return ()=>undefined
  return onSnapshot(doc(db,'workspaces',workspaceId,'settings','cash'),snapshot=>{
    try{
      if(!snapshot.exists()){onChange({...defaultCashPreferences});return}
      const data=snapshot.data()
      const next={enabled:data.enabled,useForSales:data.useForSales}
      validateCashPreferences(next)
      onChange(next)
    }catch(e){onError(e instanceof Error?e:new Error('Помилка налаштувань каси.'))}
  },onError)
}
export async function saveCashPreferences(workspaceId:string,prefs:CashPreferences):Promise<void>{
  if(!db)throw Error('Firebase не налаштовано')
  if(!navigator.onLine)throw Error('Потрібен інтернет для зміни налаштувань каси.')
  validateCashPreferences(prefs)
  await setDoc(doc(db,'workspaces',workspaceId,'settings','cash'),{...prefs,updatedAt:serverTimestamp()})
}

// Optional performance-plan module: one document per workspace, with monthly goal overrides.
import {defaultPerformanceSettings,parsePerformanceSettings,validatePerformanceSettings,validateMonthlyTarget,type PerformanceSettings,type MonthlyTarget} from './performance'
export type {PerformanceSettings,MonthlyTarget} from './performance'
export function subscribePerformanceSettings(workspaceId:string,onChange:(value:PerformanceSettings)=>void,onError:(e:Error)=>void):Unsubscribe{
  if(!db)return ()=>undefined
  return onSnapshot(doc(db,'workspaces',workspaceId,'settings','performance'),snapshot=>{
    try{
      if(!snapshot.exists()){onChange({...defaultPerformanceSettings,tiers:defaultPerformanceSettings.tiers.map(t=>({...t}))});return}
      // Decode every required setting. v0.9.4 omitted manualDailyPay when reading,
      // triggering a misleading local validation error after a successful Firestore write.
      const value=parsePerformanceSettings(snapshot.data())
      onChange(value)
    }catch(e){onError(e instanceof Error?e:new Error('Некоректні правила плану.'))}
  },onError)
}
export async function savePerformanceSettings(workspaceId:string,value:PerformanceSettings):Promise<void>{
  if(!db)throw Error('Firebase не налаштовано')
  if(!navigator.onLine)throw Error('Для збереження правил плану потрібен інтернет.')
  validatePerformanceSettings(value)
  await setDoc(doc(db,'workspaces',workspaceId,'settings','performance'),{...value,tiers:value.tiers.map(t=>({...t})),updatedAt:serverTimestamp()})
}
export function subscribeMonthlyTargets(workspaceId:string,onChange:(targets:Record<string,number>)=>void,onError:(e:Error)=>void):Unsubscribe{
  if(!db)return ()=>undefined
  return onSnapshot(collection(db,'workspaces',workspaceId,'monthlyTargets'),snapshot=>{
    try{
      const targets:Record<string,number>={}
      snapshot.docs.forEach(item=>{const target={month:item.id,amount:item.data().amount};validateMonthlyTarget(target);targets[item.id]=target.amount})
      onChange(targets)
    }catch(e){onError(e instanceof Error?e:new Error('Некоректні місячні плани.'))}
  },onError)
}
export async function saveMonthlyTarget(workspaceId:string,target:MonthlyTarget):Promise<void>{
  if(!db)throw Error('Firebase не налаштовано')
  if(!navigator.onLine)throw Error('Для збереження місячного плану потрібен інтернет.')
  validateMonthlyTarget(target)
  await setDoc(doc(db,'workspaces',workspaceId,'monthlyTargets',target.month),{amount:target.amount,updatedAt:serverTimestamp()})
}
export async function removeMonthlyTarget(workspaceId:string,month:string):Promise<void>{
  if(!db)throw Error('Firebase не налаштовано')
  validateMonthlyTarget({month,amount:0})
  await deleteDoc(doc(db,'workspaces',workspaceId,'monthlyTargets',month))
}

// Day-specific personal base wage (optional). Does not duplicate the daily cash ledger.
export type DailyWage={date:string;amount:number}
export function validateDailyWage(record:DailyWage):void{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(record.date)||!Number.isSafeInteger(record.amount)||record.amount<0||record.amount>100_000_000_000 ||
    Number.isNaN(Date.parse(record.date+'T12:00:00')) || new Date(record.date+'T12:00:00').toISOString().slice(0,10)!==record.date)
    throw Error('Введи правильну дату й суму заробітку за день.')
}
export function subscribeDailyWages(workspaceId:string,onChange:(value:Record<string,number>)=>void,onError:(e:Error)=>void):Unsubscribe{
  if(!db)return ()=>undefined
  return onSnapshot(collection(db,'workspaces',workspaceId,'dailyWages'),snap=>{
    try{const values:Record<string,number>={};snap.docs.forEach(item=>{const record={date:item.id,amount:item.data().amount};validateDailyWage(record);values[item.id]=record.amount});onChange(values)}
    catch(e){onError(e instanceof Error?e:new Error('Некоректні дані заробітку за день.'))}
  },onError)
}
export async function saveDailyWage(workspaceId:string,value:DailyWage):Promise<void>{
  if(!db)throw Error('Firebase не налаштовано')
  if(!navigator.onLine)throw Error('Для збереження заробітку потрібен інтернет.')
  validateDailyWage(value)
  await setDoc(doc(db,'workspaces',workspaceId,'dailyWages',value.date),{amount:value.amount,updatedAt:serverTimestamp()})
}
export async function removeDailyWage(workspaceId:string,date:string):Promise<void>{
  if(!db)throw Error('Firebase не налаштовано')
  validateDailyWage({date,amount:0})
  await deleteDoc(doc(db,'workspaces',workspaceId,'dailyWages',date))
}
