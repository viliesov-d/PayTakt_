import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {initialOnboardingDraft,visibleWizardSteps,makeOnboardingPaySettings,onboardingOvertimePreset,onboardingCalendarDays,previewOnboardingSchedule,validateOnboardingDraft,overtimeDailyMinutes} from '../src/lib/onboarding.ts'
import {validatePaySettings} from '../src/lib/salary.ts'
import {validateOvertimePreset} from '../src/lib/calendar.ts'

const base=(patch={})=>({...initialOnboardingDraft(new Date(2026,10,1)),sector:'retail',mode:'monthly',rate:'31000',...patch})

test('daily overtime follow-up is shown only if overtime is selected',()=>{
 assert.equal(visibleWizardSteps('none').length,7)
 assert.equal(visibleWizardSteps('none').includes('Години понаднормових'),false)
 assert.equal(visibleWizardSteps('quick').length,8)
 assert.equal(visibleWizardSteps('automatic')[4],'Години понаднормових')
})
test('quick overtime duration and percent become real calendar preset, not just UI copy',()=>{
 const d=base({overtimeMode:'quick',overtime:true,overtimeHoursPerDay:2.5,overtimePercent:150,end:'18:00'})
 const preset=onboardingOvertimePreset(d)
 assert.deepEqual(preset,{start:'18:00',end:'20:30',breakMinutes:0,basisPoints:15000})
 validateOvertimePreset(preset)
 const pay=makeOnboardingPaySettings(d)
 assert.equal(pay.overtimeEntryMode,'marked')
 assert.equal(pay.markedOvertimeBasisPoints,15000)
 assert.equal(pay.monthlySalary,3100000)
 validatePaySettings(pay)
})
test('overnight shifts preserve overtime hours across midnight',()=>{
 const d=base({overtimeMode:'quick',overtime:true,overtimeHoursPerDay:3,start:'20:00',end:'05:00'})
 const preset=onboardingOvertimePreset(d)
 assert.equal(preset.start,'05:00')
 assert.equal(preset.end,'08:00')
 validateOvertimePreset(preset)
})
test('automatic overtime extends scheduled worked hours without inflating planned salary norm',()=>{
 const d=base({overtimeMode:'automatic',overtime:true,overtimeAfterHours:8,overtimeHoursPerDay:2,overtimePercent:120})
 const days=previewOnboardingSchedule(d,new Date(2026,10,2))
 const monday=days.find(x=>x.date==='2026-11-02')
 assert.equal(monday.start,'09:00');assert.equal(monday.end,'20:00')
 assert.equal(monday.plannedMinutes,480)
 const settings=makeOnboardingPaySettings(d)
 assert.equal(settings.monthlyBaseMinutesPerDay,480)
 assert.equal(settings.bands[1].afterMinutes,480)
 assert.equal(settings.overtimeThresholdMinutes,480)
 const holiday=days.find(x=>x.date==='2026-11-01')
 assert.equal(holiday.dayType,'off')
 validatePaySettings(settings)
})
test('no overtime leaves regular eight-hour shifts and hides follow-up even if draft has old extra hours',()=>{
 const d=base({overtimeMode:'none',overtime:false,overtimeHoursPerDay:8})
 const monday=previewOnboardingSchedule(d,new Date(2026,10,2)).find(x=>x.date==='2026-11-02')
 assert.equal(monday.end,'18:00')
 assert.equal(monday.plannedMinutes,480)
 assert.equal(makeOnboardingPaySettings(d).overtimeEnabled,false)
})
test('invalid overtime values are caught before a database write',()=>{
 for(const bad of [-1,0,0.25,12.5,NaN,Infinity]){
  const d=base({overtimeMode:'quick',overtime:true,overtimeHoursPerDay:bad})
  assert.throws(()=>validateOnboardingDraft(d),/0,5 до 12/)
 }
 assert.equal(overtimeDailyMinutes(base({overtimeHoursPerDay:1.5})),90)
})
test('24-hour duty cannot silently spill extra hours into a second day',()=>{
 const d=base({preset:'duty-24-72',overtimeMode:'automatic',overtime:true,overtimeHoursPerDay:2})
 assert.throws(()=>previewOnboardingSchedule(d,new Date(2026,10,2)),/Добова зміна/)
})
test('interface and advanced settings expose applied values and animated disclosure',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
 const wizard=readFileSync(new URL('../src/components/OnboardingWizard.tsx',import.meta.url),'utf8')
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')
 assert.match(app,/onboardingCalendarDays\(draft,month,anchor\)/)
 assert.match(app,/onSaveOvertimePreset\(onboardingOvertimePreset\(draft\)\)/)
 assert.match(app,/className="v2-settings-links"/)
 assert.match(app,/className="v2-extra-features"/)
 assert.match(wizard,/Скільки годин понаднормових на добу/)
 assert.match(css,/details\[open\] > :not\(summary\)/)
 assert.match(css,/prefers-reduced-motion:reduce/)
})
