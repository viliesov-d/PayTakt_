import test from 'node:test'
import assert from 'node:assert/strict'
import {calculatePay,defaultPaySettings,normalizePaySettings,validatePaySettings,validateMonthlySales} from '../src/lib/salary.ts'
const day=(date='2026-11-02',options={})=>({id:date,date,start:'09:00',end:'18:00',breakMinutes:60,status:'worked',note:'',dayType:'work',kind:'regular',additionalShifts:[],...options})
const settings=(patch={})=>({...defaultPaySettings,hourlyRate:10000,...patch})
test('v0.4.2 settings upgrade to v3 without losing rates or bonuses',()=>{
  const old={version:1,mode:'hourly',hourlyRate:17500,shiftRate:200000,monthlySalary:2500000,monthlyNormDays:22,workdayBonus:1000,extraShiftBonus:2000,monthlyBonus:3000}
  const migrated=normalizePaySettings(old)
  assert.equal(migrated.version,5)
  assert.equal(migrated.hourlyRate,17500)
  assert.equal(migrated.monthlyBonus,3000)
  assert.equal(migrated.nightEnabled,false)
  assert.equal(migrated.customRules.length,0)
})
test('night hours across midnight and additive bonus with no break',()=>{
  const r=calculatePay([day('2026-11-02',{start:'20:00',end:'08:00',breakMinutes:0})],'2026-11',settings({nightEnabled:true,nightBonusBasisPoints:3000}))
  assert.equal(r.workedMinutes,720)
  assert.equal(r.nightPaidMinutes,480)
  assert.equal(r.lines.find(l=>l.code==='night').amount,24000)
  assert.equal(r.gross,144000)
})
test('day hours are not night hours; night period can cross midnight',()=>{
  const r=calculatePay([day('2026-11-02',{start:'09:00',end:'17:00',breakMinutes:0})],'2026-11',settings({nightEnabled:true}))
  assert.equal(r.nightPaidMinutes,0)
  assert.equal(r.lines.find(l=>l.code==='night').amount,0)
})
test('unpaid breaks are distributed proportionally for night estimate',()=>{
  const r=calculatePay([day('2026-11-02',{start:'20:00',end:'08:00',breakMinutes:120})],'2026-11',settings({nightEnabled:true,nightBonusBasisPoints:3000}))
  assert.equal(r.workedMinutes,600)
  assert.equal(r.nightPaidMinutes,400)
  assert.equal(r.lines.find(l=>l.code==='night').amount,20000)
})
test('overtime pays only premium for paid minutes above user threshold',()=>{
  const shifts=[day('2026-11-02',{start:'09:00',end:'19:00',breakMinutes:0}),day('2026-11-03',{start:'09:00',end:'19:00',breakMinutes:0})]
  const r=calculatePay(shifts,'2026-11',settings({bandEnabled:true,bandPeriod:'month',bands:[{id:'base',afterMinutes:0,multiplierBasisPoints:10000},{id:'ot',afterMinutes:900,multiplierBasisPoints:15000}]}))
  assert.equal(r.workedMinutes,1200)
  assert.equal(r.overtimeMinutes,300)
  assert.equal(r.lines.find(l=>l.code==='tier:ot').amount - 50000,25000)
})
test('extra supplement for fixed shift payment uses reference hourly rate but not added base',()=>{
  const r=calculatePay([day('2026-11-02',{start:'22:00',end:'06:00',breakMinutes:0})],'2026-11',settings({mode:'per_shift',shiftRate:250000,hourlyRate:20000,nightEnabled:true,nightBonusBasisPoints:3000}))
  assert.equal(r.gross,298000)
})
test('sales commission plus plan award monthly separate from shifts',()=>{
  const r=calculatePay([],'2026-11',settings({salesCommissionBasisPoints:500,salesPlan:1_000_000,salesPlanBonus:150_000}),{month:'2026-11',amount:1_250_000})
  assert.equal(r.salesPlanReached,true)
  assert.equal(r.lines.find(l=>l.code==='commission').amount,62500)
  assert.equal(r.gross,212500)
})
test('sales below plan excludes bonus, zero reported sales is valid',()=>{
  const r=calculatePay([],'2026-11',settings({salesPlan:1000000,salesPlanBonus:200000}),{month:'2026-11',amount:999999})
  assert.equal(r.salesPlanReached,false)
  assert.equal(r.gross,0)
  validateMonthlySales({month:'2026-11',amount:0})
})
test('custom bonus triggers once per month when condition met',()=>{
  const customRules=[{id:'r1',title:'За десять годин',trigger:'hours_at_least',threshold:600,bonus:80000},{id:'r2',title:'За три зміни',trigger:'shifts_at_least',threshold:3,bonus:20000}]
  const r=calculatePay([day('2026-11-02',{start:'09:00',end:'21:00',breakMinutes:0})],'2026-11',settings({customRules}))
  assert.equal(r.lines.find(l=>l.code==='custom:r1').amount,80000)
  assert.equal(r.lines.find(l=>l.code==='custom:r2').amount,0)
})
test('configured night and overtime and sales rules stack without duplicate base pay',()=>{
  const r=calculatePay([day('2026-11-02',{start:'22:00',end:'06:00',breakMinutes:0})],'2026-11',settings({nightEnabled:true,nightBonusBasisPoints:3000,bandEnabled:true,bandPeriod:'day',bands:[{id:'base',afterMinutes:0,multiplierBasisPoints:10000},{id:'ot',afterMinutes:360,multiplierBasisPoints:15000}],salesCommissionBasisPoints:1000}),{month:'2026-11',amount:100000})
  assert.equal(r.gross,80000+24000+10000+10000)
})
test('rejects duplicate rules, percent overflow and mismatched sales period',()=>{
  const rule={id:'same',title:'test',trigger:'days_at_least',threshold:2,bonus:1000}
  assert.throws(()=>validatePaySettings(settings({customRules:[rule,rule]})),/правила/i)
  assert.throws(()=>validatePaySettings(settings({salesCommissionBasisPoints:100001})),/відсоток/i)
  assert.throws(()=>calculatePay([], '2026-11',settings(),{month:'2026-12',amount:1000}),/місяць/i)
})
