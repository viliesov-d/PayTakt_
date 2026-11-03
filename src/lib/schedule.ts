/** Cyclic schedule generator. Calculations use civil calendar days in UTC, not elapsed local milliseconds. */
export type GeneratedShift = {
  id: string
  date: string
  start: string
  end: string
  breakMinutes: number
  status: 'planned'
  note: string
}

export type CycleOptions = {
  month: string // YYYY-MM
  anchorDate: string // first workday of the cycle (YYYY-MM-DD)
  workDays: number
  restDays: number
  start: string
  end: string
  breakMinutes: number
}

const MILLIS_PER_DAY = 86_400_000
const isoDay = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const isoMonth = /^\d{4}-(0[1-9]|1[0-2])$/
const clock = /^([01]\d|2[0-3]):[0-5]\d$/

function dayNumber(iso: string): number {
  if (!isoDay.test(iso)) throw new Error('Некоректна дата початку циклу.')
  const [year, month, day] = iso.split('-').map(Number)
  const value = Date.UTC(year, month - 1, day)
  const parsed = new Date(value)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day)
    throw new Error('Некоректна календарна дата.')
  return Math.floor(value / MILLIS_PER_DAY)
}

export function generateMonthlyCycle(
  options: CycleOptions,
  existingDates: ReadonlySet<string> = new Set(),
): GeneratedShift[] {
  const {month, anchorDate, workDays, restDays, start, end, breakMinutes} = options
  if (!isoMonth.test(month)) throw new Error('Некоректний місяць.')
  if (!Number.isInteger(workDays) || workDays < 1 || workDays > 14 ||
      !Number.isInteger(restDays) || restDays < 0 || restDays > 14 || workDays + restDays > 28)
    throw new Error('У циклі можна встановити 1–14 робочих та 0–14 вихідних днів.')
  if (!clock.test(start) || !clock.test(end)) throw new Error('Вкажи час початку та завершення зміни.')
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 1439)
    throw new Error('Перерва має бути в межах 0–1439 хвилин.')
  const [year, m] = month.split('-').map(Number)
  if (year < 1900 || year > 2100) throw new Error('Місяць поза допустимим діапазоном.')
  const startTime = Number(start.slice(0,2))*60+Number(start.slice(3))
  const endTime = Number(end.slice(0,2))*60+Number(end.slice(3))
  const duration = (endTime - startTime + 1440) % 1440 || 1440
  if (breakMinutes >= duration) throw new Error('Перерва не може дорівнювати тривалості зміни або перевищувати її.')
  const anchor = dayNumber(anchorDate)
  const length = new Date(Date.UTC(year,m,0)).getUTCDate()
  const cycleLength = workDays + restDays
  const result: GeneratedShift[] = []
  for (let day=1; day<=length; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`
    const position = ((dayNumber(date) - anchor) % cycleLength + cycleLength) % cycleLength
    if (position >= workDays || existingDates.has(date)) continue
    result.push({id: date, date, start, end, breakMinutes, status:'planned', note:'Створено за шаблоном графіка'})
  }
  return result
}

/** v0.3: each position in a repeating cycle can have independent working hours. */
export type PatternDay = {
  type: 'work' | 'off'
  start: string
  end: string
  breakMinutes: number
  label: string
}
export type TemplatePreset = '2/2' | '4/2' | '5/2' | '5/2-weekdays' | 'day-night-48' | '1/1' | '2/1' | '1/2' | '3/1' | '3/3' | '4/4' | '6/1' | '7/7' | 'duty-24-72' | 'night-2/2' | 'custom'
export type ScheduleTemplate = {
  id: string
  name: string
  anchorDate: string
  pattern: PatternDay[]
}
export type GeneratedCalendarDay = GeneratedShift & {
  dayType: 'work' | 'off'
  kind: 'regular'
  additionalShifts: []
  plannedWorkday: boolean
  plannedMinutes: number
}
export const workSlot = (start = '09:00', end = '18:00', breakMinutes = 60, label = 'Робочий день'): PatternDay =>
  ({type: 'work', start, end, breakMinutes, label})
export const offSlot = (): PatternDay => ({type:'off', start:'09:00', end:'18:00', breakMinutes:0, label:'Вихідний за графіком'})
/** Returns the Monday of the calendar week containing a civil ISO date.
 * Anchor is stable across month boundaries and DST changes.
 */
export function mondayOfWeek(iso: string): string {
  const ordinal = dayNumber(iso)
  const weekday = new Date(ordinal * MILLIS_PER_DAY).getUTCDay() // Sun = 0
  const offset = (weekday + 6) % 7 // Mon = 0, Sun = 6
  return new Date((ordinal - offset) * MILLIS_PER_DAY).toISOString().slice(0, 10)
}

/** This preset is anchored to Monday, unlike a rotating 5/2 cycle. */
export const WEEKDAY_FIVE_TWO_PRESET: TemplatePreset = '5/2-weekdays'

export function presetPattern(preset: TemplatePreset): PatternDay[] {
  if (preset === 'custom') return [workSlot()]
  if (preset === WEEKDAY_FIVE_TWO_PRESET) return [
    workSlot('09:00','18:00',60,'Понеділок'),
    workSlot('09:00','18:00',60,'Вівторок'),
    workSlot('09:00','18:00',60,'Середа'),
    workSlot('09:00','18:00',60,'Четвер'),
    workSlot('09:00','18:00',60,'П’ятниця'),
    {...offSlot(),label:'Субота — вихідний'},
    {...offSlot(),label:'Неділя — вихідний'},
  ]
  if (preset === 'duty-24-72') return [workSlot('08:00','08:00',60,'Добова зміна'),offSlot(),offSlot(),offSlot()]
  if (preset === 'night-2/2') return [workSlot('20:00','08:00',60,'Нічна зміна'),workSlot('20:00','08:00',60,'Нічна зміна'),offSlot(),offSlot()]
  if (preset === 'day-night-48') return [
    workSlot('08:00', '20:00', 60, 'Денна зміна'),
    workSlot('20:00', '08:00', 60, 'Нічна зміна'),
    offSlot(), offSlot(),
  ]
  const [work, rest] = preset.split('/').map(Number)
  return [...Array.from({length:work},()=>workSlot()), ...Array.from({length:rest},()=>offSlot())]
}

export function validatePattern(pattern: PatternDay[]): void {
  if (!Array.isArray(pattern) || !pattern.length || pattern.length > 28)
    throw Error('Цикл має містити від 1 до 28 днів.')
  if (!pattern.some(day => day.type === 'work')) throw Error('Додай щонайменше один робочий день до циклу.')
  for (const day of pattern) {
    if (!day || !['work', 'off'].includes(day.type) || typeof day.label !== 'string' || day.label.length > 70)
      throw Error('Некоректний день у шаблоні.')
    if (!clock.test(day.start) || !clock.test(day.end) ||
        !Number.isInteger(day.breakMinutes) || day.breakMinutes < 0 || day.breakMinutes > 1439)
      throw Error('Перевір час і перерву в шаблоні.')
    if (day.type === 'work') {
      const startMinutes = Number(day.start.slice(0,2)) * 60 + Number(day.start.slice(3))
      const endMinutes = Number(day.end.slice(0,2)) * 60 + Number(day.end.slice(3))
      const length = ((endMinutes-startMinutes+1440) % 1440) || 1440
      if (day.breakMinutes >= length) throw Error('Перерва не може дорівнювати тривалості зміни або перевищувати її.')
    }
  }
}

/** Includes rest days as explicit entries, so a later fill never replaces an approved day off.
 * Existing records are skipped, never overwritten. A cycle flows continuously across months.
 */
export function generateMonthlyPattern(
  options: {month:string; anchorDate:string; pattern:PatternDay[]},
  existingDates: ReadonlySet<string> = new Set(),
): GeneratedCalendarDay[] {
  const {month, anchorDate, pattern} = options
  if (!isoMonth.test(month)) throw Error('Некоректний місяць.')
  const [year, m] = month.split('-').map(Number)
  if (year < 1900 || year > 2100) throw Error('Місяць поза допустимим діапазоном.')
  validatePattern(pattern)
  const anchor = dayNumber(anchorDate)
  const monthDays = new Date(Date.UTC(year,m,0)).getUTCDate()
  const result: GeneratedCalendarDay[] = []
  for (let day=1; day<=monthDays; day++) {
    const date = `${month}-${String(day).padStart(2,'0')}`
    if (existingDates.has(date)) continue
    const position = ((dayNumber(date)-anchor)%pattern.length+pattern.length)%pattern.length
    const slot = pattern[position]
    result.push({
      id:date, date, start:slot.start, end:slot.end,
      breakMinutes:slot.breakMinutes, status:'planned', note:slot.label,
      dayType:slot.type === 'off' ? 'off' : 'work', kind:'regular', additionalShifts:[],
      plannedWorkday:slot.type==='work', plannedMinutes:slot.type==='work' ? Math.round((((Number(slot.end.slice(0,2))*60+Number(slot.end.slice(3)))-(Number(slot.start.slice(0,2))*60+Number(slot.start.slice(3)))+1440)%1440 || 1440)-slot.breakMinutes) : 0,
    })
  }
  return result
}


/** v0.4.1: Pure application plan used by the calendar preview and demo mode.
 * Existing confirmed, leave and complex day records are never silently overwritten.
 */
import type { Shift } from './calendar'
export type PatternApplyMode = 'missing' | 'update-planned'
export type PatternApplySummary = { created:number; updated:number; protected:number; unchanged:number }

export function isProtectedPatternDay(existing: Pick<Shift,'status'|'dayType'|'kind'|'additionalShifts'|'overtimeMinutes'|'overtimeExtra'>): boolean {
  return existing.status === 'worked' ||
    (existing.overtimeMinutes??0)>0 ||
    Boolean(existing.overtimeExtra) ||
    !['work','off'].includes(existing.dayType ?? 'work') ||
    (existing.kind ?? 'regular') !== 'regular' ||
    (existing.additionalShifts?.length ?? 0) > 0 ||
    (existing.additionalShifts ?? []).some(extra => extra.status === 'worked')
}

export function samePatternDay(existing: Pick<Shift,'start'|'end'|'breakMinutes'|'dayType'|'status'|'kind'|'note'>, generated: GeneratedCalendarDay): boolean {
  return existing.start === generated.start && existing.end === generated.end &&
    existing.breakMinutes === generated.breakMinutes &&
    (existing.dayType ?? 'work') === generated.dayType &&
    existing.status === generated.status &&
    (existing.kind ?? 'regular') === generated.kind &&
    existing.note === generated.note
}

export function planPatternApplication(
  generated: readonly GeneratedCalendarDay[],
  existing: readonly Shift[],
  mode: PatternApplyMode,
): { write:GeneratedCalendarDay[]; summary:PatternApplySummary } {
  const oldByDate = new Map(existing.map(s=>[s.date,s]))
  const summary:PatternApplySummary = { created:0, updated:0, protected:0, unchanged:0 }
  const write:GeneratedCalendarDay[] = []
  for(const day of generated) {
    const old = oldByDate.get(day.date)
    if(!old){summary.created++;write.push(day);continue}
    if(isProtectedPatternDay(old)){summary.protected++;continue}
    if(mode==='missing'){summary.unchanged++;continue}
    if(samePatternDay(old,day)){summary.unchanged++;continue}
    summary.updated++;write.push(day)
  }
  return {write,summary}
}

/** Copies an edited day's hours, unpaid break and label to all *working* slots.
 * The work/rest sequence stays intact (off days remain off).
 */
export function copyWorkdayToAll(pattern: readonly PatternDay[], index: number): PatternDay[] {
  validatePattern([...pattern])
  if(!Number.isInteger(index) || index<0 || index>=pattern.length)throw Error('Оберіть день циклу.')
  const source=pattern[index]
  if(source.type!=='work')throw Error('Копіювання доступне лише для робочого дня.')
  return pattern.map(slot=>slot.type==='work' ? {...slot, start:source.start,end:source.end,breakMinutes:source.breakMinutes,label:source.label} : {...slot})
}
