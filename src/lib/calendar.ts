/** Pure calendar-day, shift and paid-time helpers. No Firebase or UI imports. */
export type DayType = 'work' | 'off' | 'vacation' | 'sick' | 'unpaid'
export type ShiftKind = 'regular' | 'extra' | 'replacement'
export type AdditionalShift = {
  id: string
  start: string
  end: string
  breakMinutes: number
  status: 'planned' | 'worked'
  kind: ShiftKind
  note: string
}
/** A separately added overtime interval, paid at its own full multiplier. */
export type OvertimeExtra = {
  start: string
  end: string
  breakMinutes: number
  status: 'planned' | 'worked'
  basisPoints: number
}
export type OvertimePreset = Pick<OvertimeExtra,'start'|'end'|'breakMinutes'|'basisPoints'>
export const defaultOvertimePreset: OvertimePreset = {start:'18:00',end:'20:00',breakMinutes:0,basisPoints:12000}
export function validateOvertimePreset(p: OvertimePreset): void {
  if (!p || p.start===p.end || !Number.isSafeInteger(p.basisPoints) || p.basisPoints<10000 || p.basisPoints>100000 ||
      !Number.isSafeInteger(p.breakMinutes) || p.breakMinutes<0 || p.breakMinutes>1439 ||
      segmentHours(p)<=0) throw Error('Перевір час, перерву та ставку понаднормових (100–1000%).')
}
export function overtimeExtraMinutes(shift:Shift): number {
  return shift.dayType && shift.dayType!=='work' || shift.overtimeExtra?.status!=='worked' ? 0 :
    Math.round(segmentHours(shift.overtimeExtra)*60)
}
export type Shift = {
  id: string
  date: string
  start: string
  end: string
  breakMinutes: number
  status: 'planned' | 'worked'
  note: string
  dayType?: DayType // v0.2 documents without this field are regular workdays
  kind?: ShiftKind
  additionalShifts?: AdditionalShift[]
  /** Paid minutes manually identified as overtime, a subset of worked time. */
  overtimeMinutes?: number
  /** Independent interval added with a saved overtime preset (not included in base shift hours). */
  overtimeExtra?: OvertimeExtra
  /** Immutable planned workload for monthly salary norms when leave is entered. */
  plannedWorkday?: boolean
  plannedMinutes?: number
}

export function segmentHours(s: Pick<AdditionalShift, 'start' | 'end' | 'breakMinutes'>): number {
  const match = /^([01]\d|2[0-3]):[0-5]\d$/
  if (!match.test(s.start) || !match.test(s.end) ||
      !Number.isInteger(s.breakMinutes) || s.breakMinutes < 0) return 0
  const [sh, sm] = s.start.split(':').map(Number)
  const [eh, em] = s.end.split(':').map(Number)
  let minutes = (eh * 60 + em) - (sh * 60 + sm)
  if (minutes <= 0) minutes += 1440 // Clock-only estimate; DST requires a later timezone-aware engine.
  return Math.max(0, (minutes - s.breakMinutes) / 60)
}
export function shiftHours(s: Shift): number {
  if (s.dayType && s.dayType !== 'work') return 0
  return segmentHours(s) + (s.additionalShifts || []).reduce((sum,part)=>sum+segmentHours(part),0)
}
export function workedHours(s: Shift): number {
  if (s.dayType && s.dayType !== 'work') return 0
  return (s.status === 'worked' ? segmentHours(s) : 0)
    + (s.additionalShifts||[]).reduce((sum, part)=>sum+(part.status==='worked'?segmentHours(part):0),0)
    + overtimeExtraMinutes(s)/60
}
export function shiftCount(s: Shift): number {
  return s.dayType && s.dayType !== 'work' ? 0 : 1+(s.additionalShifts?.length || 0)
}
export function validateDay(s: Shift): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s.date) ||
      !['work','off','vacation','sick','unpaid'].includes(s.dayType ?? 'work')) throw Error('Перевір дату та статус дня.')
  const [year, month, day] = s.date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year,month-1,day))
  if (year < 1900 || year > 2100 || parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month-1 || parsed.getUTCDate() !== day)
    throw Error('Некоректна календарна дата.')
  if (s.overtimeMinutes != null && (!Number.isSafeInteger(s.overtimeMinutes) || s.overtimeMinutes<0 || s.overtimeMinutes>1440*5))
    throw Error('Понаднормові хвилини мають бути цілим невід’ємним числом.')
  if (s.plannedWorkday != null && typeof s.plannedWorkday !== 'boolean') throw Error('Некоректний плановий день.')
  if (s.plannedMinutes != null && (!Number.isSafeInteger(s.plannedMinutes) || s.plannedMinutes<0 || s.plannedMinutes>1440)) throw Error('Некоректна планова норма годин.')
  if ((s.dayType??'work')==='work' && (s.overtimeMinutes??0)>Math.round(shiftHours(s)*60))
    throw Error('Позначених понаднормових годин не може бути більше за фактично відпрацьовані.')
  if(s.overtimeExtra){
    validateOvertimePreset(s.overtimeExtra)
    if(!['planned','worked'].includes(s.overtimeExtra.status))throw Error('Некоректний статус додаткових понаднормових.')
    if((s.dayType??'work')!=='work')throw Error('Додаткові понаднормові доступні лише для робочого дня.')
    // These are an independent interval: do not overlap another shift in this day.
    const clock=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3))
    const baseStart=clock(s.start)
    const range=(part:Pick<AdditionalShift,'start'|'end'>)=>{
      let start=clock(part.start),end=clock(part.end)
      if(end<=start)end+=1440
      // A night shift ending next morning can be followed by overtime that morning.
      if(start<baseStart && clock(s.end)<=baseStart){start+=1440;end+=1440}
      return {start,end}
    }
    const ot=range(s.overtimeExtra)
    for(const part of [s,...(s.additionalShifts||[])]){
      const regular=range(part)
      if(regular.start<ot.end && ot.start<regular.end)
        throw Error('Додаткові понаднормові не можуть накладатися на звичайну чи додаткову зміну.')
    }
  }
  const extras = s.additionalShifts ?? []
  if (!Array.isArray(extras) || extras.length>4) throw Error('Дозволено не більше п’яти змін на день.')
  const segments = [s,...extras]
  for (const segment of segments) {
    if (!['planned','worked'].includes(segment.status) || typeof segment.note !== 'string' ||
        segment.note.length > 400 || !Number.isInteger(segment.breakMinutes) ||
        segment.breakMinutes < 0 || segment.breakMinutes > 1439 ||
        (segmentHours(segment)<=0 && (s.dayType??'work')==='work'))
      throw Error('Перевір час, перерву та статус кожної зміни.')
  }
  if ((s.dayType??'work')==='work') {
    const intervals = segments.map(segment=>{
      const [h,m]=segment.start.split(':').map(Number)
      const [endH,endM]=segment.end.split(':').map(Number)
      const start=h*60+m
      let end=endH*60+endM
      if(end<=start)end+=1440
      return {start,end}
    })
    for(let i=0;i<intervals.length;i++)for(let j=i+1;j<intervals.length;j++){
      if(intervals[i].start<intervals[j].end&&intervals[j].start<intervals[i].end)
        throw Error('Зміни в одному дні не повинні перекриватися за часом.')
    }
  }
  const ids = extras.map(x=>x.id)
  if (new Set(ids).size !== ids.length || extras.some(x=>!x.id || x.id.length>70 || !['regular','extra','replacement'].includes(x.kind)))
    throw Error('Некоректні додаткові зміни.')
}

