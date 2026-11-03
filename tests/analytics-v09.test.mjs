import test from 'node:test'
import assert from 'node:assert/strict'
import {buildMonthAnalytics,payoutsInMonth,recentMonths,shiftMonth} from '../src/lib/analytics.ts'
import {defaultPaySettings} from '../src/lib/salary.ts'

const shift=(date, overrides={})=>({id:date,date,start:'09:00',end:'17:00',breakMinutes:0,status:'worked',note:'',dayType:'work',plannedWorkday:true,plannedMinutes:480,additionalShifts:[],...overrides})
const settings={...defaultPaySettings,mode:'hourly',hourlyRate:10000}
test('monthly metrics count confirmed time and planned time separately, including leave',()=>{
 const shifts=[shift('2026-11-02'),shift('2026-11-03',{status:'planned'}),shift('2026-11-04',{dayType:'vacation'}),shift('2026-11-05',{status:'worked',overtimeExtra:{start:'17:00',end:'19:00',breakMinutes:0,status:'worked',basisPoints:12000}})]
 const x=buildMonthAnalytics(shifts,'2026-11',settings)
 assert.equal(x.plannedDays,4)
 assert.equal(x.workedDays,2)
 assert.equal(x.workedHours,18)
 assert.equal(x.scheduledHours,32)
 assert.equal(x.overtimeHours,2)
 assert.equal(x.vacationDays,1)
 assert.equal(x.result.gross,184000)
 assert.equal(x.weeks.reduce((s,w)=>s+w.worked,0),18)
})
test('calendar displays payout next month without mixing earnings month',()=>{
 const shifts=[shift('2026-11-02')]
 const nextMonthSettings={...settings,paymentRules:[
  {id:'salary',title:'Залишок зарплати',source:'earnings',method:'remainder',amount:0,day:10,monthOffset:1,enabled:true},
  {id:'bonus',title:'Премія',source:'bonus',method:'remainder',amount:0,day:15,monthOffset:1,enabled:true}
 ]}
 const items=payoutsInMonth(shifts,'2026-12',nextMonthSettings,{},{});
 assert.equal(items.some(x=>x.title==='Залишок зарплати' && x.date==='2026-12-10' && x.sourceMonth==='2026-11'),true)
 assert.equal(items.find(x=>x.title==='Залишок зарплати').amount,80000)
})
test('forecast marker without configured norm has unknown amount, not invented zero',()=>{
 const monthly={...defaultPaySettings,mode:'monthly',monthlySalary:3100000,monthlyNormSource:'calendar'}
 const items=payoutsInMonth([], '2026-12',monthly,{},{});
 const salary=items.find(x=>x.title==='Залишок зарплати' && x.sourceMonth==='2026-11')
 assert.equal(salary.amount,null)
})
test('month offsets and weekly grid work on year boundary and six-week month',()=>{
 assert.equal(shiftMonth('2027-01',-1),'2026-12')
 assert.deepEqual(recentMonths('2027-02',3),['2026-12','2027-01','2027-02'])
 assert.equal(buildMonthAnalytics([],'2026-11',null).weeks.length,6)
})
test('never count planned overtime as worked pay',()=>{
 const shifts=[shift('2026-11-01',{status:'planned',overtimeExtra:{start:'17:00',end:'19:00',breakMinutes:0,status:'planned',basisPoints:12000}})]
 const x=buildMonthAnalytics(shifts,'2026-11',settings)
 assert.equal(x.workedHours,0)
 assert.equal(x.result.gross,0)
})
