import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePay,defaultPaySettings,normalizePaySettings } from '../src/lib/salary.ts'
import {calculatePaymentForecast} from '../src/lib/payments.ts'
import {generateMonthlyPattern,presetPattern} from '../src/lib/schedule.ts'
import {validateDay} from '../src/lib/calendar.ts'
const m='2026-11'
const calendar=()=>generateMonthlyPattern({month:m,anchorDate:'2026-11-02',pattern:presetPattern('5/2')})
const marked=()=>({...defaultPaySettings,mode:'monthly',monthlySalary:3_100_000,monthlyNormSource:'calendar',monthlyAccrualBasis:'hours',overtimeEntryMode:'marked',markedOvertimeBasisPoints:12000,monthlyOvertimeMode:'full',bandEnabled:false})
const worked=(day,ot=0)=>({...day,status:'worked',overtimeMinutes:ot})
test('new salary settings default to calendar norm; old version 4 keeps manual norm until user enables calendar',()=>{
 assert.equal(defaultPaySettings.monthlyNormSource,'calendar')
 const migrated=normalizePaySettings({...defaultPaySettings,version:4,monthlyNormDays:19})
 assert.equal(migrated.version,5)
 assert.equal(migrated.monthlyNormSource,'manual')
})
test('5/2 schedule supplies all planned workdays and eight-hour norms, not entered manual number',()=>{
 const dates=calendar()
 const count=dates.filter(d=>d.plannedWorkday).length
 const mins=dates.reduce((s,d)=>s+d.plannedMinutes,0)
 const r=calculatePay(dates.map(s=>s.date==='2026-11-02'?worked(s):s),m,marked())
 assert.equal(r.scheduledDays,count)
 assert.equal(r.scheduledMinutes,mins)
 assert.equal(r.lines.find(x=>x.code==='base').amount,Math.round(3_100_000/count))
})
test('manually marked overtime is subset of actual hours; 8 normal + 2 overtime at 120 percent',()=>{
 const dates=calendar();const date=dates.find(d=>d.plannedWorkday)
 const s={...date,status:'worked',end:'20:00',start:'09:00',breakMinutes:60,overtimeMinutes:120}
 // 10h total, plan originally 8h
 const r=calculatePay(dates.filter(x=>x.date!==date.date).concat(s),m,marked())
 const perHour=3_100_000*60/r.scheduledMinutes
 assert.equal(r.workedMinutes,600)
 assert.equal(r.overtimeMinutes,120)
 assert.equal(r.lines.find(x=>x.code==='marked-overtime').amount,Math.round(120*perHour*1.2/60))
 assert.equal(r.lines.find(x=>x.code==='base').amount,Math.round(3_100_000*480/r.scheduledMinutes))
})
test('hourly pay with manual overtime adds only premium on top of base hours',()=>{
 const d={...calendar()[0],start:'09:00',end:'20:00',breakMinutes:60,status:'worked',overtimeMinutes:120,dayType:'work'}
 const r=calculatePay([d],m,{...defaultPaySettings,mode:'hourly',hourlyRate:10000,overtimeEntryMode:'marked',markedOvertimeBasisPoints:12000})
 assert.equal(r.gross,104000)
})
test('invalid overtime hours greater than shift duration is rejected',()=>{
 const d={...calendar().find(x=>x.plannedWorkday),overtimeMinutes:6000}
 assert.throws(()=>validateDay(d),/понаднормових/i)
})
test('leave on planned day retains the norm, and overtime is not paid for leave',()=>{
 const dates=calendar();const i=dates.findIndex(d=>d.plannedWorkday)
 const origCount=dates.filter(d=>d.plannedWorkday).length
 dates[i]={...dates[i],dayType:'vacation',status:'planned',overtimeMinutes:0}
 const r=calculatePay(dates,m,marked())
 assert.equal(r.scheduledDays,origCount)
 assert.equal(r.gross,0)
})
test('first-half payment forecast keeps full-month calendar norm',()=>{
 const dates=calendar().map(d=>d.date==='2026-11-02'?worked(d):d)
 const p=marked()
 const all=calculatePay(dates,m,p)
 const forecast=calculatePaymentForecast(dates,m,p,all)
 assert.equal(forecast.firstHalfEarnings,all.gross)
 assert.equal(forecast.earnings,all.gross)
})
test('automatic tiers still work when marked mode disabled',()=>{
 const d={...calendar().find(x=>x.plannedWorkday),status:'worked',end:'20:00',breakMinutes:60}
 const setting={...defaultPaySettings,mode:'hourly',hourlyRate:10000,bandEnabled:true,overtimeEntryMode:'automatic'}
 const r=calculatePay([d],m,setting)
 assert.equal(r.gross,104000)
})

