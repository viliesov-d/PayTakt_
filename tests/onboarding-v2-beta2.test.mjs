import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {initialOnboardingDraft,makeOnboardingPaySettings,makeOnboardingPerformance,validateOnboardingDraft,wizardSteps} from '../src/lib/onboarding.ts'
import {calendarFeatures,isCashRelevantSector} from '../src/lib/featureVisibility.ts'
import {defaultCashPreferences} from '../src/lib/dailyCash.ts'
import {calculatePayWithPerformance,validatePerformanceSettings} from '../src/lib/performance.ts'
import {validatePaySettings} from '../src/lib/salary.ts'
const draft=(patch={})=>({...initialOnboardingDraft(new Date(2026,10,2)),sector:'retail',mode:'hourly',rate:'100',...patch})
const shift={id:'2026-11-02',date:'2026-11-02',start:'09:00',end:'19:00',breakMinutes:0,status:'worked',note:'',dayType:'work',kind:'regular',additionalShifts:[],plannedWorkday:true,plannedMinutes:480}
const result=(d,entry={})=>{
 const settings=makeOnboardingPaySettings(d),perf=makeOnboardingPerformance(d)
 return calculatePayWithPerformance([shift],'2026-11',settings,{month:'2026-11',amount:0},{month:'2026-11',count:0},perf,0,0,entry)
}
test('shop offers cash but production does not unless explicitly enabled',()=>{
 assert.equal(isCashRelevantSector('retail'),true)
 assert.equal(isCashRelevantSector('manufacturing'),false)
 const retail=calendarFeatures({...makeOnboardingPaySettings(draft()),sector:'retail'},defaultCashPreferences,makeOnboardingPerformance(draft()))
 const factory=calendarFeatures({...makeOnboardingPaySettings(draft()),sector:'manufacturing'},defaultCashPreferences,makeOnboardingPerformance(draft()))
 assert.equal(retail.cashToggle,true)
 assert.equal(factory.cashToggle,false)
 assert.equal(factory.cashEntry,false)
 assert.equal(calendarFeatures({...makeOnboardingPaySettings(draft()),sector:'manufacturing'},{enabled:true,useForSales:false},makeOnboardingPerformance(draft())).cashToggle,true)
})
test('manual pay is independent of a mandatory fixed rate, and no plan remains hidden',()=>{
 const d=draft({manualDailyPay:true,rate:'',overtime:false,overtimeMode:'none',plan:false})
 validateOnboardingDraft(d)
 const pay=makeOnboardingPaySettings(d),perf=makeOnboardingPerformance(d)
 validatePaySettings(pay);validatePerformanceSettings(perf)
 assert.equal(perf.enabled,false)
 assert.equal(perf.manualDailyPay,true)
 assert.equal(perf.defaultTarget,0)
 assert.equal(pay.hourlyRate,0)
 assert.equal(result(d,{'2026-11-02':75000}).gross,75000)
 assert.equal(result(d).gross,0)
})
test('manual wage and automatic overtime keeps ONLY additional premium above 100%',()=>{
 const d=draft({manualDailyPay:true,rate:'',overtime:true,overtimeMode:'automatic',overtimeHourlyRate:'100',overtimeAfterHours:8,overtimePercent:120})
 validateOnboardingDraft(d)
 const pay=makeOnboardingPaySettings(d)
 assert.equal(pay.bandEnabled,true)
 assert.equal(pay.bands[1].afterMinutes,480)
 assert.equal(pay.bands[1].multiplierBasisPoints,12000)
 const r=result(d,{'2026-11-02':75000})
 assert.equal(r.gross,79000) // 750 UAH manually + 2h * 100 UAH * 20%
})
test('hourly automatic overtime pays 8h at 100% and 2h at 120%',()=>{
 const d=draft({overtime:true,overtimeMode:'automatic',overtimeAfterHours:8,overtimePercent:120})
 assert.equal(result(d).gross,104000)
})
test('quick overtime button only when user chose manual overtime',()=>{
 const base=draft({overtime:false,overtimeMode:'none'})
 const p=makeOnboardingPerformance(base)
 assert.equal(calendarFeatures(makeOnboardingPaySettings(base),defaultCashPreferences,p).overtimeButton,false)
 const quick=draft({overtime:true,overtimeMode:'quick'})
 assert.equal(calendarFeatures(makeOnboardingPaySettings(quick),defaultCashPreferences,p).overtimeButton,true)
 const auto=draft({overtime:true,overtimeMode:'automatic'})
 assert.equal(calendarFeatures(makeOnboardingPaySettings(auto),defaultCashPreferences,p).overtimeButton,false)
})
test('manual overtime requires an hourly reference and does not invent a pay rate',()=>{
 const d=draft({manualDailyPay:true,rate:'',overtime:true,overtimeMode:'quick',overtimeHourlyRate:''})
 assert.throws(()=>validateOnboardingDraft(d),/базову ставку/)
 assert.equal(makeOnboardingPaySettings({...d,overtimeHourlyRate:'175'}).hourlyRate,17500)
})
test('wizard and main calendar keep context-specific UI and a dedicated overtime step',()=>{
 assert.equal(wizardSteps.length,8)
 assert.equal(wizardSteps[3],'Понаднормові')
 const ui=readFileSync(new URL('../src/components/OnboardingWizard.tsx',import.meta.url),'utf8')
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
 assert.match(ui,/Вводжу заробіток сам/)
 assert.match(ui,/Як рахувати понаднормові години/)
 assert.match(ui,/canUseCash&&<label/)
 assert.match(app,/cashPrefs\.enabled&&<label/)
 assert.match(app,/visible\.overtimeButton&&<div/)
})

test('quick overtime percent is saved into the separate calendar button preset',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
 assert.match(app,/draft\.overtimeMode!=='none'/)
 assert.match(app,/onSaveOvertimePreset\(onboardingOvertimePreset\(draft\)\)/)
})


test('manual wages plus night supplements require a reference hourly rate',()=>{
 const d=draft({manualDailyPay:true,rate:'',night:true,overtime:false,overtimeMode:'none',overtimeHourlyRate:''})
 assert.throws(()=>validateOnboardingDraft(d),/базову ставку/)
 const p=makeOnboardingPaySettings({...d,overtimeHourlyRate:'175'})
 assert.equal(p.hourlyRate,17500)
 assert.equal(p.nightEnabled,true)
})


test('manual earnings remain correct when the bonus/plan module is disabled',()=>{
 const d=draft({manualDailyPay:true,rate:'',plan:false,overtime:false,overtimeMode:'none'})
 const p=makeOnboardingPerformance(d)
 assert.equal(p.enabled,false)
 assert.equal(calculatePayWithPerformance([shift],'2026-11',makeOnboardingPaySettings(d),{month:'2026-11',amount:0},{month:'2026-11',count:0},p,0,0,{'2026-11-02':35000}).gross,35000)
})
