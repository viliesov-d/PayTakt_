import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {activeDailyCash,cashTotalsByMonth,effectiveRevenue,parseCashHryvnia,validateCashPreferences,validateDailyCash} from '../src/lib/dailyCash.ts'
const worked=(date,dayType='work')=>({date,dayType,start:'09:00',end:'18:00',breakMinutes:60,status:'worked',note:''})
const shifts=[worked('2026-11-02'),worked('2026-11-03','off'),worked('2026-11-04','unpaid'),worked('2026-12-01')]
const records=[{date:'2026-11-02',amount:1_250_050},{date:'2026-11-03',amount:99999},{date:'2026-11-04',amount:50000},{date:'2026-11-05',amount:23400},{date:'2026-12-01',amount:0}]
test('cash amount validation preserves exact cents and zero',()=>{
  assert.equal(parseCashHryvnia('12500,50'),1250050)
  assert.equal(parseCashHryvnia('0'),0)
  assert.equal(parseCashHryvnia('0.01'),1)
  assert.throws(()=>parseCashHryvnia('-2'))
  assert.throws(()=>parseCashHryvnia('12.345'))
  assert.throws(()=>parseCashHryvnia('x'))
  validateDailyCash({date:'2026-11-02',amount:0})
  assert.throws(()=>validateDailyCash({date:'2026-11-02',amount:12.3}))
  assert.throws(()=>validateDailyCash({date:'bad',amount:0}))
})
test('daily cash journal excludes day off, unpaid, missing shifts',()=>{
  assert.deepEqual(activeDailyCash(records,shifts).map(x=>x.date),['2026-11-02','2026-12-01'])
  assert.deepEqual(cashTotalsByMonth(records,shifts),{'2026-11':1250050,'2026-12':0})
})
test('revenue is not affected without explicit opt in',()=>{
  const manual={'2026-11':199999}
  assert.deepEqual(effectiveRevenue(manual,records,shifts,{enabled:false,useForSales:false}),manual)
  assert.deepEqual(effectiveRevenue(manual,records,shifts,{enabled:true,useForSales:false}),manual)
})
test('opt in replaces monthly amount without double counting',()=>{
  const manual={'2026-11':199999}
  assert.deepEqual(effectiveRevenue(manual,records,shifts,{enabled:true,useForSales:true}),{'2026-11':1250050,'2026-12':0})
  assert.throws(()=>validateCashPreferences({enabled:false,useForSales:true}))
})
test('Firestore owner-only rules contain the new paths and do not open wildcard access',()=>{
  const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')
  assert.match(rules,/match \/dailyCash\/\{date\}/)
  assert.match(rules,/allow create, update: if ownWorkspace\(workspaceId\)/)
  assert.match(rules,/settingsId == 'cash'/)
  assert.doesNotMatch(rules,/allow (?:read|write|create|update|get|list): if true/)
})
import {estimatedDailyBaseWage} from '../src/lib/dailyCash.ts'
import {defaultPaySettings} from '../src/lib/salary.ts'
test('journal base wage estimate uses the whole month salary norm',()=>{
  const calendar=[worked('2026-11-02'),worked('2026-11-03')].map(s=>({...s,plannedWorkday:true,plannedMinutes:480}))
  const settings={...defaultPaySettings,mode:'monthly',monthlySalary:3100000,monthlyNormSource:'calendar',monthlyAccrualBasis:'days'}
  assert.equal(estimatedDailyBaseWage('2026-11-02',calendar,settings),1550000)
  assert.equal(estimatedDailyBaseWage('2026-11-02',calendar,{...settings,mode:'per_unit'}),null)
  assert.equal(estimatedDailyBaseWage('2026-11-02',[...calendar.slice(0,1),{...calendar[1],status:'planned'}],{...settings,mode:'hourly',hourlyRate:10000}),80000)
})
test('invalid dates such as February 30 are rejected',()=>{
  assert.throws(()=>validateDailyCash({date:'2026-02-30',amount:100}))
})
