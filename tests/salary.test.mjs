import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePay, defaultPaySettings, validatePaySettings, moneyUA } from '../src/lib/salary.ts'
const day = (date='2026-11-01', overrides={})=>({
  id:date,date,start:'09:00',end:'18:00',breakMinutes:60,status:'worked',
  dayType:'work',kind:'regular',note:'',additionalShifts:[],...overrides,
})
const pay=(settings={})=>({...defaultPaySettings,...settings})
test('hourly wage is calculated in kopeks from actually worked minutes',()=>{
  const r=calculatePay([day()], '2026-11',pay({hourlyRate:15000}))
  assert.equal(r.workedMinutes,480)
  assert.equal(r.gross,120000)
  assert.equal(r.workedDays,1)
  assert.equal(r.workedSegments,1)
})
test('planned work is not paid',()=>{
  const r=calculatePay([day('2026-11-01',{status:'planned'})], '2026-11',pay({hourlyRate:50000,monthlyBonus:200000}))
  assert.equal(r.gross,0)
})
test('off, sick, vacation, unpaid days never count even if mistakenly marked worked',()=>{
  const days=['off','sick','vacation','unpaid'].map((dayType,i)=>day(`2026-11-0${i+1}`,{dayType}))
  const r=calculatePay(days,'2026-11',pay({hourlyRate:10000,workdayBonus:25000}))
  assert.equal(r.gross,0)
})
test('overnight time and breaks are accounted, with calendar attribution to start date',()=>{
  const r=calculatePay([day('2026-11-30',{start:'20:00',end:'08:00',breakMinutes:60})],'2026-11',pay({hourlyRate:20000}))
  assert.equal(r.workedMinutes,660)
  assert.equal(r.gross,220000)
  assert.equal(calculatePay([day('2026-11-30',{start:'20:00',end:'08:00',breakMinutes:60})],'2026-12',pay({hourlyRate:20000})).gross,0)
})
test('per shift wage only uses confirmed segments; extra bonus for extra/replacement',()=>{
  const d=day('2026-11-02',{additionalShifts:[
    {id:'a',start:'18:00',end:'20:00',breakMinutes:0,status:'worked',kind:'extra',note:''},
    {id:'b',start:'20:00',end:'22:00',breakMinutes:0,status:'planned',kind:'extra',note:''},
  ]})
  const r=calculatePay([d],'2026-11',pay({mode:'per_shift',shiftRate:50000,workdayBonus:10000,extraShiftBonus:15000,monthlyBonus:20000}))
  assert.equal(r.workedSegments,2)
  assert.equal(r.extraSegments,1)
  assert.equal(r.gross,145000)
})
test('monthly salary uses explicit norm, not dynamic weekday/off-day denominator',()=>{
  const r=calculatePay([day('2026-11-02'),day('2026-11-03'),day('2026-11-04',{dayType:'off'})],'2026-11',pay({mode:'monthly',monthlySalary:3000000,monthlyNormDays:20,monthlyNormSource:'manual'}))
  assert.equal(r.gross,300000)
  assert.equal(r.workedDays,2)
})
test('monthly pay is capped to defined norm to avoid accidental overpayment',()=>{
  const r=calculatePay([day('2026-11-01'),day('2026-11-02'),day('2026-11-03')],'2026-11',pay({mode:'monthly',monthlySalary:1200000,monthlyNormDays:2,monthlyNormSource:'manual'}))
  assert.equal(r.gross,1200000)
})
test('extras completed while primary planned are paid and count as a worked day',()=>{
  const r=calculatePay([day('2026-11-01',{status:'planned',additionalShifts:[{id:'a',start:'18:00',end:'21:00',breakMinutes:0,status:'worked',kind:'extra',note:''}]})], '2026-11',pay({hourlyRate:10000,workdayBonus:60000,extraShiftBonus:20000}))
  assert.equal(r.workedDays,1)
  assert.equal(r.workedSegments,1)
  assert.equal(r.gross,110000)
})
test('rounding to whole kopeks occurs once for total hourly work',()=>{
  const r=calculatePay([day('2026-11-01',{start:'09:00',end:'09:01',breakMinutes:0}),day('2026-11-02',{start:'09:00',end:'09:01',breakMinutes:0})],'2026-11',pay({hourlyRate:100}))
  assert.equal(r.gross,3)
})
test('duplicate calendar dates are rejected to prevent double payment',()=>{
  assert.throws(()=>calculatePay([day(),day()],'2026-11',pay()),/дублікати/i)
})
test('invalid rates, norm and type are rejected',()=>{
  assert.throws(()=>validatePaySettings(pay({hourlyRate:-1})),/суми/i)
  assert.throws(()=>validatePaySettings(pay({monthlyNormDays:0})),/Норма/i)
  assert.throws(()=>validatePaySettings(pay({mode:'invalid'})),/тип/i)
})
test('money formatting uses Ukrainian currency',()=>{
  assert.match(moneyUA(12345),/123,45|123,45/)
})

test('overlapping shifts cannot be counted twice for pay',()=>{
  const d=day('2026-11-02',{additionalShifts:[
    {id:'bad',start:'17:00',end:'21:00',breakMinutes:0,status:'worked',kind:'extra',note:''},
  ]})
  assert.throws(()=>calculatePay([d],'2026-11',pay({hourlyRate:10000})),/перекриватися/)
})
test('monthly salary counts an extra-only worked day toward the chosen day norm',()=>{
  const d=day('2026-11-02',{status:'planned',additionalShifts:[
    {id:'extra',start:'18:00',end:'22:00',breakMinutes:0,status:'worked',kind:'extra',note:''},
  ]})
  const r=calculatePay([d],'2026-11',pay({mode:'monthly',monthlySalary:2000000,monthlyNormDays:20,monthlyNormSource:'manual'}))
  assert.equal(r.workedDays,1)
  assert.equal(r.gross,100000)
})
