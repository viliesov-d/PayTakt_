import test from 'node:test'
import assert from 'node:assert/strict'
import {calculatePay,defaultPaySettings,normalizePaySettings,validatePaySettings,allocateBands,validateMonthlyUnits} from '../src/lib/salary.ts'
const day=(date,start='08:00',end='18:00',breakMinutes=0)=>({id:date,date,start,end,breakMinutes,status:'worked',note:'',dayType:'work',kind:'regular',additionalShifts:[]})
const hourly=(patch={})=>({...defaultPaySettings,hourlyRate:10000,bandEnabled:true,bandPeriod:'day',bands:[{id:'base',afterMinutes:0,multiplierBasisPoints:10000},{id:'after8',afterMinutes:480,multiplierBasisPoints:12000}],...patch})
const run=(shifts,settings,unitCount=0)=>calculatePay(shifts,'2026-11',settings,{month:'2026-11',amount:0},{month:'2026-11',count:unitCount})
test('8 hours at 100%, then 2 hours at 120% gives 1040 UAH',()=>{
  const r=run([day('2026-11-02')],hourly())
  assert.equal(r.gross,104000)
  assert.equal(r.lines.find(x=>x.code==='tier:base').amount,80000)
  assert.equal(r.lines.find(x=>x.code==='tier:after8').amount,24000)
  assert.equal(r.overtimeMinutes,120)
})
test('daily tiers reset each day; monthly tiers accumulate',()=>{
  const shifts=[day('2026-11-02','08:00','14:00'),day('2026-11-03','08:00','14:00')]
  assert.equal(run(shifts,hourly()).gross,120000)
  assert.equal(run(shifts,hourly({bandPeriod:'month'})).gross,128000)
})
test('shift period resets separately for two nonoverlapping segments in same day',()=>{
  const a=day('2026-11-02','00:00','06:00')
  a.additionalShifts=[{id:'other',start:'07:00',end:'13:00',breakMinutes:0,status:'worked',kind:'extra',note:''}]
  assert.equal(run([a],hourly({bandPeriod:'shift'})).gross,120000)
  assert.equal(run([a],hourly({bandPeriod:'day'})).gross,128000)
})
test('weekly tiers reset after Sunday, not every month day',()=>{
  const a=day('2026-11-02','08:00','18:00'),b=day('2026-11-03','08:00','18:00'),c=day('2026-11-09','08:00','18:00')
  const s=hourly({bandPeriod:'week',bands:[{id:'base',afterMinutes:0,multiplierBasisPoints:10000},{id:'ot',afterMinutes:900,multiplierBasisPoints:12500}]})
  assert.equal(run([a,b,c],s).gross,312500)
})
test('planned work not paid, unpaid days not paid',()=>{
  const planned=day('2026-11-02');planned.status='planned'
  const unpaid=day('2026-11-03');unpaid.dayType='unpaid'
  assert.equal(run([planned,unpaid],hourly()).gross,0)
})
test('extra tiers on per shift mode add only premium above 100%',()=>{
  const s=hourly({mode:'per_shift',shiftRate:200000})
  const r=run([day('2026-11-02')],s)
  assert.equal(r.gross,204000)
})
test('piecework is a full base pay option, count can be independent of shifts',()=>{
  const s=hourly({mode:'per_unit',bandEnabled:false,unitName:'доставка',unitRate:3000,unitPlan:20,unitPlanBonus:10000})
  const r=run([],s,25)
  assert.equal(r.gross,85000)
  assert.equal(r.unitPlanReached,true)
})
test('piecework can supplement hourly pay without duplicate base',()=>{
  const s=hourly({bandEnabled:false,unitName:'виріб',unitBonusEnabled:true,unitRate:5000})
  assert.equal(run([day('2026-11-02')],s,3).gross,115000)
})
test('v0.5 monthly overtime migrates to correct tiers, no lost pay',()=>{
  const {bandEnabled, bands, bandPeriod, unitName, unitRate, unitBonusEnabled, unitPlan, unitPlanBonus,...legacy}=defaultPaySettings
  void bandEnabled;void bands;void bandPeriod;void unitName;void unitRate;void unitBonusEnabled;void unitPlan;void unitPlanBonus
  const old={...legacy,version:2,hourlyRate:10000,overtimeEnabled:true,overtimeThresholdMinutes:480,overtimeBonusBasisPoints:2000}
  const normalized=normalizePaySettings(old)
  assert.equal(normalized.version,5)
  assert.equal(normalized.bandPeriod,'month')
  assert.equal(normalized.bands[1].multiplierBasisPoints,12000)
  assert.equal(run([day('2026-11-02')],normalized).gross,104000)
})
test('invalid and unordered bands rejected; monthly units integer',()=>{
  assert.throws(()=>validatePaySettings(hourly({bands:[{id:'wrong',afterMinutes:30,multiplierBasisPoints:10000}]})),/перший|поріг|ступ/)
  assert.throws(()=>validatePaySettings(hourly({bands:[{id:'base',afterMinutes:0,multiplierBasisPoints:10000},{id:'bad',afterMinutes:0,multiplierBasisPoints:12000}]})),/пороги/)
  assert.throws(()=>validateMonthlyUnits({month:'2026-11',count:1.5}),/кількість/i)
  assert.deepEqual(allocateBands([600],[{afterMinutes:0},{afterMinutes:480}]),[480,120])
})
test('custom bonus rule may depend on completed units, not sales',()=>{
  const s=hourly({mode:'per_unit',bandEnabled:false,unitRate:1000,customRules:[{id:'delivery',title:'За 25 доставок',trigger:'units_at_least',threshold:25,bonus:20000}]})
  assert.equal(run([],s,25).gross,45000)
  assert.equal(run([],s,24).gross,24000)
})
test('invalid salary periods and negative unit counts are rejected',()=>{
  assert.throws(()=>validateMonthlyUnits({month:'2026-11',count:-1}),/кількість/i)
  assert.throws(()=>calculatePay([], '2026-11', hourly(),{month:'2026-11',amount:0},{month:'2026-12',count:1}),/місяць/i)
})
