import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/styles/calendar-quick-jump.css',import.meta.url),'utf8')
const baseStyles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')

test('calendar returns to the pre-stage-D markup including old day badges',()=>{
  assert.match(app,/<section className="panel calendar-panel"><div className="calendar-toolbar"><div><h3 key=\{monthKey\}/)
  assert.match(app,/className="calendar-overtime" aria-label=/)
  assert.match(app,/className="calendar-payout-marker"><Wallet/)
  assert.match(app,/className="cal-legend"/)
  assert.doesNotMatch(app,/cal-day-flags|cal-worked-check|cal-today-dot|calendar-month-kicker|calendar-period-note/)
})

test('today button, month navigation and filters remain available',()=>{
  assert.match(app,/className="cal-today" onClick=\{jumpToToday\}/)
  assert.match(app,/onClick=\{\(\)=>moveMonth\(-1\)\}/)
  assert.match(app,/onClick=\{\(\)=>moveMonth\(1\)\}/)
  assert.match(app,/onClick=\{\(\)=>setCalendarFilter\(id\)\}/)
  assert.match(app,/onChange=\{e=>setShowPayouts\(e\.target\.checked\)\}/)
  assert.match(app,/onClick=\{\(\)=>select\(day\)\}/)
  assert.match(app,/aria-pressed=\{selected===date\}/)
})

test('quick jump remains tied to the selected day and the original editor',()=>{
  assert.match(app,/className="calendar-selection-bar"/)
  assert.match(app,/className="calendar-selection-copy"/)
  assert.match(app,/selectedDayStatus/)
  assert.match(app,/layout\.visible\.editor&&<button/)
  assert.match(app,/getElementById\('calendar-day-editor'\)\?\.scrollIntoView/)
  assert.match(app,/id="calendar-day-editor" className="panel editor-panel day-editor-v2"/)
})

test('only quick jump styles are imported; original calendar and Liquid Glass remain intact',()=>{
  assert.match(main,/import '\.\/styles\/calendar-quick-jump\.css'/)
  assert.doesNotMatch(main,/calendar-refresh\.css/)
  assert.match(css,/\.calendar-selection-bar/)
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/)
  assert.doesNotMatch(css,/\.cal-day|\.cal-grid|\.cal-arrows|\.calendar-toolbar|pt-optical-glass|backdrop-filter|feDisplacementMap/i)
  assert.match(baseStyles,/\.calendar-day-slot\{order:-1/)
  assert.match(main,/import '\.\/styles\/optical-glass\.css'/)
})

test('return to classic calendar does not change payroll actions',()=>{
  assert.match(app,/const quickSave = async/)
  assert.match(app,/const quickType = \(type:DayType\)/)
  assert.match(app,/const quickStatus = \(\)/)
  assert.match(app,/const quickOvertime = \(\)/)
  assert.match(app,/await onSave\(\{\.\.\.next,id:selected,date:selected\}\)/)
  assert.match(app,/onSaveDailyWage\(date,wage\)/)
  assert.match(app,/onSaveCash\(\{date,amount:cash\}\)/)
})
