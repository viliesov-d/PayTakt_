import test from 'node:test'
import assert from 'node:assert/strict'
import {calculatePay,defaultPaySettings,normalizePaySettings,calendarSalaryNorm,countsTowardMonthlyNorm,validatePaySettings} from '../src/lib/salary.ts'
import {changeDayType} from '../src/lib/dayActions.ts'
import {buildMonthAnalytics} from '../src/lib/analytics.ts'
import {preparePaySettingsWrite} from '../src/lib/paySettingsPayload.ts'
import {verifyPaySettingsFirestoreShape} from '../src/lib/paySettingsRulesCheck.ts'

const month='2026-11'
const salary={...defaultPaySettings,mode:'monthly',monthlySalary:3100000,monthlyNormSource:'calendar',monthlyOffDayNormMode:'exclude_off',monthlyAccrualBasis:'days',bandEnabled:false}
const day=(date)=>({date,start:'09:00',end:'18:00',breakMinutes:60,status:'worked',note:'',dayType:'work',kind:'regular',additionalShifts:[],overtimeMinutes:0,plannedWorkday:true,plannedMinutes:480})
const base=[day('2026-11-02'),day('2026-11-03'),day('2026-11-04')]
const amount=(days,settings=salary)=>calculatePay(days,month,settings).lines.find(x=>x.code==='base').amount

test('ordinary rest day, even Tuesday, reduces divisor and leaves full salary for other worked days',()=>{
  const days=[base[0],changeDayType(base[1],'off'),base[2]]
  assert.equal(days[1].plannedWorkday,true,'original scheduled day remains stored')
  assert.equal(calendarSalaryNorm(days,month,salary).days,2)
  assert.equal(calendarSalaryNorm(days,month,salary).minutes,960)
  assert.equal(amount(days),3100000)
  assert.equal(calculatePay(days,month,salary).scheduledDays,2)
})
test('unpaid leave does not change scheduled norm, but itself is not paid',()=>{
  const days=[base[0],changeDayType(base[1],'unpaid'),base[2]]
  assert.equal(calendarSalaryNorm(days,month,salary).days,3)
  assert.equal(calendarSalaryNorm(days,month,salary).minutes,1440)
  assert.equal(amount(days),2066667)
  assert.equal(buildMonthAnalytics(days,month,salary).plannedDays,3)
})
test('vacation and sick leave similarly retain the original monthly denominator',()=>{
  for (const type of ['vacation','sick']) {
    const days=[base[0],changeDayType(base[1],type),base[2]]
    assert.equal(calendarSalaryNorm(days,month,salary).days,3)
    assert.equal(amount(days),2066667)
  }
})
test('legacy pay settings maintain old denominator when loaded, unless owner explicitly opts in',()=>{
  const old={...defaultPaySettings,mode:'monthly',monthlySalary:3100000}
  delete old.monthlyOffDayNormMode
  const migrated=normalizePaySettings(old)
  assert.equal(migrated.monthlyOffDayNormMode,'keep_planned')
  assert.equal(amount([base[0],changeDayType(base[1],'off'),base[2]],migrated),2066667)
  const opted={...migrated,monthlyOffDayNormMode:'exclude_off'}
  assert.equal(amount([base[0],changeDayType(base[1],'off'),base[2]],opted),3100000)
})
test('manual monthly salary divisor stays fixed regardless of calendar rules',()=>{
  const manual={...salary,monthlyNormSource:'manual',monthlyNormDays:3}
  const days=[base[0],changeDayType(base[1],'off'),base[2]]
  assert.equal(amount(days,manual),2066667)
})
test('hours-based salary uses adjusted planned minutes and excludes off days from day cap',()=>{
  const settings={...salary,monthlyAccrualBasis:'hours'}
  const days=[base[0],changeDayType(base[1],'off'),base[2]]
  assert.equal(amount(days,settings),3100000)
  const unpaid=[base[0],changeDayType(base[1],'unpaid'),base[2]]
  assert.equal(amount(unpaid,settings),2066667)
})
test('stored security payload carries new rule and local Firestore shape checker validates it',()=>{
  const saved=preparePaySettingsWrite(salary)
  assert.equal(saved.monthlyOffDayNormMode,'exclude_off')
  assert.deepEqual(verifyPaySettingsFirestoreShape(saved),[])
  validatePaySettings(saved)
  assert.equal(countsTowardMonthlyNorm(changeDayType(base[1],'off'),salary),false)
  assert.equal(countsTowardMonthlyNorm(changeDayType(base[1],'unpaid'),salary),true)
  assert.throws(()=>validatePaySettings({...salary,monthlyOffDayNormMode:'wrong'}),/джерело норми/i)
})
