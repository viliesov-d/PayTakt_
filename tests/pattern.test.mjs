import test from 'node:test'
import assert from 'node:assert/strict'
import { presetPattern, generateMonthlyPattern, workSlot, offSlot, validatePattern } from '../src/lib/schedule.ts'
import { shiftHours, workedHours, shiftCount, validateDay } from '../src/lib/calendar.ts'

const month = '2026-11'
test('day/night/48 template creates the right day and night times',()=>{
  const pattern = presetPattern('day-night-48')
  const days = generateMonthlyPattern({month,anchorDate:'2026-11-01',pattern})
  assert.equal(days.length,30)
  assert.deepEqual(days.slice(0,6).map(d=>[d.dayType,d.start,d.end]), [
    ['work','08:00','20:00'],['work','20:00','08:00'],['off','09:00','18:00'],
    ['off','09:00','18:00'],['work','08:00','20:00'],['work','20:00','08:00'],
  ])
  assert.equal(days.find(x=>x.date==='2026-11-02').breakMinutes,60)
})
test('custom mixed hours and existing days are never overwritten',()=>{
  const pattern = [workSlot('06:00','14:00',30,'Ранок'),workSlot('14:00','22:00',45,'Вечір'),offSlot()]
  const days = generateMonthlyPattern({month,anchorDate:'2026-11-01',pattern},new Set(['2026-11-01','2026-11-03']))
  assert.deepEqual(days.slice(0,3).map(x=>x.date),['2026-11-02','2026-11-04','2026-11-05'])
  assert.equal(days[0].start,'14:00')
  assert.equal(days[1].start,'06:00')
  assert.equal(days.length,28)
})
test('cycle is continuous across month boundary, including leap years',()=>{
  const pattern = [workSlot('19:00','07:00',45,'Ніч'),offSlot()]
  const feb = generateMonthlyPattern({month:'2028-02',anchorDate:'2028-02-28',pattern})
  const mar = generateMonthlyPattern({month:'2028-03',anchorDate:'2028-02-28',pattern})
  assert.equal(feb.find(x=>x.date==='2028-02-29').dayType,'off')
  assert.equal(mar.find(x=>x.date==='2028-03-01').dayType,'work')
})
test('invalid cycle, break and impossible calendar dates are rejected',()=>{
  assert.throws(()=>validatePattern(Array(29).fill(workSlot())),/28/)
  assert.throws(()=>validatePattern([offSlot()]),/робочий/)
  assert.throws(()=>validatePattern([workSlot('09:00','10:00',60)]),/Перерва/)
  assert.throws(()=>generateMonthlyPattern({month,anchorDate:'2026-02-30',pattern:[workSlot()]}),/дата/)
})
const base = {id:'2026-11-02',date:'2026-11-02',start:'09:00',end:'18:00',breakMinutes:60,status:'worked',kind:'regular',note:'',dayType:'work'}
test('multiple non-overlapping shifts count independently and worked hours exclude planned',()=>{
  const day={...base,additionalShifts:[{id:'extra1',start:'18:00',end:'22:00',breakMinutes:0,status:'planned',kind:'extra',note:''}]}
  validateDay(day)
  assert.equal(shiftHours(day),12)
  assert.equal(workedHours(day),8)
  assert.equal(shiftCount(day),2)
})
test('overlapping time segments are rejected and off day has zero paid hours',()=>{
  const day={...base,additionalShifts:[{id:'overlap',start:'17:00',end:'22:00',breakMinutes:0,status:'planned',kind:'extra',note:''}]}
  assert.throws(()=>validateDay(day),/перекриватися/)
  assert.equal(shiftHours({...base,dayType:'vacation'}),0)
  assert.equal(workedHours({...base,dayType:'sick'}),0)
  assert.equal(shiftCount({...base,dayType:'off'}),0)
})
test('overnight shift duration with a break is computed',()=>{
  const shift={...base,start:'20:00',end:'08:00',breakMinutes:60}
  validateDay(shift)
  assert.equal(shiftHours(shift),11)
})
