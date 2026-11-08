import type {Shift} from './calendar'

/** Compare only the controls shown in the selected-day editor.
 * Firestore may reorder fields or normalize optional properties. Neither
 * wage calculations nor shift validation should depend on this UI check.
 */
export function matchesDayButtonState(saved:Shift|undefined,optimistic:Shift):boolean {
  if(!saved||saved.date!==optimistic.date)return false
  const overtime=(day:Shift)=>{
    const p=day.overtimeExtra
    return p?[p.start,p.end,p.breakMinutes,p.status,p.basisPoints].join('|'):''
  }
  const extras=(day:Shift)=>(day.additionalShifts??[])
    .map(part=>[part.id,part.kind,part.status,part.start,part.end,part.breakMinutes].join('|')).join('||')
  return (saved.dayType??'work')===(optimistic.dayType??'work')&&
    saved.status===optimistic.status&&
    saved.kind===optimistic.kind&&
    overtime(saved)===overtime(optimistic)&&
    extras(saved)===extras(optimistic)
}


export type DayButtonQueueState='pending'|'conflict'|'error'|undefined
export type DayButtonResolution='waiting'|'confirmed'|'blocked'

/** A matching optimistic *overlay* is never server confirmation.
 * The caller must pass the last server-acknowledged snapshot, and an
 * outstanding queued write blocks confirmation until it has been flushed.
 */
export function dayButtonResolution(
  serverConfirmed:Shift|undefined,
  expected:Shift,
  queueState:DayButtonQueueState,
):DayButtonResolution{
  if(queueState==='conflict'||queueState==='error')return 'blocked'
  if(queueState==='pending')return 'waiting'
  return matchesDayButtonState(serverConfirmed,expected)?'confirmed':'waiting'
}
