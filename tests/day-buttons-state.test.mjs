import test from 'node:test'
import assert from 'node:assert/strict'
import {matchesDayButtonState} from '../src/lib/dayButtonState.ts'

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
