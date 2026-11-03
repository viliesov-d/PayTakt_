import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {initialOnboardingDraft,scheduleChoices,payChoices,previewOnboardingSchedule,makeOnboardingPaySettings,makeOnboardingPerformance,validateOnboardingDraft,hryvniasToKopeks,onboardingMonthKeys} from '../src/lib/onboarding.ts'
import {validatePaymentRules,validatePaySettings} from '../src/lib/salary.ts'
import {validatePerformanceSettings} from '../src/lib/performance.ts'

const basic=()=>({...initialOnboardingDraft(new Date(2026,10,1)),rate:'31000'})

test('each sector offers relevant schedule plus custom option',()=>{
  for(const sector of ['office','retail','logistics','healthcare','other']){
    assert.ok(scheduleChoices(sector).includes('custom'))
    assert.ok(payChoices(sector).includes('monthly'))
  }
  assert.equal(scheduleChoices('office')[0],'5/2-weekdays')
})
test('weekday schedule obeys Monday through Friday on the 2026 November calendar',()=>{
  const days=previewOnboardingSchedule(basic(),new Date(2026,10,2))
  assert.equal(days.length,30)
  assert.equal(days[0].date,'2026-11-01')
  assert.equal(days[0].dayType,'off')
  assert.equal(days[1].dayType,'work')
  assert.equal(days.filter(x=>x.dayType==='work').length,21)
})
test('custom schedule works across changing months and leap years',()=>{
  const d={...basic(),preset:'custom',customWork:2,customOff:2,anchorDate:'2028-02-27'}
  const days=previewOnboardingSchedule(d,new Date(2028,1,1))
  assert.equal(days.length,29)
  assert.equal(days.find(x=>x.date==='2028-02-27').dayType,'work')
  assert.equal(days.find(x=>x.date==='2028-02-29').dayType,'off')
  assert.deepEqual(onboardingMonthKeys(new Date(2028,11,18)),['2028-12','2029-01'])
})
test('invalid custom cycle is rejected before allocating giant patterns',()=>{
  assert.throws(()=>previewOnboardingSchedule({...basic(),preset:'custom',customWork:1e7}),/цикл/i)
})
test('convert hryvnia input exactly to integer kopeks',()=>{
  assert.equal(hryvniasToKopeks('31 000,50'),3_100_050)
  assert.equal(hryvniasToKopeks('0'),0)
  assert.throws(()=>hryvniasToKopeks('1.234'),/коректну/)
})
test('monthly salary from wizard uses calendar norm and default payouts',()=>{
  const pay=makeOnboardingPaySettings(basic())
  assert.equal(pay.monthlySalary,3_100_000)
  assert.equal(pay.monthlyNormSource,'calendar')
  assert.equal(pay.monthlyBaseMinutesPerDay,480)
  assert.equal(pay.hourlyRate,0)
  validatePaySettings(pay)
  validatePaymentRules(pay.paymentRules)
})
test('chosen base pay mode drives correct money field without extra hidden rates',()=>{
  for(const [mode,field] of [['hourly','hourlyRate'],['per_shift','shiftRate'],['per_unit','unitRate']]){
    const pay=makeOnboardingPaySettings({...basic(),mode,rate:'250.25'})
    assert.equal(pay[field],25025)
    assert.equal(pay.monthlySalary,0)
    validatePaySettings(pay)
  }
})
test('manual overtime and night are optional, 120 percent is 12000 basis points',()=>{
  const pay=makeOnboardingPaySettings({...basic(),overtime:true,overtimePercent:120,night:true})
  assert.equal(pay.markedOvertimeBasisPoints,12000)
  assert.equal(pay.overtimeEntryMode,'marked')
  assert.equal(pay.nightEnabled,true)
  validatePaySettings(pay)
})
test('fixed advance allocates money only once and keeps separate bonus payout',()=>{
  const pay=makeOnboardingPaySettings({...basic(),payout:'fixed',advance:'10000',advanceDay:20,salaryDay:10,bonusDay:15})
  assert.equal(pay.paymentRules[0].amount,1000000)
  assert.equal(pay.paymentRules[0].method,'fixed')
  validatePaymentRules(pay.paymentRules)
})
test('single payment disables advance and keeps bonus remainder rule',()=>{
  const pay=makeOnboardingPaySettings({...basic(),payout:'all',salaryDay:7})
  assert.equal(pay.paymentRules[0].enabled,false)
  assert.equal(pay.paymentRules[1].monthOffset,0)
  validatePaymentRules(pay.paymentRules)
})
test('performance bonus is one tier and uses correct metric units',()=>{
  const p=makeOnboardingPerformance({...basic(),plan:true,planMetric:'cash',planTarget:'250000',planBonus:'2000'})
  assert.equal(p.defaultTarget,25000000)
  assert.equal(p.tiers[0].bonus,200000)
  validatePerformanceSettings(p)
  const u=makeOnboardingPerformance({...basic(),plan:true,planMetric:'units',planTarget:'20',planBonus:'500'})
  assert.equal(u.defaultTarget,20)
})
test('complete draft passes validation; invalid limits are rejected',()=>{
  validateOnboardingDraft(basic())
  assert.throws(()=>validateOnboardingDraft({...basic(),rate:''}),/суму/i)
  assert.throws(()=>validateOnboardingDraft({...basic(),overtime:true,overtimePercent:15}),/100%/)
  assert.throws(()=>validateOnboardingDraft({...basic(),plan:true,planMetric:'cash',planTarget:''}),/коректну|план/i)
})
test('new wizard is integrated and its application is non-destructive',()=>{
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
  assert.match(app,/OnboardingWizard/)
  assert.match(app,/!paySettings&&/)
  assert.match(app,/await onApplyPattern\(generated,'missing'\)/)
  assert.match(app,/await onSavePay\(salary\)/)
})

test('night and duty presets preserve distinct hours instead of flattening every slot',()=>{
  const night=previewOnboardingSchedule({...basic(),preset:'day-night-48',anchorDate:'2026-11-01'})
  assert.equal(night[0].start,'08:00')
  assert.equal(night[1].start,'20:00')
  assert.equal(night[1].end,'08:00')
  const duty=makeOnboardingPaySettings({...basic(),preset:'duty-24-72'})
  assert.equal(duty.monthlyBaseMinutesPerDay,1380)
})
