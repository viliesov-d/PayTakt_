import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultPaySettings, calculatePay} from '../src/lib/salary.ts'
import {calculatePaymentForecast, firstHalfOnlyShifts} from '../src/lib/payments.ts'
import {buildMonthAnalytics} from '../src/lib/analytics.ts'
import {calculatePayWithPerformance,defaultPerformanceSettings} from '../src/lib/performance.ts'

const shift=(date,overrides={})=>({id:date,date,start:'09:00',end:'17:00',breakMinutes:0,status:'worked',note:'',dayType:'work',plannedWorkday:true,plannedMinutes:480,additionalShifts:[],...overrides})
const extra=(status='worked')=>({start:'17:00',end:'19:00',breakMinutes:0,basisPoints:12000,status})
const settings={...defaultPaySettings,mode:'hourly',hourlyRate:10000}

test('post-15th separately worked overtime is excluded from first-half advance, not full-month salary',()=>{
  const shifts=[shift('2026-11-10'),shift('2026-11-20',{status:'planned',overtimeExtra:extra()})]
  const result=calculatePay(shifts,'2026-11',settings)
  const forecast=calculatePaymentForecast(shifts,'2026-11',settings,result)
  assert.equal(result.gross,104000)
  assert.equal(forecast.firstHalfEarnings,80000)
  assert.equal(forecast.events.find(e=>e.id==='advance').amount,80000)
  assert.equal(forecast.events.reduce((s,e)=>s+e.amount,0),result.gross)
  assert.equal(shifts[1].overtimeExtra.status,'worked','must not mutate Firestore-derived data')
})

test('first-half overtime is paid when confirmed on or before the 15th',()=>{
  const shifts=[shift('2026-11-15',{overtimeExtra:extra()})]
  const forecast=calculatePaymentForecast(shifts,'2026-11',settings,calculatePay(shifts,'2026-11',settings))
  assert.equal(forecast.firstHalfEarnings,104000)
})

test('all independent post-15th overtime is reset in first-half shift projection',()=>{
  const shifts=[shift('2026-11-16',{overtimeExtra:extra()}),shift('2026-11-14',{overtimeExtra:extra()})]
  const first=firstHalfOnlyShifts(shifts,'2026-11')
  assert.equal(first[0].status,'planned')
  assert.equal(first[0].overtimeExtra.status,'planned')
  assert.equal(first[1].overtimeExtra.status,'worked')
  assert.equal(shifts[0].status,'worked')
})

test('manual daily wage first-half advance excludes post-15th independent overtime',()=>{
  const shifts=[shift('2026-11-10'),shift('2026-11-20',{overtimeExtra:extra()})]
  const performance={...defaultPerformanceSettings,enabled:true,manualDailyPay:true}
  const dailyWages={'2026-11-10':30000,'2026-11-20':40000}
  const analytics=buildMonthAnalytics(shifts,'2026-11',settings,0,0,performance,0,0,dailyWages)
  assert.equal(analytics.payError,null)
  assert.equal(analytics.forecast.firstHalfEarnings,30000)
  assert.equal(analytics.result.gross,94000)
})
