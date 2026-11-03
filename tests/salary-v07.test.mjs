import test from 'node:test'
import assert from 'node:assert/strict'
import {calculatePay,defaultPaySettings,normalizePaySettings,validatePaymentRules} from '../src/lib/salary.ts'
import {calculatePaymentForecast,paymentDate} from '../src/lib/payments.ts'

const shift=(date,hours=8)=>({id:date,date,start:'08:00',end:`${String(8+hours).padStart(2,'0')}:00`,breakMinutes:0,status:'worked',note:'',dayType:'work',kind:'regular',additionalShifts:[]})
const norm=()=>({...defaultPaySettings,mode:'monthly',monthlySalary:3_100_000,monthlyNormDays:20,monthlyNormSource:'manual',monthlyBaseMinutesPerDay:480,monthlyAccrualBasis:'days',monthlyAutoHourlyRate:true,monthlyOvertimeMode:'full',bandEnabled:true,bandPeriod:'day',bands:[{id:'base',afterMinutes:0,multiplierBasisPoints:10000},{id:'overtime',afterMinutes:480,multiplierBasisPoints:12000}]})
const many=()=>Array.from({length:20},(_,i)=>shift(`2026-11-${String(i+1).padStart(2,'0')}`))
const gross=(shifts,settings)=>calculatePay(shifts,'2026-11',settings)
test('31 000 monthly for 20 eight-hour days: per day 1 550, reference hourly 193.75, extra two hours at 120% = 465',()=>{
 const r=gross([shift('2026-11-01',10)],norm())
 assert.equal(r.lines.find(x=>x.code==='base').amount,155000)
 assert.equal(r.lines.find(x=>x.code==='tier:overtime').amount,46500)
 assert.equal(r.gross,201500)
})
test('monthly salary does not pay overtime for regular 8-hour day',()=>{
 assert.equal(gross([shift('2026-11-01')],norm()).gross,155000)
})
test('two days, one normal and another ten hours, supplement is not doubled',()=>{
 assert.equal(gross([shift('2026-11-01'),shift('2026-11-02',10)],norm()).gross,356500)
})
test('premium-only monthly mode preserves +20% instead of full 120%',()=>{
 assert.equal(gross([shift('2026-11-01',10)],{...norm(),monthlyOvertimeMode:'premium'}).gross,162750)
})
test('manually assigned hourly reference is supported',()=>{
 assert.equal(gross([shift('2026-11-01',10)],{...norm(),monthlyAutoHourlyRate:false,hourlyRate:20000}).gross,203000)
})
test('month salary may be proportional to capped standard paid minutes',()=>{
 const s={...norm(),monthlyAccrualBasis:'hours',bandEnabled:false}
 assert.equal(gross([shift('2026-11-01',4)],s).gross,77500)
 assert.equal(gross([shift('2026-11-01',10)],s).gross,155000)
})
test('fixed 10k advance, remaining salary and bonus paid same day next month',()=>{
 const settings={...norm(),bandEnabled:false,monthlyBonus:200000,paymentRules:[
  {id:'advance',title:'Аванс',source:'earnings',method:'fixed',amount:1000000,day:20,monthOffset:0,enabled:true},
  {id:'salary',title:'Зарплата',source:'earnings',method:'remainder',amount:0,day:10,monthOffset:1,enabled:true},
  {id:'bonus',title:'Премія',source:'bonus',method:'remainder',amount:0,day:10,monthOffset:1,enabled:true},
 ]}
 const shifts=many(),result=gross(shifts,settings),f=calculatePaymentForecast(shifts,'2026-11',settings,result)
 assert.equal(result.gross,3300000)
 assert.deepEqual(f.events.map(x=>[x.date,x.amount]),[['2026-11-20',1000000],['2026-12-10',200000],['2026-12-10',2100000]])
 assert.equal(f.unallocatedEarnings+f.unallocatedBonuses,0)
})
test('first-half advance and bonus separately, salary remainder next month',()=>{
 const settings={...norm(),bandEnabled:false,monthlyBonus:200000}
 const shifts=many(),r=gross(shifts,settings),f=calculatePaymentForecast(shifts,'2026-11',settings,r)
 assert.equal(f.firstHalfEarnings,2325000)
 assert.deepEqual(f.events.map(x=>[x.date,x.amount]),[['2026-11-25',2325000],['2026-12-10',775000],['2026-12-15',200000]])
 assert.equal(f.events.reduce((s,x)=>s+x.amount,0),r.gross)
})
test('February payout date is clamped to last calendar date',()=>{
 assert.equal(paymentDate('2027-01',1,31),'2027-02-28')
 assert.equal(paymentDate('2028-01',1,31),'2028-02-29')
})
test('advance larger than accrued salary does not create imaginary payout',()=>{
 const settings={...norm(),bandEnabled:false,paymentRules:[
 {id:'advance',title:'Аванс',source:'earnings',method:'fixed',amount:4000000,day:20,monthOffset:0,enabled:true},
 {id:'salary',title:'Залишок',source:'earnings',method:'remainder',amount:0,day:10,monthOffset:1,enabled:true},
 {id:'bonus',title:'Премії',source:'bonus',method:'remainder',amount:0,day:10,monthOffset:1,enabled:true},
 ]}
 const shifts=many(),r=gross(shifts,settings),f=calculatePaymentForecast(shifts,'2026-11',settings,r)
 assert.equal(f.events.find(x=>x.id==='advance').amount,3100000)
 assert.equal(f.events.find(x=>x.id==='advance').shortfall,900000)
 assert.equal(f.events.find(x=>x.id==='salary').amount,0)
})
test('percent advance followed by remaining salary gives entire gross exactly once',()=>{
 const settings={...norm(),bandEnabled:false,paymentRules:[
 {id:'advance',title:'40%',source:'earnings',method:'percent',amount:4000,day:25,monthOffset:0,enabled:true},
 {id:'salary',title:'Залишок',source:'earnings',method:'remainder',amount:0,day:10,monthOffset:1,enabled:true},
 {id:'bonus',title:'Премія',source:'bonus',method:'remainder',amount:0,day:10,monthOffset:1,enabled:true},
 ]}
 const shifts=many(),r=gross(shifts,settings),f=calculatePaymentForecast(shifts,'2026-11',settings,r)
 assert.deepEqual(f.events.map(x=>x.amount).sort((a,b)=>a-b),[0,1240000,1860000])
})
test('remainder must be last for its source and day must be valid',()=>{
 const wrong=[...norm().paymentRules,{id:'late',title:'Заборонений',source:'earnings',method:'fixed',amount:100,day:10,monthOffset:0,enabled:true}]
 assert.throws(()=>validatePaymentRules(wrong),/останньою/)
 assert.throws(()=>validatePaymentRules(norm().paymentRules.map(x=>({...x,day:32}))),/дату/)
})
test('version 3 salary policy migrates to version 4 and premium mode without losing settings',()=>{
 const old={...norm(),version:3,monthlyOvertimeMode:undefined,monthlyBaseMinutesPerDay:undefined,paymentRules:undefined}
 delete old.monthlyOvertimeMode;delete old.monthlyBaseMinutesPerDay;delete old.paymentRules
 const next=normalizePaySettings(old)
 assert.equal(next.version,5)
 assert.equal(next.monthlyOvertimeMode,'premium')
 assert.equal(next.monthlyAutoHourlyRate,false)
 assert.equal(next.monthlyBaseMinutesPerDay,480)
 assert.equal(next.paymentRules.length,3)
})

test('an elevated first band adds only its premium above an existing monthly salary',()=>{
 const settings={...norm(),bands:[{id:'base',afterMinutes:0,multiplierBasisPoints:11000},{id:'overtime',afterMinutes:480,multiplierBasisPoints:12000}]}
 const result=gross([shift('2026-11-01',10)],settings)
 assert.equal(result.gross,155000+15500+46500)
})