test('bulk template application preserves a planned day with manually entered overtime',async()=>{
 const {planPatternApplication}=await import('../src/lib/schedule.ts')
 const days=calendar()
 const existing=[{...days.find(x=>x.plannedWorkday),overtimeMinutes:120}]
 const p=planPatternApplication(days,existing,'update-planned')
 assert.equal(p.summary.protected,1)
 assert.ok(!p.write.some(x=>x.date===existing[0].date))
})

test('v0.8.2: separately added overtime pays full 120% ABOVE hourly base and is not counted twice',()=>{
 const regular={...calendar().find(d=>d.plannedWorkday),status:'worked',overtimeExtra:{start:'18:00',end:'20:00',breakMinutes:0,status:'worked',basisPoints:12000}}
 const p={...defaultPaySettings,mode:'hourly',hourlyRate:10000,bandEnabled:true,overtimeEntryMode:'automatic'}
 validateDay(regular)
 const r=calculatePay([regular],m,p)
 assert.equal(r.workedMinutes,600)
 assert.equal(r.overtimeMinutes,120)
 assert.equal(r.lines.find(x=>x.code==='added-overtime').amount,24000)
 assert.equal(r.lines.find(x=>x.code==='base')?.amount,undefined) // tiers handle eight regular hours
 assert.equal(r.gross,104000)
})
test('v0.8.2: monthly norm remains unchanged when extra overtime is appended',()=>{
 const dates=calendar()
 const i=dates.findIndex(d=>d.plannedWorkday)
 dates[i]={...dates[i],status:'worked',overtimeExtra:{start:'18:00',end:'20:00',breakMinutes:0,status:'worked',basisPoints:12000}}
 const r=calculatePay(dates,m,marked())
 const hour=3_100_000*60/r.scheduledMinutes
 assert.equal(r.scheduledMinutes,dates.reduce((sum,d)=>sum+d.plannedMinutes,0))
 assert.equal(r.lines.find(x=>x.code==='added-overtime').amount,Math.round(hour*2*1.2))
 assert.equal(r.lines.find(x=>x.code==='base').amount,Math.round(3_100_000*480/r.scheduledMinutes))
})
test('v0.8.2: planned extra overtime is not paid and cannot overlap regular shift',()=>{
 const base={...calendar().find(d=>d.plannedWorkday),status:'worked'}
 const p={...defaultPaySettings,mode:'hourly',hourlyRate:10000}
 const planned={...base,overtimeExtra:{start:'18:00',end:'20:00',breakMinutes:0,status:'planned',basisPoints:12000}}
 assert.equal(calculatePay([planned],m,p).gross,80000)
 assert.throws(()=>validateDay({...base,overtimeExtra:{start:'17:00',end:'20:00',breakMinutes:0,status:'worked',basisPoints:12000}}),/накладатися/)
 assert.throws(()=>validateDay({...base,dayType:'vacation',overtimeExtra:{start:'18:00',end:'20:00',breakMinutes:0,status:'worked',basisPoints:12000}}),/робочого дня/)
})
test('v0.8.2: working day with only overtime should not generate a full monthly base day',()=>{
 const dates=calendar()
 const i=dates.findIndex(d=>d.plannedWorkday)
 dates[i]={...dates[i],status:'planned',overtimeExtra:{start:'18:00',end:'20:00',breakMinutes:0,status:'worked',basisPoints:12000}}
 const r=calculatePay(dates,m,marked())
 assert.equal(r.lines.find(x=>x.code==='base').amount,0)
 assert.ok(r.lines.find(x=>x.code==='added-overtime').amount>0)
})
test('v0.8.2: night bonus can combine with separately added overtime if enabled',()=>{
 const s={...calendar().find(d=>d.plannedWorkday),status:'worked',overtimeExtra:{start:'22:00',end:'00:00',breakMinutes:0,status:'worked',basisPoints:12000}}
 const settings={...defaultPaySettings,mode:'hourly',hourlyRate:10000,nightEnabled:true,nightBonusBasisPoints:3000}
 const p=calculatePay([s],m,settings)
 assert.equal(p.lines.find(x=>x.code==='added-overtime').amount,24000)
 assert.equal(p.lines.find(x=>x.code==='night').amount,6000)
 assert.equal(p.gross,110000)
})
