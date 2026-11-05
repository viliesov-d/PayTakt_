import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {markWorkedForDailyPay,changeDayType} from '../src/lib/dayActions.ts'
import {defaultOvertimePreset,workedHours} from '../src/lib/calendar.ts'
import {defaultCalendarLayout,makeCalendarLayoutPreset,isCalendarLayoutPreset,moveCalendarBlock,sanitizeCalendarLayout} from '../src/lib/calendarLayout.ts'

const day=()=>({id:'2026-11-05',date:'2026-11-05',start:'09:00',end:'18:00',breakMinutes:60,status:'planned',note:'',dayType:'work',kind:'regular',plannedWorkday:true,plannedMinutes:480,additionalShifts:[],overtimeMinutes:0})

test('combined save marks planned shift worked, then preserves worked status on re-save',()=>{
  const worked=markWorkedForDailyPay(day())
  assert.equal(worked.status,'worked')
  assert.equal(workedHours(worked),8)
  const updated=markWorkedForDailyPay({...worked,note:'Зміни після першого збереження'})
  assert.equal(updated.status,'worked')
  assert.equal(updated.note,'Зміни після першого збереження')
  assert.equal(workedHours(updated),8)
})

test('combined action confirms preset overtime and does not undo it',()=>{
  const planned={...day(),overtimeExtra:{...defaultOvertimePreset,status:'planned'}}
  const worked=markWorkedForDailyPay(planned)
  assert.equal(worked.overtimeExtra.status,'worked')
  const workedAgain=markWorkedForDailyPay(worked)
  assert.equal(workedAgain.overtimeExtra.status,'worked')
})

test('combined action rejects absence days rather than silently recording hours',()=>{
  assert.throws(()=>markWorkedForDailyPay(changeDayType(day(),'off')),/робочий день/)
})

test('three layout presets are meaningful, non-destructive, and detectable',()=>{
  const full=makeCalendarLayoutPreset('full')
  const compact=makeCalendarLayoutPreset('compact')
  const minimal=makeCalendarLayoutPreset('calendar')
  assert.deepEqual(full,defaultCalendarLayout)
  assert.equal(compact.visible.metrics,false)
  assert.equal(compact.visible.plan,true)
  assert.equal(compact.visible.editor,true)
  assert.deepEqual(minimal.visible,{plan:false,metrics:false,editor:false})
  assert.equal(isCalendarLayoutPreset(full,'full'),true)
  assert.equal(isCalendarLayoutPreset(compact,'full'),false)
  assert.equal(isCalendarLayoutPreset(moveToTop(compact),'compact'),false)
})
function moveToTop(value){
  return sanitizeCalendarLayout({...value,order:moveCalendarBlock(value.order,'metrics',-1)})
}

test('manual pay and cash share one primary save-worked action; simple toggle is hidden in that mode',()=>{
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
  const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')
  assert.match(app,/const saveDayMoney=async\(e:FormEvent<HTMLFormElement>\)/)
  assert.match(app,/const next=markWorkedForDailyPay/)
  assert.match(app,/await onSave\(next\)/)
  assert.match(app,/await onSaveDailyWage\(date,wage\)/)
  assert.match(app,/await onSaveCash\(\{date,amount:cash\}\)/)
  assert.match(app,/\{!\(performance\.manualDailyPay\|\|cashPrefs\.enabled\)&&<div className="day-action-section">/)
  assert.match(app,/Зберегти й відмітити/)
  assert.match(app,/Зберегти зміни/)
  assert.match(css,/\.day-money-submit/)
})

test('layout editor includes presets, explicit order buttons, visibility toggles and reset',()=>{
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
  const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')
  assert.match(app,/Налаштуй календар під себе/)
  assert.match(app,/Змін[иа] зберігаються автоматично/)
  assert.match(app,/makeCalendarLayoutPreset/)
  assert.match(app,/Підняти \$\{titles\[id\]\}/)
  assert.match(app,/Опустити \$\{titles\[id\]\}/)
  assert.match(css,/\.calendar-layout-presets/)
  assert.match(css,/\.calendar-layout-switch-track/)
})
