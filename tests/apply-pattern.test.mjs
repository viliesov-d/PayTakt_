import test from 'node:test'
import assert from 'node:assert/strict'
import {
  presetPattern, workSlot, offSlot, copyWorkdayToAll,
  generateMonthlyPattern, planPatternApplication,
} from '../src/lib/schedule.ts'
import { validateDay } from '../src/lib/calendar.ts'
const options={month:'2026-11',anchorDate:'2026-11-01'}
const source=generateMonthlyPattern({...options,pattern:presetPattern('2/2')})
const one=(index)=>({...source[index]})
test('one modified day copies hours, break and label to every working slot; keeps rest days',()=>{
  const pattern=presetPattern('4/2')
  const changed=[{...pattern[0],start:'12:00',end:'23:00',breakMinutes:40,label:'Мій робочий день'},...pattern.slice(1)]
  const all=copyWorkdayToAll(changed,0)
  assert.equal(all.length,6)
  assert.ok(all.slice(0,4).every(x=>x.start==='12:00'&&x.end==='23:00'&&x.breakMinutes===40&&x.label==='Мій робочий день'))
  assert.deepEqual(all.slice(4).map(x=>x.type),['off','off'])
  assert.equal(pattern[1].start,'09:00','copy does not mutate source')
})
test('copying an off day is blocked',()=>{
  assert.throws(()=>copyWorkdayToAll([workSlot(),offSlot()],1),/робочого/)
})
test('filled planned month can be updated with edited template',()=>{
  const next=generateMonthlyPattern({...options,pattern:[workSlot('07:00','15:00',30),workSlot('07:00','15:00',30),offSlot(),offSlot()]})
  const {write,summary}=planPatternApplication(next,source,'update-planned')
  assert.equal(write.length,16)
  assert.equal(summary.created,0)
  assert.equal(summary.updated,16)
  assert.equal(summary.unchanged,14)
})
test('missing-only mode does not modify previously scheduled dates',()=>{
  const existing=source.slice(0,10)
  const {write,summary}=planPatternApplication(source,existing,'missing')
  assert.equal(write.length,20)
  assert.equal(summary.created,20)
  assert.equal(summary.unchanged,10)
  assert.equal(summary.updated,0)
})
test('confirmed, leave and complex days protected; simple pending days updated',()=>{
  const next=generateMonthlyPattern({...options,pattern:[workSlot('08:00','16:00',30),offSlot()]})
  const existing=[
    {...one(0),status:'worked'},
    {...one(1),dayType:'vacation'},
    {...one(2),kind:'replacement'},
    {...one(3),additionalShifts:[{id:'x',start:'18:00',end:'21:00',breakMinutes:0,status:'planned',kind:'extra',note:''}]},
    {...one(4),start:'10:00'},
  ]
  const {write,summary}=planPatternApplication(next,existing,'update-planned')
  assert.equal(summary.protected,4)
  assert.equal(summary.updated,1)
  assert.ok(write.some(d=>d.date===source[4].date))
  assert.equal(write.some(d=>d.date===source[0].date),false)
})
test('if the resulting pattern equals existing records it is not rewritten',()=>{
  const {write,summary}=planPatternApplication(source,source,'update-planned')
  assert.equal(write.length,0)
  assert.equal(summary.unchanged,30)
})
test('invalid real calendar dates are rejected before Firestore write',()=>{
  assert.throws(()=>validateDay({...one(0),date:'2026-02-30'}),/календарна дата/)
  assert.throws(()=>validateDay({...one(0),date:'2026-11-00'}),/дату/)
  assert.throws(()=>validateDay({...one(0),date:'2026-11-01',note:undefined}),/Перевір час/)
})
