import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/styles/calendar-refresh.css',import.meta.url),'utf8')
const baseStyles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')

test('stage D keeps month switch, today jump and calendar filters functional',()=>{
  assert.match(app,/onClick=\{\(\)=>moveMonth\(-1\)\}/)
  assert.match(app,/onClick=\{jumpToToday\}/)
  assert.match(app,/onClick=\{\(\)=>moveMonth\(1\)\}/)
  assert.match(app,/onClick=\{\(\)=>setCalendarFilter\(id\)\}/)
  assert.match(app,/onChange=\{e=>setShowPayouts\(e\.target\.checked\)\}/)
  assert.match(app,/onClick=\{\(\)=>select\(day\)\}/)
})

test('stage D day cells remain keyboard accessible and announce useful details',()=>{
  assert.match(app,/aria-current=\{date===toDateKey\(today\)\?'date':undefined\}/)
  assert.match(app,/aria-pressed=\{selected===date\}/)
  assert.match(app,/cal-worked-check/)
  assert.match(app,/cal-today-dot/)
  assert.match(app,/className="cal-day-flags"/)
  assert.match(app,/понаднормові/)
  assert.match(app,/є запис каси/)
  assert.match(app,/запланована виплата/)
})

test('selected date summary links back to the existing editable day form',()=>{
  assert.match(app,/className="calendar-selection-bar"/)
  assert.match(app,/className="calendar-selection-copy"/)
  assert.match(app,/selectedDayStatus/)
  assert.match(app,/layout\.visible\.editor&&<button/)
  assert.match(app,/getElementById\('calendar-day-editor'\)\?\.scrollIntoView/)
  assert.match(app,/id="calendar-day-editor" className="panel editor-panel day-editor-v2"/)
})

test('calendar refresh is scoped, responsive and keeps mobile editor first',()=>{
  assert.match(main,/import '\.\/styles\/calendar-refresh\.css'/)
  assert.match(css,/\.calendar-panel \.cal-day/)
  assert.match(css,/@media\(max-width:700px\)/)
  assert.match(css,/@media\(max-width:430px\)/)
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/)
  assert.doesNotMatch(css,/pt-optical-glass|backdrop-filter|feDisplacementMap/i)
  assert.match(baseStyles,/\.calendar-day-slot\{order:-1/)
})

test('calendar refresh leaves payroll actions and storage wiring in place',()=>{
  assert.match(app,/const quickSave = async/)
  assert.match(app,/const quickType = \(type:DayType\)/)
  assert.match(app,/const quickStatus = \(\)/)
  assert.match(app,/const quickOvertime = \(\)/)
  assert.match(app,/await onSave\(\{\.\.\.next,id:selected,date:selected\}\)/)
  assert.match(app,/onSaveDailyWage\(date,wage\)/)
  assert.match(app,/onSaveCash\(\{date,amount:cash\}\)/)
})
