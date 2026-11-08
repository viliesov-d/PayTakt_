import test from 'node:test'
import assert from 'node:assert/strict'
import {matchesDayButtonState,dayButtonResolution} from '../src/lib/dayButtonState.ts'

const shift=(overrides={})=>({
  id:'2026-11-08',date:'2026-11-08',dayType:'work',status:'planned',kind:'regular',
  start:'09:00',end:'18:00',breakMinutes:60,additionalShifts:[],note:'',
  ...overrides,
})

test('matching queued shift state preserves selected-day button without layout flash',()=>{
  const next=shift({status:'worked'})
  assert.equal(matchesDayButtonState(next,next),true)
  // Firestore can normalize unrelated fields; button state should still match.
  assert.equal(matchesDayButtonState({...next,note:'Тільки примітка',plannedMinutes:480},next),true)
  assert.equal(matchesDayButtonState(undefined,next),false)
  assert.equal(matchesDayButtonState(shift(),next),false)
  assert.equal(matchesDayButtonState(shift({date:'2026-11-09',status:'worked'}),next),false)
  assert.equal(matchesDayButtonState(shift({status:'worked',dayType:'off'}),next),false)
})

test('overtime and added shifts do not flash back to stale button state',()=>{
  const overtime={start:'18:00',end:'20:00',breakMinutes:0,status:'worked',basisPoints:12000}
  const extras=[{id:'extra1',start:'20:00',end:'22:00',breakMinutes:0,status:'worked',kind:'extra',note:''}]
  const desired=shift({status:'worked',overtimeExtra:overtime,additionalShifts:extras})
  assert.equal(matchesDayButtonState(desired,desired),true)
  assert.equal(matchesDayButtonState(shift({status:'worked',additionalShifts:extras}),desired),false)
  assert.equal(matchesDayButtonState(shift({status:'worked',
    overtimeExtra:{...overtime,status:'planned'},additionalShifts:extras}),desired),false)
  assert.equal(matchesDayButtonState(shift({status:'worked',overtimeExtra:overtime,
    additionalShifts:[{...extras[0],status:'planned'}]}),desired),false)
  assert.equal(matchesDayButtonState({...desired,note:'Примітка в календарі'},desired),true)
})


test('server acknowledgement, not queued overlay equality, releases visual state',()=>{
  assert.equal(dayButtonResolution(shift({status:'planned'}),shift({status:'worked'}),'pending'),'waiting')
  // Critical race: transaction removes the local edit before onSnapshot catches up.
  assert.equal(dayButtonResolution(shift({status:'planned'}),shift({status:'worked'}),undefined),'waiting')
  // Even if server currently matches, an unflushed queued revision is not yet finished.
  assert.equal(dayButtonResolution(shift({status:'worked'}),shift({status:'worked'}),'pending'),'waiting')
  assert.equal(dayButtonResolution(shift({status:'worked'}),shift({status:'worked'}),undefined),'confirmed')
})

test('offline conflict and error stay explicit; a retry can wait for acknowledgement',()=>{
  const before=shift({status:'planned'})
  const desired=shift({status:'worked'})
  assert.equal(dayButtonResolution(before,desired,'conflict'),'blocked')
  assert.equal(dayButtonResolution(before,desired,'error'),'blocked')
  assert.equal(dayButtonResolution(before,desired,'pending'),'waiting')
  assert.equal(dayButtonResolution(desired,desired,undefined),'confirmed')
  assert.equal(dayButtonResolution(undefined,desired,undefined),'waiting')
})

test('overtime confirmation waits through removal of offline entry and older snapshots',()=>{
  const before=shift({status:'worked'})
  const desired=shift({status:'worked',overtimeExtra:{
    start:'18:00',end:'20:00',breakMinutes:0,status:'worked',basisPoints:12000,
  }})
  assert.equal(dayButtonResolution(before,desired,'pending'),'waiting')
  assert.equal(dayButtonResolution(before,desired,undefined),'waiting')
  assert.equal(dayButtonResolution(desired,desired,undefined),'confirmed')
})
