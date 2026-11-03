import test from 'node:test'
import assert from 'node:assert/strict'
import {changeDayType,toggleWorkedDay,togglePresetOvertime} from '../src/lib/dayActions.ts'
import {defaultOvertimePreset,validateDay,workedHours} from '../src/lib/calendar.ts'

const day = () => ({id:'2026-11-05',date:'2026-11-05',start:'09:00',end:'18:00',breakMinutes:60,status:'planned',note:'',dayType:'work',kind:'regular',plannedWorkday:true,plannedMinutes:480,additionalShifts:[],overtimeMinutes:0})
test('one tap marks regular workday worked and restores planned status',()=>{
  const done=toggleWorkedDay(day())
  assert.equal(done.status,'worked')
  assert.equal(workedHours(done),8)
  const planned=toggleWorkedDay(done)
  assert.equal(planned.status,'planned')
  assert.equal(workedHours(planned),0)
})
test('one tap overtime is a toggle: no duplicated time and preserves configured multiplier',()=>{
  const done=toggleWorkedDay(day())
  const added=togglePresetOvertime(done,defaultOvertimePreset)
  assert.equal(added.overtimeExtra.basisPoints,12000)
  assert.equal(added.overtimeExtra.status,'worked')
  assert.equal(workedHours(added),10)
  const removed=togglePresetOvertime(added,defaultOvertimePreset)
  assert.equal(removed.overtimeExtra,undefined)
  assert.equal(workedHours(removed),8)
  validateDay(removed)
})
test('confirming worked day also confirms previously scheduled added overtime',()=>{
  const scheduled=togglePresetOvertime(day(),defaultOvertimePreset)
  assert.equal(scheduled.overtimeExtra.status,'planned')
  assert.equal(workedHours(scheduled),0)
  const done=toggleWorkedDay(scheduled)
  assert.equal(done.overtimeExtra.status,'worked')
  assert.equal(workedHours(done),10)
  const revoked=toggleWorkedDay(done)
  assert.equal(revoked.overtimeExtra.status,'planned')
  assert.equal(workedHours(revoked),0)
})
test('quick change day type keeps plan norm but removes incompatible overtime',()=>{
  const withOt=togglePresetOvertime(day(),defaultOvertimePreset)
  const leave=changeDayType(withOt,'vacation')
  assert.equal(leave.plannedWorkday,true)
  assert.equal(leave.plannedMinutes,480)
  assert.equal(leave.overtimeExtra,undefined)
  assert.equal(leave.overtimeMinutes,0)
  assert.equal(workedHours(leave),0)
  assert.throws(()=>toggleWorkedDay(leave),/робочий день/)
})
test('one-click overtime shifts conflicting preset to after the workday, maintaining paid duration',()=>{
  const base={...day(),start:'09:00',end:'21:00',breakMinutes:0,status:'worked'}
  const extra=togglePresetOvertime(base,{...defaultOvertimePreset,start:'18:00',end:'20:00'})
  assert.equal(extra.overtimeExtra.start,'21:00')
  assert.equal(extra.overtimeExtra.end,'23:00')
  assert.equal(extra.overtimeExtra.basisPoints,12000)
  assert.equal(workedHours(extra),14)
  assert.equal(togglePresetOvertime(extra,defaultOvertimePreset).overtimeExtra,undefined)
})
test('overlapping overtime after a night shift is appended in the morning',()=>{
  const base={...day(),start:'19:00',end:'03:00',breakMinutes:0,status:'worked'}
  const result=togglePresetOvertime(base,{...defaultOvertimePreset,start:'22:00',end:'00:00'})
  assert.equal(result.overtimeExtra.start,'03:00')
  assert.equal(result.overtimeExtra.end,'05:00')
  assert.equal(workedHours(result),10)
})
test('quick overtime still rejects non-work days',()=>{
  assert.throws(()=>togglePresetOvertime(changeDayType(day(),'off'),defaultOvertimePreset),/робочий день/)
})
