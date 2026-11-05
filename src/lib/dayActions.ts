/** One-tap calendar actions. Pure helpers: UI and Firebase share the validated result. */
import {validateDay, validateOvertimePreset, type DayType, type OvertimePreset, type Shift} from './calendar.ts'

export function changeDayType(day: Shift, type: DayType): Shift {
  if (!['work','off','vacation','sick','unpaid'].includes(type)) throw Error('Невідомий тип дня.')
  const next: Shift = {
    ...day, dayType: type,
    // The scheduled denominator remains independent from sick/vacation/unpaid time.
    plannedWorkday: type==='work' ? true : (day.plannedWorkday ?? false),
    plannedMinutes: type==='work' && !(day.plannedMinutes??0) ? 480 : day.plannedMinutes,
    ...(type==='work' ? {} : {overtimeMinutes:0,overtimeExtra:undefined}),
  }
  validateDay(next)
  return next
}

/** Mark worked for a money save, without toggling it back on later edits. */
export function markWorkedForDailyPay(day: Shift): Shift {
  if ((day.dayType ?? 'work') !== 'work') throw Error('Спочатку обери робочий день.')
  const status = 'worked' as const
  const next: Shift = {
    ...day,
    status,
    overtimeExtra: day.overtimeExtra ? {...day.overtimeExtra,status} : undefined,
  }
  validateDay(next)
  return next
}

export function toggleWorkedDay(day: Shift): Shift {
  if ((day.dayType??'work') !== 'work') throw Error('Спочатку обери робочий день.')
  const status = day.status === 'worked' ? 'planned' : 'worked'
  const next: Shift = {
    ...day, status,
    // A day's overtime preset is confirmed together with its primary shift.
    overtimeExtra: day.overtimeExtra ? {...day.overtimeExtra,status} : undefined,
  }
  validateDay(next)
  return next
}

const clockMinutes = (time: string): number => Number(time.slice(0,2))*60+Number(time.slice(3))
const fmtClock = (minutes: number): string => {
  const n = ((minutes%1440)+1440)%1440
  return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`
}

/** One-tap overtime never double-counts a portion of the regular shift.
 * If the saved preset overlaps a regular/additional shift, keep its *duration*
 * and multiplier, but place the extra hours immediately after the last shift.
 * The UI explicitly tells the user the applied time instead of silently
 * changing the preset or throwing a confusing overlap error.
 */
export function togglePresetOvertime(day: Shift, preset: OvertimePreset): Shift {
  if ((day.dayType??'work') !== 'work') throw Error('Понаднормові можна додати лише в робочий день.')
  if (day.overtimeExtra) {
    const cleared = {...day, overtimeExtra:undefined}
    validateDay(cleared)
    return cleared
  }
  validateOvertimePreset(preset)
  const normal = {...day, overtimeExtra:{...preset,status:day.status}}
  try {
    validateDay(normal)
    return normal
  } catch (error) {
    // The fallback handles time overlap only. Any other invalid calendar
    // data must surface normally and must never be silently overwritten.
    if (!(error instanceof Error) || !error.message.includes('не можуть накладатися')) throw error
  }
  const baseStart = clockMinutes(day.start)
  const baseEnd = clockMinutes(day.end)
  const ends = [day,...(day.additionalShifts??[])].map(part=>{
    let start=clockMinutes(part.start), end=clockMinutes(part.end)
    if(end<=start)end+=1440
    // Match the day validator's interpretation for post-midnight segments.
    if(start<baseStart && baseEnd<=baseStart){start+=1440;end+=1440}
    return end
  })
  const latest = Math.max(...ends)
  const span = (clockMinutes(preset.end)-clockMinutes(preset.start)+1440)%1440
  const shifted = {...day,overtimeExtra:{
    ...preset,start:fmtClock(latest),end:fmtClock(latest+span),status:day.status,
  }}
  validateDay(shifted)
  return shifted
}
