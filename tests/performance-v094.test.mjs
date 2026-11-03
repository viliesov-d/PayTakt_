import test from 'node:test'
import assert from 'node:assert/strict'
import {calculatePayWithPerformance,performanceProgress,validatePerformanceSettings,planTarget,zminaPerformancePreset,defaultPerformanceSettings} from '../src/lib/performance.ts'
import {defaultPaySettings} from '../src/lib/salary.ts'
const month='2026-11'
const base={...defaultPaySettings,mode:'hourly',hourlyRate:10000}
const shift={id:'2026-11-02',date:'2026-11-02',start:'09:00',end:'17:00',breakMinutes:0,status:'worked',note:'',dayType:'work',kind:'regular',additionalShifts:[],plannedWorkday:true,plannedMinutes:480}
const perf={...zminaPerformancePreset,defaultTarget:25000000}
test('zmina tier pays once at 100%, excludes at 99%',()=>{
 const no=calculatePayWithPerformance([shift],month,base,{month,amount:0},{month,count:0},perf,25000000,24999999)
 const yes=calculatePayWithPerformance([shift],month,base,{month,amount:0},{month,count:0},perf,25000000,25000000)
 assert.equal(no.gross,80000);assert.equal(yes.gross,280000)
 assert.equal(yes.lines.filter(l=>l.code==='performance-plan').length,1)
})
test('tier milestones highest only, not cumulative',()=>{
 const p={...perf,tiers:[{id:'a',thresholdBasisPoints:8000,bonus:100000},{id:'b',thresholdBasisPoints:10000,bonus:200000},{id:'c',thresholdBasisPoints:12000,bonus:300000}]}
 const v=calculatePayWithPerformance([shift],month,base,{month,amount:0},{month,count:0},p,1000000,1200000)
 assert.equal(v.gross,380000)
})
test('disabled preserves existing sales plan reward and original pay',()=>{
 const pay={...base,salesPlan:100, salesPlanBonus:5000}
 const v=calculatePayWithPerformance([shift],month,pay,{month,amount:100},{month,count:0},defaultPerformanceSettings,100,100)
 assert.equal(v.lines.find(x=>x.code==='sales-plan')?.amount,5000)
})
test('enabled module avoids legacy goal bonuses but preserves commissions',()=>{
 const pay={...base,salesPlan:100,salesPlanBonus:5000,salesCommissionBasisPoints:1000,unitPlan:1,unitPlanBonus:5000}
 const v=calculatePayWithPerformance([shift],month,pay,{month,amount:10000},{month,count:1},perf,10000,10000)
 assert.equal(v.lines.find(x=>x.code==='sales-plan'),undefined)
 assert.equal(v.lines.find(x=>x.code==='unit-plan'),undefined)
 assert.equal(v.lines.find(x=>x.code==='commission')?.amount,1000)
})
test('work units & salary metric',()=>{
 const basePay=calculatePayWithPerformance([shift],month,base)
 const unit=performanceProgress(basePay,{...perf,metric:'units'},3,100000)
 assert.equal(unit.actual,0)
 const earned=performanceProgress(basePay,{...perf,metric:'earnings'},80000,0)
 assert.equal(earned.bonus,200000)
})
test('per-month target overrides default including zero',()=>{
 assert.equal(planTarget(month,perf,{[month]:0}),0)
 assert.equal(planTarget(month,perf,{}),25000000)
})
test('invalid thresholds and targets rejected',()=>{
 assert.throws(()=>validatePerformanceSettings({...perf,tiers:[{id:'a',thresholdBasisPoints:12000,bonus:1},{id:'b',thresholdBasisPoints:9000,bonus:1}]}))
})

test('manual day wage replaces base; overtime supplement remains',()=>{
 const perfManual={...perf,manualDailyPay:true}
 const result=calculatePayWithPerformance([shift],month,{...base,monthlyBonus:10000},{month,amount:0},{month,count:0},perfManual,0,0,{'2026-11-02':35000})
 assert.equal(result.lines.find(x=>x.code==='manual-day')?.amount,35000)
 assert.equal(result.lines.some(x=>x.code==='base'),false)
 assert.equal(result.gross,45000)
})
test('manual day wage only for worked shift and 0 allowed',()=>{
 const manual={...perf,manualDailyPay:true}
 const planned={...shift,status:'planned'}
 const v=calculatePayWithPerformance([planned],month,base,{month,amount:0},{month,count:0},manual,0,0,{'2026-11-02':35000})
 assert.equal(v.gross,0)
 const zero=calculatePayWithPerformance([shift],month,base,{month,amount:0},{month,count:0},manual,0,0,{'2026-11-02':0})
 assert.equal(zero.gross,0)
})

test('performance bonus is allocated once to next-month 15th payday',async()=>{
 const {buildMonthAnalytics,payoutsInMonth}=await import('../src/lib/analytics.ts')
 const settings={...base}
 const plan={...perf,defaultTarget:1000000}
 const metrics=buildMonthAnalytics([shift],month,settings,0,0,plan,1000000,1200000)
 assert.equal(metrics.result?.gross,280000)
 assert.equal(metrics.forecast?.bonuses,200000)
 assert.equal(metrics.forecast?.events.find(e=>e.source==='bonus')?.date,'2026-12-15')
 const payouts=payoutsInMonth([shift],'2026-12',settings,{}, {},plan,{[month]:1000000},{[month]:1200000})
 assert.equal(payouts.find(e=>e.title==='Премії')?.amount,200000)
})
test('first half advance includes manual earnings entered before 15th',async()=>{
 const {buildMonthAnalytics}=await import('../src/lib/analytics.ts')
 const manual={...perf,manualDailyPay:true,defaultTarget:0}
 const metrics=buildMonthAnalytics([shift],month,base,0,0,manual,0,0,{'2026-11-02':75000})
 assert.equal(metrics.result?.gross,75000)
 assert.equal(metrics.forecast?.firstHalfEarnings,75000)
 assert.equal(metrics.forecast?.events.find(e=>e.id==='advance')?.amount,75000)
})
test('firestore owner-only rules exist for performance goals and daily wages',async()=>{
 const {readFileSync}=await import('node:fs')
 const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')
 assert.match(rules,/match \/monthlyTargets\/\{month\}/)
 assert.match(rules,/match \/dailyWages\/\{date\}/)
 assert.match(rules,/settingsId == 'performance'/)
 assert.match(rules,/ownWorkspace\(workspaceId\)/)
 assert.doesNotMatch(rules,/allow\s+read,\s*write\s*:\s*if\s+true/)
})

test('manual daily wage keeps hourly overtime tier premium, not double base',()=>{
 const longShift={...shift,end:'19:00'} // 10 hours
 const pay={...base,bandEnabled:true,bandPeriod:'day',bands:[{id:'base',afterMinutes:0,multiplierBasisPoints:10000},{id:'plus',afterMinutes:480,multiplierBasisPoints:12000}]}
 const manual={...perf,manualDailyPay:true,defaultTarget:0}
 const result=calculatePayWithPerformance([longShift],month,pay,{month,amount:0},{month,count:0},manual,0,0,{'2026-11-02':75000})
 assert.equal(result.lines.find(l=>l.code==='manual-tier-premium')?.amount,4000)
 assert.equal(result.gross,79000)
})
